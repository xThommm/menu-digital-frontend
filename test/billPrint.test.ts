import test from "node:test";
import assert from "node:assert/strict";
import { billLayoutFromOrder, billLayoutFromTable, columns } from "../src/features/orders/lib/print/billLayout.ts";
import { encodeBill, encodeText } from "../src/features/orders/lib/print/escpos.ts";
import { billHtml } from "../src/features/orders/lib/print/printers.ts";
import type { Bill, Order } from "../src/features/orders/types.ts";

// Cuenta impresa (ticket para el cliente): qué dice y los bytes ESC/POS.
// Sin impresora real: se verifica el contenido y la secuencia de comandos.

const NOW = new Date("2026-10-23T23:30:00.000Z");

const bill = (overrides: Partial<Bill> = {}): Bill => ({
  tableSessionId: 3,
  tableNumber: 4,
  closed: false,
  mode: "none",
  total: 9000,
  paid: 5000,
  pending: 4000,
  overpaid: 0,
  unassigned: 0,
  overAssigned: 0,
  paidUnattributed: 0,
  status: "partial",
  guests: [],
  items: [
    { id: 1, orderId: 10, orderNumber: 12, title: "Coca", option: null, quantity: 2, unitPrice: 1500, amount: 2700, authorName: null, shared: false, shares: [] },
    { id: 2, orderId: 10, orderNumber: 12, title: "Milanesa", option: "Grande", quantity: 1, unitPrice: 5000, amount: 4500, authorName: null, shared: false, shares: [] },
    { id: 3, orderId: 11, orderNumber: 15, title: "Coca", option: null, quantity: 1, unitPrice: 1500, amount: 1800, authorName: null, shared: false, shares: [] },
  ],
  payments: [
    { id: 1, amount: 5000, methodKind: "cash", methodName: "Efectivo", guestId: null, payerName: "Ana", reference: null, status: "approved", actorType: null, actorName: null, createdAt: "", voidedAt: null, voidReason: null },
    { id: 2, amount: 900, methodKind: "debit", methodName: "Débito", guestId: null, payerName: null, reference: null, status: "voided", actorType: null, actorName: null, createdAt: "", voidedAt: "", voidReason: null },
  ],
  events: [],
  ...overrides,
});

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 10, shiftId: 1, number: 7, source: "panel", status: "ready", serviceType: "takeaway", tableNumber: null, tableSessionId: null,
  cashSessionId: 1, customerName: "Juan", customerPhone: null, deliveryAddress: null, deliveryNotes: null, waiterId: null,
  waiterName: "Caro", notes: null, statusReason: null, paymentMode: "none", paymentStatus: "NOT_REQUIRED", subtotal: 3000,
  discountAmount: 300, total: 2700, createdAt: "2026-10-23T23:00:00Z", confirmedAt: null, readyAt: null, dispatchedAt: null,
  deliveredAt: null, cancelledAt: null, returnedAt: null,
  items: [{ id: 1, itemId: "a", title: "Empanada", categoryName: null, option: null, unitPrice: 1000, quantity: 3, notes: null }],
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

test("cuenta de la mesa: junta lo repetido, muestra el descuento y solo los pagos vigentes", () => {
  const layout = billLayoutFromTable(bill(), { business: "La Esquina", now: NOW });
  assert.equal(layout.place, "Mesa 4");
  assert.equal(layout.orders, "Pedidos #12, #15");
  assert.equal(layout.dateTime.includes("20:30"), true, "hora de Argentina");
  assert.deepEqual(layout.lines, [
    { quantity: 3, title: "Coca", amount: 4500 },
    { quantity: 1, title: "Milanesa (Grande)", amount: 5000 },
  ]);
  assert.equal(layout.subtotal, 9500);
  assert.equal(layout.discount, 500);
  assert.equal(layout.total, 9000);
  assert.deepEqual(layout.payments, [{ label: "Efectivo · Ana", amount: 5000 }]);
  assert.equal(layout.pending, 4000);
  assert.deepEqual(layout.split, [], "sin dividir");
});

test("cuenta dividida: lo que le toca a cada uno", () => {
  const layout = billLayoutFromTable(bill({
    mode: "equal",
    guests: [
      { id: 1, name: "Ana", fromGroup: false, customAmount: null, owed: 4500, paid: 5000, balance: -500 },
      { id: 2, name: "Luis", fromGroup: false, customAmount: null, owed: 4500, paid: 0, balance: 4500 },
    ],
  }), { now: NOW });
  assert.deepEqual(layout.split, [{ name: "Ana", amount: 4500 }, { name: "Luis", amount: 4500 }]);
});

test("pedido suelto: a nombre de quién, descuento y lo pagado con Mercado Pago", () => {
  const plain = billLayoutFromOrder(order(), { now: NOW });
  assert.equal(plain.place, "Take away · Juan");
  assert.equal(plain.orders, "Pedido #7");
  assert.equal(plain.waiter, "Caro");
  assert.deepEqual(plain.lines, [{ quantity: 3, title: "Empanada", amount: 3000 }]);
  assert.equal(plain.discount, 300);
  assert.equal(plain.pending, 2700);
  assert.deepEqual(plain.payments, []);

  const online = billLayoutFromOrder(order({ paymentMode: "mercadopago", paymentStatus: "APPROVED" }), { now: NOW });
  assert.deepEqual(online.payments, [{ label: "Mercado Pago", amount: 2700 }]);
  assert.equal(online.pending, 0);
});

test("columnas: importe a la derecha; si el texto no entra sigue abajo", () => {
  assert.deepEqual(columns("TOTAL", "$ 900", 16), ["TOTAL      $ 900"]);
  const rows = columns("2 x Milanesa napolitana", "$ 24.000", 20);
  assert.deepEqual(rows, ["2 x Milanesa", "napolitana  $ 24.000"]);
  for (const row of rows) assert.ok(row.length <= 20);
  assert.deepEqual(columns("  Ana", "$ 500", 12), ["  Ana  $ 500"], "respeta la sangría");
});

test("ESC/POS: inicializa, renglones de 48 en 80 mm, total destacado, pagado/falta y corte por copia", () => {
  const layout = billLayoutFromTable(bill(), { business: "La Esquina", now: NOW });
  const bytes = encodeBill(layout, { paperWidth: 80, copies: 2 });
  assert.ok(includes(bytes, [0x1b, 0x40, 0x1b, 0x74, 2]), "inicializa con PC850");
  assert.ok(includes(bytes, encodeText("CUENTA")));
  assert.ok(includes(bytes, encodeText("FALTA PAGAR")));
  assert.ok(!includes(bytes, encodeText("Débito")), "el pago anulado no sale");
  assert.ok(includes(bytes, [0x1d, 0x21, 0x01]), "total en doble alto");
  assert.ok(includes(bytes, encodeText("No válido como factura")));
  assert.equal(count(bytes, [0x1d, 0x56, 66, 3]), 2, "un corte por copia");
  // El espacio duro del formato de moneda sale como espacio, no como "?".
  assert.ok(includes(bytes, encodeText("$ 9.000")));
  assert.ok(!bytes.includes(0x3f), "ningún carácter sin traducir");

  // Ningún renglón pasa de 48 caracteres (sin contar los comandos).
  const text = new TextDecoder("latin1").decode(bytes.filter(byte => byte === 0x0a || byte >= 0x20));
  for (const line of text.split("\n")) assert.ok(line.length <= 48 + 6, `renglón largo: ${line}`);

  const paid = encodeBill(billLayoutFromTable(bill({ paid: 9000, pending: 0 }), { now: NOW }), { paperWidth: 58 });
  assert.ok(includes(paid, encodeText("PAGADO")));
  assert.ok(!includes(paid, encodeText("FALTA PAGAR")));
});

test("HTML: ancho del papel, total y leyenda; escapa lo que viene del menú", () => {
  const layout = billLayoutFromTable(bill({
    items: [{ ...bill().items[0], title: "<b>Coca</b>" }],
  }), { business: "Bar & Co", now: NOW });
  const html = billHtml(layout, { paperWidth: 80, copies: 1 });
  assert.match(html, /size: 80mm auto/);
  assert.match(html, /Bar &amp; Co/);
  assert.match(html, /&lt;b&gt;Coca&lt;\/b&gt;/);
  assert.match(html, /TOTAL/);
  assert.match(html, /No válido como factura/);
});
