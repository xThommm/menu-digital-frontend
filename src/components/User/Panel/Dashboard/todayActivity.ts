import type { StatsData } from "../../../../types/index.ts";
import type { BoardResponse } from "../../../../features/orders/types.ts";
import type { ReservationList } from "../../../../features/reservations/api/reservationsApi.ts";

// Resúmenes de "Hoy" del inicio del panel: funciones puras sobre las
// respuestas que ya usan Estadísticas, Gestión de pedidos y Reservas.

export interface VisitsSummary {
  today: number;
  week: number;
  // Variación contra los 7 días anteriores, en %; null si no hay con qué comparar.
  delta: number | null;
  series: number[];
}

export function summarizeVisits(stats: StatsData): VisitsSummary {
  const comparable = stats.comparisonAvailable && stats.previousTotalViews > 0;
  return {
    today: stats.todayViews,
    week: stats.totalViews,
    delta: comparable
      ? Math.round(((stats.totalViews - stats.previousTotalViews) / stats.previousTotalViews) * 100)
      : null,
    series: stats.days.map(day => day.count),
  };
}

export interface OrdersSummary {
  shiftOpen: boolean;
  // Sin entregar ni cancelar: por confirmar + en preparación + listos.
  active: number;
  pending: number;
  ready: number;
}

export function summarizeOrders(board: BoardResponse): OrdersSummary {
  const count = (status: string) => board.orders.filter(order => order.status === status).length;
  const pending = count("pending");
  const ready = count("ready");
  return {
    shiftOpen: board.openShift !== null,
    active: pending + count("confirmed") + ready,
    pending,
    ready,
  };
}

export interface ReservationsSummary {
  // Reservas de hoy que siguen en pie (confirmadas o esperando respuesta).
  today: number;
  // Las que esperan respuesta, de cualquier fecha.
  pending: number;
  // Hora de la próxima confirmada de hoy que todavía no pasó ("21:00"), si hay.
  next: string | null;
}

export function summarizeReservations(list: ReservationList, today: string, nowTime: string): ReservationsSummary {
  const todays = list.reservations.filter(r => r.date === today && (r.status === "confirmed" || r.status === "pending"));
  const upcoming = todays
    .filter(r => r.status === "confirmed" && r.time >= nowTime)
    .map(r => r.time)
    .sort();
  return {
    today: todays.length,
    pending: list.pendingCount,
    next: upcoming[0] ?? null,
  };
}

// Puntos de la mini curva de visitas, en un lienzo de `width` x `height`.
export function sparklinePoints(series: number[], width: number, height: number): string {
  if (series.length < 2) return "";
  const max = Math.max(...series, 1);
  const step = width / (series.length - 1);
  return series
    .map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`)
    .join(" ");
}

// Días que le quedan al plan (redondeo hacia arriba); null sin fecha válida.
export function daysUntil(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  const time = new Date(expiresAt).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - now) / 86_400_000);
}
