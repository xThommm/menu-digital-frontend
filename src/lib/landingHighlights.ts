// Qué productos de la carta se muestran en la portada (plantilla Inmersiva):
// una vidriera corta que invita a abrir la carta, no un segundo menú.
import type { PublicMenuData, PublicMenuItem } from "../types/index.ts";
import { isOfferActive } from "./offers.ts";
import { buildMenuTabs, isItemUnavailable } from "./publicMenu.ts";

export interface LandingHighlights {
  /** Productos de la vidriera, en el orden en que se muestran. */
  picks: PublicMenuItem[];
  /** Producto con oferta vigente para el aviso destacado; null si no hay. */
  offer: PublicMenuItem | null;
}

// Una fila de cuatro, o dos filas si la carta da para llenarlas. Con menos de
// MIN_PICKS la sección no se muestra: una tarjeta suelta parece un error.
const ROW = 4;
export const MIN_PICKS = 2;

export function pickHighlights(menu: PublicMenuData | null, { hidePrices }: { hidePrices: boolean }): LandingHighlights {
  const seen = new Set<string>();
  // Solo lo que hoy se puede pedir y tiene foto: sin foto la tarjeta queda
  // vacía justo en la sección que existe para tentar.
  const items = buildMenuTabs(menu)
    .flatMap(tab => tab.categorias.flatMap(cat => cat.items))
    .filter(item => {
      if (seen.has(item._id) || isItemUnavailable(item) || !item.image) return false;
      seen.add(item._id);
      return true;
    });

  // Primero los que el dueño marcó como recomendados; si no alcanzan para
  // una fila, se completa con el resto en el orden de la carta.
  const recommended = items.filter(item => item.recommended);
  const rest = items.filter(item => !item.recommended);
  const pool = recommended.length >= ROW ? recommended : [...recommended, ...rest];
  const picks = pool.slice(0, pool.length >= ROW * 2 ? ROW * 2 : ROW);

  // Con los precios ocultos no hay oferta que anunciar (el backend ni manda
  // los precios). Se prefiere una que no esté ya en la vidriera.
  const offers = hidePrices ? [] : items.filter(item => isOfferActive(item));
  const offer = offers.find(item => !picks.includes(item)) ?? offers[0] ?? null;

  return { picks: picks.length >= MIN_PICKS ? picks : [], offer };
}

export interface HighlightPrice {
  /** Precio vigente. */
  current: number;
  /** Precio de lista tachado, solo con oferta vigente. */
  previous?: number;
  /** Porcentaje de descuento redondeado, solo con oferta vigente. */
  discount?: number;
  /** El producto solo tiene variantes: `current` es la más barata ("Desde"). */
  from?: true;
}

// Mismo criterio que la tarjeta de la carta (priceInfo en UserMenu.tsx):
// oferta > variantes > precio simple. null = no se muestra precio.
export function highlightPrice(item: PublicMenuItem, { hidePrices }: { hidePrices: boolean }): HighlightPrice | null {
  if (hidePrices) return null;
  if (isOfferActive(item)) {
    return {
      current: item.offerPrice!,
      previous: item.price!,
      discount: Math.round((1 - item.offerPrice! / item.price!) * 100),
    };
  }
  if (item.price != null) return { current: item.price };
  const variants = Object.values(item.options ?? {});
  return variants.length > 0 ? { current: Math.min(...variants), from: true } : null;
}
