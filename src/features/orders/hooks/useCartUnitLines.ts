import { useCallback, useMemo, useState } from "react";
import { useCart } from "../../../context/useCart";
import { lineKey, type UnitLine } from "../lib/units";

// El carrito de la carta (CartProvider) como líneas con aclaraciones por
// unidad, que es lo que edita UnitLinesEditor. El carrito compartido no guarda
// las aclaraciones: viven acá mientras el drawer está abierto.

export function useCartUnitLines() {
  const { items, updateQuantity, removeItem } = useCart();
  const [notes, setNotes] = useState<Record<string, string[]>>({});

  const lines: UnitLine[] = useMemo(() => items.map(line => ({
    itemId: line.itemId,
    title: line.title,
    option: line.selectedOption,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    unitNotes: notes[lineKey(line.itemId, line.selectedOption)] ?? [],
  })), [items, notes]);

  const onLinesChange = (next: UnitLine[]) => {
    const nextKeys = new Set(next.map(line => lineKey(line.itemId, line.option)));
    for (const line of lines) {
      if (!nextKeys.has(lineKey(line.itemId, line.option))) removeItem(line.itemId, line.option);
    }
    const nextNotes: Record<string, string[]> = {};
    for (const line of next) {
      const current = lines.find(l => lineKey(l.itemId, l.option) === lineKey(line.itemId, line.option));
      if (current && current.quantity !== line.quantity) updateQuantity(line.itemId, line.option, line.quantity);
      nextNotes[lineKey(line.itemId, line.option)] = line.unitNotes;
    }
    setNotes(nextNotes);
  };

  const resetNotes = useCallback(() => setNotes({}), []);

  return { lines, onLinesChange, resetNotes };
}
