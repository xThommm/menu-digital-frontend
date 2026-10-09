import type { Order, PaymentStatus } from "../types";

// Pago online (Mercado Pago) de un pedido, aparte del estado del pedido.

const PAID: PaymentStatus[] = ["APPROVED", "PARTIALLY_REFUNDED"];

export const isOnlinePayment = (order: Pick<Order, "paymentMode">) => order.paymentMode === "mercadopago";

// ¿Se puede devolver algo de este pedido?
export const isRefundable = (order: Pick<Order, "paymentMode" | "paymentStatus">) =>
  isOnlinePayment(order) && order.paymentStatus !== undefined && PAID.includes(order.paymentStatus);
