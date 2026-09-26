import type { DayCount, StatsData, TopItemStat } from "../../../../types/index.ts";
import { formatDateAR } from "../../../../lib/dates.ts";

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// El gráfico semanal arranca en lunes, que es como se lee una semana acá.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface WeekdayStat {
  weekday: number;
  label: string;
  average: number;
  samples: number;
}

interface Insights {
  total: number;
  today: number;
  previous: number;
  averageDays: number;
  /** Variación contra el período anterior de igual duración. */
  trend: number | null;
  dailyAverage: number;
  best: DayCount | null;
  weekdays: WeekdayStat[];
  bestWeekday: WeekdayStat | null;
  hasWeekdayPattern: boolean;
}

// El servidor define fechas y ventanas completas en Buenos Aires.
export function buildInsights(stats: StatsData | null): Insights {
  const days = stats?.days ?? [];
  const totalViews = stats?.totalViews ?? 0;
  const previous = stats?.previousTotalViews ?? 0;
  const trend = stats?.comparisonAvailable && previous > 0
    ? Math.round(((totalViews - previous) / previous) * 100) : null;
  // El día del alta es parcial. Los ceros anteriores tampoco son muestras.
  const observedFrom = stats?.observedFrom;
  const observedDays = observedFrom ? days.filter(day => day.date > observedFrom) : [];

  const best = days.reduce<DayCount | null>(
    (top, day) => (day.count > 0 && (!top || day.count > top.count) ? day : top),
    null,
  );

  // Promedio por día de la semana: en un negocio gastronómico el patrón
  // semanal dice más que el total, porque es lo accionable (qué día reforzar,
  // cuándo conviene la promo).
  const buckets = new Map<number, { sum: number; samples: number }>();
  observedDays.forEach((day) => {
    const weekday = parseLocalDate(day.date)?.getUTCDay();
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
    today: stats?.todayViews ?? 0,
    previous,
    averageDays: observedDays.length,
    trend,
    dailyAverage: observedDays.length > 0 ? observedDays.reduce((sum, day) => sum + day.count, 0) / observedDays.length : 0,
    best,
    weekdays,
    bestWeekday,
    hasWeekdayPattern: weekdays.every(day => day.samples >= 2) && observedDays.some(day => day.count > 0),
  };
}

// ── Horarios pico ─────────────────────────────────────────────────────────────

// Con menos visitas con hora, un "pico" es ruido.
export const HOURLY_MIN_VISITS = 20;
// Ancho de la franja pico: en gastronomía el servicio dura unas horas, y
// una sola hora parte en dos el pico de la cena.
const PEAK_HOURS = 3;

export interface HourlyInsights {
  hours: number[];
  total: number;
  from: string | null;
  enough: boolean;
  /** Franja de 3 horas con más visitas (puede cruzar la medianoche). */
  peak: { start: number; end: number; share: number } | null;
}

export function buildHourly(stats: StatsData | null): HourlyInsights | null {
  if (!stats?.hours) return null;
  const hours = stats.hours;
  const total = hours.reduce((sum, value) => sum + value, 0);
  let peak: HourlyInsights["peak"] = null;
  if (total > 0) {
    for (let start = 0; start < 24; start += 1) {
      let sum = 0;
      for (let offset = 0; offset < PEAK_HOURS; offset += 1) sum += hours[(start + offset) % 24];
      if (!peak || sum > peak.share) peak = { start, end: (start + PEAK_HOURS) % 24, share: sum };
    }
    if (peak) peak = { ...peak, share: peak.share / total };
  }
  return { hours, total, from: stats.hoursFrom ?? null, enough: total >= HOURLY_MIN_VISITS, peak };
}

// ── Cómo llegan y qué hacen ───────────────────────────────────────────────────

export interface FunnelStep {
  key: "visits" | "engaged" | "carts" | "orders";
  label: string;
  count: number;
  /** Proporción sobre las visitas medidas (0-1). */
  rate: number;
}

export interface AudienceInsights {
  from: string | null;
  visits: number;
  funnel: FunnelStep[];
  qrShare: number | null;
  returningShare: number | null;
  visitors: number;
}

export function buildAudience(stats: StatsData | null, { showOrders }: { showOrders: boolean }): AudienceInsights | null {
  const audience = stats?.audience;
  if (!audience || audience.visits === 0) return null;
  const { visits } = audience;
  const rate = (count: number) => Math.min(count / visits, 1);
  const funnel: FunnelStep[] = [
    { key: "visits", label: "Abrieron la carta", count: visits, rate: 1 },
    { key: "engaged", label: "Miraron un producto", count: audience.engaged, rate: rate(audience.engaged) },
  ];
  // Sin pedido por WhatsApp en el plan, esos pasos serían ceros que no dicen nada.
  if (showOrders || audience.carts > 0 || audience.orders > 0) {
    funnel.push(
      { key: "carts", label: "Armaron un pedido", count: audience.carts, rate: rate(audience.carts) },
      { key: "orders", label: "Lo mandaron por WhatsApp", count: audience.orders, rate: rate(audience.orders) },
    );
  }
  return {
    from: audience.from,
    visits,
    funnel,
    qrShare: rate(audience.qr),
    returningShare: audience.visitors > 0 ? Math.min(audience.returning / audience.visitors, 1) : null,
    visitors: audience.visitors,
  };
}

// ── Variación por producto ────────────────────────────────────────────────────

export type ItemTrend = { kind: "new" } | { kind: "change"; pct: number } | null;

// Con menos vistas en el período anterior, cualquier porcentaje exagera
// (de 1 a 3 vistas es "+200%").
const ITEM_TREND_MIN_BASE = 3;

export function itemTrend(item: TopItemStat, comparisonAvailable: boolean): ItemTrend {
  if (!comparisonAvailable || item.totalViews === 0) return null;
  if (item.previousViews === 0) return { kind: "new" };
  if (item.previousViews < ITEM_TREND_MIN_BASE) return null;
  const pct = Math.round(((item.totalViews - item.previousViews) / item.previousViews) * 100);
  return Math.abs(pct) >= 10 ? { kind: "change", pct } : null;
}

// Producto muy mirado que casi no se pide: la señal más accionable del
// ranking (foto, precio o descripción no convencen). Solo con pedidos en uso
// en el período — si nadie pidió nada, que un producto no se pida no dice nada.
const LOW_CONVERSION_MIN_VIEWS = 10;
const LOW_CONVERSION_RATE = 0.05;

export function lowConversionItem(items: TopItemStat[]): (TopItemStat & { orders: number }) | null {
  if (!items.some(item => (item.orders ?? 0) > 0)) return null;
  const candidate = items
    .filter(item => item.orders !== undefined && item.totalViews >= LOW_CONVERSION_MIN_VIEWS
      && item.orders / item.totalViews < LOW_CONVERSION_RATE)
    .sort((a, b) => b.totalViews - a.totalViews)[0];
  return candidate ? { ...candidate, orders: candidate.orders ?? 0 } : null;
}

// Fecha de calendario para calcular el día semanal con getters UTC.
export function parseLocalDate(dateStr?: string): Date | null {
  const day = formatDateAR(dateStr, { output: "date-input", fallback: "" });
  return day ? new Date(`${day}T00:00:00Z`) : null;
}
