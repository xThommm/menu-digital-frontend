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
  // Todos los del tablero (también entregados y cancelados), del más viejo al más nuevo.
  all: Order[];
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
    all: [...board.orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
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
  // Todas las cargadas (cualquier fecha y estado), por fecha y horario: el
  // calendario de la agenda filtra sobre estas.
  all: OwnerReservation[];
  // Desde qué fecha hay datos (YYYY-MM-DD); antes de eso el calendario no muestra nada.
  from: string;
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
    all: [...list.reservations].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    from: list.from,
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

// Qué tarjetas de pedidos y reservas tienen algo para mostrar en el inicio.
// Una tarjeta sin datos no se dibuja: las demás ocupan su lugar.
export interface ActivityShape {
  // Agenda: hay reservas cargadas o pedidos de hoy.
  agenda: boolean;
  // Estado de pedidos y tabla: hay pedidos en curso.
  orders: boolean;
  // Cifra "Reservas hoy".
  reservations: boolean;
}

export const EMPTY_ACTIVITY_SHAPE: ActivityShape = { agenda: false, orders: false, reservations: false };

/**
 * Cada clave es true/false con los datos ya cargados y undefined mientras
 * cargan. Una fuente en null (falló, el plan no la incluye o el dueño apagó
 * la opción en Configuración) cuenta como sin datos.
 */
export function activityShape(
  orders: OrdersSummary | null | undefined,
  reservations: ReservationsSummary | null | undefined,
): Partial<ActivityShape> {
  const anything = (orders?.all.length ?? 0) > 0 || (reservations?.all.length ?? 0) > 0;
  return {
    agenda: anything ? true : orders === undefined || reservations === undefined ? undefined : false,
    orders: orders === undefined ? undefined : (orders?.active ?? 0) > 0,
    reservations: reservations === undefined ? undefined : (reservations?.today ?? 0) > 0,
  };
}

// Lo que se dibuja: lo ya cargado y, para lo que falta, lo que había la
// última vez (así un local con movimiento ve los esqueletos de siempre y uno
// sin datos no ve aparecer y desaparecer tarjetas).
export function resolveActivityShape(loaded: Partial<ActivityShape>, last: ActivityShape): ActivityShape {
  return {
    agenda: loaded.agenda ?? last.agenda,
    orders: loaded.orders ?? last.orders,
    reservations: loaded.reservations ?? last.reservations,
  };
}

export function isActivityShape(value: unknown): value is ActivityShape {
  if (!value || typeof value !== "object") return false;
  const shape = value as Record<string, unknown>;
  return typeof shape.agenda === "boolean" && typeof shape.orders === "boolean" && typeof shape.reservations === "boolean";
}
