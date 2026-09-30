import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { PublicMenuData, PublicMenuItem } from "../../../../types";
import { buildMenuTabs, isItemUnavailable } from "../../../../lib/publicMenu";
import { cartUnitPrice } from "../../../../lib/cartPricing";
import { isOfferActive } from "../../../../lib/offers";
import { formatMoney } from "../../lib/format";
import s from "./ProductPicker.module.css";

// Buscador de productos de la carta para cargar pedidos a mano (tomador de
// pedidos del operador y alta manual del panel). Trabaja sobre la carta pública
// v2: solo lo visible, con los no disponibles marcados.

export interface PickedProduct {
  itemId: string;
  title: string;
  option?: string;
  unitPrice: number;
}

interface Props {
  menu: PublicMenuData;
  hidePrices?: boolean;
  onPick: (product: PickedProduct) => void;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ProductPicker({ menu, hidePrices = false, onPick }: Props) {
  const [search, setSearch] = useState("");
  const categories = useMemo(
    () => buildMenuTabs(menu).flatMap(tab => tab.categorias.map(cat => ({
      title: tab.categorias.length > 1 || tab.label === cat.title ? cat.title : `${tab.label} · ${cat.title}`,
      items: cat.items,
    }))),
    [menu]
  );

  const query = normalize(search.trim());
  const visible = query
    ? categories
      .map(cat => ({ ...cat, items: cat.items.filter(item => normalize(item.title).includes(query)) }))
      .filter(cat => cat.items.length > 0)
    : categories;

  const pick = (item: PublicMenuItem, option?: string) => {
    const unitPrice = cartUnitPrice(item, option, { hidePrices });
    if (unitPrice === null) return;
    onPick({ itemId: item._id, title: item.title, option, unitPrice });
  };

  return (
    <div className={s.picker}>
      <label className={s.search}>
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar producto"
          aria-label="Buscar producto"
        />
      </label>

      {visible.length === 0 && <p className={s.empty}>No hay productos que coincidan.</p>}

      {visible.map((cat, index) => (
        <section key={`${cat.title}-${index}`} className={s.category}>
          <h3 className={s.categoryTitle}>{cat.title}</h3>
          <ul className={s.items}>
            {cat.items.map(item => {
              const unavailable = isItemUnavailable(item);
              const options = Object.entries(item.options ?? {});
              // Mismo criterio que las tarjetas de la carta (UserMenu): con
              // una oferta vigente se pide como producto simple; si no, un
              // producto con variantes se pide por variante.
              const onOffer = isOfferActive(item);
              const simplePrice = cartUnitPrice(item, undefined, { hidePrices });
              const showSimple = (options.length === 0 || onOffer) && simplePrice != null;
              const showVariants = options.length > 0 && !onOffer;
              return (
                <li key={item._id} className={`${s.item} ${unavailable ? s.itemOff : ""}`}>
                  <div className={s.itemHead}>
                    <span className={s.itemTitle}>{item.title}</span>
                    {unavailable && <span className={s.badge}>No disponible</span>}
                  </div>
                  <div className={s.actions}>
                    {showSimple && (
                      <button type="button" className={s.add} disabled={unavailable} onClick={() => pick(item)}>
                        <Plus size={14} aria-hidden />
                        <span>{hidePrices ? "Agregar" : formatMoney(simplePrice)}</span>
                      </button>
                    )}
                    {showVariants && options.map(([name, price]) => (
                      <button
                        key={name}
                        type="button"
                        className={s.add}
                        disabled={unavailable}
                        onClick={() => pick(item, name)}
                      >
                        <Plus size={14} aria-hidden />
                        <span>{name}{!hidePrices && ` · ${formatMoney(price)}`}</span>
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
