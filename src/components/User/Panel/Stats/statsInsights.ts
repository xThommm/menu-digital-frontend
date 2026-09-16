import type { DayCount, StatsData } from "../../../../types/index.ts";
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

// Fecha de calendario para calcular el día semanal con getters UTC.
export function parseLocalDate(dateStr?: string): Date | null {
  const day = formatDateAR(dateStr, { output: "date-input", fallback: "" });
  return day ? new Date(`${day}T00:00:00Z`) : null;
}
