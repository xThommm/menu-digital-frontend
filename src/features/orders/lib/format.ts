import type { Order, OrderSource, OrderStatus, ServiceType } from "../types";

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

// "3 h 24 min" entre dos momentos (o hasta ahora).
export const durationLabel = (fromIso: string, toIso: string | null = null, now = Date.now()) => {
  const end = toIso ? new Date(toIso).getTime() : now;
  const minutes = Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
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
  waiter: "Operador",
  panel: "Cargado en el panel",
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  table: "Mesa",
  counter: "Barra",
  takeaway: "Take away",
  delivery: "Delivery",
};

// Dónde va el pedido: "Mesa 4", "Barra", "Take away" o "Delivery".
export const placeLabel = (order: Pick<Order, "serviceType" | "tableNumber">) =>
  order.serviceType === "table" && order.tableNumber
    ? `Mesa ${order.tableNumber}`
    : SERVICE_LABEL[order.serviceType === "table" ? "counter" : order.serviceType];
