import test from "node:test";
import assert from "node:assert/strict";
import { buildTableMenu, type TableMenuActions } from "../src/features/orders/components/panel/tablesMenu.ts";
import { buildBillGuestMenu, buildBillPaymentMenu } from "../src/features/orders/components/shared/billMenu.ts";
import { buildGroupMenu } from "../src/features/orders/components/shared/groupMenu.ts";
import type { BillGuest, BillPayment, GroupSession, TableSession } from "../src/features/orders/types.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

const session = (overrides: Partial<TableSession> = {}): TableSession => ({
  id: 3, tableNumber: 4, shiftId: 1, waiterId: null, waiterName: null, guests: null, openedAt: "2026-10-09T20:00:00Z",
  closedAt: null, closedByType: null, closedByName: null, ordersCount: 2, totalAmount: 5000, activeOrders: 0, ...overrides,
});

const group = (overrides: Partial<GroupSession> = {}): GroupSession => ({
  id: 8, tableNumber: 4, code: "123456", joinToken: "tok", open: true, createdAt: "2026-10-09T20:00:00Z", closedAt: null,
  members: [], cart: [], cartTotal: 0, orders: [], ...overrides,
});

function tableMenu(overrides: { group?: GroupSession | null; tableLink?: string | null; busy?: boolean } = {}) {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions: TableMenuActions = {
    toggleOrders: fn("toggle"),
    openBill: fn("bill"),
    addOrder: fn("add"),
    openGroup: async () => { calls.push("open-group"); },
    downloadQr: async () => { calls.push("qr"); },
    closeTable: async () => { calls.push("close"); },
  };
  const items = resolve(buildTableMenu(env), {
    session: session(),
    group: overrides.group === undefined ? null : overrides.group,
    showingOrders: false,
    tableLink: overrides.tableLink === undefined ? "https://x/menu?mesa=t" : overrides.tableLink,
    busy: overrides.busy ?? false,
    actions,
  });
  return { items, calls, log };
}

test("mesa: las acciones de la tarjeta, el link y el QR, y cerrar al final", () => {
  assert.deepEqual(ids(tableMenu().items), ["orders", "bill", "add-order", "group", "link", "qr", "close"]);
  assert.deepEqual(ids(tableMenu({ group: group(), tableLink: null }).items), ["orders", "bill", "add-order", "close"],
    "con pedido grupal abierto no se ofrece abrir otro; sin link no hay copiar ni QR");
});

test("mesa: cerrarla siempre confirma con el total", async () => {
  const { items, calls } = tableMenu();
  const close = action(items, "close");
  assert.equal(close.danger, true);
  assert.equal(close.confirm?.title, "¿Cerrar la mesa 4?");
  assert.match(close.confirm?.message ?? "", /2 pedido\(s\)/);

  assert.equal((await run(close, { accept: false })).outcome, "cancelled");
  assert.deepEqual(calls, []);
  await run(close);
  assert.deepEqual(calls, ["close"]);
});

test("mesa: copiar el link y abrir la cuenta, el pedido grupal y un pedido nuevo", async () => {
  const { items, calls, log } = tableMenu();
  const copied = await run(action(items, "link"));
  assert.deepEqual(copied.notices, ["ok:Link de la mesa copiado."]);
  assert.deepEqual(log, ["copy:https://x/menu?mesa=t"]);

  await run(action(items, "bill"));
  await run(action(items, "add-order"));
  await run(action(items, "group"));
  await run(action(items, "qr"));
  assert.deepEqual(calls, ["bill", "add", "open-group", "qr"]);

  assert.equal(action(tableMenu({ busy: true }).items, "close").disabled, true);
});

test("pedido grupal: enviar solo con algo cargado y cerrar con confirmación", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions = { showQr: fn("qr"), send: fn("send"), close: fn("close") };
  const context = (cart: GroupSession["cart"]) => ({
    group: group({ cart, cartTotal: cart.length * 1000 }), tableNumber: 4, joinUrl: "https://x/menu?grupo=tok", busy: false, actions,
  });

  assert.deepEqual(ids(resolve(buildGroupMenu(env), context([]))), ["qr", "link", "close"]);
  const loaded = resolve(buildGroupMenu(env), context([{ id: 1 } as GroupSession["cart"][number]]));
  assert.deepEqual(ids(loaded), ["qr", "link", "send", "close"]);

  const close = action(loaded, "close");
  assert.equal(close.confirm?.title, "¿Cerrar el pedido grupal de la mesa 4?");
  assert.match(close.confirm?.message ?? "", /se descarta/);
  assert.equal((await run(close, { accept: false })).outcome, "cancelled");
  assert.deepEqual(calls, []);

  await run(action(loaded, "send"));
  await run(close);
  await run(action(loaded, "link"));
  assert.deepEqual(calls, ["send", "close"]);
  assert.deepEqual(log, ["copy:https://x/menu?grupo=tok"]);
});

test("cuenta: cambiar nombre y quitar comensal; anular solo pagos aprobados", async () => {
  const guest = { id: 5, name: "Ana" } as BillGuest;
  const { calls, fn } = recorder();
  const guestItems = resolve(buildBillGuestMenu(), { guest, locked: false, actions: { rename: fn("rename"), remove: fn("remove") } });
  assert.deepEqual(ids(guestItems), ["rename", "remove"]);
  await run(action(guestItems, "rename"));
  await run(action(guestItems, "remove"));
  assert.deepEqual(calls, ["rename #5", "remove #5"]);

  const locked = resolve(buildBillGuestMenu(), { guest, locked: true, actions: { rename: fn("rename"), remove: fn("remove") } });
  assert.equal(action(locked, "remove").disabled, true);

  const payment = (status: BillPayment["status"]) => ({ id: 9, status } as BillPayment);
  const voidCalls = recorder();
  const approved = resolve(buildBillPaymentMenu(), { payment: payment("approved"), locked: false, actions: { voidPayment: voidCalls.fn("void") } });
  await run(action(approved, "void"));
  assert.deepEqual(voidCalls.calls, ["void 9"]);
  assert.deepEqual(ids(resolve(buildBillPaymentMenu(), { payment: payment("voided"), locked: false, actions: { voidPayment: voidCalls.fn("void") } })), []);
});
