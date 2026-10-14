import type { PrintMode, Sector, Ticket } from "../../types";
import type { PrintOptions } from "./printers.ts";
import { ticketLayout, type TicketLayout } from "./ticketLayout.ts";

// Reimprimir las comandas de un pedido desde el panel (menú contextual del
// tablero), sin abrir la pantalla de cada sector. Cada comanda sale por la
// impresora de su sector, con la marca de reimpresión, y queda contada como
// impresa. Los sectores que trabajan solo en pantalla no imprimen.

export class ReprintError extends Error {}

export interface ReprintDeps {
  load: (orderId: number) => Promise<{ tickets: Ticket[]; sectors: Sector[] }>;
  print: (mode: PrintMode, layout: TicketLayout, options: PrintOptions) => Promise<void>;
  markPrinted: (sectorId: number, ticketId: number) => Promise<unknown>;
}

/** Devuelve cuántas comandas se mandaron a imprimir. */
export async function reprintOrderTickets(orderId: number, deps: ReprintDeps): Promise<number> {
  const { tickets, sectors } = await deps.load(orderId);
  if (tickets.length === 0) throw new ReprintError("Este pedido todavía no tiene comandas.");

  const sectorOf = new Map(sectors.map((sector) => [sector.id, sector]));
  const printable = tickets.filter((ticket) => {
    const mode = sectorOf.get(ticket.sectorId)?.printMode;
    return mode !== undefined && mode !== "none";
  });
  if (printable.length === 0) {
    throw new ReprintError("Los sectores de este pedido trabajan solo en pantalla: no tienen impresora configurada.");
  }

  // De a una: varias comandas juntas no se pisan en la impresora.
  for (const ticket of printable) {
    const sector = sectorOf.get(ticket.sectorId)!;
    await deps.print(sector.printMode, { ...ticketLayout(ticket), reprint: true }, {
      paperWidth: sector.paperWidth,
      copies: sector.printCopies,
    });
    await deps.markPrinted(sector.id, ticket.id);
  }
  return printable.length;
}
