import { createContext } from "react";

// Una línea del carrito = un producto + una variante puntual (si el
// producto tiene "options", cada variante elegida es una línea separada).
export interface CartLine {
  itemId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  selectedOption?: string;
}

export interface CartContextType {
  enabled: boolean;
  items: CartLine[];
  addItem: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeItem: (itemId: string, selectedOption?: string) => void;
  updateQuantity: (itemId: string, selectedOption: string | undefined, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

// ✅ Solo exporta el contexto — con allowConstantExport: true en ESLint no genera warning
export const CartContext = createContext<CartContextType | undefined>(undefined);
