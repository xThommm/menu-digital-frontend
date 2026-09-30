import { elapsedLabel, placeLabel, STATUS_LABEL } from "../../lib/format";
import type { Order } from "../../types";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// Un pedido en el tomador del operador: misma lectura que la tarjeta del
// panel, sin acciones.

export default function WaiterOrderCard({ order, showPlace = true }: { order: Order; showPlace?: boolean }) {
  return (
    <article className={s.orderCard}>
      <div className={s.orderHead}>
        <div className={s.orderId}>
          <span className={s.orderNumber}>#{order.number}</span>
          {showPlace && <span className={s.orderTable}>{placeLabel(order)}</span>}
        </div>
        <span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span>
      </div>
      <ul className={s.orderLines}>
        {order.items.map(item => (
          <li key={item.id} className={s.orderLine}>
            <span className={s.orderQty}>{item.quantity}×</span>
            <span className={s.orderText}>
              <span>{item.title}{item.option && <em> · {item.option}</em>}</span>
              {item.notes && <span className={s.orderNotes}>{item.notes}</span>}
            </span>
          </li>
        ))}
      </ul>
      {(order.customerName || order.deliveryAddress) && (
        <span className={s.orderTime}>
          {[order.customerName, order.customerPhone, order.deliveryAddress].filter(Boolean).join(" · ")}
        </span>
      )}
      <span className={s.orderTime}>{elapsedLabel(order.createdAt)}</span>
    </article>
  );
}
