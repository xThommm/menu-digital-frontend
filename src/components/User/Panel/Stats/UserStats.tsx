import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import type { StatsData, ItemStatsData, TopItemStat } from "../../../../types";
import type { ServiceType } from "../../../../features/orders/types";
import { usePlans } from "../../../../hooks/usePlans";
import { isSubscriptionExpired, PLAN_ORDER } from "../../../../lib/plans";
import { formatDateAR } from "../../../../lib/dates";
import DataTable from "../../../Common/DataTable/DataTable";
import UpgradeModal from "../../../Common/UpgradeModal";
import s from "./UserStats.module.css";
import {
  buildAudience, buildHourly, buildInsights, HOURLY_MIN_VISITS, itemTrend, lowConversionItem,
  type AudienceInsights, type HourlyInsights, type WeekdayStat,
} from "./statsInsights";

import {
  requestStatsData, isStatsData, isItemStatsData, sanitizeItemStatsData, sanitizeStatsData,
} from "./statsRequests";
import { DailyChart, Hero, HourBars, Ring } from "./StatsCharts";
import { formatCompact, formatDay, formatDayLong, formatDecimal, formatPercent, hourRange, plural } from "./statsFormat";
import { useSalesReport, type SalesState } from "./useSalesReport";
import SalesView from "./SalesView";
import CashView from "./CashView";
import ExportDialog from "./ExportDialog";

const WEEKDAY_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

type Tab = "visits" | "sales" | "cash";
const TABS: { id: Tab; label: string; title: string }[] = [
  { id: "visits", label: "Visitas", title: "Visitas a tu carta" },
  { id: "sales", label: "Ventas", title: "Ventas" },
  { id: "cash", label: "Caja", title: "Cierres de caja" },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserStats() {
  const { token } = useAuth();
  return <UserStatsPanel key={token ?? "anonymous"} />;
}

function UserStatsPanel() {
  const { token, user, isLoading: authLoading, logout } = useAuth();
  const catalog = usePlans();
  const effectiveSubscription = user && isSubscriptionExpired(
    user.subscription,
    user.subscriptionExpiresAt,
    user.subscriptionStatus,
  )
    ? "free"
    : (user?.subscription ?? "free");
  const statsPlan = catalog.isError
    ? undefined
    : catalog.data?.find(plan => plan.features.estadisticas && PLAN_ORDER.indexOf(plan.name) > PLAN_ORDER.indexOf(effectiveSubscription));
  // Ventas y caja salen de Gestión de pedidos, que es del plan Pro.
  const isPro = effectiveSubscription === "pro";

  const [stats, setStats]         = useState<StatsData | null>(null);
  const [itemStats, setItemStats] = useState<ItemStatsData | null>(null);
  const [locked, setLocked]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [itemsError, setItemsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [windowDays, setWindowDays] = useState<7 | 30>(30);
  const [tab, setTab] = useState<Tab>("visits");
  const [exportOpen, setExportOpen] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const sales = useSalesReport(windowDays, serviceType, isPro && !locked && tab !== "visits");

  // Una sola carga para inicio, reintento y refresco. La cancelación impide
  // aplicar respuestas de una cuenta/período anterior o de una vista desmontada.
  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;
    let inFlight = false;
    let denied = false;
    let controller: AbortController | undefined;
    let timeoutId: number | undefined;
    const refresh = async () => {
      if (inFlight || denied || cancelled) return;
      inFlight = true;
      controller = new AbortController();
      timeoutId = window.setTimeout(() => controller?.abort(), 15_000);
      setRefreshing(true);
      try {
        const [r, ir] = await Promise.all([
          requestStatsData<StatsData>(`/api/users/me/stats?days=${windowDays}`, token, controller.signal),
          requestStatsData<ItemStatsData>(`/api/users/me/item-stats?days=${windowDays}`, token, controller.signal),
        ]);
        if (cancelled) return;
        if (r.kind === "unauthorized" || ir.kind === "unauthorized") {
          denied = true;
          logout();
          window.location.href = "/login";
          return;
        }
        if (r.kind === "locked" || ir.kind === "locked") {
          denied = true;
          setLocked(true);
          setStats(null);
          setItemStats(null);
          return;
        }
        setLocked(false);
        // Un backend anterior debe mostrar error, nunca datos mal rotulados.
        const validStats = r.kind === "data" && isStatsData(r.data, windowDays);
        const validItems = ir.kind === "data" && isItemStatsData(ir.data, windowDays);
        setStatsError(!validStats);
        setItemsError(!validItems);
        if (validStats) setStats(sanitizeStatsData(r.data));
        if (validItems) setItemStats(sanitizeItemStatsData(ir.data));
      } finally {
        window.clearTimeout(timeoutId);
        inFlight = false;
        if (!cancelled) { setLoading(false); setHasLoaded(true); setRefreshing(false); }
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 45_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authLoading, token, logout, retry, windowDays, user?.subscription, user?.subscriptionStatus, user?.subscriptionExpiresAt]);

  // Los pasos de pedido del embudo solo tienen sentido con pedido por
  // WhatsApp en el plan (o si igual llegaron pedidos, ej. de antes de bajar).
  const showOrders = catalog.data?.find(plan => plan.name === effectiveSubscription)?.features.pedido_whatsapp === true;

  const days = useMemo(() => stats?.days ?? [], [stats]);
  const insights = useMemo(() => buildInsights(stats), [stats]);
  const hourly = useMemo(() => buildHourly(stats), [stats]);
  const audience = useMemo(() => buildAudience(stats, { showOrders }), [stats, showOrders]);

  if (loading && !hasLoaded) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando estadísticas..." />
      </div>
    );
  }

  if (locked) {
    return (
      <div className={s.root}>
        <main className={s.main}>
          <div className={s.welcome}>
            <p className={s.welcomeEyebrow}>Estadísticas</p>
            <h1 className={s.welcomeTitle}>Visitas a tu carta</h1>
          </div>

          <div className={s.lockCard}>
            <div className={s.lockIcon}><LockIcon /></div>
            <p className={s.lockTitle}>Estadísticas no incluidas en tu plan</p>
            <p className={s.lockDesc}>
              Mirá cuántas veces abrieron tu carta y seguí la tendencia día a día.
              {statsPlan && ` Disponibles con ${statsPlan.label} desde ${statsPlan.effectivePrice.toLocaleString("es-AR")} ARS por mes.`}
            </p>
            <button className={s.lockBtn} onClick={() => setUpgradeOpen(true)} type="button">
              Consultar planes disponibles
            </button>
          </div>
          {upgradeOpen && (
            <UpgradeModal
              currentPlan={effectiveSubscription}
              minPlan="basic"
              requiredFeature="estadisticas"
              title="Desbloqueá las estadísticas"
              description="Consultá qué planes incluyen visitas de la carta y los productos más vistos."
              onClose={() => setUpgradeOpen(false)}
            />
          )}
        </main>
      </div>
    );
  }

  const hasAnyView = insights.total > 0;
  // "Hoy" según el servidor; si las visitas no cargaron, el del navegador en Buenos Aires.
  const today = stats?.todayDate ?? formatDateAR(new Date(), { output: "date-input" });

  return (
    <div className={s.root}>
      <main className={s.main}>
        <header className={`${s.welcome} ${s.welcomeSplit}`}>
          <div>
            <p className={s.welcomeEyebrow}>Estadísticas</p>
            <h1 className={s.welcomeTitle}>{TABS.find(option => option.id === tab)?.title}</h1>
            <p className={s.welcomeSub}>
              <span className={s.liveDot} aria-hidden />
              Los datos se actualizan automáticamente
            </p>
          </div>
          <button className={s.exportBtn} type="button" onClick={() => setExportOpen(true)}>
            <Download size={18} strokeWidth={1.75} aria-hidden />
            Exportar a Excel
          </button>
        </header>

        <div className={s.toolbar}>
          <div className={s.tabs} role="group" aria-label="Secciones de estadísticas">
            {TABS.map(option => (
              <button key={option.id} type="button" aria-pressed={tab === option.id} onClick={() => setTab(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
          <fieldset className={s.periodPicker}>
            <legend>Período de estadísticas</legend>
            {([7, 30] as const).map(value => (
              <button key={value} type="button" aria-pressed={windowDays === value}
                onClick={() => {
                  if (value === windowDays) return;
                  setWindowDays(value);
                  setStats(null);
                  setItemStats(null);
                  setStatsError(false);
                  setItemsError(false);
                  setLoading(true);
                }}>
                {value} días completos
              </button>
            ))}
          </fieldset>
        </div>
        {loading && <p className={s.periodDates} role="status">Cargando período…</p>}
        {stats && <p className={s.periodDates}>
          {formatDayLong(stats.periodStart)} al {formatDayLong(stats.periodEnd)} · Comparación: {formatDayLong(stats.previousStart)} al {formatDayLong(stats.previousEnd)}
        </p>}

        {tab !== "visits" && (
          <SalesTab
            tab={tab}
            isPro={isPro}
            sales={sales}
            serviceType={serviceType}
            onServiceType={setServiceType}
            onUpgrade={() => setUpgradeOpen(true)}
          />
        )}
        {tab === "visits" && (
          <>
            {(statsError || itemsError) && (
              <section className={s.notice} role="status">
                {statsError && <p>{stats ? "No pudimos actualizar las visitas. Mostramos los últimos datos recibidos." : "No pudimos cargar las visitas."}</p>}
                {itemsError && <p>{itemStats ? "No pudimos actualizar los productos. Mostramos el último ranking recibido." : "No pudimos cargar los productos más vistos."}</p>}
                <button className={s.lockBtn} type="button" disabled={refreshing} onClick={() => setRetry(value => value + 1)}>
                  {refreshing ? "Reintentando…" : "Reintentar"}
                </button>
              </section>
            )}
            {stats && (
              <>
                <Hero
                  label={`Visitas en ${windowDays} días completos`}
                  value={insights.total.toLocaleString("es-AR")}
                  trend={insights.trend}
                  foot={insights.trend === null ? "Sin base completa para calcular una variación" : `${insights.previous.toLocaleString("es-AR")} visitas en el período anterior`}
                  series={days.map(day => day.count)}
                  stats={[
                    { label: "Promedio diario", value: formatDecimal(insights.dailyAverage) },
                    ...(insights.best ? [{ label: "Mejor día", value: `${insights.best.count.toLocaleString("es-AR")} · ${formatDay(insights.best.date)}` }] : []),
                    ...(audience?.qrShare ? [{ label: "Llegan por el QR", value: formatPercent(audience.qrShare) }] : []),
                  ]}
                  aside={(
                    // "Hoy" contra un día promedio, sin variación: el día está a
                    // medio transcurrir y compararlo contra días completos
                    // mostraría siempre una caída que no existe.
                    <Ring
                      size="lg"
                      value={insights.dailyAverage > 0 ? insights.today / insights.dailyAverage : 0}
                      label={`Hoy: ${insights.today} ${plural(insights.today, "visita", "visitas")}`}
                    >
                      <small>Hoy · {formatDay(stats.todayDate)}</small>
                      <strong>{insights.today.toLocaleString("es-AR")}</strong>
                      <span>{plural(insights.today, "visita", "visitas")}</span>
                      {insights.dailyAverage > 0 && (
                        <span>{formatPercent(insights.today / insights.dailyAverage)} de un día promedio</span>
                      )}
                    </Ring>
                  )}
                />

                {!hasAnyView && <EmptyState slug={user?.slug} />}
                <section className={`${s.card} ${insights.bestWeekday && insights.hasWeekdayPattern ? s.span8 : s.cardWide}`}>
                  <div className={s.cardHead}>
                    <p className={s.cardLabel}>Visitas por día</p>
                    {insights.best && (
                      <p className={s.cardNote}>
                        Tu mejor día fue el <strong>{formatDayLong(insights.best.date)}</strong>, con{" "}
                        {insights.best.count.toLocaleString("es-AR")}{" "}
                        {plural(insights.best.count, "visita", "visitas")}
                      </p>
                    )}
                  </div>
                  <DailyChart
                    key={windowDays}
                    days={days.map(day => ({ date: day.date, value: day.count }))}
                    previousDays={stats.comparisonAvailable ? stats.previousDays.map(day => ({ date: day.date, value: day.count })) : null}
                    average={insights.dailyAverage}
                    format={formatDecimal}
                    formatAxis={formatCompact}
                    noun={count => plural(count, "visita", "visitas")}
                    valueHeader="Visitas"
                    detailLabel="Ver detalle de visitas por día"
                  />
                </section>

                {insights.bestWeekday && insights.hasWeekdayPattern && (
                  <section className={`${s.card} ${s.span4}`}>
                    <div className={s.cardHead}>
                      <p className={s.cardLabel}>Tu semana típica</p>
                      <p className={s.cardNote}>
                        Promedio de los días completos desde el alta, dentro del período seleccionado
                      </p>
                    </div>
                    <WeekdayChart
                      weekdays={insights.weekdays}
                      best={insights.bestWeekday}
                      dailyAverage={insights.dailyAverage}
                    />
                  </section>
                )}

                {/* Sin semana típica al lado, a lo ancho en vez de media fila vacía. */}
                {hourly && (
                  <HourlyCard
                    hourly={hourly}
                    periodStart={stats.periodStart}
                    wide={!audience}
                  />
                )}

                {!insights.hasWeekdayPattern && <p className={s.measurementNote}>El patrón semanal necesita al menos dos días completos de cada día de la semana desde el alta y alguna visita. Seleccioná 30 días para verlo cuando haya datos suficientes.</p>}

                {audience && <AudienceCard audience={audience} periodStart={stats.periodStart} wide={!hourly} />}
              </>
            )}
            {itemStats && (
              <section className={s.card}>
                <div className={s.cardHead}>
                  <p className={s.cardLabel}>Productos más vistos</p>
                  <p className={s.cardNote}>
                    Veces que abrieron el detalle, una por visita · {formatDay(itemStats.periodStart)} al {formatDay(itemStats.periodEnd)}
                    {itemStats.comparisonAvailable && ` · Comparado con ${formatDay(itemStats.previousStart)} al ${formatDay(itemStats.previousEnd)}`}
                  </p>
                </div>
                {itemStats.topItems.length === 0
                  ? <p className={s.cardNote}>Todavía no abrieron productos en este período.</p>
                  : <ItemRanking items={itemStats.topItems} metric="views" comparisonAvailable={itemStats.comparisonAvailable} showOrders={showOrders} />}
              </section>
            )}
            {itemStats?.topOrdered && (showOrders || itemStats.topOrdered.length > 0) && (
              <section className={s.card}>
                <div className={s.cardHead}>
                  <p className={s.cardLabel}>Productos más pedidos</p>
                  <p className={s.cardNote}>
                    Pedidos por WhatsApp que los incluían · {formatDay(itemStats.periodStart)} al {formatDay(itemStats.periodEnd)}
                  </p>
                </div>
                {itemStats.topOrdered.length === 0
                  ? <p className={s.cardNote}>Todavía no llegaron pedidos por WhatsApp en este período.</p>
                  : <ItemRanking items={itemStats.topOrdered} metric="orders" comparisonAvailable={false} showOrders />}
              </section>
            )}
            <MeasurementNote audienceFrom={stats?.audience?.from ?? null} periodStart={stats?.periodStart} hasViews={insights.total > 0} />
          </>
        )}

        {exportOpen && (
          <ExportDialog
            today={today}
            initialPreset={windowDays === 7 ? "period7" : "period30"}
            salesAvailable={isPro}
            slug={user?.slug}
            onClose={() => setExportOpen(false)}
          />
        )}
        {upgradeOpen && (
          <UpgradeModal
            currentPlan={effectiveSubscription}
            minPlan="pro"
            title="Sumá ventas y caja a tus estadísticas"
            description="Con Gestión de pedidos del plan Pro ves lo vendido por día, los productos que más salen y cada cierre de caja."
            onClose={() => setUpgradeOpen(false)}
          />
        )}
      </main>
    </div>
  );
}

// ── Ventas y caja (plan Pro) ──────────────────────────────────────────────────

function SalesTab({ tab, isPro, sales, serviceType, onServiceType, onUpgrade }: {
  tab: "sales" | "cash";
  isPro: boolean;
  sales: SalesState;
  serviceType: ServiceType | null;
  onServiceType: (value: ServiceType | null) => void;
  onUpgrade: () => void;
}) {
  if (!isPro || sales.result?.kind === "locked") {
    return (
      <div className={s.lockCard}>
        <div className={s.lockIcon}><LockIcon /></div>
        <p className={s.lockTitle}>{tab === "sales" ? "Ventas" : "Cierres de caja"} con el plan Pro</p>
        <p className={s.lockDesc}>
          {tab === "sales"
            ? "Mirá cuánto vendiste cada día, el ticket promedio, los productos que más salen y en qué horarios."
            : "Revisá cada cierre de caja: lo vendido, el efectivo esperado, lo contado y la diferencia."}
          {" "}Los datos salen de Gestión de pedidos.
        </p>
        <button className={s.lockBtn} onClick={onUpgrade} type="button">Consultar planes disponibles</button>
      </div>
    );
  }
  if (sales.result?.kind === "unavailable") {
    return (
      <section className={s.notice} role="status">
        <p>Los reportes de ventas no están disponibles en este momento. Probá de nuevo en unos minutos.</p>
        <button className={s.lockBtn} type="button" disabled={sales.refreshing} onClick={sales.retry}>
          {sales.refreshing ? "Reintentando…" : "Reintentar"}
        </button>
      </section>
    );
  }
  if (!sales.report && !sales.result) return <p className={s.periodDates} role="status">Cargando ventas…</p>;
  return (
    <>
      {sales.result?.kind === "error" && (
        <section className={s.notice} role="status">
          <p>{sales.report ? "No pudimos actualizar las ventas. Mostramos los últimos datos recibidos." : "No pudimos cargar las ventas."}</p>
          <button className={s.lockBtn} type="button" disabled={sales.refreshing} onClick={sales.retry}>
            {sales.refreshing ? "Reintentando…" : "Reintentar"}
          </button>
        </section>
      )}
      {sales.report && (tab === "sales"
        ? <SalesView report={sales.report} serviceType={serviceType} onServiceType={onServiceType} pending={sales.pending} />
        : <CashView report={sales.report} />)}
    </>
  );
}


// ── Patrón por día de la semana ───────────────────────────────────────────────

function WeekdayChart({
  weekdays,
  best,
  dailyAverage,
}: {
  weekdays: WeekdayStat[];
  best: WeekdayStat;
  dailyAverage: number;
}) {
  const max = Math.max(...weekdays.map(w => w.average), 1);
  // Cuánto rinde el mejor día contra un día promedio. Solo se muestra si la
  // diferencia es real: decir "1x" no le aporta nada a nadie.
  const ratio = dailyAverage > 0 ? best.average / dailyAverage : 0;

  return (
    <div>
      <div className={s.weekChart}>
        {weekdays.map((w) => {
          const height = w.average > 0 ? Math.max((w.average / max) * 100, 8) : 4;
          const isBest = w.weekday === best.weekday;
          return (
            <div key={w.weekday} className={s.weekCol}>
              <span className={s.weekValue}>{formatDecimal(w.average)}</span>
              <div className={s.weekBarWrap}>
                <div
                  className={`${s.weekBar} ${isBest ? s.weekBarBest : ""}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className={`${s.weekLabel} ${isBest ? s.weekLabelBest : ""}`}>{w.label}</span>
            </div>
          );
        })}
      </div>

      {ratio >= 1.15 && (
        <p className={s.weekNote}>
          En este período, los <strong>{WEEKDAY_PLURAL[best.weekday]}</strong> tuvieron el mayor promedio:{" "}
          {formatDecimal(ratio)}× un día promedio.
        </p>
      )}
    </div>
  );
}

// ── Horarios de más visitas ───────────────────────────────────────────────────

function HourlyCard({ hourly, periodStart, wide }: { hourly: HourlyInsights; periodStart: string; wide: boolean }) {
  const { peak } = hourly;
  const partial = hourly.from !== null && hourly.from > periodStart;

  return (
    <section className={`${s.card} ${wide ? s.cardWide : s.span5}`}>
      <div className={s.cardHead}>
        <p className={s.cardLabel}>Horarios de más visitas</p>
        <p className={s.cardNote}>
          {hourly.total === 0
            ? "Los horarios se registran a partir de esta actualización: el gráfico aparece con las próximas visitas."
            : hourly.enough && peak
              ? <>El <strong>{formatPercent(peak.share)}</strong> de las visitas entra {hourRange(peak.start, peak.end)}.</>
              : `Todavía son pocas visitas para marcar un horario pico (${hourly.total} de ${HOURLY_MIN_VISITS}).`}
          {partial && hourly.from && ` Medido desde el ${formatDayLong(hourly.from)}.`}
        </p>
      </div>
      {hourly.total > 0 && (
        <>
          <HourBars
            values={hourly.hours}
            peakStart={hourly.enough && peak ? peak.start : null}
            format={value => `${value.toLocaleString("es-AR")} ${plural(value, "visita", "visitas")}`}
            label="Visitas por hora del día, sumadas en el período"
          />
          <details className={s.dailyDetails}>
            <summary>Ver visitas por hora</summary>
            <DataTable<{ hour: number; visits: number }>
              caption="Visitas por hora del día, sumadas en el período"
              rows={hourly.hours.map((visits, hour) => ({ hour, visits }))}
              columns={[
                { id: "hour", header: "Hora", resizable: false, sortValue: row => row.hour, render: row => `${row.hour} a ${(row.hour + 1) % 24} h` },
                { id: "visits", header: "Visitas", align: "right", resizable: false, initialDirection: "desc", sortValue: row => row.visits, render: row => row.visits },
              ]}
              getRowId={row => String(row.hour)}
            />
          </details>
        </>
      )}
    </section>
  );
}

// ── Cómo llegan y qué hacen ───────────────────────────────────────────────────

function AudienceCard({ audience, periodStart, wide }: { audience: AudienceInsights; periodStart: string; wide: boolean }) {
  const partial = audience.from !== null && audience.from > periodStart;
  return (
    <section className={`${s.card} ${wide ? s.cardWide : s.span7}`}>
      <div className={s.cardHead}>
        <p className={s.cardLabel}>Cómo llegan y qué hacen</p>
        <p className={s.cardNote}>
          Sobre {audience.visits.toLocaleString("es-AR")} {audience.visits === 1 ? "visita medida" : "visitas medidas"}
          {partial && audience.from && ` desde el ${formatDayLong(audience.from)}`}
        </p>
      </div>
      <div className={s.audienceGrid}>
        <ol className={s.funnel} aria-label="Recorrido de las visitas">
          {audience.funnel.map(step => (
            <li key={step.key} className={s.funnelStep}>
              <div className={s.funnelHead}>
                <span>{step.label}</span>
                <strong>{step.count.toLocaleString("es-AR")}</strong>
                {step.key !== "visits" && <small>{formatPercent(step.rate)}</small>}
              </div>
              <span className={s.funnelTrack} aria-hidden>
                <span
                  className={s.funnelFill}
                  style={{ width: `${step.count > 0 ? Math.max(step.rate * 100, 2) : 0}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
        <div className={s.audienceFacts}>
          <div className={s.ringRow}>
            <Ring value={audience.qrShare ?? 0} label={`${formatPercent(audience.qrShare ?? 0)} de las visitas llegó por el QR`}>
              <strong>{formatPercent(audience.qrShare ?? 0)}</strong>
            </Ring>
            <p>
              <strong>Llegaron por el QR</strong>
              {audience.qrShare
                ? "El resto entró por un link compartido, redes o buscadores."
                : "Los QR impresos antes de esta actualización cuentan como link: descargalo de nuevo desde Inicio para medirlo."}
            </p>
          </div>
          {audience.returningShare !== null && (
            <div className={s.ringRow}>
              <Ring value={audience.returningShare} label={`${formatPercent(audience.returningShare)} de los visitantes ya había abierto la carta`}>
                <strong>{formatPercent(audience.returningShare)}</strong>
              </Ring>
              <p>
                <strong>Vuelven</strong>
                de los visitantes de cada día ya habían abierto la carta otro día desde el mismo dispositivo
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Rankings de productos ─────────────────────────────────────────────────────

function ItemRanking({ items, metric, comparisonAvailable, showOrders }: {
  items: TopItemStat[];
  metric: "views" | "orders";
  comparisonAvailable: boolean;
  showOrders: boolean;
}) {
  const valueOf = (item: TopItemStat) => (metric === "views" ? item.totalViews : item.orders ?? 0);
  const max = valueOf(items[0]) || 1;
  const hint = metric === "views" && showOrders ? lowConversionItem(items) : null;

  return (
    <>
      <ol className={s.topItemsList}>
        {items.map((item, i) => {
          const value = valueOf(item);
          const trend = metric === "views" ? itemTrend(item, comparisonAvailable) : null;
          return (
            <li key={item.itemID} className={s.topItemRow}>
              <span className={s.topItemRank}>{i + 1}</span>
              <ItemThumb image={item.image} title={item.title} />
              <div className={s.topItemMain}>
                <span className={s.topItemName}>{item.title}</span>
                <span className={s.topItemBarWrap}>
                  <span className={s.topItemBar} style={{ width: `${Math.max((value / max) * 100, 4)}%` }} />
                </span>
              </div>
              <span className={s.topItemCount}>
                {value.toLocaleString("es-AR")}
                <small>{metric === "views" ? (value === 1 ? "vista" : "vistas") : (value === 1 ? "pedido" : "pedidos")}</small>
                {metric === "views" && trend?.kind === "new" && (
                  <small className={s.trendUp} title="Sin vistas en el período anterior">Nuevo</small>
                )}
                {metric === "views" && trend?.kind === "change" && (
                  <small
                    className={trend.pct > 0 ? s.trendUp : s.trendDown}
                    title={`${item.previousViews.toLocaleString("es-AR")} vistas en el período anterior`}
                  >
                    {trend.pct > 0 ? "↑" : "↓"} {Math.abs(trend.pct)}%
                  </small>
                )}
                {metric === "views" && comparisonAvailable && !trend && (
                  <small>{item.previousViews.toLocaleString("es-AR")} antes</small>
                )}
                {metric === "views" && showOrders && item.orders !== undefined && (
                  <small>{item.orders.toLocaleString("es-AR")} {item.orders === 1 ? "pedido" : "pedidos"}</small>
                )}
                {metric === "orders" && (
                  <small>{item.totalViews.toLocaleString("es-AR")} {item.totalViews === 1 ? "vista" : "vistas"}</small>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {hint && (
        <p className={s.weekNote}>
          <strong>{hint.title}</strong> se mira mucho pero casi no se pide
          ({hint.orders.toLocaleString("es-AR")} {hint.orders === 1 ? "pedido" : "pedidos"} en {hint.totalViews.toLocaleString("es-AR")} vistas).
          Revisá la foto, el precio o la descripción.
        </p>
      )}
    </>
  );
}

function MeasurementNote({ audienceFrom, periodStart, hasViews }: {
  audienceFrom: string | null;
  periodStart?: string;
  hasViews: boolean;
}) {
  const mixed = hasViews && (!audienceFrom || (periodStart !== undefined && audienceFrom > periodStart));
  return (
    <p className={s.measurementNote}>
      Una visita es una sesión en la carta: recargar o volver dentro de 30 minutos no suma otra, y tus
      propias visitas con la sesión iniciada no cuentan. Las vistas de productos son aperturas del detalle,
      una por visita. Un pedido cuenta cuando el cliente abre WhatsApp con el pedido armado: no confirma que
      lo haya enviado ni pagado.
      {mixed && (audienceFrom
        ? ` Los días anteriores al ${formatDayLong(audienceFrom)} pueden incluir recargas y tus propias visitas.`
        : " Los días anteriores a esta actualización pueden incluir recargas y tus propias visitas.")}
    </p>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ItemThumb({ image, title }: { image: string; title: string }) {
  // La foto ya venía en la respuesta del backend y no se estaba usando. Ver el
  // plato hace que la lista se lea como la carta propia y no como un reporte.
  // Sin foto, la inicial mantiene la fila alineada.
  if (!image) {
    return <span className={s.topItemThumbEmpty} aria-hidden>{title.trim().charAt(0) || "·"}</span>;
  }
  return <img className={s.topItemThumb} src={image} alt="" loading="lazy" />;
}

function EmptyState({ slug }: { slug?: string | null }) {
  return (
    <div className={s.emptyCard}>
      <div className={s.emptyIcon}><ChartIcon /></div>
      <p className={s.emptyTitle}>No hubo visitas en este período</p>
      <p className={s.emptyDesc}>
        Probá otro período para consultar visitas anteriores. Las visitas de hoy aparecen por separado.
        Compartí el link o pegá el QR en las mesas para dar a conocer tu carta.
      </p>
      {slug && (
        <a className={s.emptyLink} href={`/${slug}/menu`} target="_blank" rel="noreferrer">
          Ver mi carta
        </a>
      )}
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  );
}
