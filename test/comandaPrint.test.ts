import test from "node:test";
import assert from "node:assert/strict";
import { ticketLayout, wrapText } from "../src/features/orders/lib/print/ticketLayout.ts";
import { encodeTicket, encodeText } from "../src/features/orders/lib/print/escpos.ts";
import type { Ticket } from "../src/features/orders/types.ts";

// Comandas impresas: el armado (qué dice) y los bytes ESC/POS para la
// comandera. Sin impresora real: se verifica la secuencia de comandos.

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 7,
  orderId: 30,
  sectorId: 1,
  sectorName: "Cocina",
  status: "new",
  createdAt: "2026-09-30T23:05:00.000Z",
  startedAt: null,
  doneAt: null,
  cancelledAt: null,
  printedAt: null,
  printCount: 0,
  order: {
    number: 12,
    status: "confirmed",
    serviceType: "table",
    tableNumber: 4,
    customerName: null,
    waiterName: "Juan",
    notes: "Sin sal para todos",
    createdAt: "2026-09-30T23:04:00.000Z",
  },
  items: [
    { title: "Milanesa napolitana", option: "Grande", quantity: 2, notes: "sin cebolla" },
    { title: "Papas fritas", option: null, quantity: 1, notes: null },
  ],
  ...overrides,
});

const includes = (bytes: Uint8Array, sequence: number[]) => {
  outer: for (let i = 0; i <= bytes.length - sequence.length; i += 1) {
    for (let j = 0; j < sequence.length; j += 1) if (bytes[i + j] !== sequence[j]) continue outer;
    return true;
  }
  return false;
};

const count = (bytes: Uint8Array, sequence: number[]) => {
  let total = 0;
  for (let i = 0; i <= bytes.length - sequence.length; i += 1) {
    if (sequence.every((value, j) => bytes[i + j] === value)) total += 1;
  }
  return total;
};

test("la comanda dice sector, destino, número, hora en Argentina y operador", () => {
  const layout = ticketLayout(ticket());
  assert.equal(layout.sector, "Cocina");
  assert.equal(layout.place, "Mesa 4");
  assert.equal(layout.orderNumber, 12);
  assert.equal(layout.time, "20:05");
  assert.equal(layout.waiter, "Juan");
  assert.equal(layout.cancelled, false);
  assert.equal(layout.reprint, false);
});

test("take away muestra a nombre de quién y una reimpresión se marca", () => {
  const layout = ticketLayout(ticket({
    printCount: 1,
    order: { ...ticket().order, serviceType: "takeaway", tableNumber: null, customerName: "Ana" },
  }));
  assert.equal(layout.place, "Take away · Ana");
  assert.equal(layout.reprint, true);
});

test("corta renglones sin partir palabras, salvo las que no entran", () => {
  assert.deepEqual(wrapText("Milanesa napolitana con papas", 12), ["Milanesa", "napolitana", "con papas"]);
  assert.deepEqual(wrapText("Supercalifragilístico", 8), ["Supercal", "ifragilí", "stico"]);
  assert.deepEqual(wrapText("  ", 10), []);
});

test("acentos y ñ salen en la página de códigos PC850", () => {
  assert.deepEqual(encodeText("Ñoquis ¿jamón?"), [0xa5, 0x6f, 0x71, 0x75, 0x69, 0x73, 0x20, 0xa8, 0x6a, 0x61, 0x6d, 0xa2, 0x6e, 0x3f]);
  assert.deepEqual(encodeText("“A”—×"), [0x22, 0x41, 0x22, 0x2d, 0x78]);
  // Lo que la impresora no puede mostrar sale como "?".
  assert.deepEqual(encodeText("🍕"), [0x3f]);
});

test("bytes ESC/POS: inicializa, elige PC850, imprime el contenido y corta", () => {
  const bytes = encodeTicket(ticketLayout(ticket()), { paperWidth: 80 });
  assert.deepEqual([...bytes.slice(0, 5)], [0x1b, 0x40, 0x1b, 0x74, 2]);
  const text = new TextDecoder("latin1").decode(bytes);
  assert.match(text, /COCINA/);
  assert.match(text, /Mesa 4 #12/);
  assert.match(text, /2 x Milanesa napolitana \(Grande\)/);
  assert.match(text, /> sin cebolla/);
  assert.match(text, /NOTA:/);
  assert.ok(includes(bytes, [0x1d, 0x56, 66, 3]), "corte parcial");
});

test("58 mm: ningún renglón de texto normal pasa de 32 caracteres", () => {
  const long = ticket({ items: [{ title: "Hamburguesa doble con cheddar, panceta y huevo frito", option: null, quantity: 3, notes: "la carne bien cocida por favor" }] });
  const bytes = encodeTicket(ticketLayout(long), { paperWidth: 58 });
  // Los renglones van entre LF. Se sacan los comandos (ESC/GS y el byte que
  // los identifica) y los argumentos, que son bytes de control.
  let plain = "";
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0x1b || bytes[i] === 0x1d) { i += 1; continue; }
    if (bytes[i] === 0x0a || bytes[i] >= 0x20) plain += String.fromCharCode(bytes[i]);
  }
  for (const row of plain.split("\n")) assert.ok(row.length <= 32, `renglón largo: "${row}"`);
});

test("una comanda anulada lo dice y las copias se repiten con su corte", () => {
  const bytes = encodeTicket(ticketLayout(ticket({ status: "cancelled" })), { paperWidth: 80, copies: 2 });
  assert.match(new TextDecoder("latin1").decode(bytes), /\*\*\* ANULADA \*\*\*/);
  assert.equal(count(bytes, [0x1d, 0x56, 66, 3]), 2);
});
