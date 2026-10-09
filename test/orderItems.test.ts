import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeliverItems, canEditItems, canRemoveItem, canRestoreItems, deliveryProgress, linesText, maxRemovable, removedNotice,
  stockNoticeMessage,
} from "../src/features/orders/lib/orderItems.ts";
import type { Order, OrderItem } from "../src/features/orders/types.ts";

const item = (id: number, overrides: Partial<OrderItem> = {}): OrderItem => ({
  id, itemId: `i${id}`, title: `Producto ${id}`, categoryName: null, option: null, unitPrice: 1000, quantity: 1, notes: null,
  deliveredAt: null, ...overrides,
});

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 1, shiftId: 1, number: 7, source: "panel", status: "confirmed", serviceType: "table", tableNumber: 4, tableSessionId: 1,
  cashSessionId: 1, customerName: null, customerPhone: null, deliveryAddress: null, deliveryNotes: null, waiterId: null,
  waiterName: null, notes: null, statusReason: null, paymentMode: "none", paymentStatus: "NOT_REQUIRED", subtotal: 2000,
  discountAmount: 0, total: 2000, createdAt: "2026-10-09T20:00:00Z", confirmedAt: null, readyAt: null, dispatchedAt: null,
  deliveredAt: null, cancelledAt: null, returnedAt: null, items: [item(1), item(2)], removedItems: [], refundDue: 0,
  ...overrides,
});

test("quitar productos: solo en pedidos en curso que no salieron del local", () => {
  for (const status of ["pending", "confirmed", "ready"] as const) assert.equal(canEditItems(order({ status })), true, status);
  for (const status of ["delivered", "cancelled", "returned"] as const) assert.equal(canEditItems(order({ status })), false, status);
  assert.equal(canEditItems(order({ status: "ready", dispatchedAt: "2026-10-09T20:30:00Z" })), false);
});

test("lo último que queda no se quita, salvo bajarle la cantidad", () => {
  const two = order();
  assert.equal(canRemoveItem(two, two.items[0]), true);
  assert.equal(maxRemovable(two, item(1, { quantity: 3 })), 3);

  const single = order({ items: [item(1)] });
  assert.equal(canRemoveItem(single, single.items[0]), false);

  const several = order({ items: [item(1, { quantity: 3 })] });
  assert.equal(canRemoveItem(several, several.items[0]), true);
  assert.equal(maxRemovable(several, several.items[0]), 2, "siempre queda al menos una unidad");

  const delivered = order({ items: [item(1, { deliveredAt: "2026-10-09T20:10:00Z" }), item(2)] });
  assert.equal(canRemoveItem(delivered, delivered.items[0]), false, "lo entregado no se quita");
});

test("entrega en partes: confirmado, con más de un producto y sin ser delivery", () => {
  assert.equal(canDeliverItems(order()), true);
  assert.equal(canDeliverItems(order({ status: "ready" })), true);
  assert.equal(canDeliverItems(order({ status: "pending" })), false);
  assert.equal(canDeliverItems(order({ serviceType: "delivery" })), false);
  assert.equal(canDeliverItems(order({ items: [item(1)] })), false, "con un solo producto alcanza con «Entregado»");
});

test("avance de la entrega", () => {
  assert.equal(deliveryProgress(order()), null);
  const partial = order({ items: [item(1, { deliveredAt: "x" }), item(2), item(3)] });
  assert.deepEqual(deliveryProgress(partial), { delivered: 1, total: 3 });
});

test("restaurar: no si ya se devolvió plata del pedido", () => {
  assert.equal(canRestoreItems(order()), true);
  assert.equal(canRestoreItems(order({ paymentMode: "mercadopago", paymentStatus: "APPROVED" })), true);
  assert.equal(canRestoreItems(order({ paymentMode: "mercadopago", paymentStatus: "PARTIALLY_REFUNDED" })), false);
  assert.equal(canRestoreItems(order({ status: "delivered" })), false);
});

test("aviso al cliente por WhatsApp: qué falta, el total que queda y la devolución", () => {
  const removed = [{ ...item(3, { title: "Empanadas", option: "Carne", quantity: 2 }), reason: "Sin stock", removedAt: "x" }];
  const paid = stockNoticeMessage(order({
    number: 12, customerName: " Ana ", total: 16000, removedItems: removed, refundDue: 6000, paymentMode: "mercadopago",
  }));
  assert.match(paid, /^¡Hola Ana! Te escribimos por tu pedido #12\./);
  assert.match(paid, /no nos queda:\n• 2× Empanadas \(Carne\)/);
  assert.match(paid, /recibir el resto del pedido \(total \$\s?16\.000\) o preferís cancelarlo/);
  assert.match(paid, /te devolvemos \$\s?6\.000 por Mercado Pago/);

  const unpaid = stockNoticeMessage(order({ removedItems: [...removed, { ...removed[0], id: 4, title: "Flan", option: null, quantity: 1 }] }));
  assert.match(unpaid, /^¡Hola! /);
  assert.match(unpaid, /no nos quedan:/);
  assert.doesNotMatch(unpaid, /Mercado Pago/);
});

test("seguimiento del cliente: explica qué se quitó y qué pasa con la plata", () => {
  const base = { orderStatus: "confirmed" as const, total: 22000, orderTotal: 16000, refund: "none" as const };
  const removed = [{ title: "Empanadas", option: null, quantity: 1 }];
  assert.equal(removedNotice(null), null);
  assert.equal(removedNotice({ ...base }), null, "sin productos quitados no hay aviso");
  assert.equal(removedNotice({ ...base, removedItems: [] }), null);

  const pending = removedNotice({ ...base, removedItems: removed });
  assert.equal(pending?.title, "Un producto no está disponible");
  assert.equal(pending?.items, "1× Empanadas");
  assert.match(pending?.text ?? "", /total \$\s?16\.000/);
  assert.match(pending?.text ?? "", /Te vamos a devolver \$\s?6\.000/);

  const done = removedNotice({ ...base, refund: "partial", removedItems: [...removed, { title: "Flan", option: "Mixto", quantity: 2 }] });
  assert.equal(done?.title, "Algunos productos no están disponibles");
  assert.equal(done?.items, "1× Empanadas, 2× Flan (Mixto)");
  assert.match(done?.text ?? "", /Ya te devolvimos la diferencia/);

  assert.equal(removedNotice({ ...base, orderStatus: "cancelled", removedItems: removed }), null, "cancelado: manda el otro mensaje");
  assert.equal(linesText([]), "");
});
