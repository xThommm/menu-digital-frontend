import { useMemo, useState } from "react";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import type { PublicMenuData } from "../../../../types";
import { isItemUnavailable } from "../../../../lib/publicMenu";
import { formatMoney } from "../../lib/format";
import { normalizeSearch, pickChoices, pickerCategories, pickProduct, type PickedProduct } from "../../lib/quickPick";
import { lineKey } from "../../lib/units";
import s from "./QuickPicker.module.css";

// Carga rápida para el personal: la carta como botones grandes, de a una
// categoría (chips arriba) o buscando. Un toque suma una unidad; un producto
// con variantes muestra un botón por variante. Arriba, "Otra vuelta" repite
// con un toque lo que la mesa ya pidió. Cada botón muestra cuántas unidades
// lleva el pedido en curso.

const ALL = -1;

interface Props {
  menu: PublicMenuData;
  hidePrices?: boolean;
  // Unidades en el pedido en curso, por lineKey(itemId, option).
  counts: Map<string, number>;
  repeat?: PickedProduct[];
  onPick: (product: PickedProduct) => void;
}

export default function QuickPicker({ menu, hidePrices = false, counts, repeat = [], onPick }: Props) {
  const categories = useMemo(() => pickerCategories(menu), [menu]);
  const [chosen, setActive] = useState(categories.length > 1 ? 0 : ALL);
  // Si la carta cambia y la categoría elegida ya no está, se muestra todo.
  const active = chosen < categories.length ? chosen : ALL;
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");

  const query = normalizeSearch(search.trim());
  const visible = query
    ? categories
      .map(cat => ({ ...cat, items: cat.items.filter(item => normalizeSearch(item.title).includes(query)) }))
      .filter(cat => cat.items.length > 0)
    : active === ALL ? categories : categories.slice(active, active + 1);

  const count = (itemId: string, option?: string) => counts.get(lineKey(itemId, option)) ?? 0;
  const price = (value: number) => (hidePrices ? null : formatMoney(value));

  const closeSearch = () => {
    setSearching(false);
    setSearch("");
  };

  return (
    <div className={s.picker}>
      {repeat.length > 0 && !query && (
        <section aria-label="Otra vuelta">
          <h3 className={s.rowTitle}><RotateCcw size={13} aria-hidden /> Otra vuelta</h3>
          <div className={s.chips}>
            {repeat.map(product => {
              const units = count(product.itemId, product.option);
              return (
                <button
                  key={lineKey(product.itemId, product.option)}
                  type="button"
                  className={`${s.chip} ${s.repeatChip}`}
                  onClick={() => onPick(product)}
                  aria-label={`Otra vez ${product.title}${product.option ? ` ${product.option}` : ""}`}
                >
                  <Plus size={13} aria-hidden />
                  {product.title}{product.option && <span className={s.chipOption}> · {product.option}</span>}
                  {units > 0 && <span className={s.chipCount}>{units}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className={s.bar}>
        {searching ? (
          <label className={s.search}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar producto"
              aria-label="Buscar producto"
            />
            <button type="button" className={s.searchClose} onClick={closeSearch} aria-label="Cerrar la búsqueda"><X size={16} aria-hidden /></button>
          </label>
        ) : (
          <>
            <button type="button" className={`${s.chip} ${s.searchBtn}`} onClick={() => setSearching(true)} aria-label="Buscar producto">
              <Search size={16} aria-hidden />
            </button>
            <div className={s.chips} role="tablist" aria-label="Categorías">
              {categories.length > 1 && (
                <button type="button" role="tab" aria-selected={active === ALL} className={`${s.chip} ${active === ALL ? s.chipActive : ""}`} onClick={() => setActive(ALL)}>
                  Todo
                </button>
              )}
              {categories.map((cat, index) => (
                <button
                  key={`${cat.title}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  className={`${s.chip} ${active === index ? s.chipActive : ""}`}
                  onClick={() => setActive(index)}
                >
                  {cat.title}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {visible.length === 0 && <p className={s.empty}>{query ? "No hay productos que coincidan." : "La carta no tiene productos."}</p>}

      {visible.map((cat, index) => (
        <section key={`${cat.title}-${index}`} className={s.category} aria-label={cat.title}>
          {(query || active === ALL) && <h3 className={s.rowTitle}>{cat.title}</h3>}
          <ul className={s.grid}>
            {cat.items.map(item => {
              const unavailable = isItemUnavailable(item);
              const { simple, variants } = pickChoices(item, hidePrices);
              if (simple === null && variants.length === 0) return null;
              const pick = (option?: string) => {
                const product = pickProduct(item, option, hidePrices);
                if (product) onPick(product);
              };

              if (simple !== null) {
                const units = count(item._id);
                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      className={`${s.tile} ${units > 0 ? s.tileOn : ""}`}
                      disabled={unavailable}
                      onClick={() => pick()}
                      aria-label={`${item.title}${hidePrices ? "" : `, ${formatMoney(simple)}`}${units > 0 ? `, ${units} en el pedido` : ""}`}
                    >
                      <span className={s.tileTitle}>{item.title}</span>
                      {unavailable ? <span className={s.off}>No disponible</span> : <span className={s.tilePrice}>{price(simple)}</span>}
                      {units > 0 && <span className={s.tileCount}>{units}</span>}
                    </button>
                  </li>
                );
              }

              return (
                <li key={item._id} className={s.wide}>
                  <div className={`${s.tile} ${s.variantTile}`} aria-disabled={unavailable || undefined}>
                    <span className={s.tileTitle}>{item.title}</span>
                    {unavailable && <span className={s.off}>No disponible</span>}
                    <div className={s.variants}>
                      {variants.map(([name, value]) => {
                        const units = count(item._id, name);
                        return (
                          <button
                            key={name}
                            type="button"
                            className={`${s.variant} ${units > 0 ? s.variantOn : ""}`}
                            disabled={unavailable}
                            onClick={() => pick(name)}
                            aria-label={`${item.title} ${name}${hidePrices ? "" : `, ${formatMoney(value)}`}${units > 0 ? `, ${units} en el pedido` : ""}`}
                          >
                            <span>{name}</span>
                            {!hidePrices && <span className={s.variantPrice}>{formatMoney(value)}</span>}
                            {units > 0 && <span className={s.tileCount}>{units}</span>}
                          </button>
                        );
                      })}
                    </div>
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
