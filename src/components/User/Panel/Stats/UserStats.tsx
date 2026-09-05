import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../context/useAuth";
import { useNotifications } from "../../../../context/useNotifications";
import type { StatsData, ItemStatsData, DayCount } from "../../../../types";
import { usePlans } from "../../../../hooks/usePlans";
import { isSubscriptionExpired, PLAN_ORDER } from "../../../../lib/plans";
import UpgradeModal from "../../../Common/UpgradeModal";
import s from "./UserStats.module.css";

// Pega a /me/stats y devuelve el resultado ya interpretado. Es pura (no toca
// estado de React ni el DOM), así se puede reusar desde la carga inicial y
// desde el refresh automático sin duplicar el fetch y sin volverse una
// dependencia de efectos. Los efectos hacen el setState después del await.
type StatsResult =
  | { kind: "locked" }               // 403 — el plan del usuario no incluye stats
  | { kind: "unauthorized" }         // 401 — token vencido/revocado
  | { kind: "data"; data: StatsData } // 200 — datos ok
  | { kind: "none" };                // otro estado — no tocamos nada

async function requestStats(token: string): Promise<StatsResult> {
  const res = await fetch("/api/users/me/stats", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 403) return { kind: "locked" };
  if (res.ok) return { kind: "data", data: await res.json() };
  return { kind: "none" };
}

// Mismo patrón que requestStats, para el endpoint de "platos más vistos"
// (mismo gate de plan — si /me/stats no está bloqueado, este tampoco).
type ItemStatsResult =
  | { kind: "unauthorized" }
  | { kind: "data"; data: ItemStatsData }
  | { kind: "none" };

async function requestItemStats(token: string): Promise<ItemStatsResult> {
  const res = await fetch("/api/users/me/item-stats", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.ok) return { kind: "data", data: await res.json() };
  return { kind: "none" };
}

// ── Lectura de los datos ──────────────────────────────────────────────────────
// Todo lo de acá sale de la misma serie de 30 días que ya devolvía el backend:
// no hay endpoints nuevos, es la misma información contada de otra manera.

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// En la frase el día va completo y en plural: "los sáb" no se lee como
// castellano. Lunes a viernes no cambian en plural; sábado y domingo sí.
const WEEKDAY_PLURAL = [
  "domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados",
];
// El gráfico semanal arranca en lunes, que es como se lee una semana acá.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface WeekdayStat {
  weekday: number;
  label: string;
  average: number;
  samples: number;
}

interface Insights {
  total: number;
  today: number;
  last7: number;
  previous7: number;
  /** Variación de los últimos 7 días contra los 7 anteriores. */
  trend: number | null;
  dailyAverage: number;
  best: DayCount | null;
  weekdays: WeekdayStat[];
  bestWeekday: WeekdayStat | null;
  /** Días distintos con al menos una visita. */
  daysWithViews: number;
}

// Piso de datos para mostrar el patrón semanal. Con una carta publicada hace
// pocos días, cada día de la semana tiene una sola medición: un martes bueno
// alcanzaría para que la app afirme "los martes son tu mejor día", que es
// ruido disfrazado de conclusión. Con diez días con visitas ya hay al menos
// un par de mediciones por día y la comparación empieza a significar algo.
const MIN_DAYS_FOR_WEEKDAY_PATTERN = 10;

function buildInsights(days: DayCount[], totalViews: number): Insights {
  const last7 = days.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const previous7 = days.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);

  // Sin base previa no hay porcentaje: dividir por cero da "+∞%", y una carta
  // recién publicada siempre "creció". Mismo criterio que el CRM.
  const trend = previous7 > 0 ? Math.round(((last7 - previous7) / previous7) * 100) : null;

  const best = days.reduce<DayCount | null>(
    (top, day) => (day.count > 0 && (!top || day.count > top.count) ? day : top),
    null,
  );

  // Promedio por día de la semana: en un negocio gastronómico el patrón
  // semanal dice más que el total, porque es lo accionable (qué día reforzar,
  // cuándo conviene la promo).
  const buckets = new Map<number, { sum: number; samples: number }>();
  days.forEach((day) => {
    const weekday = parseLocalDate(day.date)?.getDay();
    if (weekday === undefined) return;
    const bucket = buckets.get(weekday) ?? { sum: 0, samples: 0 };
    bucket.sum += day.count;
    bucket.samples += 1;
    buckets.set(weekday, bucket);
  });

  const weekdays: WeekdayStat[] = WEEKDAY_ORDER.map((weekday) => {
    const bucket = buckets.get(weekday);
    return {
      weekday,
      label: WEEKDAY_LABEL[weekday],
      average: bucket && bucket.samples > 0 ? bucket.sum / bucket.samples : 0,
      samples: bucket?.samples ?? 0,
    };
  });

  const bestWeekday = weekdays.reduce<WeekdayStat | null>(
    (top, day) => (day.average > 0 && (!top || day.average > top.average) ? day : top),
    null,
  );

  return {
    total: totalViews,
    today: days[days.length - 1]?.count ?? 0,
    last7,
    previous7,
    trend,
    dailyAverage: days.length > 0 ? totalViews / days.length : 0,
    best,
    weekdays,
    bestWeekday,
    daysWithViews: days.filter((day) => day.count > 0).length,
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserStats() {
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
  const { error: notifyError } = useNotifications();

  const [stats, setStats]         = useState<StatsData | null>(null);
  const [itemStats, setItemStats] = useState<ItemStatsData | null>(null);
  const [locked, setLocked]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Carga inicial: el spinner arranca en true (useState) y se apaga cuando la
  // primera request termina. El setState ocurre después del await (no synchrono
  // dentro del efecto), por eso no dispara renders en cascada.
  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;
    const run = async () => {
      try {
        const r = await requestStats(token);
        if (cancelled) return;
        if (r.kind === "unauthorized") { logout(); window.location.href = "/login"; return; }
        if (r.kind === "locked") { setLocked(true); return; }
        if (r.kind === "data") setStats(r.data);
        // Mismo gate de plan que /me/stats — si esa no está bloqueada, esta
        // tampoco. Se pide después (no en paralelo) para no duplicar el
        // manejo del 403 en dos lugares.
        const ir = await requestItemStats(token);
        if (!cancelled && ir.kind === "data") setItemStats(ir.data);
      } catch {
        if (!cancelled) {
          notifyError("No pudimos cargar las estadísticas. Intentá recargar la página.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [authLoading, token, notifyError, logout]);

  // "Tiempo real": las visitas se registran en el backend en el momento
  // (upsert por cada vista de la carta), así que refrescando periódicamente
  // traemos el conteo al día sin recargar la página. Para no gastar red al
  // pedo, solo hacemos polling mientras la pestaña está visible, y además
  // refrescamos apenas el usuario vuelve a la pestaña (visibilitychange).
  useEffect(() => {
    if (authLoading || !token || locked) return;
    const REFRESH_MS = 45_000;
    let intervalId: number | undefined;

    const refresh = async () => {
      try {
        const r = await requestStats(token);
        if (r.kind === "unauthorized") { logout(); window.location.href = "/login"; return; }
        if (r.kind === "locked") setLocked(true);
        else if (r.kind === "data") setStats(r.data);
      } catch {
        // silencioso: es un refresh de fondo, no molestamos al usuario
      }
    };
    const stopPolling = () => {
      if (intervalId !== undefined) { window.clearInterval(intervalId); intervalId = undefined; }
    };
    const startPolling = () => {
      stopPolling();
      intervalId = window.setInterval(refresh, REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh(); // refresco inmediato al volver a la pestaña
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authLoading, token, locked, logout]);

  const days = useMemo(() => stats?.last30Days ?? [], [stats]);
  const totalViews = stats?.totalViews ?? 0;
  const insights = useMemo(() => buildInsights(days, totalViews), [days, totalViews]);

  if (loading) {
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
              Mirá cuántas veces escanearon el QR de tu carta y seguí la tendencia día a día.
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
            Se actualiza solo, sin recargar la página
          </p>
        </header>

        {!hasAnyView ? (
          <EmptyState slug={user?.slug} />
        ) : (
          <>
            <section className={s.summaryRow} aria-label="Resumen de visitas">
              <SummaryCard
                label="Últimos 30 días"
                value={insights.total}
                foot={`${formatDecimal(insights.dailyAverage)} por día en promedio`}
              />
              <SummaryCard
                label="Últimos 7 días"
                value={insights.last7}
                trend={insights.trend}
                foot={
                  insights.trend === null
                    ? "Sin base previa para comparar"
                    : `${insights.previous7.toLocaleString("es-AR")} en los 7 días anteriores`
                }
              />
              {/* "Hoy" va sin comparación a propósito: el día está a medio
                  transcurrir y compararlo contra días completos mostraría
                  siempre una caída que no existe. */}
              <SummaryCard
                label="Hoy"
                value={insights.today}
                foot="Día en curso"
                accent
              />
            </section>

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
              <DailyChart days={days} average={insights.dailyAverage} />
            </section>

            {insights.bestWeekday && insights.daysWithViews >= MIN_DAYS_FOR_WEEKDAY_PATTERN && (
              <section className={s.card}>
                <div className={s.cardHead}>
                  <p className={s.cardLabel}>Tu semana típica</p>
                  <p className={s.cardNote}>
                    Promedio de visitas por día de la semana, sobre los últimos 30 días
                  </p>
                </div>
                <WeekdayChart
                  weekdays={insights.weekdays}
                  best={insights.bestWeekday}
                  dailyAverage={insights.dailyAverage}
                />
              </section>
            )}

            {itemStats && itemStats.topItems.length > 0 && (
              <section className={s.card}>
                <div className={s.cardHead}>
                  <p className={s.cardLabel}>Productos más vistos</p>
                  <p className={s.cardNote}>Últimos {itemStats.windowDays} días</p>
                </div>
                <ol className={s.topItemsList}>
                  {itemStats.topItems.map((it, i) => {
                    const maxViews = itemStats.topItems[0].totalViews || 1;
                    return (
                      <li key={it.itemID} className={s.topItemRow}>
                        <span className={s.topItemRank}>{i + 1}</span>
                        <ItemThumb image={it.image} title={it.title} />
                        <div className={s.topItemMain}>
                          <span className={s.topItemName}>{it.title}</span>
                          <span className={s.topItemBarWrap}>
                            <span
                              className={s.topItemBar}
                              style={{ width: `${Math.max((it.totalViews / maxViews) * 100, 4)}%` }}
                            />
                          </span>
                        </div>
                        <span className={s.topItemCount}>
                          {it.totalViews.toLocaleString("es-AR")}
                          <small>vistas</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── Gráfico de visitas por día ────────────────────────────────────────────────

function DailyChart({ days, average }: { days: DayCount[]; average: number }) {
  // Un índice activo en vez del atributo `title` nativo: `title` no existe en
  // touch, así que en el celular —que es donde el dueño mira esto— el detalle
  // de cada día no se podía ver. Con estado, el mismo tooltip sirve para
  // mouse y para tap.
  const [active, setActive] = useState<number | null>(null);
  const maxCount = Math.max(1, ...days.map(d => d.count));
  const todayIndex = days.length - 1;
  const shown = active !== null ? days[active] : null;

  return (
    <div className={s.chartBlock}>
      <div
        className={s.chart}
        role="img"
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
          const weekday = parseLocalDate(d.date)?.getDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const height = d.count > 0 ? Math.max((d.count / maxCount) * 100, 6) : 3;
          return (
            <div
              key={d.date}
              className={[
                s.barWrap,
                active === i ? s.barWrapActive : "",
                i === todayIndex ? s.barWrapToday : "",
              ].join(" ").trim()}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive((current) => (current === i ? null : i))}
            >
              <div
                className={[
                  s.bar,
                  d.count === 0 ? s.barEmpty : "",
                  isWeekend ? s.barWeekend : "",
                ].join(" ").trim()}
                style={{ height: `${height}%`, animationDelay: `${i * 14}ms` }}
              />
            </div>
          );
        })}

        {shown && active !== null && (
          <div
            className={s.tooltip}
            // Se ancla al centro de la barra y se corre hacia adentro en los
            // extremos para no salirse de la tarjeta.
            style={{
              left: `${((active + 0.5) / days.length) * 100}%`,
              transform: `translateX(${
                active < 3 ? "-12%" : active > days.length - 4 ? "-88%" : "-50%"
              })`,
            }}
          >
            <strong>{shown.count.toLocaleString("es-AR")}</strong>
            <span>{shown.count === 1 ? "visita" : "visitas"}</span>
            <small>{formatDayLong(shown.date)}</small>
          </div>
        )}
      </div>

      <div className={s.chartAxis}>
        <span>{formatDay(days[0]?.date)}</span>
        <span className={s.chartAxisToday}>Hoy</span>
      </div>

      {/* El gráfico es visual; el mismo dato en tabla para lectores de
          pantalla, que no pueden recorrer 30 barras con el mouse. */}
      <table className={s.srOnly}>
        <caption>Visitas por día de los últimos {days.length} días</caption>
        <thead>
          <tr><th scope="col">Día</th><th scope="col">Visitas</th></tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatDayLong(d.date)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
          Los <strong>{WEEKDAY_PLURAL[best.weekday]}</strong> son tu mejor día:{" "}
          {formatDecimal(ratio)}× un día promedio.
        </p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Parseamos "YYYY-MM-DD" como fecha local (no UTC) para que no se corra un
// día en husos horarios negativos como el de Argentina (UTC-3).
function parseLocalDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDay(dateStr?: string) {
  const date = parseLocalDate(dateStr);
  return date ? date.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "";
}

function formatDayLong(dateStr?: string) {
  const date = parseLocalDate(dateStr);
  return date
    ? date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })
    : "";
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
        {value.toLocaleString("es-AR")}
        {typeof trend === "number" && trend !== 0 && (
          <span className={`${s.trend} ${trend > 0 ? s.trendUp : s.trendDown}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
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
      <p className={s.emptyTitle}>Todavía no hay visitas para mostrar</p>
      <p className={s.emptyDesc}>
        Apenas alguien abra tu carta vas a ver acá las visitas por día, tu mejor
        día de la semana y los productos que más miran. Compartí el link o pegá
        el QR en las mesas para empezar.
      </p>
      {slug && (
        <a className={s.emptyLink} href={`/${slug}`} target="_blank" rel="noreferrer">
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
