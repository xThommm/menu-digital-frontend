import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { useAuth } from "../../../../context/useAuth";
import s from "./UserDashboard.module.css";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface DashData {
  businessName: string;
  slug: string;
  hasDelivery: boolean;
  template: number;
  itemCount: number;
  categoryCount: number;
}

// ── Hook: luz que sigue al cursor en las cards ────────────────────────────────

function useSpotlight(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [ref]);
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserDashboard() {
  const { token, isLoading } = useAuth();
  const navigate = useNavigate();

  const [data, setData]     = useState<DashData | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [qrMenuOpen, setQrMenuOpen] = useState(false);
  const [qrMenuPos, setQrMenuPos] = useState<{ top: number; left: number } | null>(null);
  const qrMenuWrapRef = useRef<HTMLDivElement>(null);
  const qrMenuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!token) return;
    const load = async () => {
      try {
        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        setData({
          businessName:  json.contactInfo?.businessName ?? "",
          slug:          json.slug ?? "",
          hasDelivery:   json.hasDelivery ?? false,
          template:      json.template ?? 1,
          itemCount:     json.itemCount ?? 0,
          categoryCount: json.categoryCount ?? 0,
        });
      } catch {
        // El dashboard sigue mostrándose aunque fallen los stats
      }
    };
    load();
  }, [token, isLoading]);

  const publicUrl = data?.slug
    ? `${window.location.origin}/${data.slug}`
    : null;

  const handleCopy = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback silencioso */ }
  }, [publicUrl]);

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
  // presentación.
  const generateQrDataUrl = useCallback(() => {
    if (!publicUrl) return null;
    return QRCode.toDataURL(`${publicUrl}/menu`, {
      width: 1024,
      margin: 2,
      color: { dark: "#1a1208", light: "#ffffffff" },
    });
  }, [publicUrl]);

  const handleDownloadQr = useCallback(async (format: "png" | "pdf") => {
    if (!publicUrl || generatingQr) return;
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
    } catch {
      // La descarga es un "extra" — si falla no interrumpimos el resto
      // del dashboard con un banner de error.
    } finally {
      setGeneratingQr(false);
    }
  }, [publicUrl, data, generatingQr, generateQrDataUrl]);

  const displayName = data?.businessName;

  return (
    <div className={s.root}>

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <main className={s.main}>
      <div className={s.leftCol}>

        {/* Bienvenida */}
        <div className={s.welcome}>
          <p className={s.welcomeEyebrow}>Bienvenido!</p>
          <h1 className={s.welcomeTitle}>{displayName}</h1>
        </div>

        {/* Tarjeta storefront */}
        <div className={s.storefrontCard}>
          <div className={s.storefrontTop}>
            <div className={s.storefrontIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <span className={s.storefrontLabel}>Tu carta en línea</span>
          </div>

          <div className={s.urlRow}>
            <span className={s.urlText}>
              {publicUrl
                ? publicUrl.replace(/^https?:\/\//, "")
                : <span className={s.urlPlaceholder}>Configurá tu negocio para obtener tu link</span>
              }
            </span>
          </div>

          {publicUrl && (
            <div className={s.storefrontActions}>
              <button
                className={`${s.actionBtn} ${copied ? s.actionBtnSuccess : ""}`}
                onClick={handleCopy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "¡Copiado!" : "Copiar link"}
              </button>
              <button className={`${s.actionBtn} ${s.actionBtnOutline}`} onClick={handleOpen}>
                <ExternalIcon />
                Ver página
              </button>
              <div className={s.qrMenuWrap} ref={qrMenuWrapRef}>
                <button
                  className={`${s.actionBtn} ${s.actionBtnOutline}`}
                  onClick={e => {
                    // display:contents en .qrMenuWrap no genera caja propia, así que
                    // la posición se toma del botón (currentTarget), no del wrapper.
                    const rect = e.currentTarget.getBoundingClientRect();
                    setQrMenuPos({ top: rect.bottom + 8, left: rect.left });
                    setQrMenuOpen(o => !o);
                  }}
                  disabled={generatingQr}
                  aria-haspopup="menu"
                  aria-expanded={qrMenuOpen}
                >
                  <QrIcon />
                  {generatingQr ? "Generando..." : "Descargar QR"}
                </button>
                {qrMenuOpen && qrMenuPos && createPortal(
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
            </div>
          )}

          {data && (
            <div className={s.statsPills}>
              <StatPill icon={<MenuIcon />} value={data.itemCount}
                label={data.itemCount === 1 ? "producto" : "productos"} />
              <StatPill icon={<GridIcon />} value={data.categoryCount}
                label={data.categoryCount === 1 ? "categoría" : "categorías"} />
              <span className={`${s.deliveryPill} ${data.hasDelivery ? s.deliveryOn : s.deliveryOff}`}>
                <span className={s.deliveryDot} />
                {data.hasDelivery ? "Delivery activo" : "Sin delivery"}
              </span>
            </div>
          )}
        </div>

        {/* Cards de navegación */}
        <div className={s.cards}>
          <SpotlightCard
            onClick={() => navigate("/menu/editor")}
            icon={<DocIcon />}
            title="Editor de menú"
            desc="Platos, precios, categorías y disponibilidad."
            primary
          />
          <SpotlightCard
            onClick={() => navigate("/user/editor")}
            icon={<StoreIcon />}
            title="Mi negocio"
            desc="Datos de contacto, fotos y apariencia."
          />
        </div>

      </div>

      {/* Vista previa en vivo — una sola instancia (no se duplica el
          iframe). En mobile/tablet, .rightCol no tiene estilos propios y
          esto queda apilado abajo del resto por el flex-column de .main;
          en desktop (ver UserDashboard.module.css, min-width: 1200px)
          .main pasa a fila y esta columna queda al lado, más grande. */}
      <div className={s.rightCol}>
        <PreviewCard url={publicUrl} />
      </div>
      </main>
    </div>
  );
}

// ── SpotlightCard ─────────────────────────────────────────────────────────────

interface NavCardProps {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
}

function SpotlightCard({ onClick, icon, title, desc, primary }: NavCardProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useSpotlight(ref as React.RefObject<HTMLElement>);

  return (
    <button
      ref={ref}
      className={`${s.navCard} ${primary ? s.navCardPrimary : ""}`}
      onClick={onClick}
    >
      <div className={`${s.cardIcon} ${primary ? s.cardIconPrimary : ""}`}>
        {icon}
      </div>
      <div className={s.cardBody}>
        <p className={s.cardTitle}>{title}</p>
        <p className={s.cardDesc}>{desc}</p>
      </div>
      <svg className={s.cardArrow} width="17" height="17" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}

// ── PreviewCard ────────────────────────────────────────────────────────────────

interface PreviewCardProps {
  url: string | null;
}

function PreviewCard({ url }: PreviewCardProps) {
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const DEVICE = mode === "mobile" ? { w: 390, h: 844 } : { w: 1280, h: 800 };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // No llamamos a setScale directamente acá: el ResizeObserver dispara su
    // callback en cuanto lo suscribimos con observe(), de forma asíncrona.
    // Así el setState queda dentro de la suscripción a un sistema externo,
    // en vez de ser una llamada síncrona en el cuerpo del efecto.
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      setScale(Math.min(width / DEVICE.w, 1));
    });
    ro.observe(el);
    return () => ro.disconnect();
    // `url` está en las dependencias aunque no se lea acá adentro: en el
    // primer render `url` todavía es null (data no cargó), este componente
    // devuelve null y wrapRef.current es null, así que ese primer efecto no
    // hace nada. Cuando `url` pasa a tener valor recién ahí se monta el div
    // con el ref — sin `url` en las deps, el efecto no se repetiría (mode
    // no cambió) y la vista previa quedaba pegada en scale:1 hasta que se
    // togglea mobile/desktop a mano (lo que sí cambia DEVICE.w).
  }, [DEVICE.w, url]);

  // Reseteamos `loaded` cuando cambia el modo, la url o se fuerza un reload.
  // En vez de un useEffect que llame a setLoaded de forma síncrona (lo que
  // dispara un render en cascada evitable), lo resolvemos durante el propio
  // render comparando contra la key anterior, tal como recomienda React para
  // "ajustar estado cuando cambia algo" sin pasar por un efecto.
  const frameKey = `${mode}|${url}|${reloadKey}`;
  const [prevFrameKey, setPrevFrameKey] = useState(frameKey);
  if (frameKey !== prevFrameKey) {
    setPrevFrameKey(frameKey);
    setLoaded(false);
  }

  if (!url) return null;

  return (
    <div className={s.previewCard}>
      <div className={s.previewHeader}>
        <span className={s.previewLabel}>Vista previa</span>
        <div className={s.previewControls}>
          <div className={s.previewToggle}>
            <button
              className={`${s.previewToggleBtn} ${mode === "mobile" ? s.previewToggleBtnActive : ""}`}
              onClick={() => setMode("mobile")}
            >
              Móvil
            </button>
            <button
              className={`${s.previewToggleBtn} ${mode === "desktop" ? s.previewToggleBtnActive : ""}`}
              onClick={() => setMode("desktop")}
            >
              Escritorio
            </button>
          </div>
          <button
            className={s.previewRefreshBtn}
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Actualizar vista previa"
            title="Actualizar"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div ref={wrapRef} className={s.previewViewport}>
        <div
          className={s.previewFrameWrap}
          style={{ width: DEVICE.w * scale, height: DEVICE.h * scale }}
        >
          {!loaded && <div className={s.previewSkeleton} />}
          <iframe
            key={reloadKey}
            src={url}
            title="Vista previa de tu carta"
            className={s.previewIframe}
            style={{ width: DEVICE.w, height: DEVICE.h, transform: `scale(${scale})` }}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className={s.statPill}>
      <span className={s.statPillIcon}>{icon}</span>
      <strong>{value}</strong> {label}
    </span>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

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

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}