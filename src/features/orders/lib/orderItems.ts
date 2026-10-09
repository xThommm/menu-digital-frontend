import type { OnlineCheckoutStatus, Order, OrderItem, PlainOrderLine } from "../types";

// Pedidos que no siguen su curso natural: qué se puede hacer con cada producto
// de un pedido en curso (quitarlo, restaurarlo, entregarlo antes que el resto)
// y los textos que lo acompañan. Todo puro (sin React ni red); el servidor
// vuelve a validar cada regla.

// Motivos rápidos al quitar un producto; el primero es el más común.
export const ITEM_REMOVE_REASONS = ["Sin stock", "Lo pidió el cliente", "Error de carga"];

// Motivos rápidos al cancelar un pedido entero.
export const CANCEL_REASONS = ["Sin stock", "El cliente no vino", "Lo pidió el cliente", "Error de carga"];

const ACTIVE = ["pending", "confirmed", "ready"];

type OrderState = Pick<Order, "status" | "serviceType" | "dispatchedAt" | "items">;

// Un pedido en curso que todavía no salió del local.
export const canEditItems = (order: Pick<Order, "status" | "dispatchedAt">): boolean =>
  ACTIVE.includes(order.status) && !order.dispatchedAt;

// Lo último que queda no se quita (eso es cancelar el pedido), salvo bajarle la cantidad.
export const canRemoveItem = (order: OrderState, item: Pick<OrderItem, "quantity" | "deliveredAt">): boolean =>
  canEditItems(order) && !item.deliveredAt && (order.items.length > 1 || item.quantity > 1);

// Cuántas unidades se pueden quitar de esa línea sin vaciar el pedido.
export const maxRemovable = (order: Pick<Order, "items">, item: Pick<OrderItem, "quantity">): number =>
  order.items.length > 1 ? item.quantity : item.quantity - 1;

// Entrega en partes: pedidos confirmados que no son delivery y tienen más de un producto.
export const canDeliverItems = (order: OrderState): boolean =>
  (order.status === "confirmed" || order.status === "ready") && order.serviceType !== "delivery" && order.items.length > 1;

// Con plata ya devuelta el producto no puede volver al pedido.
export const canRestoreItems = (order: Pick<Order, "status" | "dispatchedAt" | "paymentMode" | "paymentStatus">): boolean =>
  canEditItems(order) && !(order.paymentMode === "mercadopago" && order.paymentStatus !== "APPROVED");

// "Entregado 2 de 5" (null si todavía no se entregó nada).
export const deliveryProgress = (order: Pick<Order, "items">): { delivered: number; total: number } | null => {
  const delivered = order.items.filter(item => item.deliveredAt).length;
  return delivered > 0 ? { delivered, total: order.items.length } : null;
};

const lineText = (line: PlainOrderLine) => `${line.quantity}× ${line.title}${line.option ? ` (${line.option})` : ""}`;

export const linesText = (lines: PlainOrderLine[]): string => lines.map(lineText).join(", ");

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

// Seguimiento del cliente: el local quitó productos de su pedido pagado online.
// null si no se quitó nada o si el pedido ya no sigue (ahí manda el mensaje de
// cancelación).
export interface RemovedNotice { title: string; items: string; text: string }

export const removedNotice = (
  status: Pick<OnlineCheckoutStatus, "orderStatus" | "total" | "orderTotal" | "refund" | "removedItems"> | null,
): RemovedNotice | null => {
  const removed = status?.removedItems ?? [];
  if (!status || removed.length === 0) return null;
  if (status.orderStatus === "cancelled" || status.orderStatus === "returned") return null;
  const difference = status.orderTotal === undefined ? 0 : Math.max(0, status.total - status.orderTotal);
  const refund = status.refund === "none"
    ? `Te vamos a devolver ${difference > 0 ? money(difference) : "la diferencia"} a tu cuenta de Mercado Pago.`
    : "Ya te devolvimos la diferencia a tu cuenta de Mercado Pago; puede tardar unos días en verse reflejada.";
  return {
    title: removed.length === 1 ? "Un producto no está disponible" : "Algunos productos no están disponibles",
    items: linesText(removed),
    text: `El resto de tu pedido sigue en marcha${status.orderTotal === undefined ? "" : ` (total ${money(status.orderTotal)})`}. ${refund}`,
  };
};

// Mensaje de WhatsApp para avisarle al cliente que falta algo de su pedido y
// que decida si sigue con el resto. Solo usa lo que el local ya ve en el pedido.
export const stockNoticeMessage = (
  order: Pick<Order, "number" | "customerName" | "total" | "removedItems" | "refundDue" | "paymentMode">,
): string => {
  const removed = order.removedItems ?? [];
  const name = order.customerName?.trim();
  const paid = order.paymentMode === "mercadopago";
  return [
    `¡Hola${name ? ` ${name}` : ""}! Te escribimos por tu pedido #${order.number}.`,
    removed.length === 1 ? "Lamentablemente no nos queda:" : "Lamentablemente no nos quedan:",
    ...removed.map(line => `• ${lineText(line)}`),
    "",
    `¿Querés recibir el resto del pedido (total ${money(order.total)}) o preferís cancelarlo?`,
    ...(paid
      ? [order.refundDue && order.refundDue > 0
        ? `Si seguimos, te devolvemos ${money(order.refundDue)} por Mercado Pago. Si lo cancelás, te devolvemos todo.`
        : "Lo que ya no va te lo devolvemos por Mercado Pago."]
      : []),
  ].join("\n");
};
