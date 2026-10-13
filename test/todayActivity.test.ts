import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_ACTIVITY_SHAPE, activityShape, isActivityShape, resolveActivityShape,
  type OrdersSummary, type ReservationsSummary,
} from "../src/components/User/Panel/Dashboard/todayActivity.ts";

const orders = (active: number, total = active): OrdersSummary => ({
  shiftOpen: true, active, pending: active, confirmed: 0, ready: 0,
  list: Array(active).fill({}), all: Array(total).fill({}),
});

const reservations = (today: number, total = today): ReservationsSummary => ({
  today, pending: 0, next: null, list: Array(today).fill({}), all: Array(total).fill({}), from: "2026-10-01",
});

test("sin pedidos ni reservas no queda ninguna tarjeta", () => {
  assert.deepEqual(activityShape(orders(0), reservations(0)), EMPTY_ACTIVITY_SHAPE);
});

test("una fuente no disponible (falló, plan sin la función u opción apagada) cuenta como sin datos", () => {
  assert.deepEqual(activityShape(null, null), EMPTY_ACTIVITY_SHAPE);
  assert.deepEqual(activityShape(null, reservations(2)), { agenda: true, orders: false, reservations: true });
});

test("cada tarjeta depende de sus propios datos", () => {
  // Pedidos ya entregados: hay agenda del día, pero nada en curso.
  assert.deepEqual(activityShape(orders(0, 3), reservations(0)), { agenda: true, orders: false, reservations: false });
  // Reservas de otros días: agenda sí, la cifra "Reservas hoy" no.
  assert.deepEqual(activityShape(orders(0), reservations(0, 4)), { agenda: true, orders: false, reservations: false });
  assert.deepEqual(activityShape(orders(2), reservations(1)), { agenda: true, orders: true, reservations: true });
});

test("mientras carga no decide, salvo que lo que ya llegó alcance", () => {
  assert.deepEqual(activityShape(undefined, undefined), { agenda: undefined, orders: undefined, reservations: undefined });
  assert.deepEqual(activityShape(orders(0), undefined), { agenda: undefined, orders: false, reservations: undefined });
  assert.equal(activityShape(orders(1), undefined).agenda, true);
});

test("lo que falta cargar se dibuja como la última vez", () => {
  const last = { agenda: true, orders: true, reservations: false };
  assert.deepEqual(resolveActivityShape({}, last), last);
  assert.deepEqual(resolveActivityShape({ orders: false }, last), { agenda: true, orders: false, reservations: false });
  assert.deepEqual(resolveActivityShape(EMPTY_ACTIVITY_SHAPE, last), EMPTY_ACTIVITY_SHAPE);
});

test("un valor guardado con otro formato se descarta", () => {
  assert.ok(isActivityShape({ agenda: true, orders: false, reservations: false }));
  for (const value of [null, "si", [], {}, { agenda: true, orders: "no", reservations: false }]) {
    assert.equal(isActivityShape(value), false);
  }
});
