import test from "node:test";
import assert from "node:assert/strict";
import { DRAFT_TTL_MS, parseDrafts } from "../src/features/orders/lib/waiterDrafts.ts";

// Lo cargado sin enviar que se guarda en el celular del operador: al volver
// a abrir la app se recupera lo válido y vigente; lo roto o viejo se descarta.

const NOW = Date.parse("2026-10-15T21:00:00.000Z");
const line = { itemId: "beer", title: "Cerveza", option: "Pinta", unitPrice: 4000, quantity: 2, unitNotes: ["", "sin espuma"] };
const draft = (over: object = {}) => ({ lines: [line], notes: "", savedAt: NOW - 60_000, ...over });

test("recupera las mesas con lo cargado", () => {
  const parsed = parseDrafts({ 3: draft(), 7: draft({ notes: "la bebida primero" }) }, NOW);
  assert.deepEqual(Object.keys(parsed), ["3", "7"]);
  assert.equal(parsed[3].lines[0].quantity, 2);
  assert.equal(parsed[7].notes, "la bebida primero");
});

test("descarta lo viejo, lo vacío y lo que no tiene la forma esperada", () => {
  const parsed = parseDrafts({
    1: draft({ savedAt: NOW - DRAFT_TTL_MS - 1 }),
    2: draft({ lines: [], notes: "" }),
    3: draft({ lines: [{ ...line, quantity: 0 }] }),
    4: draft({ lines: [{ ...line, unitNotes: [1] }] }),
    5: { lines: [line] },
    mesa: draft(),
    0: draft(),
    6: draft(),
  }, NOW);
  assert.deepEqual(Object.keys(parsed), ["6"]);
});

test("cualquier cosa que no sea un objeto se lee como vacío", () => {
  for (const value of [null, undefined, "x", 3, [draft()]]) assert.deepEqual(parseDrafts(value, NOW), {});
});
