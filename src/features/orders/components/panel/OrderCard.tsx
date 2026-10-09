import { useState } from "react";
import { Link } from "react-router-dom";
import { Bike, Check, ChefHat, HandPlatter, MapPin, MessageCircle, MessageSquareText, Phone, QrCode, Smartphone, Undo2, UserRound, X } from "lucide-react";
import { buildWaLink } from "../../../../lib/whatsapp";
import { elapsedLabel, formatMoney, formatTime, placeLabel, STATUS_LABEL } from "../../lib/format";
import { CANCEL_REASONS, stockNoticeMessage } from "../../lib/orderItems";
import type { Order, OrderStatus, TicketStatus, Waiter } from "../../types";
import { isRefundable } from "../../lib/payment";
import OrderItemsList, { type ItemActions } from "./OrderItemsList";
import PaymentBadge from "./PaymentBadge";
import p from "./panel.module.css";
import s from "./OrdersBoard.module.css";

// Tarjeta de un pedido en el panel: todo lo necesario para prepararlo y
// entregarlo (productos, cantidades, aclaraciones, destino, operador, estado) y los
// botones para avanzarlo.

interface Props {
  order: Order;
  waiters: Waiter[];
  now: number;
  highlight?: boolean;
  busy?: boolean;
  // reason: motivo de la cancelación (opcional).
  onStatus: (order: Order, status: OrderStatus, reason?: string) => void;
  onWaiter: (order: Order, waiterId: number | null) => void;
  // Delivery listo: salió del local (queda «En camino» hasta entregarlo).
  onDispatch?: (order: Order) => void;
  // Devolución de un pedido pagado online; cancel = rechazarlo devolviendo el dinero.
  // amount: importe sugerido (lo que quedó cobrado de más al quitar productos).
  onRefund?: (order: Order, cancel: boolean, amount?: number) => void;
  // Quitar, restaurar o entregar productos sueltos del pedido.
  itemActions?: ItemActions;
}

const SOURCE_ICON = {
  customer: <QrCode size={13} aria-hidden />,
  waiter: <Smartphone size={13} aria-hidden />,
  panel: <UserRound size={13} aria-hidden />,
};

const SOURCE_TEXT = { customer: "QR", waiter: "Operador", panel: "Panel" };

// Datos de quien retira (take away) o recibe (delivery), si se cargaron.
export function CustomerInfo({ order }: { order: Order }) {
  if (order.serviceType !== "takeaway" && order.serviceType !== "delivery") return null;
  const who = [order.customerName, order.customerPhone].filter(Boolean).join(" · ");
  if (!who && !order.deliveryAddress && !order.deliveryNotes) return null;
  return (
    <div className={s.customerInfo}>
      {who && (
        <span className={s.customerLine}>
          {order.customerPhone ? <Phone size={13} aria-hidden /> : <UserRound size={13} aria-hidden />} {who}
        </span>
      )}
      {order.deliveryAddress && <span className={s.customerLine}><MapPin size={13} aria-hidden /> {order.deliveryAddress}</span>}
      {order.deliveryNotes && <span className={s.customerLine}><MessageSquareText size={13} aria-hidden /> {order.deliveryNotes}</span>}
    </div>
  );
}

const TICKET_LABEL: Record<TicketStatus, string> = {
  new: "Recibida",
  preparing: "Preparando",
  done: "Lista",
  cancelled: "Anulada",
};

// Avance de cada sector (una comanda por sector). Cuando están todas listas
// se avisa, pero el pedido lo sigue marcando "Listo" quien maneja el panel.
function SectorProgress({ order }: { order: Order }) {
  const tickets = order.tickets ?? [];
  if (tickets.length === 0 || order.status === "pending") return null;
  const allDone = tickets.every(ticket => ticket.status === "done");
  return (
    <div className={s.sectors} aria-label="Avance por sector">
      {tickets.map(ticket => (
        <span key={ticket.id} className={`${s.sectorChip} ${s[`sector_${ticket.status}`]}`}>
          {ticket.status === "done" && <Check size={12} aria-hidden />}
          {ticket.sectorName} · {TICKET_LABEL[ticket.status]}
        </span>
      ))}
      {allDone && order.status === "confirmed" && <span className={s.sectorsDone}>Todo preparado</span>}
    </div>
  );
}

export default function OrderCard({ order, waiters, now, highlight = false, busy = false, onStatus, onWaiter, onDispatch, onRefund, itemActions }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  // Productos quitados: lo que falta devolver (si se pagó online) y el aviso al cliente por WhatsApp.
  const removedCount = order.removedItems?.length ?? 0;
  const refundDue = order.refundDue ?? 0;
  const noticeHref = removedCount > 0 && order.customerPhone ? buildWaLink(order.customerPhone, stockNoticeMessage(order)) : null;
  const minutes = Math.floor((now - new Date(order.createdAt).getTime()) / 60_000);
  const late = order.status !== "ready" && minutes >= 20;
  // Pedido ya cobrado online: cancelarlo implica decidir la devolución.
  const paid = onRefund !== undefined && isRefundable(order);
  // Delivery listo que todavía no salió: el siguiente paso es «Salió el pedido», no «Entregado».
  // Con repartidor asignado, la salida y la entrega las registra él (con el código del cliente).
  const courierActive = order.delivery?.status === "assigned" || order.delivery?.status === "picked_up";
  const toDispatch = order.status === "ready" && order.serviceType === "delivery" && !order.dispatchedAt && !courierActive && onDispatch !== undefined;
  const statusLabel = order.status === "ready" && order.dispatchedAt ? "En camino" : STATUS_LABEL[order.status];

  return (
    <article className={`${s.card} ${highlight ? s.cardNew : ""} ${late ? s.cardLate : ""}`} aria-label={`Pedido ${order.number}`}>
      <header className={s.cardHead}>
        <div className={s.cardId}>
          <span className={s.cardNumber}>#{order.number}</span>
          <span className={s.table}>{placeLabel(order)}</span>
        </div>
        <span className={`${p.status} ${p[`status_${order.status}`]}`}>{statusLabel}</span>
      </header>

      <div className={s.cardMeta}>
        <span className={s.source} title={`Origen: ${SOURCE_TEXT[order.source]}`}>
          {SOURCE_ICON[order.source]} {SOURCE_TEXT[order.source]}
        </span>
        <PaymentBadge order={order} />
        <span className={s.cardTime} title={formatTime(order.createdAt)}>{formatTime(order.createdAt)} · {elapsedLabel(order.createdAt, now)}</span>
      </div>

      <OrderItemsList order={order} busy={busy} actions={itemActions} />

      {removedCount > 0 && (refundDue > 0 || noticeHref) && (
        <div className={s.itemsNotice}>
          {refundDue > 0 && (
            <span>
              Este pedido se pagó online: por lo que quitaste hay que devolverle <strong>{formatMoney(refundDue)}</strong> al cliente.
            </span>
          )}
          <div className={s.itemsNoticeActions}>
            {refundDue > 0 && onRefund && (
              <button type="button" className={`${p.btnPrimary} ${p.small}`} disabled={busy} onClick={() => onRefund(order, false, refundDue)}>
                <Undo2 size={14} aria-hidden /> Devolver {formatMoney(refundDue)}
              </button>
            )}
            {noticeHref && (
              <a className={`${p.btn} ${p.small}`} href={noticeHref} target="_blank" rel="noreferrer">
                <MessageCircle size={14} aria-hidden /> Avisar al cliente
              </a>
            )}
          </div>
        </div>
      )}

      <SectorProgress order={order} />

      {order.notes && (
        <p className={s.orderNotes}>
          <MessageSquareText size={14} aria-hidden />
          <span>{order.notes}</span>
        </p>
      )}

      <CustomerInfo order={order} />

      {courierActive && order.delivery && (
        <p className={s.orderNotes}>
          <Bike size={14} aria-hidden />
          <span>
            {order.delivery.status === "picked_up" ? "En camino con " : "Asignado a "}<strong>{order.delivery.courierName}</strong>.
            {" "}Se marca entregado con el código del cliente. <Link to="/pedidos/delivery">Ver entregas en curso</Link>
          </span>
        </p>
      )}

      <div className={s.cardFoot}>
        <label className={s.waiterSelect}>
          <span className="sr-only">Operador</span>
          <select
            className={p.select}
            value={order.waiterId ?? ""}
            disabled={busy}
            onChange={event => onWaiter(order, event.target.value ? Number(event.target.value) : null)}
            aria-label={`Operador del pedido ${order.number}`}
          >
            <option value="">{order.waiterName && !order.waiterId ? order.waiterName : "Sin operador"}</option>
            {waiters.filter(waiter => waiter.active || waiter.id === order.waiterId).map(waiter => (
              <option key={waiter.id} value={waiter.id}>{waiter.name}</option>
            ))}
          </select>
        </label>
        <strong className={s.total}>{formatMoney(order.total)}</strong>
      </div>

      <div className={s.actions}>
        {confirmCancel && !paid ? (
          <>
            <div className={s.cancelReasons} role="radiogroup" aria-label="Motivo de la cancelación">
              {CANCEL_REASONS.map(reason => (
                <button
                  key={reason}
                  type="button"
                  role="radio"
                  aria-checked={cancelReason === reason}
                  className={`${s.reasonChip} ${cancelReason === reason ? s.reasonChipOn : ""}`}
                  onClick={() => setCancelReason(cancelReason === reason ? null : reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <span className={s.confirmText}>¿Cancelar el pedido?</span>
            <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={() => onStatus(order, "cancelled", cancelReason ?? undefined)}>
              Sí, cancelar
            </button>
            <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirmCancel(false)}>No</button>
          </>
        ) : (
          <>
            {order.status === "pending" && (
              <button type="button" className={p.btnPrimary} disabled={busy} onClick={() => onStatus(order, "confirmed")}>
                <Check size={16} aria-hidden /> Confirmar
              </button>
            )}
            {order.status === "confirmed" && (
              <button type="button" className={p.btnPrimary} disabled={busy} onClick={() => onStatus(order, "ready")}>
                <ChefHat size={16} aria-hidden /> Listo
              </button>
            )}
            {toDispatch && (
              <button type="button" className={p.btnPrimary} disabled={busy} onClick={() => onDispatch(order)}>
                <Bike size={16} aria-hidden /> Salió el pedido
              </button>
            )}
            {(order.status === "confirmed" || order.status === "ready") && !courierActive && (
              <button
                type="button"
                className={order.status === "ready" && !toDispatch ? p.btnPrimary : p.btn}
                disabled={busy}
                onClick={() => onStatus(order, "delivered")}
              >
                <HandPlatter size={16} aria-hidden /> Entregado
              </button>
            )}
            <button
              type="button"
              className={`${p.btnGhost} ${s.cancelBtn}`}
              disabled={busy}
              onClick={() => (paid ? onRefund(order, true) : setConfirmCancel(true))}
              aria-label={paid ? `Rechazar pedido ${order.number} y devolver el pago` : `Cancelar pedido ${order.number}`}
            >
              <X size={16} aria-hidden /> {paid ? "Rechazar y devolver" : "Cancelar"}
            </button>
            {paid && (
              <button type="button" className={p.btnGhost} disabled={busy} onClick={() => onRefund(order, false)}>
                <Undo2 size={16} aria-hidden /> Reembolsar
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
