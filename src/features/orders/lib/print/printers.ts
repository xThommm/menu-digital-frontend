import type { PaperWidth, PrintMode } from "../../types";
import { formatAmount } from "../bill.ts";
import { encodeBill, encodeTicket } from "./escpos.ts";
import { BILL_FOOTER, type BillLayout } from "./billLayout.ts";
import type { TicketLayout } from "./ticketLayout.ts";

// Cómo sale una comanda (o la cuenta) a papel, según el modo del sector (o de
// la impresora de la cuenta de este equipo):
//
// - browser: ticket HTML del ancho del papel por el diálogo de impresión del
//   navegador. Sirve con cualquier impresora instalada en el equipo (también
//   una comandera con su driver). Para que imprima sin preguntar, abrir
//   Chrome/Edge con --kiosk-printing y la comandera como predeterminada.
// - escpos: bytes ESC/POS directo a la comandera por puerto serie/USB (Web
//   Serial, solo Chrome/Edge de escritorio). EXPERIMENTAL: no se probó con
//   una impresora real. El navegador pide elegir el puerto la primera vez
//   (con un clic de la persona); después lo recuerda.

export interface PrintOptions {
  paperWidth: PaperWidth;
  copies: number;
}

export class PrintError extends Error {}

// ── Navegador ────────────────────────────────

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]!));

export function ticketHtml(layout: TicketLayout, { paperWidth, copies }: PrintOptions): string {
  const one = `
    <section class="ticket">
      <div class="sector">${escapeHtml(layout.sector)}</div>
      ${layout.cancelled ? `<div class="cancelled">*** ANULADA ***</div>` : layout.reprint ? `<div class="meta">(reimpresión)</div>` : ""}
      <div class="place">${escapeHtml(layout.place)} <span>#${layout.orderNumber}</span></div>
      <div class="meta">${escapeHtml([layout.time, layout.waiter].filter(Boolean).join(" · "))}</div>
      <hr />
      <ul>
        ${layout.lines.map(line => `
          <li>
            <b>${line.quantity} ×</b>
            <div>
              <strong>${escapeHtml(line.title)}${line.option ? ` (${escapeHtml(line.option)})` : ""}</strong>
              ${line.notes ? `<em>› ${escapeHtml(line.notes)}</em>` : ""}
            </div>
          </li>`).join("")}
      </ul>
      ${layout.notes ? `<hr /><p class="notes"><b>Nota:</b> ${escapeHtml(layout.notes)}</p>` : ""}
    </section>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Comanda #${layout.orderNumber}</title>
<style>
  @page { size: ${paperWidth}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; width: ${paperWidth}mm; padding: 2mm 3mm; font: 12px/1.3 "Courier New", monospace; color: #000; background: #fff; }
  .ticket { page-break-after: always; }
  .ticket:last-child { page-break-after: auto; }
  .sector { text-align: center; font-weight: 700; text-transform: uppercase; }
  .cancelled { text-align: center; font-size: 18px; font-weight: 700; margin: 1mm 0; }
  .place { text-align: center; font-size: 20px; font-weight: 700; margin-top: 1mm; }
  .place span { white-space: nowrap; }
  .meta { text-align: center; }
  hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 2mm; font-size: 15px; margin-bottom: 1.5mm; }
  li > b { flex: none; }
  li strong { display: block; }
  li em { display: block; font-size: 12px; font-style: normal; }
  .notes { margin: 0; }
</style></head><body>${Array.from({ length: Math.max(1, copies) }, () => one).join("")}</body></html>`;
}

// Cuenta para el cliente: productos con precio, total, división y pagos.
export function billHtml(layout: BillLayout, { paperWidth, copies }: PrintOptions): string {
  const money = (value: number) => escapeHtml(formatAmount(value));
  const row = (label: string, value: number, className = "") =>
    `<div class="row ${className}"><span>${escapeHtml(label)}</span><span>${money(value)}</span></div>`;
  const one = `
    <section class="ticket">
      ${layout.business ? `<div class="business">${escapeHtml(layout.business)}</div>` : ""}
      <div class="title">CUENTA</div>
      <div class="meta">${escapeHtml([layout.place, layout.orders].filter(Boolean).join(" · "))}</div>
      <div class="meta">${escapeHtml([layout.dateTime, layout.waiter].filter(Boolean).join(" · "))}</div>
      <hr />
      ${layout.lines.map(line => row(`${line.quantity} × ${line.title}`, line.amount)).join("")}
      <hr />
      ${layout.discount > 0 ? row("Subtotal", layout.subtotal) + row("Descuento", -layout.discount) : ""}
      ${row("TOTAL", layout.total, "total")}
      ${layout.split.length > 0 ? `<hr /><div>Dividida:</div>${layout.split.map(guest => row(guest.name, guest.amount, "indent")).join("")}` : ""}
      ${layout.payments.length > 0 ? `<hr /><div>Pagos:</div>${layout.payments.map(payment => row(payment.label, payment.amount, "indent")).join("")}
        ${layout.pending > 0 ? row("FALTA PAGAR", layout.pending, "strong") : `<div class="paid">PAGADO</div>`}` : ""}
      <hr />
      ${BILL_FOOTER.map(line => `<div class="meta">${escapeHtml(line)}</div>`).join("")}
    </section>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Cuenta ${escapeHtml(layout.place)}</title>
<style>
  @page { size: ${paperWidth}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; width: ${paperWidth}mm; padding: 2mm 3mm; font: 12px/1.35 "Courier New", monospace; color: #000; background: #fff; }
  .ticket { page-break-after: always; }
  .ticket:last-child { page-break-after: auto; }
  .business { text-align: center; font-size: 18px; font-weight: 700; }
  .title { text-align: center; font-weight: 700; margin-top: 1mm; }
  .meta { text-align: center; }
  hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row span:last-child { flex: none; white-space: nowrap; }
  .indent span:first-child { padding-left: 2mm; }
  .strong { font-weight: 700; }
  .total { font-size: 17px; font-weight: 700; margin-top: 1mm; }
  .paid { text-align: center; font-weight: 700; margin-top: 1mm; }
</style></head><body>${Array.from({ length: Math.max(1, copies) }, () => one).join("")}</body></html>`;
}

// Imprime en un iframe oculto: la pantalla no cambia.
function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) { cleanup(); reject(new PrintError("No se pudo preparar la impresión.")); return; }
      win.addEventListener("afterprint", cleanup, { once: true });
      win.focus();
      win.print();
      resolve();
    };
    frame.srcdoc = html;
  });
}

// ── Comandera ESC/POS por Web Serial (experimental) ──

// Tipos mínimos de Web Serial (no están en lib.dom de TypeScript).
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
}

const serial = (): SerialLike | null =>
  (typeof navigator !== "undefined" && (navigator as unknown as { serial?: SerialLike }).serial) || null;

export const escposSupported = () => serial() !== null;

// 9600 es lo más común en comanderas por USB-serie; muchas por USB ignoran el valor.
const BAUD_RATE = 9600;

// Pide elegir la comandera (necesita un clic de la persona: no se puede
// llamar desde un temporizador). El navegador recuerda el permiso.
export async function chooseEscposPrinter(): Promise<void> {
  const api = serial();
  if (!api) throw new PrintError("Este navegador no puede hablar directo con la comandera. Usá Chrome o Edge en una PC.");
  await api.requestPort();
}

export async function hasEscposPrinter(): Promise<boolean> {
  const api = serial();
  return api ? (await api.getPorts()).length > 0 : false;
}

async function writeEscpos(bytes: Uint8Array): Promise<void> {
  const api = serial();
  if (!api) throw new PrintError("Este navegador no puede hablar directo con la comandera.");
  const [port] = await api.getPorts();
  if (!port) throw new PrintError("Elegí la comandera desde \"Conectar comandera\".");
  await port.open({ baudRate: BAUD_RATE });
  try {
    const writer = port.writable?.getWriter();
    if (!writer) throw new PrintError("La comandera no acepta datos.");
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}

export async function printTicket(mode: PrintMode, layout: TicketLayout, options: PrintOptions): Promise<void> {
  if (mode === "browser") return printHtml(ticketHtml(layout, options));
  if (mode === "escpos") return writeEscpos(encodeTicket(layout, options));
  throw new PrintError("Este sector trabaja solo en pantalla.");
}

export async function printBill(mode: PrintMode, layout: BillLayout, options: PrintOptions): Promise<void> {
  if (mode === "browser") return printHtml(billHtml(layout, options));
  if (mode === "escpos") return writeEscpos(encodeBill(layout, options));
  throw new PrintError("Este equipo no tiene impresora para la cuenta. Configurala en Configuración de pedidos.");
}
