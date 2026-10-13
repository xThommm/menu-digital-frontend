import { Plus } from "lucide-react";
import { useCart } from "../../../context/useCart";
import { formatMoney } from "../../orders/lib/format";
import type { PublicMenuItem } from "../../../types/index";
import { addAction } from "../lib/games";
import v from "../../orders/components/customer/VenueOrder.module.css";
import s from "./Games.module.css";

// Un producto real de la carta dentro de un juego, con su botón de acción: lo
// suma al pedido (el mismo carrito de la carta, así la mesa, las variantes y
// las validaciones las resuelve el flujo de pedidos de siempre) o, si tiene
// variantes, abre el producto para elegir.

interface Props {
  item: PublicMenuItem;
  hidePrices: boolean;
  // false: desde esta carta no se puede pedir (el producto solo se muestra).
  canOrder: boolean;
  // Abre el detalle del producto (para elegir variante o solo verlo).
  onOpenItem: (item: PublicMenuItem) => void;
}

const minOption = (item: PublicMenuItem) => {
  const prices = Object.values(item.options ?? {});
  return prices.length > 0 ? Math.min(...prices) : null;
};

export default function GameProduct({ item, hidePrices, canOrder, onOpenItem }: Props) {
  const { items: cartItems, addItem } = useCart();
  const action = addAction(item, hidePrices);
  const inCart = cartItems.filter(line => line.itemId === item._id).reduce((sum, line) => sum + line.quantity, 0);

  let price: string | null = null;
  if (!hidePrices) {
    if (action.kind === "add") price = formatMoney(action.unitPrice);
    else if (action.kind === "options" && minOption(item) !== null) price = `Desde ${formatMoney(minOption(item)!)}`;
  }

  return (
    <article className={s.product}>
      <div className={s.productHead}>
        <span className={s.productTitle}>{item.title}</span>
        {price && <span className={s.productPrice}>{price}</span>}
      </div>
      {item.description && <p className={s.productDesc}>{item.description}</p>}

      {canOrder && action.kind === "add" && (
        <button
          type="button"
          className={v.sendBtn}
          onClick={() => addItem({ itemId: item._id, title: item.title, unitPrice: action.unitPrice })}
        >
          <Plus size={17} aria-hidden /> Agregar al pedido
        </button>
      )}
      {canOrder && action.kind === "options" && (
        <button type="button" className={v.sendBtn} onClick={() => onOpenItem(item)}>
          <Plus size={17} aria-hidden /> Elegir y agregar
        </button>
      )}
      {(!canOrder || action.kind === "none") && (
        <button type="button" className={v.ghostBtn} onClick={() => onOpenItem(item)}>Ver en la carta</button>
      )}
      {inCart > 0 && <span className={s.productAdded} role="status">{inCart} en tu pedido</span>}
    </article>
  );
}
