import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { PublicMenuData, PublicMenuItem } from "../../../../types";
import { isItemUnavailable } from "../../../../lib/publicMenu";
import { formatMoney } from "../../lib/format";
import { normalizeSearch, pickChoices, pickerCategories, pickProduct, type PickedProduct } from "../../lib/quickPick";
import s from "./ProductPicker.module.css";

// Buscador de productos de la carta para cargar pedidos a mano (tomador de
// pedidos del operador y alta manual del panel). Trabaja sobre la carta pública
// v2: solo lo visible, con los no disponibles marcados.

export type { PickedProduct };

interface Props {
  menu: PublicMenuData;
  hidePrices?: boolean;
  onPick: (product: PickedProduct) => void;
}

export default function ProductPicker({ menu, hidePrices = false, onPick }: Props) {
  const [search, setSearch] = useState("");
  const categories = useMemo(() => pickerCategories(menu), [menu]);

  const query = normalizeSearch(search.trim());
  const visible = query
    ? categories
      .map(cat => ({ ...cat, items: cat.items.filter(item => normalizeSearch(item.title).includes(query)) }))
      .filter(cat => cat.items.length > 0)
    : categories;

  const pick = (item: PublicMenuItem, option?: string) => {
    const product = pickProduct(item, option, hidePrices);
    if (product) onPick(product);
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
              const { simple: simplePrice, variants } = pickChoices(item, hidePrices);
              return (
                <li key={item._id} className={`${s.item} ${unavailable ? s.itemOff : ""}`}>
                  <div className={s.itemHead}>
                    <span className={s.itemTitle}>{item.title}</span>
                    {unavailable && <span className={s.badge}>No disponible</span>}
                  </div>
                  <div className={s.actions}>
                    {simplePrice !== null && (
                      <button type="button" className={s.add} disabled={unavailable} onClick={() => pick(item)}>
                        <Plus size={14} aria-hidden />
                        <span>{hidePrices ? "Agregar" : formatMoney(simplePrice)}</span>
                      </button>
                    )}
                    {variants.map(([name, price]) => (
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
