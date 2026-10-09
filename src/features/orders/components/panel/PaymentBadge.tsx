import { CreditCard } from "lucide-react";
import { PAYMENT_LABEL } from "../../lib/format";
import { isOnlinePayment } from "../../lib/payment";
import type { Order } from "../../types";
import p from "./panel.module.css";

// Estado del pago online de un pedido (aparte del estado del pedido: puede
// estar pagado y todavía sin aceptar). No muestra nada si no se cobró online.
export default function PaymentBadge({ order }: { order: Pick<Order, "paymentMode" | "paymentStatus"> }) {
  if (!isOnlinePayment(order) || !order.paymentStatus || order.paymentStatus === "NOT_REQUIRED") return null;
  return (
    <span className={`${p.pay} ${p[`pay_${order.paymentStatus}`]}`} title="Pago con Mercado Pago">
      <CreditCard size={12} aria-hidden /> {PAYMENT_LABEL[order.paymentStatus]}
    </span>
  );
}
