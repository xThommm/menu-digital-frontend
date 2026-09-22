import test from "node:test";
import assert from "node:assert/strict";
import { isOfferActive } from "../src/lib/offers.ts";
import type { Item, ItemOfferSchedule } from "../src/types/index.ts";

// Espejo de test/offers.test.js del backend: la carta puede quedar abierta
// cruzando el borde de un horario, así que el front tiene que resolver la
// vigencia de la oferta igual que el servidor.

const week = (days: Partial<ItemOfferSchedule>): ItemOfferSchedule => ({
  enabled: true,
  mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  ...days,
});

const item = (overrides: Partial<Item>): Item => ({
  price: 1000,
  offerPrice: 800,
  offerRange: { from: null, to: null },
  ...overrides,
} as Item);

const at = (iso: string) => new Date(iso).getTime();

test("sin período ni horario la oferta queda activa de forma permanente", () => {
  assert.equal(isOfferActive(item({})), true);
});

test("sin precio de oferta o sin precio original nunca hay oferta", () => {
  assert.equal(isOfferActive(item({ offerPrice: null })), false);
  assert.equal(isOfferActive(item({ price: null })), false);
});

test("el rango de fechas puede tener un solo extremo", () => {
  const desde = item({ offerRange: { from: "2026-08-20T03:00:00.000Z", to: null } });
  assert.equal(isOfferActive(desde, at("2026-08-19T23:00:00-03:00")), false);
  assert.equal(isOfferActive(desde, at("2026-09-30T12:00:00-03:00")), true);

  const hasta = item({ offerRange: { from: null, to: "2026-08-21T02:59:59.999Z" } });
  assert.equal(isOfferActive(hasta, at("2026-08-20T23:30:00-03:00")), true);
  assert.equal(isOfferActive(hasta, at("2026-08-21T00:30:00-03:00")), false);
});

test("el horario semanal acota la oferta a esos días y horas", () => {
  const happyHour = item({
    offerSchedule: week({ mon: [{ from: "18:00", to: "20:00" }], tue: [{ from: "18:00", to: "20:00" }] }),
  });

  // Lunes 17/08/2026 en Buenos Aires.
  assert.equal(isOfferActive(happyHour, at("2026-08-17T19:00:00-03:00")), true);
  assert.equal(isOfferActive(happyHour, at("2026-08-17T20:00:00-03:00")), false);
  // Miércoles: día apagado.
  assert.equal(isOfferActive(happyHour, at("2026-08-19T19:00:00-03:00")), false);
});

test("un horario nocturno sigue vigente después de medianoche", () => {
  const nocturna = item({ offerSchedule: week({ fri: [{ from: "22:00", to: "02:00" }] }) });

  // Viernes 21/08/2026 y la madrugada del sábado.
  assert.equal(isOfferActive(nocturna, at("2026-08-21T23:30:00-03:00")), true);
  assert.equal(isOfferActive(nocturna, at("2026-08-22T01:30:00-03:00")), true);
  assert.equal(isOfferActive(nocturna, at("2026-08-22T02:30:00-03:00")), false);
});

test("horas iguales cubren las 24 horas del día", () => {
  const todoElDia = item({ offerSchedule: week({ mon: [{ from: "00:00", to: "00:00" }] }) });

  assert.equal(isOfferActive(todoElDia, at("2026-08-17T00:10:00-03:00")), true);
  assert.equal(isOfferActive(todoElDia, at("2026-08-17T23:50:00-03:00")), true);
  assert.equal(isOfferActive(todoElDia, at("2026-08-18T00:10:00-03:00")), false);
});

test("el rango de fechas y el horario semanal se combinan", () => {
  const campania = item({
    offerRange: { from: "2026-08-17T03:00:00.000Z", to: "2026-08-24T02:59:59.999Z" },
    offerSchedule: week({ mon: [{ from: "18:00", to: "20:00" }] }),
  });

  assert.equal(isOfferActive(campania, at("2026-08-17T19:00:00-03:00")), true);
  // Lunes siguiente: el horario da, pero el rango de fechas ya terminó.
  assert.equal(isOfferActive(campania, at("2026-08-24T19:00:00-03:00")), false);
});

test("un horario semanal desactivado no restringe nada", () => {
  const guardadoInactivo = item({
    offerSchedule: { ...week({ mon: [{ from: "18:00", to: "20:00" }] }), enabled: false },
  });

  assert.equal(isOfferActive(guardadoInactivo, at("2026-08-19T10:00:00-03:00")), true);
});

test("carta v2: sin offerRange ni offerSchedule (ya resueltos por el servidor) rige si hay offerPrice y price", () => {
  // La v2 manda offerPrice solo si la oferta rige ahora, siempre junto con
  // price, y no manda ni el rango ni el horario: sin ellos no hay nada que
  // restringir, en cualquier momento.
  assert.equal(isOfferActive({ price: 1000, offerPrice: 800 }), true);
  assert.equal(isOfferActive({ price: 1000, offerPrice: 800 }, at("2030-01-01T03:00:00-03:00")), true);
  // Oferta vencida o fuera de horario: la v2 no manda offerPrice, y no hay oferta.
  assert.equal(isOfferActive({ price: 1000 }), false);
  // Nunca hay oferta sin el precio original.
  assert.equal(isOfferActive({ offerPrice: 800 }), false);
});
