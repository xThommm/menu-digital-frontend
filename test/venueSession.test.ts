import test from "node:test";
import assert from "node:assert/strict";
import {
  clearVenueSession, readChosenTable, readVenueSession, saveChosenTable, saveVenueSession,
} from "../src/features/orders/lib/venueSession.ts";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
} as Storage;

const context = { inVenue: true as const, ordering: true, history: true, tableNumber: null, tableCount: 12 };
const HOUR = 60 * 60_000;

test("la sesión del local se lee mientras está vigente", () => {
  store.clear();
  saveVenueSession("bar", "token-de-prueba-1234", context);
  assert.equal(readVenueSession("bar")?.token, "token-de-prueba-1234");
  assert.equal(readVenueSession("otro"), null);
});

test("salir del local borra la sesión y la mesa elegida", () => {
  store.clear();
  saveVenueSession("bar", "token-de-prueba-1234", context);
  saveChosenTable("bar", 7);
  clearVenueSession("bar");
  assert.equal(readVenueSession("bar"), null);
  assert.equal(readChosenTable("bar"), null);
});

test("al vencer la sesión también se olvida la mesa elegida", () => {
  store.clear();
  saveVenueSession("bar", "token-de-prueba-1234", context);
  saveChosenTable("bar", 7);
  assert.equal(readVenueSession("bar", Date.now() + 5 * HOUR), null);
  assert.equal(readChosenTable("bar"), null);
});
