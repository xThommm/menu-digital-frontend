import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../context/useAuth";
import type { StatsData, ItemStatsData, DayCount, TopItemStat } from "../../../../types";
import { usePlans } from "../../../../hooks/usePlans";
import { isSubscriptionExpired, PLAN_ORDER } from "../../../../lib/plans";
import { formatDateAR } from "../../../../lib/dates";
import UpgradeModal from "../../../Common/UpgradeModal";
import s from "./UserStats.module.css";
import {
  buildAudience, buildHourly, buildInsights, HOURLY_MIN_VISITS, itemTrend, lowConversionItem, parseLocalDate,
  type AudienceInsights, type HourlyInsights, type WeekdayStat,
} from "./statsInsights";

import {
  requestStatsData, isStatsData, isItemStatsData, sanitizeItemStatsData, sanitizeStatsData,
} from "./statsRequests";

const WEEKDAY_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

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

  return (
    <div className={s.root}>
      <main className={s.main}>
        <header className={s.welcome}>
          <p className={s.welcomeEyebrow}>Estadísticas</p>
          <h1 className={s.welcomeTitle}>Visitas a tu carta</h1>
          <p className={s.welcomeSub}>
            <span className={s.liveDot} aria-hidden />
            Visitas y productos se actualizan automáticamente
          </p>
        </header>

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
        {loading && <p className={s.periodDates} role="status">Cargando período…</p>}
        {stats && <p className={s.periodDates}>
          {formatDayLong(stats.periodStart)} al {formatDayLong(stats.periodEnd)} · Comparación: {formatDayLong(stats.previousStart)} al {formatDayLong(stats.previousEnd)}
        </p>}
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
            <section className={s.summaryRow} aria-label="Resumen de visitas">
              <SummaryCard
                label={`Últimos ${windowDays} días completos`}
                value={insights.total}
                trend={insights.trend}
                foot={insights.trend === null ? "Sin base completa para calcular una variación" : `${insights.previous.toLocaleString("es-AR")} visitas en el período anterior`}
              />
              <SummaryCard
                label="Promedio diario"
                value={insights.dailyAverage}
                foot={insights.averageDays ? `Sobre ${insights.averageDays} días completos desde el alta` : "Sin días completos desde el alta"}
              />
              {/* "Hoy" va sin comparación a propósito: el día está a medio
                  transcurrir y compararlo contra días completos mostraría
                  siempre una caída que no existe. */}
              <SummaryCard
                label="Hoy"
                value={insights.today}
                foot={`Día en curso · ${formatDay(stats.todayDate)}`}
                accent
              />
            </section>

            {!hasAnyView && <EmptyState slug={user?.slug} />}
            <section className={`${s.card} ${s.cardWide}`}>
              <div className={s.cardHead}>
                <p className={s.cardLabel}>Visitas por día</p>
                {insights.best && (
                  <p className={s.cardNote}>
                    Tu mejor día fue el <strong>{formatDayLong(insights.best.date)}</strong>, con{" "}
                    {insights.best.count.toLocaleString("es-AR")}{" "}
                    {insights.best.count === 1 ? "visita" : "visitas"}
                  </p>
                )}
              </div>
              <DailyChart
                key={windowDays}
                days={days}
                previousDays={stats.comparisonAvailable ? stats.previousDays : null}
                average={insights.dailyAverage}
              />
            </section>

            {insights.bestWeekday && insights.hasWeekdayPattern && (
              <section className={s.card}>
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
                wide={!(insights.bestWeekday && insights.hasWeekdayPattern)}
              />
            )}

            {!insights.hasWeekdayPattern && <p className={s.measurementNote}>El patrón semanal necesita al menos dos días completos de cada día de la semana desde el alta y alguna visita. Seleccioná 30 días para verlo cuando haya datos suficientes.</p>}

            {audience && <AudienceCard audience={audience} periodStart={stats.periodStart} />}
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
      </main>
    </div>
  );
}

// ── Gráfico de visitas por día ────────────────────────────────────────────────

function DailyChart({ days, previousDays, average }: {
  days: DayCount[];
  // Mismo largo que `days`, día por día (el 1.º con el 1.º). null sin base
  // de comparación: antes del alta serían ceros que no son datos.
  previousDays: DayCount[] | null;
  average: number;
}) {
  // Un índice activo en vez del atributo `title` nativo: `title` no existe en
  // touch, así que en el celular —que es donde el dueño mira esto— el detalle
  // de cada día no se podía ver. Con estado, el mismo tooltip sirve para
  // mouse y para tap.
  const [active, setActive] = useState<number | null>(null);
  const previous = previousDays && previousDays.length === days.length ? previousDays : null;
  const maxCount = Math.max(1, ...days.map(d => d.count), ...(previous ?? []).map(d => d.count));
  const shown = active !== null ? days[active] : null;
  const shownPrevious = active !== null ? previous?.[active] : undefined;

  return (
    <div className={s.chartBlock}>
      <div
        className={s.chart}
        role="group"
        aria-label={`Visitas diarias de los últimos ${days.length} días. El detalle está en la tabla siguiente.`}
        onMouseLeave={() => setActive(null)}
      >
        {/* Línea de promedio: da una referencia para leer cada barra como
            "arriba" o "abajo" de lo normal, en vez de solo alta o baja. */}
        {average > 0 && (
          <span
            className={s.averageLine}
            style={{ bottom: `${Math.min((average / maxCount) * 100, 100)}%` }}
            aria-hidden
          >
            <small>prom. {formatDecimal(average)}</small>
          </span>
        )}

        {days.map((d, i) => {
          const weekday = parseLocalDate(d.date)?.getUTCDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const height = d.count > 0 ? Math.max((d.count / maxCount) * 100, 6) : 3;
          const before = previous?.[i];
          return (
            <button
              type="button"
              key={d.date}
              aria-label={`${formatDayLong(d.date)}: ${d.count} ${d.count === 1 ? "visita" : "visitas"}${
                before ? `; ${before.count} el ${formatDayLong(before.date)}` : ""}`}
              aria-pressed={active === i}
              className={[
                s.barWrap,
                active === i ? s.barWrapActive : "",
              ].join(" ").trim()}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}
              onClick={() => setActive(i)}
            >
              <span
                className={[
                  s.bar,
                  d.count === 0 ? s.barEmpty : "",
                  isWeekend ? s.barWeekend : "",
                ].join(" ").trim()}
                style={{ height: `${height}%`, animationDelay: `${i * 14}ms` }}
              />
              {/* Marca del mismo día del período anterior: una raya en vez
                  de otra barra, para que 30 pares entren en un celular y la
                  lectura sea "arriba o abajo de la raya". */}
              {before && before.count > 0 && (
                <span
                  className={s.barPrevious}
                  style={{ bottom: `${Math.min((before.count / maxCount) * 100, 100)}%` }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}

        {shown && active !== null && (
          <div
            className={s.tooltip}
            aria-hidden="true"
            // Se ancla en la barra y se corre en la misma proporción: centrado
            // en el medio, pegado al borde en los extremos. Nunca se sale de
            // la tarjeta, sea cual sea su ancho.
            style={{
              left: `${((active + 0.5) / days.length) * 100}%`,
              transform: `translateX(-${((active + 0.5) / days.length) * 100}%)`,
            }}
          >
            <span className={s.tooltipMain}>
              <strong>{shown.count.toLocaleString("es-AR")}</strong>
              <span>{shown.count === 1 ? "visita" : "visitas"}</span>
              <small>{formatDayLong(shown.date)}</small>
            </span>
            {shownPrevious && (
              <small className={s.tooltipPrevious}>
                {shownPrevious.count.toLocaleString("es-AR")} el {formatDay(shownPrevious.date)}
              </small>
            )}
          </div>
        )}
      </div>

      <div className={s.chartAxis}>
        <span>{formatDay(days[0]?.date)}</span>
        {previous && (
          <span className={s.chartLegend}>
            <i className={s.legendPrevious} aria-hidden /> Mismo día del período anterior
          </span>
        )}
        <span>{formatDay(days.at(-1)?.date)}</span>
      </div>

      <details className={s.dailyDetails}>
        <summary>Ver detalle de visitas por día</summary>
        <table className={s.dataTable}>
          <caption>Visitas por día de los últimos {days.length} días</caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Visitas</th>
              {previous && <th scope="col">Período anterior</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.date}>
                <th scope="row">{formatDayLong(d.date)}</th>
                <td>{d.count}</td>
                {previous && <td>{previous[i].count} ({formatDay(previous[i].date)})</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
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

const HOUR_TICKS = [0, 6, 12, 18, 23];

function HourlyCard({ hourly, periodStart, wide }: { hourly: HourlyInsights; periodStart: string; wide: boolean }) {
  const max = Math.max(1, ...hourly.hours);
  const { peak } = hourly;
  const inPeak = (hour: number) => !!peak && hourly.enough && (hour - peak.start + 24) % 24 < 3;
  const partial = hourly.from !== null && hourly.from > periodStart;

  return (
    <section className={`${s.card} ${wide ? s.cardWide : ""}`}>
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
          <div className={s.hourChart} aria-hidden>
            {hourly.hours.map((value, hour) => (
              <span
                key={hour}
                className={`${s.hourBar} ${inPeak(hour) ? s.hourBarPeak : ""} ${value === 0 ? s.barEmpty : ""}`}
                style={{ height: `${value > 0 ? Math.max((value / max) * 100, 6) : 3}%` }}
              />
            ))}
          </div>
          <div className={s.hourAxis} aria-hidden>
            {HOUR_TICKS.map(hour => (
              <span key={hour} style={{ gridColumn: hour + 1 }}>{hour} h</span>
            ))}
          </div>
          <details className={s.dailyDetails}>
            <summary>Ver visitas por hora</summary>
            <table className={s.dataTable}>
              <caption>Visitas por hora del día, sumadas en el período</caption>
              <thead>
                <tr><th scope="col">Hora</th><th scope="col">Visitas</th></tr>
              </thead>
              <tbody>
                {hourly.hours.map((value, hour) => (
                  <tr key={hour}>
                    <th scope="row">{hour} a {(hour + 1) % 24} h</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

// ── Cómo llegan y qué hacen ───────────────────────────────────────────────────

function AudienceCard({ audience, periodStart }: { audience: AudienceInsights; periodStart: string }) {
  const partial = audience.from !== null && audience.from > periodStart;
  return (
    <section className={`${s.card} ${s.cardWide}`}>
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
          <div className={s.fact}>
            <p className={s.summaryLabel}>Llegaron por el QR</p>
            <p className={s.factValue}>{formatPercent(audience.qrShare ?? 0)}</p>
            <p className={s.summaryFoot}>
              {audience.qrShare
                ? "El resto entró por un link compartido, redes o buscadores."
                : "Los QR impresos antes de esta actualización cuentan como link: descargalo de nuevo desde Inicio para medirlo."}
            </p>
          </div>
          {audience.returningShare !== null && (
            <div className={s.fact}>
              <p className={s.summaryLabel}>Vuelven</p>
              <p className={s.factValue}>{formatPercent(audience.returningShare)}</p>
              <p className={s.summaryFoot}>de los visitantes de cada día ya habían abierto la carta otro día desde el mismo dispositivo</p>
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

// "entre las 20 y las 23 h", "entre las 23 y la 1 h", "entre las 21 h y la medianoche".
function hourRange(start: number, end: number) {
  if (end === 0) return `entre las ${start} h y la medianoche`;
  return `entre ${start === 1 ? "la 1" : `las ${start}`} y ${end === 1 ? "la 1" : `las ${end}`} h`;
}

function formatDay(dateStr?: string) {
  return formatDateAR(dateStr, { day: "numeric", month: "short", fallback: "" });
}

function formatDayLong(dateStr?: string) {
  return formatDateAR(dateStr, { weekday: "short", day: "numeric", month: "short", fallback: "" });
}

// Un decimal solo cuando aporta: "53" se lee mejor que "53,0".
function formatDecimal(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  foot,
  trend,
  accent,
}: {
  label: string;
  value: number;
  foot?: string;
  trend?: number | null;
  accent?: boolean;
}) {
  return (
    <div className={`${s.summaryCard} ${accent ? s.summaryCardAccent : ""}`}>
      <p className={s.summaryLabel}>{label}</p>
      <p className={s.summaryValue}>
        {formatDecimal(value)}
        {typeof trend === "number" && (
          <span className={`${s.trend} ${trend > 0 ? s.trendUp : trend < 0 ? s.trendDown : ""}`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
          </span>
        )}
      </p>
      {foot && <p className={s.summaryFoot}>{foot}</p>}
    </div>
  );
}

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
