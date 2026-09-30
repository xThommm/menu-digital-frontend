import type { PaperWidth, Ticket } from "../../types";
import { formatTime, placeLabel } from "../format.ts";

// Contenido de una comanda impresa, independiente de cómo se imprima: la
// misma estructura la usan el ticket HTML (impresora del sistema) y el
// codificador ESC/POS (comandera térmica directa).
//
// Lo importante tiene que leerse de un vistazo en la cocina: el destino
// (mesa, barra, take away), el número de pedido y las cantidades.

export interface TicketLayout {
  sector: string;
  // "Mesa 4" / "Barra" / "Take away · Juan" / "Delivery"
  place: string;
  orderNumber: number;
  time: string;
  waiter: string | null;
  cancelled: boolean;
  reprint: boolean;
  lines: { quantity: number; title: string; option: string | null; notes: string | null }[];
  notes: string | null;
}

export function ticketLayout(ticket: Ticket): TicketLayout {
  const { order } = ticket;
  const place = placeLabel(order);
  return {
    sector: ticket.sectorName,
    place: order.customerName && (order.serviceType === "takeaway" || order.serviceType === "delivery")
      ? `${place} · ${order.customerName}`
      : place,
    orderNumber: order.number,
    time: formatTime(ticket.createdAt),
    waiter: order.waiterName,
    cancelled: ticket.status === "cancelled",
    reprint: ticket.printCount > 0,
    lines: ticket.items.map(item => ({
      quantity: item.quantity,
      title: item.title,
      option: item.option,
      notes: item.notes,
    })),
    notes: order.notes,
  };
}

// Caracteres por renglón con la fuente A de una térmica típica.
export const CHARS_PER_LINE: Record<PaperWidth, number> = { 58: 32, 80: 48 };

// Corta un texto en renglones de `width` caracteres sin partir palabras
// (salvo que una sola palabra no entre).
export function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > width) {
      if (current) { lines.push(current); current = ""; }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!word) continue;
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}
