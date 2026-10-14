import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBoardMenu, buildOrderItemMenu, buildOrderMenu, type OrderItemMenuActions, type OrderMenuActions,
} from "../src/features/orders/components/panel/ordersBoardMenu.ts";
import { reprintOrderTickets, ReprintError } from "../src/features/orders/lib/print/reprint.ts";
import type { Order, OrderItem, Sector, Ticket } from "../src/features/orders/types.ts";
import { action, fakeEnv, ids, recorder, resolve, run, submenu } from "./support/menu.ts";

const item = (id: number, overrides: Partial<OrderItem> = {}): OrderItem => ({
  id, itemId: `i${id}`, title: `Producto ${id}`, categoryName: null, option: null, unitPrice: 1000, quantity: 1, notes: null,
  deliveredAt: null, ...overrides,
});

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 10, shiftId: 1, number: 7, source: "panel", status: "confirmed", serviceType: "table", tableNumber: 4, tableSessionId: 3,
  cashSessionId: 1, customerName: null, customerPhone: null, deliveryAddress: null, deliveryNotes: null, waiterId: null,
  waiterName: null, notes: null, statusReason: null, paymentMode: "none", paymentStatus: "NOT_REQUIRED", subtotal: 2000,
  discountAmount: 0, total: 2000, createdAt: "2026-10-09T20:00:00Z", confirmedAt: null, readyAt: null, dispatchedAt: null,
  deliveredAt: null, cancelledAt: null, returnedAt: null, items: [item(1), item(2)], removedItems: [], refundDue: 0,
  tickets: [{ id: 50, sectorId: 1, sectorName: "Cocina", status: "preparing", doneAt: null }],
  ...overrides,
});

function orderActions() {
  const { calls, fn } = recorder();
  const actions: OrderMenuActions = {
    refunds: true,
    dispatch: true,
    setStatus: fn("status"),
    markDispatched: fn("dispatch"),
    refund: fn("refund"),
    reprint: async (target) => { calls.push(`reprint #${target.id}`); },
  };
  return { calls, actions };
}

const orderMenu = (target: Order, { busy = false } = {}) => {
  const { env, log } = fakeEnv();
  const { calls, actions } = orderActions();
  return { items: resolve(buildOrderMenu(env), { order: target, busy, actions }), calls, log };
};

test("tarjeta: ofrece el paso que sigue según el estado, como los botones", () => {
  assert.deepEqual(ids(orderMenu(order({ status: "pending", tickets: [] })).items).slice(0, 1), ["confirm"]);
  const confirmed = ids(orderMenu(order({ status: "confirmed" })).items);
  assert.ok(confirmed.includes("ready") && confirmed.includes("deliver") && !confirmed.includes("confirm"));
  const ready = ids(orderMenu(order({ status: "ready" })).items);
  assert.ok(ready.includes("deliver") && !ready.includes("ready"));

  const delivery = ids(orderMenu(order({ status: "ready", serviceType: "delivery", tableNumber: null, tableSessionId: null })).items);
  assert.ok(delivery.includes("dispatch"), "delivery listo: salió el pedido");

  const withCourier = ids(orderMenu(order({
    status: "ready", serviceType: "delivery", tableSessionId: null,
    delivery: { status: "picked_up", courierName: "Ana" } as Order["delivery"],
  })).items);
  assert.ok(!withCourier.includes("deliver") && !withCourier.includes("dispatch"), "lo entrega el repartidor");
  assert.ok(withCourier.includes("deliveries"));
});

test("tarjeta: cancelar va con motivo y siempre confirma antes de cancelar", async () => {
  const { items, calls } = orderMenu(order());
  const cancel = submenu(items, "cancel");
  assert.deepEqual(cancel.items.filter((entry) => entry.type !== "separator").map((entry) => entry.label), [
    "Sin stock", "El cliente no vino", "Lo pidió el cliente", "Error de carga", "Sin motivo",
  ]);

  const noStock = action(items, "cancel/sin-stock");
  assert.equal(noStock.danger, true);
  assert.equal(noStock.confirm?.danger, true);
  assert.equal(noStock.confirm?.title, "¿Cancelar el pedido #7?");

  assert.equal((await run(noStock, { accept: false })).outcome, "cancelled");
  assert.deepEqual(calls, []);
  await run(noStock);
  await run(action(items, "cancel/no-reason"));
  assert.deepEqual(calls, ['status #10 "cancelled" "Sin stock"', "status #10 \"cancelled\" undefined"]);
});

test("tarjeta: un pedido pagado online no se cancela directo, se rechaza o reembolsa con su modal", async () => {
  const paid = order({ paymentMode: "mercadopago", paymentStatus: "APPROVED", refundDue: 500 });
  const { items, calls } = orderMenu(paid);
  const list = ids(items);
  assert.ok(!list.includes("cancel"));
  assert.ok(list.includes("reject-refund") && list.includes("refund") && list.includes("refund-due"));
  assert.match(action(items, "refund-due").label, /^Devolver \$/);

  await run(action(items, "reject-refund"));
  await run(action(items, "refund-due"));
  assert.deepEqual(calls, ["refund #10 true", "refund #10 false 500"]);
});

test("tarjeta: copiar, WhatsApp y mapas aparecen solo con el dato cargado", async () => {
  assert.deepEqual(ids(orderMenu(order()).items).filter((id) => id.startsWith("copy")), ["copy", "copy/number"]);

  const delivery = order({
    serviceType: "delivery", tableNumber: null, tableSessionId: null,
    customerPhone: "1123456789", deliveryAddress: "Av. Siempre Viva 742",
  });
  const { items, log } = orderMenu(delivery);
  assert.ok(ids(items).includes("copy/phone") && ids(items).includes("copy/address"));

  const copied = await run(action(items, "copy/address"));
  assert.deepEqual(copied.notices, ["ok:Dirección copiada."]);
  await run(action(items, "maps"));
  await run(action(items, "whatsapp"));
  assert.equal(log[0], "copy:Av. Siempre Viva 742");
  assert.equal(log[1], `open:https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Av. Siempre Viva 742")}`);
  assert.match(log[2], /^open:https:\/\/wa\.me\//);
});

test("tarjeta: reimprimir solo con comandas vigentes; ir a la mesa lleva la sesión", async () => {
  assert.ok(!ids(orderMenu(order({ status: "pending" })).items).includes("reprint"));
  assert.ok(!ids(orderMenu(order({ tickets: [{ id: 1, sectorId: 1, sectorName: "Cocina", status: "cancelled", doneAt: null }] })).items).includes("reprint"));

  const { items, calls, log } = orderMenu(order());
  const reprint = await run(action(items, "reprint"));
  assert.deepEqual(reprint.notices, ["ok:Comanda enviada a la impresora."]);
  assert.deepEqual(calls, ["reprint #10"]);

  await run(action(items, "table"));
  await run(action(items, "bill"));
  assert.deepEqual(log, ['go:/pedidos/mesas {"tableSessionId":3}', 'go:/pedidos/mesas {"tableSessionId":3,"bill":true}']);

  assert.ok(!ids(orderMenu(order({ tableSessionId: null })).items).includes("table"));
});

test("tarjeta: mientras se actualiza el pedido, lo que lo cambia queda deshabilitado", () => {
  const { items } = orderMenu(order(), { busy: true });
  assert.equal(action(items, "ready").disabled, true);
  assert.equal(submenu(items, "cancel").disabled, true);
  assert.equal(action(items, "copy/number").disabled, false, "copiar sigue andando");
});

// ── Producto del pedido ──

function itemMenu(target: Order, picked: { item?: OrderItem; removed?: Order["removedItems"] extends (infer R)[] | undefined ? R : never }, busy = false) {
  const { calls, fn } = recorder();
  const actions: OrderItemMenuActions = { remove: fn("remove"), restore: fn("restore"), setDelivered: fn("delivered") };
  const items = resolve(buildOrderItemMenu(), {
    order: target, item: picked.item ?? null, removed: picked.removed ?? null, busy, actions,
  });
  return { items, calls };
}

test("producto: quitar una unidad o todas, con motivo y confirmación", async () => {
  const target = order({ items: [item(1, { quantity: 3, title: "Empanada" }), item(2)] });
  const { items, calls } = itemMenu(target, { item: target.items[0] });
  assert.deepEqual(ids(items).filter((id) => !id.includes("/")), ["delivered", "remove-one", "remove"]);

  const one = action(items, "remove-one/sin-stock");
  assert.equal(one.confirm?.title, "¿Quitar 1 de 3 Empanada?");
  assert.equal((await run(one, { accept: false })).outcome, "cancelled");
  await run(one);
  await run(action(items, "remove/error-de-carga"));
  assert.deepEqual(calls, [
    'remove #10 #1 {"quantity":1,"reason":"Sin stock"}',
    'remove #10 #1 {"reason":"Error de carga"}',
  ]);
});

test("producto: lo último del pedido no se quita y lo quitado se puede volver a poner", async () => {
  const single = order({ items: [item(1)] });
  assert.deepEqual(ids(itemMenu(single, { item: single.items[0] }).items), [], "ni quitar ni entregar en partes");

  const removed = { ...item(9, { title: "Flan" }), reason: "Sin stock", removedAt: "2026-10-09T20:05:00Z" };
  const withRemoved = order({ removedItems: [removed] });
  const { items, calls } = itemMenu(withRemoved, { removed });
  assert.deepEqual(ids(items), ["restore"]);
  await run(action(items, "restore"));
  assert.deepEqual(calls, ["restore #10 #9"]);

  // Backend anterior (sin removedItems): no se ofrece nada.
  const legacy = order({ removedItems: undefined });
  assert.deepEqual(ids(itemMenu(legacy, { item: legacy.items[0] }).items), []);
});

// ── Fondo ──

test("fondo: nuevo pedido, abrir turno sin turno, sonido y accesos", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions = { createOrder: fn("create"), openShift: fn("shift"), setSound: fn("sound"), refresh: fn("refresh") };
  const items = resolve(buildBoardMenu(env), { hasShift: false, sound: true, canCreate: true, actions });
  assert.deepEqual(ids(items), ["create", "shift", "sound", "go", "go/tables", "go/cash", "go/history", "refresh"]);
  assert.equal(action(items, "sound").label, "Silenciar avisos de pedidos");

  await run(action(items, "sound"));
  await run(action(items, "go/cash"));
  assert.deepEqual(calls, ["sound false"]);
  assert.deepEqual(log, ["go:/caja"]);

  const loading = resolve(buildBoardMenu(env), { hasShift: true, sound: false, canCreate: false, actions });
  assert.ok(!ids(loading).includes("shift"));
  assert.equal(action(loading, "create").disabled, true);
});

// ── Reimprimir ──

const sector = (id: number, printMode: Sector["printMode"]): Sector => ({
  id, name: `Sector ${id}`, isDefault: false, position: id, printMode, paperWidth: 58, printCopies: 2, activeDevices: 0, sessions: [],
  createdAt: "2026-01-01T00:00:00Z",
});

const ticket = (id: number, sectorId: number): Ticket => ({
  id, orderId: 10, sectorId, sectorName: `Sector ${sectorId}`, status: "preparing", createdAt: "2026-10-09T20:00:00Z",
  startedAt: null, doneAt: null, cancelledAt: null, printedAt: "2026-10-09T20:00:05Z", printCount: 1,
  order: { number: 7, status: "confirmed", serviceType: "table", tableNumber: 4, customerName: null, waiterName: null, notes: null, createdAt: "2026-10-09T20:00:00Z" },
  items: [{ title: "Milanesa", option: null, quantity: 2, notes: null }],
});

test("reimprimir: cada comanda sale por la impresora de su sector y queda marcada", async () => {
  const printed: string[] = [];
  const count = await reprintOrderTickets(10, {
    load: async () => ({ tickets: [ticket(1, 1), ticket(2, 2), ticket(3, 3)], sectors: [sector(1, "browser"), sector(2, "none"), sector(3, "escpos")] }),
    print: async (mode, layout, options) => { printed.push(`${mode}:${layout.sector}:${layout.reprint}:${options.paperWidth}x${options.copies}`); },
    markPrinted: async (sectorId, ticketId) => { printed.push(`marked:${sectorId}/${ticketId}`); },
  });
  assert.equal(count, 2);
  assert.deepEqual(printed, [
    "browser:Sector 1:true:58x2", "marked:1/1",
    "escpos:Sector 3:true:58x2", "marked:3/3",
  ]);
});

test("reimprimir: avisa si no hay comandas o si ningún sector imprime", async () => {
  const deps = (tickets: Ticket[], sectors: Sector[]) => ({
    load: async () => ({ tickets, sectors }),
    print: async () => { throw new Error("no debería imprimir"); },
    markPrinted: async () => undefined,
  });
  await assert.rejects(reprintOrderTickets(10, deps([], [])), (err: unknown) => err instanceof ReprintError && /todavía no tiene comandas/.test(err.message));
  await assert.rejects(reprintOrderTickets(10, deps([ticket(1, 1)], [sector(1, "none")])), /solo en pantalla/);
});
