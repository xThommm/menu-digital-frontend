import type { StatsData } from "../../../../types/index.ts";
import type { BoardResponse, Order } from "../../../../features/orders/types.ts";
import type { ReservationList } from "../../../../features/reservations/api/reservationsApi.ts";
import type { OwnerReservation } from "../../../../features/reservations/types.ts";

export const formatCount = (value: number) => value.toLocaleString("es-AR");

// Resúmenes de "Hoy" del inicio del panel: funciones puras sobre las
// respuestas que ya usan Estadísticas, Gestión de pedidos y Reservas.

export interface VisitsSummary {
  today: number;
  week: number;
  // Variación contra los 7 días anteriores, en %; null si no hay con qué comparar.
  delta: number | null;
  series: number[];
  // Fechas (YYYY-MM-DD) de cada punto de `series`, para el eje del gráfico.
  dates: string[];
  // Parte de las visitas que abrió un producto (0..1); null sin datos de audiencia o sin visitas.
  engagement: number | null;
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
    dates: stats.days.map(day => day.date),
    engagement: stats.audience && stats.audience.visits > 0
      ? Math.min(stats.audience.engaged / stats.audience.visits, 1)
      : null,
  };
}

export interface OrdersSummary {
  shiftOpen: boolean;
  // Sin entregar ni cancelar: por confirmar + en preparación + listos.
  active: number;
  pending: number;
  confirmed: number;
  ready: number;
  // Los pedidos en curso, del más viejo al más nuevo.
  list: Order[];
}

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "ready"]);

export function summarizeOrders(board: BoardResponse): OrdersSummary {
  const count = (status: string) => board.orders.filter(order => order.status === status).length;
  const pending = count("pending");
  const confirmed = count("confirmed");
  const ready = count("ready");
  return {
    shiftOpen: board.openShift !== null,
    active: pending + confirmed + ready,
    pending,
    confirmed,
    ready,
    list: board.orders
      .filter(order => ACTIVE_STATUSES.has(order.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export interface ReservationsSummary {
  // Reservas de hoy que siguen en pie (confirmadas o esperando respuesta).
  today: number;
  // Las que esperan respuesta, de cualquier fecha.
  pending: number;
  // Hora de la próxima confirmada de hoy que todavía no pasó ("21:00"), si hay.
  next: string | null;
  // Las de hoy que siguen en pie, por horario.
  list: OwnerReservation[];
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
    list: [...todays].sort((a, b) => a.time.localeCompare(b.time)),
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
