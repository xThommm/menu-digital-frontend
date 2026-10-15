import type { Order } from "../types";
import { isRefundable } from "./payment.ts";

// Qué se puede hacer hoy con un pedido del tablero. Lo usan los botones de la
// tarjeta (OrderCard) y su menú contextual, así los dos ofrecen lo mismo.

export interface OrderFlow {
  /** Pagado online: cancelarlo implica decidir la devolución. */
  paid: boolean;
  /** Un repartidor lo tiene asignado o ya salió con él. */
  courierActive: boolean;
  /** Delivery listo que todavía no salió: el paso siguiente es "Salió el pedido". */
  toDispatch: boolean;
  canConfirm: boolean;
  canMarkReady: boolean;
  /** Con repartidor, la entrega la registra él (con el código del cliente). */
  canDeliver: boolean;
}

export function orderFlow(order: Order, { refunds, dispatch }: { refunds: boolean; dispatch: boolean }): OrderFlow {
  const courierActive = order.delivery?.status === "assigned" || order.delivery?.status === "picked_up";
  return {
    paid: refunds && isRefundable(order),
    courierActive,
    toDispatch: order.status === "ready" && order.serviceType === "delivery" && !order.dispatchedAt && !courierActive && dispatch,
    canConfirm: order.status === "pending",
    canMarkReady: order.status === "confirmed",
    canDeliver: (order.status === "confirmed" || order.status === "ready") && !courierActive,
  };
}
