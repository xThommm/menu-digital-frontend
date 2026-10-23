import type { PaperWidth } from "../../types";
import { CHARS_PER_LINE, wrapText, type TicketLayout } from "./ticketLayout.ts";
import { BILL_FOOTER, columns, type BillLayout } from "./billLayout.ts";
import { formatAmount } from "../bill.ts";

// Codificador ESC/POS: arma los bytes que entiende una comandera térmica
// (Epson TM-T20, Xprinter, 3nStar, Gadnic y la mayoría de las genéricas).
//
// PREPARADO, SIN PROBAR EN UNA IMPRESORA REAL. Usa solo comandos del set
// básico que comparten casi todas: inicializar, página de códigos, negrita,
// doble alto/ancho, alineación, avance y corte parcial. Al probar con la
// comandera, revisar sobre todo la página de códigos de los acentos
// (CODE_PAGE) y si el modelo corta solo (CUT).

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// ESC t n: página de códigos. 2 = PC850 (Multilingual) en la tabla de Epson,
// la más común con acentos y ñ. Algunos clones usan otra numeración.
const CODE_PAGE = 2;

// Caracteres del castellano en PC850. Lo que no esté acá y no sea ASCII
// imprimible sale como "?".
const PC850: Record<string, number> = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "ü": 0x81,
  "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9, "Ñ": 0xa5, "Ü": 0x9a,
  "¿": 0xa8, "¡": 0xad, "°": 0xf8, "º": 0xa7, "ª": 0xa6, "·": 0xfa,
};

// Tipografía y comillas "lindas" que llegan desde el menú.
const REPLACEMENTS: Record<string, string> = {
  "“": "\"", "”": "\"", "‘": "'", "’": "'", "–": "-", "—": "-", "…": "...", "×": "x",
  // Espacios duros: los usa el formato de moneda ("$ 1.500").
  " ": " ", " ": " ",
};

export function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (const raw of text) {
    const char = REPLACEMENTS[raw] ?? raw;
    for (const c of char) {
      const code = c.codePointAt(0)!;
      if (code >= 0x20 && code < 0x7f) bytes.push(code);
      else if (PC850[c] !== undefined) bytes.push(PC850[c]);
      else bytes.push(0x3f);
    }
  }
  return bytes;
}

class Builder {
  private bytes: number[] = [];

  raw(...values: number[]) { this.bytes.push(...values); return this; }
  init() { return this.raw(ESC, 0x40, ESC, 0x74, CODE_PAGE); }
  align(position: "left" | "center") { return this.raw(ESC, 0x61, position === "center" ? 1 : 0); }
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  // GS ! n: ancho y alto (0 = normal, 0x11 = doble ancho y doble alto).
  size(double: boolean) { return this.raw(GS, 0x21, double ? 0x11 : 0x00); }
  text(value: string) { return this.raw(...encodeText(value)); }
  line(value = "") { return this.text(value).raw(LF); }
  feed(lines: number) { return this.raw(ESC, 0x64, lines); }
  // GS V 66 n: avanza n y corta parcial (deja la comanda colgando).
  cut() { return this.raw(GS, 0x56, 66, 3); }
  toBytes() { return Uint8Array.from(this.bytes); }
}

/**
 * Bytes de una comanda para una comandera ESC/POS.
 * @param copies  cuántas veces se imprime (una para cada puesto, por ejemplo)
 */
export function encodeTicket(layout: TicketLayout, { paperWidth, copies = 1 }: { paperWidth: PaperWidth; copies?: number }): Uint8Array {
  const width = CHARS_PER_LINE[paperWidth];
  // Con doble ancho entra la mitad por renglón.
  const bigWidth = Math.floor(width / 2);
  const rule = "-".repeat(width);
  const b = new Builder().init();

  for (let copy = 0; copy < Math.max(1, copies); copy += 1) {
    b.align("center").bold(true).line(layout.sector.toUpperCase()).bold(false);
    if (layout.cancelled) b.size(true).line("*** ANULADA ***").size(false);
    else if (layout.reprint) b.line("(reimpresión)");
    b.size(true);
    for (const row of wrapText(`${layout.place} #${layout.orderNumber}`, bigWidth)) b.line(row);
    b.size(false).line([layout.time, layout.waiter].filter(Boolean).join(" · "));
    b.align("left").line(rule);

    for (const item of layout.lines) {
      const qty = `${item.quantity} x `;
      const indent = " ".repeat(qty.length);
      const title = item.option ? `${item.title} (${item.option})` : item.title;
      // Cantidad y producto en doble alto: es lo que se lee de lejos.
      b.bold(true).raw(GS, 0x21, 0x01);
      wrapText(title, width - qty.length).forEach((row, index) => b.line(`${index === 0 ? qty : indent}${row}`));
      b.raw(GS, 0x21, 0x00).bold(false);
      if (item.notes) wrapText(`> ${item.notes}`, width - indent.length).forEach(row => b.line(`${indent}${row}`));
    }

    if (layout.notes) {
      b.line(rule).bold(true).line("NOTA:").bold(false);
      wrapText(layout.notes, width).forEach(row => b.line(row));
    }
    b.line(rule).feed(3).cut();
  }
  return b.toBytes();
}

/**
 * Bytes de la cuenta (ticket para el cliente) para una comandera ESC/POS:
 * productos con su precio, subtotal, descuento, total, la división y los pagos.
 */
export function encodeBill(layout: BillLayout, { paperWidth, copies = 1 }: { paperWidth: PaperWidth; copies?: number }): Uint8Array {
  const width = CHARS_PER_LINE[paperWidth];
  const bigWidth = Math.floor(width / 2);
  const rule = "-".repeat(width);
  const b = new Builder().init();
  const row = (left: string, amount: number) => { columns(left, formatAmount(amount), width).forEach(line => b.line(line)); };

  for (let copy = 0; copy < Math.max(1, copies); copy += 1) {
    b.align("center");
    if (layout.business) {
      b.bold(true).size(true);
      for (const line of wrapText(layout.business, bigWidth)) b.line(line);
      b.size(false).bold(false);
    }
    b.bold(true).line("CUENTA").bold(false);
    for (const line of wrapText([layout.place, layout.orders].filter(Boolean).join(" · "), width)) b.line(line);
    b.line([layout.dateTime, layout.waiter].filter(Boolean).join(" · "));
    b.align("left").line(rule);

    for (const item of layout.lines) row(`${item.quantity} x ${item.title}`, item.amount);
    b.line(rule);

    if (layout.discount > 0) {
      row("Subtotal", layout.subtotal);
      row("Descuento", -layout.discount);
    }
    // El total en doble alto: es lo primero que se busca.
    b.bold(true).raw(GS, 0x21, 0x01);
    row("TOTAL", layout.total);
    b.raw(GS, 0x21, 0x00).bold(false);

    if (layout.split.length > 0) {
      b.line(rule).line("Dividida:");
      for (const guest of layout.split) row(`  ${guest.name}`, guest.amount);
    }

    if (layout.payments.length > 0) {
      b.line(rule).line("Pagos:");
      for (const payment of layout.payments) row(`  ${payment.label}`, payment.amount);
      if (layout.pending > 0) {
        b.bold(true);
        row("FALTA PAGAR", layout.pending);
        b.bold(false);
      } else {
        b.align("center").bold(true).line("PAGADO").bold(false).align("left");
      }
    }

    b.line(rule).align("center");
    for (const line of BILL_FOOTER) b.line(line);
    b.align("left").feed(3).cut();
  }
  return b.toBytes();
}
