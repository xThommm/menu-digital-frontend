import { useState, useEffect, useMemo, type ReactNode } from "react";
import { CartContext, type CartLine } from "./CartContext";

// Misma línea = mismo producto + misma variante (dos variantes distintas
// del mismo producto son líneas separadas en el carrito).
const lineKey = (itemId: string, selectedOption?: string) => `${itemId}::${selectedOption ?? ""}`;

function readCart(slug: string): CartLine[] {
  try {
    const raw = localStorage.getItem(`cart:${slug}`);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

// El carrito vive por local (clave localStorage "cart:<slug>"), no global:
// así no se mezcla si el cliente navega de la carta de un negocio a la de
// otro sin recargar la página.
export function CartProvider({ slug, enabled, children }: { slug: string; enabled: boolean; children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => readCart(slug));

  // Si el slug cambia (navegación SPA de una carta a otra sin recarga
  // completa), recargamos el carrito de ESE local en vez de arrastrar el
  // anterior en memoria. Ajuste de estado durante el render (no en un
  // efecto) para no disparar un render en cascada evitable — mismo patrón
  // que PreviewCard en UserDashboard.tsx.
  const [prevSlug, setPrevSlug] = useState(slug);
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setItems(readCart(slug));
  }

  useEffect(() => {
    try {
      localStorage.setItem(`cart:${slug}`, JSON.stringify(items));
    } catch {
      // localStorage no disponible (modo privado, etc.) — el carrito
      // sigue funcionando en memoria durante la sesión.
    }
  }, [slug, items]);

  const addItem = (line: Omit<CartLine, "quantity">, quantity = 1) => {
    if (!enabled) return;
    setItems((prev) => {
      const key = lineKey(line.itemId, line.selectedOption);
      const existing = prev.find((l) => lineKey(l.itemId, l.selectedOption) === key);
      if (existing) {
        return prev.map((l) =>
          lineKey(l.itemId, l.selectedOption) === key ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      return [...prev, { ...line, quantity }];
    });
  };

  const removeItem = (itemId: string, selectedOption?: string) => {
    const key = lineKey(itemId, selectedOption);
    setItems((prev) => prev.filter((l) => lineKey(l.itemId, l.selectedOption) !== key));
  };

  const updateQuantity = (itemId: string, selectedOption: string | undefined, quantity: number) => {
    if (!enabled) return;
    if (quantity <= 0) {
      removeItem(itemId, selectedOption);
      return;
    }
    const key = lineKey(itemId, selectedOption);
    setItems((prev) => prev.map((l) => (lineKey(l.itemId, l.selectedOption) === key ? { ...l, quantity } : l)));
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(() => items.reduce((sum, l) => sum + l.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ enabled, items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}
