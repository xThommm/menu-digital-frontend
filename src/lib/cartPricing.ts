import type { CartLine } from "../context/CartContext";
import type { Item } from "../types/index.ts";
import { isOfferActive } from "./offers.ts";

interface PricingOptions {
  // Opción "Ocultar precios" de la carta: se puede pedir igual, pero el
  // carrito no lleva precios (unitPrice 0) y el pedido sale sin montos.
  hidePrices?: boolean;
  now?: number;
}

const minOption = (options: Record<string, number>): number | null => {
  const vals = Object.values(options);
  return vals.length > 0 ? Math.min(...vals) : null;
};

// Precio unitario con el que un producto entra al carrito. Es la misma
// cuenta que hacen la tarjeta (UserMenu) y el preview (ItemPreviewModal)
// para el precio que muestran, así lo guardado y lo que se ve no se
// separan:
// - variante: su precio en item.options (null si la variante ya no existe);
// - simple: el de oferta si rige, si no item.price o, sin precio propio, el
//   mínimo de las variantes (el "Desde" de la tarjeta).
// null = no se puede agregar. Con hidePrices vale 0 aunque el producto no
// tenga precio: el backend los manda en null y las variantes en 0, y el
// dueño igual quiere recibir pedidos.
export function cartUnitPrice(
  item: Item,
  selectedOption?: string,
  { hidePrices = false, now = Date.now() }: PricingOptions = {},
): number | null {
  const options = item.options ?? {};
  if (selectedOption !== undefined) {
    if (!Object.hasOwn(options, selectedOption)) return null;
    return hidePrices ? 0 : options[selectedOption];
  }
  if (hidePrices) return 0;
  if (isOfferActive(item, now)) return item.offerPrice!;
  return item.price ?? minOption(options);
}

// El carrito vive en localStorage por local con el unitPrice fijado al
// agregar, así que al abrir la carta se vuelve a pasar por los productos
// actuales (todas las pestañas). Sin esto, un pedido armado con los
// precios ocultos (todo en 0) salía con "$0" si el dueño después volvía a
// mostrar los precios, y un carrito viejo arrastraba precios de otro día.
// Se descartan las líneas cuyo producto ya no está en la carta, quedó
// oculto o no disponible, cuya variante ya no existe o que se quedaron sin
// precio; el resto conserva cantidad y variante con precio y nombre al día.
export function repriceCartLines(
  lines: CartLine[],
  items: Item[],
  options: PricingOptions = {},
): CartLine[] {
  const byId = new Map(items.map(item => [item._id, item]));
  return lines.flatMap(line => {
    const item = byId.get(line.itemId);
    if (!item || item.hidden || !item.available) return [];
    const unitPrice = cartUnitPrice(item, line.selectedOption, options);
    if (unitPrice == null) return [];
    return [{ ...line, title: item.title, unitPrice }];
  });
}
