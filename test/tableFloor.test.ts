import test from "node:test";
import assert from "node:assert/strict";
import { buildFloor, filterFloor } from "../src/features/orders/lib/floor.ts";
import type { GroupSession, TableSession } from "../src/features/orders/types.ts";

// Salón: qué muestra cada mesa y qué deja ver cada filtro.

const session = (tableNumber: number, waiterId: number | null): TableSession => ({
  id: tableNumber * 10,
  tableNumber,
  shiftId: null,
  waiterId,
  waiterName: waiterId === null ? null : `Mozo ${waiterId}`,
  guests: null,
  openedAt: "2026-10-15T20:00:00.000Z",
  closedAt: null,
  closedByType: null,
  closedByName: null,
  ordersCount: 1,
  totalAmount: 1000,
  activeOrders: 0,
});

const group = (tableNumber: number) => ({ id: tableNumber, tableNumber }) as GroupSession;

test("una baldosa por mesa, de la 1 a la cantidad configurada", () => {
  const floor = buildFloor(4, [session(2, 1)], [{ tableNumber: 3, waiterName: "Ana", openedAt: "2026-10-15T20:00:00.000Z" }], [group(4)]);
  assert.deepEqual(floor.map(table => [table.tableNumber, table.kind]), [[1, "free"], [2, "open"], [3, "other"], [4, "free"]]);
  const fourth = floor[3];
  assert.equal(fourth.kind === "free" && fourth.group?.id, 4, "la libre con pedido grupal lo lleva");
});

test("una mesa abierta por encima de la cantidad configurada igual aparece", () => {
  const floor = buildFloor(2, [session(5, 1)], [], []);
  assert.equal(floor.length, 5);
  assert.equal(floor[4].kind, "open");
});

test("sin mesas configuradas ni abiertas el salón queda vacío", () => {
  assert.deepEqual(buildFloor(0, [], [], []), []);
});

test("filtros: mías, ocupadas y libres", () => {
  const floor = buildFloor(5, [session(1, 7), session(2, null)], [{ tableNumber: 3, waiterName: "Ana", openedAt: "2026-10-15T20:00:00.000Z" }], []);
  const numbers = (filter: Parameters<typeof filterFloor>[1], waiterId?: number) =>
    filterFloor(floor, filter, waiterId).map(table => table.tableNumber);
  assert.deepEqual(numbers("all"), [1, 2, 3, 4, 5]);
  assert.deepEqual(numbers("mine", 7), [1]);
  assert.deepEqual(numbers("mine"), [], "en el panel no hay operador");
  assert.deepEqual(numbers("busy"), [1, 2, 3]);
  assert.deepEqual(numbers("free"), [4, 5]);
});
