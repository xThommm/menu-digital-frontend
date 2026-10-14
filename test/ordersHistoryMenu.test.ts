import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHistoryOrderMenu, buildHistoryPageMenu, customerSummary, type HistoryOrderMenuActions,
} from "../src/features/orders/components/panel/ordersHistoryMenu.ts";
import { repeatOrderDraft, REPEAT_LINE_MAX } from "../src/features/orders/lib/repeatOrder.ts";
import type { Order, OrderItem } from "../src/features/orders/types.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

const item = (id: number, overrides: Partial<OrderItem> = {}): OrderItem => ({
  id, itemId: `i${id}`, title: `Producto ${id}`, categoryName: null, option: null, unitPrice: 1000, quantity: 1, notes: null,
  deliveredAt: null, ...overrides,
});

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 10, shiftId: 1, number: 7, source: "panel", status: "delivered", serviceType: "table", tableNumber: 4, tableSessionId: 3,
  cashSessionId: 1, customerName: null, customerPhone: null, deliveryAddress: null, deliveryNotes: null, waiterId: null,
  waiterName: null, notes: null, statusReason: null, paymentMode: "none", paymentStatus: "NOT_REQUIRED", subtotal: 2000,
  discountAmount: 0, total: 2000, createdAt: "2026-10-09T20:00:00Z", confirmedAt: null, readyAt: null, dispatchedAt: null,
  deliveredAt: null, cancelledAt: null, returnedAt: null, items: [item(1), item(2)], removedItems: [], refundDue: 0,
  ...overrides,
});

function menu(target: Order) {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions: HistoryOrderMenuActions = {
    toggleDetails: fn("details"), reopen: async (o) => { calls.push(`reopen #${o.id}`); }, markReturned: fn("returned"),
    refund: fn("refund"), repeat: fn("repeat"),
  };
  return { items: resolve(buildHistoryOrderMenu(env), { order: target, expanded: false, busy: false, actions }), calls, log };
}

test("según el estado: devuelto para los entregados, reabrir (con confirmación) para los cancelados", async () => {
  assert.deepEqual(ids(menu(order()).items), ["details", "returned", "repeat", "copy", "copy/number"]);

  const cancelled = menu(order({ status: "cancelled" }));
  const reopen = action(cancelled.items, "reopen");
  assert.equal(reopen.confirm?.title, "¿Reabrir el pedido #7?");
  assert.equal((await run(reopen, { accept: false })).outcome, "cancelled");
  await run(reopen);
  assert.deepEqual(cancelled.calls, ["reopen #10"]);

  const paid = ids(menu(order({ paymentMode: "mercadopago", paymentStatus: "APPROVED" })).items);
  assert.ok(paid.includes("refund"));
});

test("copiar los datos del cliente y repetir el pedido", async () => {
  const delivery = order({ serviceType: "delivery", tableNumber: null, customerName: "Ana", customerPhone: "1123", deliveryAddress: "Calle 1" });
  const { items, calls, log } = menu(delivery);
  await run(action(items, "copy/customer"));
  await run(action(items, "repeat"));
  assert.deepEqual(log, ["copy:Ana\n1123\nCalle 1"]);
  assert.deepEqual(calls, ["repeat #10"]);
  assert.equal(customerSummary(order()), "", "sin datos no hay qué copiar");
});

test("repetir: mismos productos (juntando líneas iguales), aclaraciones por unidad y el mismo destino", () => {
  const draft = repeatOrderDraft(order({
    notes: "Sin sal",
    items: [
      item(1, { itemId: "pizza", title: "Pizza", quantity: 2, notes: "bien cocida" }),
      item(2, { itemId: "pizza", title: "Pizza", quantity: 1 }),
      item(3, { itemId: "agua", title: "Agua", option: "Con gas", quantity: 30 }),
    ],
  }));
  assert.equal(draft.lines.length, 2);
  assert.deepEqual(draft.lines[0], { itemId: "pizza", title: "Pizza", option: undefined, unitPrice: 1000, quantity: 3, unitNotes: ["bien cocida", "bien cocida", ""] });
  assert.equal(draft.lines[1].quantity, REPEAT_LINE_MAX, "mismo tope que el selector");
  assert.deepEqual(draft.service, { serviceType: "table", table: "4", customerName: "", customerPhone: "", deliveryAddress: "", deliveryNotes: "" });
  assert.equal(draft.notes, "Sin sal");
});

test("fondo: turno actual / último y ver todo", async () => {
  const { calls, fn } = recorder();
  const items = resolve(buildHistoryPageMenu(), { scope: "all", shiftLabel: "Último turno", actions: { showCurrent: fn("current"), showAll: fn("all") } });
  assert.equal(action(items, "current").label, "Último turno");
  assert.equal(action(items, "all").disabled, true);
  await run(action(items, "current"));
  assert.deepEqual(calls, ["current"]);
});
