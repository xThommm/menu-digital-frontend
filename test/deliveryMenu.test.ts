import test from "node:test";
import assert from "node:assert/strict";
import { buildDeliveryMenu, type DeliveryMenuContext } from "../src/features/orders/components/delivery/deliveryMenu.ts";
import type { Courier, DeliveryAssignment, Order } from "../src/features/orders/types.ts";
import { action, fakeEnv, ids, resolve, run, submenu } from "./support/menu.ts";

const order = { id: 7, number: 42, deliveryAddress: "Av. Siempre Viva 742", customerPhone: "11 5555-0000" } as Order;
const courier = (id: number, name: string, available = true) => ({ id, name, available, active: true }) as Courier;
const couriers = [courier(1, "Ana"), courier(2, "Beto", false)];
const assignment = (status: DeliveryAssignment["status"]) =>
  ({ id: 9, orderId: 7, courierId: 1, courierName: "Ana", status }) as DeliveryAssignment;

function context(overrides: Partial<DeliveryMenuContext> = {}) {
  const calls: string[] = [];
  const ctx: DeliveryMenuContext = {
    order, assignment: null, couriers, enabled: true, canComplete: false, busy: false,
    actions: {
      detail: () => { calls.push("detail"); },
      assign: (c) => { calls.push(`assign ${c.id}`); },
      unassign: () => { calls.push("unassign"); },
      revealCode: async () => { calls.push("code"); },
      complete: () => { calls.push("complete"); },
    },
    ...overrides,
  };
  return { ctx, calls };
}

test("sin repartidor: Asignar a ▸ con los repartidores (los no disponibles, aclarado), copiar y mapas", async () => {
  const { env, log } = fakeEnv();
  const { ctx, calls } = context();
  const items = resolve(buildDeliveryMenu(env), ctx);
  assert.deepEqual(ids(items), [
    "assign", "assign/courier-1", "assign/courier-2", "copy", "copy/number", "copy/address", "copy/phone", "maps",
  ]);
  assert.equal(submenu(items, "assign").label, "Asignar a");
  assert.equal(action(items, "assign/courier-2").label, "Beto (no disponible)");
  await run(action(items, "assign/courier-2"));
  await run(action(items, "maps"));
  assert.deepEqual(calls, ["assign 2"]);
  assert.match(log[0], /^open:https:\/\/.*Siempre/);

  const off = resolve(buildDeliveryMenu(env), context({ enabled: false }).ctx);
  assert.ok(!ids(off).includes("assign"));
});

test("asignado: reasignar (sin el actual) y quitar repartidor confirma", async () => {
  const { env } = fakeEnv();
  const { ctx, calls } = context({ assignment: assignment("assigned") });
  const items = resolve(buildDeliveryMenu(env), ctx);
  assert.equal(submenu(items, "assign").label, "Reasignar a");
  assert.deepEqual(ids(submenu(items, "assign").items), ["assign/courier-2"]);
  assert.ok(!ids(items).includes("code"));

  const unassign = action(items, "unassign");
  assert.equal(unassign.confirm?.title, "¿Quitarle el pedido #42 a Ana?");
  assert.equal((await run(unassign, { accept: false })).outcome, "cancelled");
  await run(unassign);
  assert.deepEqual(calls, ["unassign"]);
});

test("en camino: el motivo es la confirmación; ver código y marcar entregado", async () => {
  const { env } = fakeEnv();
  const { ctx, calls } = context({ assignment: assignment("picked_up"), canComplete: true });
  const items = resolve(buildDeliveryMenu(env), ctx);
  assert.equal(action(items, "unassign").confirm, null);
  assert.equal(action(items, "unassign").label, "Quitar repartidor…");
  assert.equal(action(items, "assign/courier-2").label, "Beto (no disponible)…");
  await run(action(items, "code"));
  await run(action(items, "complete"));
  assert.deepEqual(calls, ["code", "complete"]);

  const busy = resolve(buildDeliveryMenu(env), context({ assignment: assignment("picked_up"), busy: true }).ctx);
  assert.equal(action(busy, "unassign").disabled, true);
  assert.ok(!ids(busy).includes("complete"));
});
