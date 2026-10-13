import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanJoinCode, clearGroupSession, formatJoinCode, groupByAuthor, isJoinCode, readGroupSession, readJoinParam,
  readJoinToken, saveGroupSession, toGroupLines,
} from "../src/features/orders/lib/groupSession.ts";

// Pedido grupal en el celular del comensal: la sesión guardada, el código / enlace y el carrito.

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
} as Storage;

const HOUR = 60 * 60_000;

test("la sesión del grupo sobrevive a una recarga y es de cada local", () => {
  store.clear();
  saveGroupSession("bar", "token-de-integrante-123", "Ana");
  assert.deepEqual(
    (({ token, name }) => ({ token, name }))(readGroupSession("bar")!),
    { token: "token-de-integrante-123", name: "Ana" },
  );
  assert.equal(readGroupSession("otro-bar"), null);
});

test("la sesión del grupo vence sola y salir la borra", () => {
  store.clear();
  saveGroupSession("bar", "token-de-integrante-123", "Ana");
  assert.equal(readGroupSession("bar", Date.now() + 7 * HOUR), null);
  assert.equal(store.size, 0, "vencida, no queda guardada");

  saveGroupSession("bar", "token-de-integrante-123", "Ana");
  clearGroupSession("bar");
  assert.equal(readGroupSession("bar"), null);
});

test("datos viejos o rotos en el almacenamiento se ignoran", () => {
  store.clear();
  store.set("md:group:bar", "{no es json");
  assert.equal(readGroupSession("bar"), null);
  store.set("md:group:bar", JSON.stringify({ token: 5, name: "Ana", expiresAt: Date.now() + HOUR }));
  assert.equal(readGroupSession("bar"), null);
});

test("enlace del grupo: solo se acepta un token con forma de token", () => {
  assert.equal(readJoinToken("?grupo=abcDEF123_-abcDEF123"), "abcDEF123_-abcDEF123");
  assert.equal(readJoinToken("?mesa=abcDEF123_-abcDEF123"), null);
  assert.equal(readJoinToken("?grupo=corto"), null);
  assert.equal(readJoinToken("?grupo=<script>alert(1)</script>"), null);
  assert.equal(readJoinToken(""), null);
});

test("llegar a la carta para sumarse: con el token del QR o con el código en el enlace", () => {
  assert.deepEqual(readJoinParam("?grupo=abcDEF123_-abcDEF123&src=qr"), { joinToken: "abcDEF123_-abcDEF123" });
  assert.deepEqual(readJoinParam("?grupo=abc-def"), { code: "ABCDEF" });
  assert.equal(readJoinParam("?grupo=hola"), null);
  assert.equal(readJoinParam("?mesa=abcDEF123_-abcDEF123"), null);
  assert.equal(readJoinParam(""), null);
});

test("código para sumarse: se limpia mientras se tipea y se valida", () => {
  assert.equal(cleanJoinCode(" abc-def "), "ABCDEF");
  assert.equal(cleanJoinCode("abc def ghi"), "ABCDEF");
  assert.equal(isJoinCode("ABCDEF"), true);
  assert.equal(isJoinCode("ABC23Z"), true);
  assert.equal(isJoinCode("ABCDE"), false);
  assert.equal(isJoinCode("ABCDE0"), false, "sin 0, 1, O, I ni L: se confunden");
  assert.equal(isJoinCode("ABCDEI"), false);
  assert.equal(formatJoinCode("ABCDEF"), "ABC-DEF");
  assert.equal(formatJoinCode("ABC"), "ABC");
});

test("mi carrito pasa al del grupo con un id por línea (para no cargarlo dos veces)", () => {
  let next = 0;
  const lines = toGroupLines(
    [{ itemId: "a", quantity: 2, notes: "sin sal" }, { itemId: "b", option: "Grande", quantity: 1 }],
    true,
    () => `id-${next += 1}`,
  );
  assert.deepEqual(lines, [
    { itemId: "a", quantity: 2, notes: "sin sal", shared: true, clientItemId: "id-1" },
    { itemId: "b", option: "Grande", quantity: 1, shared: true, clientItemId: "id-2" },
  ]);
  assert.equal(toGroupLines([{ itemId: "a", quantity: 1 }], false, () => "x")[0].shared, false);
});

test("carrito del grupo: agrupado por quién lo cargó, lo mío primero, con su subtotal", () => {
  const item = (id: number, memberId: number, authorName: string, unitPrice: number, quantity: number, mine: boolean) => ({
    id, memberId, authorName, itemId: `p${id}`, title: `P${id}`, option: null, unitPrice, quantity, notes: null, shared: false, mine,
  });
  const groups = groupByAuthor([
    item(1, 10, "Ana", 1000, 2, false),
    item(2, 20, "Beto", 500, 1, true),
    item(3, 10, "Ana", 300, 1, false),
    item(4, 30, "Caro", 100, 3, false),
  ]);
  assert.deepEqual(groups.map(g => [g.authorName, g.mine, g.items.length, g.total]), [
    ["Beto", true, 1, 500], ["Ana", false, 2, 2300], ["Caro", false, 1, 300],
  ]);
  assert.deepEqual(groupByAuthor([]), []);
});
