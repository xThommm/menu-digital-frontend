import { useState } from "react";
import { Check, HandPlatter, Minus, PackageX, Plus, Undo2 } from "lucide-react";
import {
  canDeliverItems, canRemoveItem, canRestoreItems, deliveryProgress, ITEM_REMOVE_REASONS, maxRemovable,
} from "../../lib/orderItems";
import type { Order, OrderItem, RemovedOrderItem } from "../../types";
import p from "./panel.module.css";
import s from "./OrdersBoard.module.css";

// Productos de un pedido en el panel, con lo que se puede hacer con cada uno
// cuando el pedido no sigue su curso natural: quitarlo (falta de stock, error
// de carga), restaurarlo o entregarlo antes que el resto. Sin las acciones
// (tarjetas de solo lectura) es la lista de siempre.

export interface ItemActions {
  onRemove: (order: Order, item: OrderItem, data: { quantity?: number; reason?: string }) => void;
  onRestore: (order: Order, item: RemovedOrderItem) => void;
  onDelivered: (order: Order, item: OrderItem, delivered: boolean) => void;
}

interface Props {
  order: Order;
  busy?: boolean;
  actions?: ItemActions;
}

export default function OrderItemsList({ order, busy = false, actions: offered }: Props) {
  // Un backend anterior no manda `removedItems` ni conoce estas acciones: no se ofrecen.
  const actions = order.removedItems === undefined ? undefined : offered;
  // Producto que se está por quitar (se elige motivo y, si hay varias unidades, cuántas).
  const [removing, setRemoving] = useState<{ id: number; quantity: number; reason: string } | null>(null);
  const removed = order.removedItems ?? [];
  const progress = deliveryProgress(order);
  const deliverable = actions !== undefined && canDeliverItems(order);
  const restorable = actions !== undefined && canRestoreItems(order);

  const confirmRemove = (item: OrderItem) => {
    if (!removing || !actions) return;
    actions.onRemove(order, item, {
      quantity: removing.quantity < item.quantity ? removing.quantity : undefined,
      reason: removing.reason,
    });
    setRemoving(null);
  };

  return (
    <>
      <ul className={s.items}>
        {order.items.map(item => {
          const removable = actions !== undefined && canRemoveItem(order, item);
          const max = maxRemovable(order, item);
          const open = removing?.id === item.id;
          return (
            <li key={item.id} className={s.itemRow}>
              <div className={`${s.item} ${item.deliveredAt ? s.itemDelivered : ""}`}>
                <span className={s.qty}>{item.quantity}×</span>
                <div className={s.itemText}>
                  <span className={s.itemTitle}>{item.title}{item.option && <em> · {item.option}</em>}</span>
                  {item.notes && <span className={s.itemNotes}>{item.notes}</span>}
                  {item.deliveredAt && <span className={s.itemState}><Check size={12} aria-hidden /> Entregado</span>}
                </div>
                {(deliverable || removable) && !open && (
                  <div className={s.itemActions}>
                    {deliverable && (
                      <button
                        type="button"
                        className={`${s.itemBtn} ${item.deliveredAt ? s.itemBtnOn : ""}`}
                        disabled={busy}
                        aria-pressed={!!item.deliveredAt}
                        title={item.deliveredAt ? "Marcar como no entregado" : "Entregar este producto"}
                        aria-label={`${item.deliveredAt ? "Marcar como no entregado" : "Entregar"}: ${item.title}`}
                        onClick={() => actions.onDelivered(order, item, !item.deliveredAt)}
                      >
                        <HandPlatter size={15} aria-hidden />
                      </button>
                    )}
                    {removable && (
                      <button
                        type="button"
                        className={s.itemBtn}
                        disabled={busy}
                        title="Quitar del pedido (sin stock, error…)"
                        aria-label={`Quitar del pedido: ${item.title}`}
                        onClick={() => setRemoving({ id: item.id, quantity: max, reason: ITEM_REMOVE_REASONS[0] })}
                      >
                        <PackageX size={15} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {open && removing && (
                <div className={s.removeBox} role="group" aria-label={`Quitar ${item.title}`}>
                  {item.quantity > 1 && (
                    <div className={s.removeQty}>
                      <span>Cuántas quitar</span>
                      <button
                        type="button"
                        className={s.itemBtn}
                        disabled={removing.quantity <= 1}
                        aria-label="Una menos"
                        onClick={() => setRemoving({ ...removing, quantity: removing.quantity - 1 })}
                      >
                        <Minus size={14} aria-hidden />
                      </button>
                      <strong aria-live="polite">{removing.quantity} de {item.quantity}</strong>
                      <button
                        type="button"
                        className={s.itemBtn}
                        disabled={removing.quantity >= max}
                        aria-label="Una más"
                        onClick={() => setRemoving({ ...removing, quantity: removing.quantity + 1 })}
                      >
                        <Plus size={14} aria-hidden />
                      </button>
                    </div>
                  )}
                  <div className={s.reasons} role="radiogroup" aria-label="Motivo">
                    {ITEM_REMOVE_REASONS.map(reason => (
                      <button
                        key={reason}
                        type="button"
                        role="radio"
                        aria-checked={removing.reason === reason}
                        className={`${s.reasonChip} ${removing.reason === reason ? s.reasonChipOn : ""}`}
                        onClick={() => setRemoving({ ...removing, reason })}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <div className={s.removeActions}>
                    <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={() => confirmRemove(item)}>
                      Quitar del pedido
                    </button>
                    <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setRemoving(null)}>No</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        {removed.map(item => (
          <li key={item.id} className={s.itemRow}>
            <div className={`${s.item} ${s.itemRemoved}`}>
              <span className={s.qty}>{item.quantity}×</span>
              <div className={s.itemText}>
                <span className={s.itemTitle}>{item.title}{item.option && <em> · {item.option}</em>}</span>
                <span className={s.itemState}>Quitado{item.reason ? ` · ${item.reason}` : ""}</span>
              </div>
              {restorable && (
                <div className={s.itemActions}>
                  <button
                    type="button"
                    className={s.itemBtn}
                    disabled={busy}
                    title="Volver a poner en el pedido"
                    aria-label={`Volver a poner en el pedido: ${item.title}`}
                    onClick={() => actions.onRestore(order, item)}
                  >
                    <Undo2 size={15} aria-hidden />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {progress && (
        <span className={s.deliveryProgress}>
          <HandPlatter size={13} aria-hidden /> Entregado {progress.delivered} de {progress.total}
        </span>
      )}
    </>
  );
}
