import type { OrderSource, OrderStatus } from "../types";

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export const formatTime = (iso: string) => timeFormatter.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso));

// "hace 3 min" — el panel lo recalcula en cada consulta.
export const minutesSince = (iso: string, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

export const elapsedLabel = (iso: string, now = Date.now()) => {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h ${minutes % 60} min`;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Sin confirmar",
  confirmed: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
  returned: "Devuelto",
};

export const SOURCE_LABEL: Record<OrderSource, string> = {
  customer: "Desde la mesa (QR)",
  waiter: "Mozo",
  panel: "Cargado en el panel",
};
