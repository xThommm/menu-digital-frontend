import { useState } from "react";
import { Check, ChefHat, HandPlatter, MapPin, MessageSquareText, Phone, QrCode, Smartphone, UserRound, X } from "lucide-react";
import { elapsedLabel, formatMoney, formatTime, placeLabel, STATUS_LABEL } from "../../lib/format";
import type { Order, OrderStatus, Waiter } from "../../types";
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
  onStatus: (order: Order, status: OrderStatus) => void;
  onWaiter: (order: Order, waiterId: number | null) => void;
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

export default function OrderCard({ order, waiters, now, highlight = false, busy = false, onStatus, onWaiter }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const minutes = Math.floor((now - new Date(order.createdAt).getTime()) / 60_000);
  const late = order.status !== "ready" && minutes >= 20;

  return (
    <article className={`${s.card} ${highlight ? s.cardNew : ""} ${late ? s.cardLate : ""}`} aria-label={`Pedido ${order.number}`}>
      <header className={s.cardHead}>
        <div className={s.cardId}>
          <span className={s.cardNumber}>#{order.number}</span>
          <span className={s.table}>{placeLabel(order)}</span>
        </div>
        <span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span>
      </header>

      <div className={s.cardMeta}>
        <span className={s.source} title={`Origen: ${SOURCE_TEXT[order.source]}`}>
          {SOURCE_ICON[order.source]} {SOURCE_TEXT[order.source]}
        </span>
        <span className={s.cardTime} title={formatTime(order.createdAt)}>{formatTime(order.createdAt)} · {elapsedLabel(order.createdAt, now)}</span>
      </div>

      <ul className={s.items}>
        {order.items.map(item => (
          <li key={item.id} className={s.item}>
            <span className={s.qty}>{item.quantity}×</span>
            <div className={s.itemText}>
              <span className={s.itemTitle}>{item.title}{item.option && <em> · {item.option}</em>}</span>
              {item.notes && <span className={s.itemNotes}>{item.notes}</span>}
            </div>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className={s.orderNotes}>
          <MessageSquareText size={14} aria-hidden />
          <span>{order.notes}</span>
        </p>
      )}

      <CustomerInfo order={order} />

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
        {confirmCancel ? (
          <>
            <span className={s.confirmText}>¿Cancelar el pedido?</span>
            <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={() => onStatus(order, "cancelled")}>
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
            {(order.status === "confirmed" || order.status === "ready") && (
              <button
                type="button"
                className={order.status === "ready" ? p.btnPrimary : p.btn}
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
              onClick={() => setConfirmCancel(true)}
              aria-label={`Cancelar pedido ${order.number}`}
            >
              <X size={16} aria-hidden /> Cancelar
            </button>
          </>
        )}
      </div>
    </article>
  );
}
