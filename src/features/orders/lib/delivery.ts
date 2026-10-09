import type { AssignmentStatus, CourierOrder, Order } from "../types";

// Reglas y textos de Delivery que comparten el panel del local, la app del
// repartidor y el seguimiento del cliente. Todo puro (sin React ni red).

export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  assigned: "Asignado",
  picked_up: "En camino",
  delivered: "Entregado",
  released: "Liberado",
};

// Enlace para abrir la dirección en la app de mapas del celular (Google Maps).
export const mapsUrl = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;

// Enlace de WhatsApp con el teléfono tal cual se cargó (solo dígitos); null si no sirve.
export const phoneHref = (phone: string | null | undefined): string | null => {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 6 ? `tel:${digits}` : null;
};

// Lo que se tipea en el campo del código: solo dígitos, máximo 6.
export const sanitizeCodeInput = (value: string): string => value.replace(/\D/g, "").slice(0, 6);

export const isCodeComplete = (value: string): boolean => /^\d{6}$/.test(value);

// "123 456" para leerlo mejor.
export const formatCode = (code: string): string => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

// Estado de una entrega vista desde el panel del local.
export const deliveryStageLabel = (order: Pick<Order, "status" | "dispatchedAt" | "delivery">): string => {
  const assignment = order.delivery;
  if (assignment?.status === "delivered" || order.status === "delivered") return "Entregado";
  if (assignment?.status === "picked_up" || (order.status === "ready" && order.dispatchedAt)) return "En camino";
  if (assignment?.status === "assigned") return order.status === "ready" ? "Listo para retirar" : "Asignado · en preparación";
  if (order.status === "ready") return "Listo, sin repartidor";
  return "Sin repartidor";
};

// Minutos desde un momento (sin pasarse de cero) hasta ahora.
export const minutesFrom = (iso: string | null | undefined, now: number): number | null => {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : Math.max(0, Math.floor((now - time) / 60_000));
};

export const minutesLabel = (minutes: number | null): string => {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

// Qué puede hacer el repartidor con un pedido suyo.
export type CourierAction = "wait" | "pickup" | "deliver" | "none";

export const courierAction = (order: CourierOrder): CourierAction => {
  const status = order.assignment?.status;
  if (status === "picked_up") return "deliver";
  if (status === "assigned") return order.canPickup ? "pickup" : "wait";
  return "none";
};

// Mensaje para el repartidor cuando el pedido todavía no está listo.
export const waitText = (order: CourierOrder): string =>
  order.orderStatus === "confirmed" ? "El local todavía lo está preparando." : "Esperando que el local lo marque como listo.";

// Dirección y referencias en una sola línea (para tarjetas compactas).
export const addressLine = (order: Pick<CourierOrder, "address" | "deliveryNotes">): string =>
  [order.address, order.deliveryNotes].filter(Boolean).join(" · ");

// Resumen de la configuración para mostrar en el panel.
export const confirmByLabel = (confirmBy: "courier" | "courier_admin", override: boolean): string => {
  if (confirmBy === "courier_admin") return "El repartidor (con el código) o el administrador";
  return override
    ? "Solo el repartidor; el administrador puede resolver incidencias con motivo"
    : "Solo el repartidor con el código del cliente";
};

// Aviso interno: la configuración de pedidos cambió (la barra lateral muestra
// u oculta Delivery según el interruptor).
export const ORDERS_SETTINGS_CHANGED = "md:orders-settings-changed";
