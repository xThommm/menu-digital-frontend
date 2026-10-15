import type { Order } from "../types";
import type { ServiceDraft } from "./service.ts";
import { lineKey, NOTES_MAX, type UnitLine } from "./units.ts";

// "Repetir pedido" (menú contextual del historial): el borrador de un pedido
// nuevo con los mismos productos, aclaraciones y destino. Los precios los
// vuelve a calcular el servidor al cargarlo (con los de hoy); un producto que
// ya no está en la carta lo avisa el servidor al enviarlo.

// Mismo tope por línea que el selector de productos del pedido manual.
export const REPEAT_LINE_MAX = 20;

export interface RepeatDraft {
  lines: UnitLine[];
  service: ServiceDraft;
  notes: string;
}

export function repeatOrderDraft(order: Order): RepeatDraft {
  const byKey = new Map<string, UnitLine>();
  for (const item of order.items) {
    const key = lineKey(item.itemId, item.option ?? undefined);
    const line = byKey.get(key) ?? {
      itemId: item.itemId,
      title: item.title,
      option: item.option ?? undefined,
      unitPrice: item.unitPrice,
      quantity: 0,
      unitNotes: [],
    };
    const note = (item.notes ?? "").slice(0, NOTES_MAX);
    for (let unit = 0; unit < item.quantity && line.quantity < REPEAT_LINE_MAX; unit += 1) {
      line.unitNotes[line.quantity] = note;
      line.quantity += 1;
    }
    byKey.set(key, line);
  }

  return {
    lines: [...byKey.values()],
    service: {
      serviceType: order.serviceType,
      table: order.serviceType === "table" && order.tableNumber ? String(order.tableNumber) : "",
      customerName: order.customerName ?? "",
      customerPhone: order.customerPhone ?? "",
      deliveryAddress: order.deliveryAddress ?? "",
      deliveryNotes: order.deliveryNotes ?? "",
    },
    notes: order.notes ?? "",
  };
}
