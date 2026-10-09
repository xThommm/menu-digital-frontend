import test from "node:test";
import assert from "node:assert/strict";
import {
  courierAction, deliveryStageLabel, formatCode, isCodeComplete, mapsUrl, minutesFrom, minutesLabel, phoneHref,
  sanitizeCodeInput, waitText,
} from "../src/features/orders/lib/delivery.ts";
import type { CourierOrder } from "../src/features/orders/types.ts";

const courierOrder = (overrides: Partial<CourierOrder> = {}): CourierOrder => ({
  id: 1, number: 7, orderStatus: "ready", address: "Calle 123", createdAt: "2026-10-09T20:00:00Z", readyAt: null,
  assignment: { status: "assigned", assignedAt: "2026-10-09T20:05:00Z", pickedUpAt: null, deliveredAt: null, codeLocked: false },
  canPickup: true,
  ...overrides,
});

test("el código de entrega solo admite 6 dígitos", () => {
  assert.equal(sanitizeCodeInput("12a3-45 6789"), "123456");
  assert.equal(sanitizeCodeInput("abc"), "");
  assert.equal(isCodeComplete("123456"), true);
  assert.equal(isCodeComplete("12345"), false);
  assert.equal(isCodeComplete("12345a"), false);
  assert.equal(formatCode("042517"), "042 517");
  assert.equal(formatCode("123"), "123");
});

test("enlace a mapas: la dirección viaja codificada", () => {
  const url = mapsUrl("  Av. Siempre Viva 742, piso 3 & timbre  ");
  assert.equal(url, "https://www.google.com/maps/search/?api=1&query=Av.%20Siempre%20Viva%20742%2C%20piso%203%20%26%20timbre");
  assert.doesNotMatch(url, /\s/);
});

test("teléfono: solo se arma el enlace si parece un número", () => {
  assert.equal(phoneHref("+54 9 11 5555-1234"), "tel:+5491155551234");
  assert.equal(phoneHref("123"), null);
  assert.equal(phoneHref(null), null);
  assert.equal(phoneHref(""), null);
});

test("el repartidor solo retira un pedido listo y entrega el que retiró", () => {
  assert.equal(courierAction(courierOrder()), "pickup");
  assert.equal(courierAction(courierOrder({ orderStatus: "confirmed", canPickup: false })), "wait");
  assert.equal(
    courierAction(courierOrder({ assignment: { status: "picked_up", assignedAt: "x", pickedUpAt: "y", deliveredAt: null, codeLocked: false } })),
    "deliver",
  );
  assert.equal(
    courierAction(courierOrder({ assignment: { status: "delivered", assignedAt: "x", pickedUpAt: "y", deliveredAt: "z", codeLocked: false } })),
    "none",
  );
  assert.equal(courierAction(courierOrder({ assignment: null })), "none");
});

test("mensaje de espera según el estado del pedido", () => {
  assert.match(waitText(courierOrder({ orderStatus: "confirmed" })), /preparando/);
  assert.match(waitText(courierOrder({ orderStatus: "pending" })), /Esperando/);
});

test("etapa de la entrega vista desde el panel del local", () => {
  const base = { status: "ready" as const, dispatchedAt: null };
  const delivery = (status: "assigned" | "picked_up" | "delivered") => ({
    id: 1, orderId: 1, courierId: 1, courierName: "Ana", status, assignedVia: "manual" as const, assignedAt: "x", pickedUpAt: null,
    deliveredAt: null, releasedAt: null, releaseReason: null, deliveredBy: null, durationMinutes: null, codeLocked: false, previousCouriers: [],
  });
  assert.equal(deliveryStageLabel({ ...base }), "Listo, sin repartidor");
  assert.equal(deliveryStageLabel({ status: "confirmed", dispatchedAt: null }), "Sin repartidor");
  assert.equal(deliveryStageLabel({ ...base, delivery: delivery("assigned") }), "Listo para retirar");
  assert.equal(deliveryStageLabel({ status: "confirmed", dispatchedAt: null, delivery: delivery("assigned") }), "Asignado · en preparación");
  assert.equal(deliveryStageLabel({ ...base, delivery: delivery("picked_up") }), "En camino");
  assert.equal(deliveryStageLabel({ status: "delivered", dispatchedAt: null, delivery: delivery("delivered") }), "Entregado");
});

test("minutos transcurridos: nunca negativos y tolerantes a fechas inválidas", () => {
  const now = new Date("2026-10-09T21:00:00Z").getTime();
  assert.equal(minutesFrom("2026-10-09T20:30:00Z", now), 30);
  assert.equal(minutesFrom("2026-10-09T21:10:00Z", now), 0);
  assert.equal(minutesFrom(null, now), null);
  assert.equal(minutesFrom("no es una fecha", now), null);
  assert.equal(minutesLabel(null), "—");
  assert.equal(minutesLabel(45), "45 min");
  assert.equal(minutesLabel(125), "2 h 5 min");
});
