import type { PublicMenuData, PublicMenuItem } from "../../../types/index.ts";
import { cartUnitPrice } from "../../../lib/cartPricing.ts";
import { isOfferActive } from "../../../lib/offers.ts";
import { buildMenuTabs, isItemUnavailable } from "../../../lib/publicMenu.ts";
import type { Order } from "../types";
import { lineKey, type UnitLine } from "./units.ts";

// Carga de productos del personal (tomador del operador y alta manual del
// panel) sobre la carta pública v2: categorías, qué se puede pedir de cada
// producto, sumar al pedido en curso y "otra vuelta" de lo que ya pidió la mesa.

export interface PickedProduct {
  itemId: string;
  title: string;
  option?: string;
  unitPrice: number;
}

export interface PickerCategory {
  title: string;
  items: PublicMenuItem[];
}

export const MAX_LINE_QUANTITY = 20;

// Lo cargado en una mesa y todavía sin enviar.
export interface TableDraft {
  lines: UnitLine[];
  notes: string;
}

export const emptyDraft = (): TableDraft => ({ lines: [], notes: "" });

export function pickerCategories(menu: PublicMenuData): PickerCategory[] {
  return buildMenuTabs(menu).flatMap(tab => tab.categorias.map(cat => ({
    title: tab.categorias.length > 1 || tab.label === cat.title ? cat.title : `${tab.label} · ${cat.title}`,
    items: cat.items,
  })));
}

export const normalizeSearch = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Mismo criterio que las tarjetas de la carta (UserMenu): con una oferta
// vigente se pide como producto simple; si no, un producto con variantes se
// pide por variante. simple: precio del producto simple (null = no se pide así).
export function pickChoices(item: PublicMenuItem, hidePrices = false): { simple: number | null; variants: [string, number][] } {
  const options = Object.entries(item.options ?? {});
  const onOffer = isOfferActive(item);
  const simplePrice = cartUnitPrice(item, undefined, { hidePrices });
  return {
    simple: (options.length === 0 || onOffer) && simplePrice != null ? simplePrice : null,
    variants: options.length > 0 && !onOffer ? options.map(([name, price]) => [name, hidePrices ? 0 : price]) : [],
  };
}

export function pickProduct(item: PublicMenuItem, option: string | undefined, hidePrices = false): PickedProduct | null {
  if (isItemUnavailable(item)) return null;
  const unitPrice = cartUnitPrice(item, option, { hidePrices });
  if (unitPrice === null) return null;
  return { itemId: item._id, title: item.title, ...(option ? { option } : {}), unitPrice };
}

// Suma una unidad: si el producto (con esa variante) ya está, sube la cantidad.
export function addPicked(lines: UnitLine[], product: PickedProduct): UnitLine[] {
  const key = lineKey(product.itemId, product.option);
  const existing = lines.find(line => lineKey(line.itemId, line.option) === key);
  if (existing) {
    return lines.map(line => (line === existing ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + 1) } : line));
  }
  return [...lines, { ...product, quantity: 1, unitNotes: [] }];
}

// Lo que la mesa ya pidió, para pedir otra vuelta con un toque: sin repetir,
// lo último primero, con el precio de la carta de hoy y solo lo que se puede
// pedir ahora (lo que salió de la carta o se agotó no aparece).
export function repeatCandidates(orders: Order[], menu: PublicMenuData, hidePrices = false, limit = 8): PickedProduct[] {
  const byId = new Map<string, PublicMenuItem>();
  for (const cat of pickerCategories(menu)) for (const item of cat.items) byId.set(item._id, item);

  const seen = new Set<string>();
  const result: PickedProduct[] = [];
  const billed = orders.filter(order => order.status !== "cancelled" && order.status !== "returned");
  for (const order of [...billed].reverse()) {
    for (const ordered of order.items) {
      const option = ordered.option ?? undefined;
      const key = lineKey(ordered.itemId, option);
      if (seen.has(key)) continue;
      seen.add(key);
      const item = byId.get(ordered.itemId);
      const product = item ? pickProduct(item, option, hidePrices) : null;
      if (product) result.push(product);
      if (result.length >= limit) return result;
    }
  }
  return result;
}
