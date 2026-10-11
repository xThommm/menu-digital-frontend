import { useSpooky } from "../../../../hooks/useHalloween";
import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { useAuth } from "../../../../context/useAuth";
import { useNotifications } from "../../../../context/useNotifications";
import { getPlanFeatureLabels, isSubscriptionExpired, PLAN_LABEL } from "../../../../lib/plans";
import type { DashData } from "../../../../types";
import { usePlans } from "../../../../hooks/usePlans";
import { formatDateAR } from "../../../../lib/dates";
import { formatReservationDate, todayBuenosAires } from "../../../../features/reservations/lib/format";
import UpgradeModal from "../../../Common/UpgradeModal";
import { CalendarCheck, ChartColumn, ClipboardList, Eye, LayoutGrid, Sparkles, UtensilsCrossed } from "lucide-react";
import { daysUntil, formatCount } from "./todayActivity";
import { useTodayActivity } from "./useTodayActivity";
import {
  AgendaCard, Gauge, KpiStat, LockedChartCard, OrdersBarsCard, OrdersTable, QuickTile, VisitsChartCard,
  type Kpi,
} from "./DashboardWidgets";
import s from "./UserDashboard.module.css";

// Con menos de estos días de vigencia, el plan vuelve a destacarse en el inicio.
const PLAN_WARNING_DAYS = 14;

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Buen día";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserDashboard() {
  const spooky = useSpooky();
  const { token, user, isLoading, refreshUser, logout } = useAuth();
  const catalog = usePlans();
  const {
    success: notifySuccess,
    error: notifyError,
    info: notifyInfo,
  } = useNotifications();
  const navigate = useNavigate();
  const subscriptionExpired = user
    ? isSubscriptionExpired(user.subscription, user.subscriptionExpiresAt, user.subscriptionStatus)
    : false;
  const previousPlanLabel = user?.previousSubscription
    ? PLAN_LABEL[user.previousSubscription]
    : null;
  const previousPlanText = previousPlanLabel ? `plan ${previousPlanLabel}` : "plan pago";
  const downgradeDate = user?.downgradedAt || user?.subscriptionExpiresAt;
  const downgradeDateLabel = downgradeDate && Number.isFinite(new Date(downgradeDate).getTime())
    ? formatDateAR(downgradeDate)
    : "";
  const effectiveSubscription = subscriptionExpired ? "free" : (user?.subscription ?? "free");
  const currentPlan = catalog.isError
    ? undefined
    : catalog.data?.find(plan => plan.name === effectiveSubscription);
  const canDownloadQr = currentPlan?.features.qr === true;

  // Momento de referencia para el saludo, la fecha y los días que le quedan al
  // plan. Se renueva al volver a la pestaña, igual que los datos de "Hoy":
  // si no, pasada la medianoche el título quedaría con la fecha de ayer.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  const planDaysLeft = subscriptionExpired ? null : daysUntil(user?.subscriptionExpiresAt, now.getTime());
  const planExpiringSoon = effectiveSubscription !== "free" && planDaysLeft !== null && planDaysLeft <= PLAN_WARNING_DAYS;
  // Un plan pago y al día no necesita una tarjeta entera: queda como una
  // línea al final. La tarjeta grande es para cuando hay algo que hacer.
  const planNeedsAttention = subscriptionExpired || effectiveSubscription === "free" || planExpiringSoon;

  const isPro = effectiveSubscription === "pro";
  const activity = useTodayActivity({
    token: isLoading ? null : token,
    visits: currentPlan?.features.estadisticas === true,
    orders: isPro,
    reservations: isPro,
  });

  const [data, setData]     = useState<DashData | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [qrMenuOpen, setQrMenuOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [qrMenuPos, setQrMenuPos] = useState<{ top: number; left: number } | null>(null);
  const qrMenuWrapRef = useRef<HTMLDivElement>(null);
  const qrMenuPortalRef = useRef<HTMLDivElement>(null);

  // MercadoPago puede redirigir antes de que llegue su webhook. Al volver de
  // un pago aprobado refrescamos el usuario y reintentamos unos segundos si
  // el plan todavía no cambió; cuando llega el webhook se actualizan juntos
  // AuthContext y localStorage, evitando que el banner Free quede obsoleto.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (!paymentStatus || !token) return;

    window.history.replaceState({}, "", window.location.pathname);
    if (paymentStatus === "failure") {
      notifyError("El pago no se completó. Podés volver a intentarlo.");
      return;
    } else if (paymentStatus === "pending") {
      notifyInfo("El pago está pendiente. Tu plan se actualizará cuando se acredite.");
      return;
    }
    notifyInfo("Pago aprobado. Estamos actualizando tu plan.");

    let cancelled = false;
    const previousPlan = user?.subscription;
    const previousExpiry = user?.subscriptionExpiresAt;

    const syncPayment = async () => {
      const attempts = 6;
      for (let attempt = 0; attempt < attempts && !cancelled; attempt += 1) {
        const refreshed = await refreshUser();
        if (refreshed && (
          refreshed.subscription !== previousPlan
          || refreshed.subscriptionExpiresAt !== previousExpiry
        )) {
          notifySuccess("Tu plan quedó actualizado correctamente.");
          return;
        }
        if (attempt < attempts - 1) {
          await new Promise(resolve => window.setTimeout(resolve, 1000));
        }
      }
    };

    syncPayment().catch(() => {
      if (!cancelled) {
        notifyError("No pudimos verificar la actualización del plan. Intentá recargar la página.");
      }
    });
    return () => { cancelled = true; };
  }, [
    notifyError,
    notifyInfo,
    notifySuccess,
    refreshUser,
    token,
    user?.subscription,
    user?.subscriptionExpiresAt,
  ]);

  useEffect(() => {
    if (isLoading) return;
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/users/me/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          logout();
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("No se pudo cargar el resumen del negocio.");
        const json = await res.json();
        if (cancelled) return;
        setData({
          businessName:  json.contactInfo?.businessName ?? "",
          slug:          json.slug ?? "",
          hasDelivery:   json.hasDelivery ?? false,
          hasTakeAway:   json.hasTakeAway ?? false,
          template:      json.template ?? 1,
          itemCount:     json.itemCount ?? 0,
          categoryCount: json.categoryCount ?? 0,
          backgroundPicture: json.media?.backgroundPicture || null,
        });
      } catch {
        if (!cancelled) {
          notifyError("No pudimos cargar el resumen del negocio. Intentá recargar la página.");
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token, isLoading, notifyError, logout]);

  // El slug ya está disponible al instante vía AuthContext (localStorage, sin
  // red) — se prioriza sobre data.slug para no atar el link ni la vista previa
  // (más abajo) al fetch de /users/me/summary, que tarda mucho más y solo
  // aporta datos secundarios (stats, nombre, delivery). data.slug queda como
  // fallback por si el user de sesión no lo trajera por algún motivo.
  const slug = user?.slug || data?.slug;
  const publicUrl = slug
    ? `${window.location.origin}/${slug}`
    : null;

  const handleCopy = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notifySuccess("Enlace copiado.");
    } catch {
      notifyError("No se pudo copiar el enlace.");
    }
  }, [notifyError, notifySuccess, publicUrl]);

  const handleOpen = useCallback(() => {
    if (!publicUrl) return;
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }, [publicUrl]);

  // Cierra el menú de formato (PNG/PDF) al hacer click o tap afuera —
  // mismo patrón que el menú mobile de AdminHome.tsx. El menú se renderiza
  // en un portal (ver más abajo) así que se chequean los dos refs: el botón
  // que lo abre y el propio menú, que no son parientes en el DOM.
  useEffect(() => {
    if (!qrMenuOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        qrMenuWrapRef.current && !qrMenuWrapRef.current.contains(target) &&
        qrMenuPortalRef.current && !qrMenuPortalRef.current.contains(target)
      ) {
        setQrMenuOpen(false);
      }
    };
    // El menú es position:fixed posicionado a mano — más simple cerrarlo
    // al scrollear que recalcular su posición en cada evento de scroll.
    const handleScroll = () => setQrMenuOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [qrMenuOpen]);

  // Genera el QR en el navegador (nada se manda a un servicio externo).
  // Apunta directo a la carta (no a la landing) porque en el uso real — QR
  // pegado en la mesa — el cliente quiere ver el menú, no una página de
  // presentación. ?src=qr separa en las estadísticas las visitas que llegan
  // escaneando de las que llegan por un link compartido (la carta lo saca
  // de la URL apenas lo lee).
  const generateQrDataUrl = useCallback(() => {
    if (!publicUrl || !canDownloadQr) return null;
    return QRCode.toDataURL(`${publicUrl}/menu?src=qr`, {
      width: 1024,
      margin: 2,
      color: { dark: "#1a1208", light: "#ffffffff" },
    });
  }, [publicUrl, canDownloadQr]);

  const handleDownloadQr = useCallback(async (format: "png" | "pdf") => {
    if (!publicUrl || generatingQr || !canDownloadQr) return;
    setQrMenuOpen(false);
    setGeneratingQr(true);
    try {
      const dataUrl = await generateQrDataUrl();
      if (!dataUrl) return;
      const filename = `qr-menu-${data?.slug ?? "carta"}`;

      if (format === "png") {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${filename}.png`;
        a.click();
      } else {
        // PDF en A4 con el QR centrado y el nombre del local como
        // referencia — pensado para imprimir y pegar en la mesa.
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const qrSize = 100;
        const x = (pageWidth - qrSize) / 2;
        const y = 70;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text(data?.businessName ?? "Menú digital", pageWidth / 2, y - 15, { align: "center" });

        pdf.addImage(dataUrl, "PNG", x, y, qrSize, qrSize);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(120);
        pdf.text("Escaneá el código para ver el menú", pageWidth / 2, y + qrSize + 12, { align: "center" });

        pdf.save(`${filename}.pdf`);
      }
      notifySuccess(`QR descargado en ${format.toUpperCase()}.`);
    } catch {
      notifyError("No se pudo generar el QR. Intentá de nuevo.");
    } finally {
      setGeneratingQr(false);
    }
  }, [
    publicUrl,
    data,
    generatingQr,
    setQrMenuOpen,
    setGeneratingQr,
    canDownloadQr,
    generateQrDataUrl,
    notifyError,
    notifySuccess,
  ]);

  const displayName = data?.businessName;
  const todayLabel = formatReservationDate(todayBuenosAires(now));

  const planActionLabel = subscriptionExpired
    ? "Renovar plan"
    : user?.subscription === "free"
      ? "Mejorar plan"
      : user?.subscription === "basic"
        ? "Renovar o pasar a Pro"
        : "Renovar plan";
  const planName = user ? currentPlan?.label ?? PLAN_LABEL[user.subscription] : "";
  const openUpgrade = () => setUpgradeOpen(true);

  // ── Cifras del encabezado ──
  // Primero lo que pasa hoy (pedidos, reservas, visitas) según el plan;
  // después la carta, hasta completar cuatro.
  const kpis: Kpi[] = [];
  if (activity.orders !== null) {
    kpis.push({
      key: "orders", icon: <ClipboardList size={13} strokeWidth={1.75} />, label: "Pedidos en curso",
      value: activity.orders === undefined ? undefined : activity.orders.shiftOpen ? activity.orders.active : null,
      onClick: () => navigate("/pedidos"),
    });
  }
  if (activity.reservations !== null) {
    kpis.push({
      key: "reservations", icon: <CalendarCheck size={13} strokeWidth={1.75} />, label: "Reservas hoy",
      value: activity.reservations?.today, onClick: () => navigate("/reservas"),
    });
  }
  if (activity.visits !== null) {
    kpis.push({
      key: "visits", icon: <Eye size={13} strokeWidth={1.75} />, label: "Visitas hoy",
      value: activity.visits?.today, onClick: () => navigate("/estadisticas"),
    });
  }
  kpis.push({
    key: "items", icon: <UtensilsCrossed size={13} strokeWidth={1.75} />, label: "Productos",
    value: data?.itemCount, onClick: () => navigate("/menu/editor"),
  });
  if (kpis.length < 4) {
    kpis.push({
      key: "categories", icon: <LayoutGrid size={13} strokeWidth={1.75} />, label: "Categorías",
      value: data?.categoryCount, onClick: () => navigate("/menu/editor"),
    });
  }
  if (kpis.length < 4 && activity.visits !== null) {
    kpis.push({
      key: "week", icon: <ChartColumn size={13} strokeWidth={1.75} />, label: "Visitas en 7 días",
      value: activity.visits?.week, onClick: () => navigate("/estadisticas"),
    });
  }

  const planAlert = subscriptionExpired
    ? downgradeDateLabel
      ? `Tu ${previousPlanText} venció el ${downgradeDateLabel}. Tu cuenta pasó al plan Gratis.`
      : `Tu ${previousPlanText} venció y tu cuenta pasó al plan Gratis.`
    : planExpiringSoon && planDaysLeft !== null
      ? `Tu plan ${planName} ${planDaysLeft <= 0 ? "vence hoy" : planDaysLeft === 1 ? "vence mañana" : `vence en ${planDaysLeft} días`}. Renovalo para no perder sus funciones.`
      : null;

  const ordersModes = data
    ? data.hasDelivery && data.hasTakeAway
      ? "Delivery y take away"
      : data.hasDelivery ? "Solo delivery" : data.hasTakeAway ? "Solo take away" : "Sin delivery ni take away"
    : "—";
  // Versión corta para la tarjeta de acceso, donde el valor va en grande.
  const ordersModesShort = data
    ? data.hasDelivery && data.hasTakeAway
      ? "Activos"
      : data.hasDelivery ? "Solo delivery" : data.hasTakeAway ? "Solo take away" : "Apagados"
    : "—";

  return (
    <div className={s.root}>
      <main className={s.main}>

        {/* ── Encabezado: saludo, cifras del día y medidor ───────────────── */}
        <section className={s.header} aria-label="Resumen">
          {data?.backgroundPicture && (
            <div className={s.headerPhoto} style={{ backgroundImage: `url(${data.backgroundPicture})` }} aria-hidden />
          )}
          <div className={s.headerGlow} aria-hidden />

          <div className={s.headerMain}>
            <div className={s.headerTop}>
              <nav className={s.breadcrumb} aria-label="Ubicación">
                <span>Inicio</span>
                <span aria-hidden>/</span>
                <span className={s.breadcrumbCurrent}>Panel</span>
              </nav>
              {publicUrl && (
                <div className={s.headerActions}>
                  <button type="button" className={s.iconBtn} onClick={handleCopy} aria-label="Copiar el link de tu carta" title={copied ? "¡Copiado!" : "Copiar link"}>
                    <span key={copied ? "done" : "idle"} className={s.iconSwap}>{copied ? <CheckIcon /> : <CopyIcon />}</span>
                  </button>
                  <div className={s.qrMenuWrap} ref={qrMenuWrapRef}>
                    <button
                      type="button"
                      className={s.iconBtn}
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setQrMenuPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - 200) });
                        setQrMenuOpen(o => !o);
                      }}
                      disabled={generatingQr || !canDownloadQr}
                      aria-haspopup="menu"
                      aria-expanded={qrMenuOpen}
                      aria-label={canDownloadQr ? "Descargar el QR de tu carta" : "Descargar QR (no incluido en tu plan)"}
                      title={generatingQr ? "Generando..." : "Descargar QR"}
                    >
                      <QrIcon />
                    </button>
                    {canDownloadQr && qrMenuOpen && qrMenuPos && createPortal(
                      <div
                        className={s.qrMenu}
                        role="menu"
                        ref={qrMenuPortalRef}
                        style={{ position: "fixed", top: qrMenuPos.top, left: qrMenuPos.left }}
                      >
                        <button className={s.qrMenuItem} role="menuitem" onClick={() => handleDownloadQr("png")}>
                          <span className={s.qrMenuItemTitle}>PNG</span>
                          <span className={s.qrMenuItemDesc}>Imagen simple</span>
                        </button>
                        <button className={s.qrMenuItem} role="menuitem" onClick={() => handleDownloadQr("pdf")}>
                          <span className={s.qrMenuItemTitle}>PDF</span>
                          <span className={s.qrMenuItemDesc}>Lista para imprimir</span>
                        </button>
                      </div>,
                      document.body
                    )}
                  </div>
                  <button type="button" className={`${s.iconBtn} ${s.iconBtnPrimary}`} onClick={handleOpen}>
                    <ExternalIcon />
                    <span>Ver carta</span>
                  </button>
                </div>
              )}
            </div>

            <h1 className={s.greeting}>
              {spooky(greeting(now.getHours()), "¡Feliz Halloween!")}
              {displayName && <>, <span className={s.greetingName}>{displayName}</span></>}
            </h1>
            <p className={s.subtitle}>
              {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
              {publicUrl && <span className={s.subtitleUrl}> · {publicUrl.replace(/^https?:\/\//, "")}</span>}
            </p>

            <div className={s.kpis}>
              {kpis.slice(0, 4).map(({ key, ...kpi }) => <KpiStat key={key} {...kpi} />)}
            </div>
          </div>

          <div className={s.headerSide}>
            {activity.visits !== null ? (
              <Gauge
                value={activity.visits?.engagement ?? 0}
                title="Interés en la carta"
                caption={activity.visits === undefined
                  ? "Cargando…"
                  : activity.visits.engagement === null
                    ? "Todavía no hay visitas esta semana."
                    : "de las visitas de la semana abrió un producto."}
              />
            ) : user && (
              <div className={s.planPromo}>
                <span className={s.planPromoIcon}><Sparkles size={18} strokeWidth={1.75} /></span>
                <span className={s.planPromoLabel}>Tu plan</span>
                <strong className={s.planPromoName}>{planName}</strong>
                <p className={s.planPromoText}>
                  {currentPlan ? getPlanFeatureLabels(currentPlan.features).slice(0, 3).join(" · ") : "Sumá estadísticas, pedidos y reservas."}
                </p>
                <button type="button" className={s.primaryBtn} onClick={openUpgrade}>{planActionLabel}</button>
              </div>
            )}
          </div>
        </section>

        {planAlert && (
          <div className={s.planAlert} role="status">
            <span>{planAlert}</span>
            <button type="button" className={s.primaryBtn} onClick={openUpgrade}>{planActionLabel}</button>
          </div>
        )}

        {/* ── Agenda, visitas y estado de pedidos ────────────────────────── */}
        <div className={`${s.row} ${isPro ? s.rowThree : s.rowTwo}`}>
          {isPro ? (
            <AgendaCard
              dateLabel="Hoy"
              reservations={activity.reservations}
              orders={activity.orders}
              onOpenReservations={() => navigate("/reservas")}
              onOpenOrders={() => navigate("/pedidos")}
            />
          ) : (
            <StorefrontCard
              url={publicUrl}
              copied={copied}
              onCopy={handleCopy}
              onOpen={handleOpen}
              data={data}
              ordersModes={ordersModes}
            />
          )}

          {activity.visits !== null
            ? <VisitsChartCard visits={activity.visits} onOpen={() => navigate("/estadisticas")} />
            : <LockedChartCard onUpgrade={openUpgrade} />}

          {isPro && <OrdersBarsCard orders={activity.orders ?? undefined} onOpen={() => navigate("/pedidos")} />}
        </div>

        {/* ── Accesos rápidos ────────────────────────────────────────────── */}
        <nav className={s.quickRow} aria-label="Accesos rápidos">
          <QuickTile
            label="Productos en la carta"
            value={data ? formatCount(data.itemCount) : "—"}
            action="Editar menú"
            onClick={() => navigate("/menu/editor")}
          />
          <QuickTile
            label="Categorías"
            value={data ? formatCount(data.categoryCount) : "—"}
            action="Ordenar"
            onClick={() => navigate("/menu/editor")}
          />
          <QuickTile
            label="Delivery y take away"
            value={ordersModesShort}
            action="Configurar"
            onClick={() => navigate("/user/editor")}
          />
          <QuickTile
            label="Mi negocio"
            value="Datos y fotos"
            action="Editar"
            onClick={() => navigate("/user/editor")}
          />
          <QuickTile
            label="Tu plan"
            value={planName || "—"}
            action={planActionLabel}
            alert={planNeedsAttention && effectiveSubscription !== "free"}
            onClick={openUpgrade}
          />
        </nav>

        {isPro && <OrdersTable orders={activity.orders ?? undefined} onOpen={() => navigate("/pedidos")} />}

        {!planNeedsAttention && user && (
          <p className={s.planLine}>
            Plan <strong>{planName}</strong>
            {user.subscriptionExpiresAt
              ? ` · Vigente hasta el ${formatDateAR(user.subscriptionExpiresAt)}`
              : " · Sin vencimiento registrado"}
          </p>
        )}

        {upgradeOpen && user && (
          <UpgradeModal
            currentPlan={effectiveSubscription || "free"}
            minPlan={effectiveSubscription === "free" ? "basic" : effectiveSubscription}
            allowCurrentPlan={effectiveSubscription !== "free" && !subscriptionExpired}
            title={subscriptionExpired || user.subscription === "free" ? "Elegí el plan para tu negocio" : "Renová o mejorá tu plan"}
            description={subscriptionExpired
              ? `Tu ${previousPlanText} venció. Elegí un plan para recuperar sus funciones y continuar trabajando.`
              : user.subscription === "free"
              ? "Pasá a Básico o Pro, elegí la duración y aprovechá el descuento por prepago."
              : user.subscription === "basic"
                ? "Sumá meses a tu plan o consultá las funciones disponibles en otros planes."
                : "Elegí cuántos meses querés sumar a la vigencia de tu plan Pro."}
            onClose={() => setUpgradeOpen(false)}
          />
        )}
      </main>
    </div>
  );
}

// ── Tu carta en línea (planes sin agenda) ─────────────────────────────────────

interface StorefrontCardProps {
  url: string | null;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
  data: DashData | null;
  ordersModes: string;
}

function StorefrontCard({ url, copied, onCopy, onOpen, data, ordersModes }: StorefrontCardProps) {
  return (
    <section className={`${s.card} ${s.storefrontCard}`} aria-label="Tu carta en línea">
      <header className={s.storefrontHeader}>
        <span className={s.storefrontIcon} aria-hidden><GlobeIcon /></span>
        <h2 className={s.cardTitle}>Tu carta en línea</h2>
      </header>
      <div className={s.urlRow}>
        <span className={s.urlText}>
          {url ? url.replace(/^https?:\/\//, "") : <span className={s.urlPlaceholder}>Configurá tu negocio para obtener tu link</span>}
        </span>
        {url && (
          <button type="button" className={`${s.urlCopyBtn} ${copied ? s.urlCopyBtnDone : ""}`} onClick={onCopy}>
            <span key={copied ? "done" : "idle"} className={s.iconSwap}>{copied ? <CheckIcon /> : <CopyIcon />}</span>
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        )}
      </div>
      {url && (
        <button type="button" className={s.primaryBtn} onClick={onOpen}>
          <ExternalIcon />
          Ver mi carta
        </button>
      )}
      {data && (
        <div className={s.storefrontFacts}>
          <span><strong>{formatCount(data.itemCount)}</strong> {data.itemCount === 1 ? "producto" : "productos"}</span>
          <span><strong>{formatCount(data.categoryCount)}</strong> {data.categoryCount === 1 ? "categoría" : "categorías"}</span>
          <span className={data.hasDelivery || data.hasTakeAway ? s.factOn : undefined}>{ordersModes}</span>
        </div>
      )}
    </section>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="14" x2="14" y2="17" />
      <line x1="14" y1="20" x2="14" y2="21" />
      <line x1="17" y1="14" x2="21" y2="14" />
      <line x1="17" y1="17" x2="19" y2="17" />
      <line x1="17" y1="20" x2="21" y2="20" />
      <line x1="21" y1="17" x2="21" y2="21" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
