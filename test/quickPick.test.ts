import test from "node:test";
import assert from "node:assert/strict";
import { addPicked, MAX_LINE_QUANTITY, pickChoices, pickerCategories, pickProduct, repeatCandidates } from "../src/features/orders/lib/quickPick.ts";
import type { Order, OrderItem } from "../src/features/orders/types.ts";
import type { PublicMenuData, PublicMenuItem } from "../src/types/index.ts";

// Carga rápida del personal: qué se puede pedir de cada producto, cómo se
// suma al pedido en curso y qué ofrece "Otra vuelta".

const BEER: PublicMenuItem = { _id: "beer", title: "Cerveza", options: { Pinta: 4000, Litro: 7000 } };
const FRIES: PublicMenuItem = { _id: "fries", title: "Papas", price: 5000 };
const SOLD_OUT: PublicMenuItem = { _id: "flan", title: "Flan", price: 3000, available: false };
const ON_OFFER: PublicMenuItem = { _id: "pizza", title: "Pizza", price: 9000, offerPrice: 7000, options: { Grande: 12000 } };

const menu = (items: PublicMenuItem[]): PublicMenuData => ({
  secciones: [{ title: "Carta", categorias: [{ title: "Bebidas", items: items.slice(0, 1) }, { title: "Cocina", items: items.slice(1) }] }],
  sinSeccion: [],
} as unknown as PublicMenuData);

const ordered = (itemId: string, option: string | null = null): OrderItem => ({
  id: 1, itemId, title: itemId, categoryName: null, option, unitPrice: 1, quantity: 1, notes: null,
});
const order = (items: OrderItem[], status: Order["status"] = "confirmed") => ({ status, items }) as Order;

test("categorías de la carta, en orden", () => {
  assert.deepEqual(pickerCategories(menu([BEER, FRIES])).map(cat => cat.title), ["Bebidas", "Cocina"]);
});

test("qué se pide de cada producto: simple, por variante o la oferta", () => {
  assert.deepEqual(pickChoices(FRIES), { simple: 5000, variants: [] });
  assert.deepEqual(pickChoices(BEER), { simple: null, variants: [["Pinta", 4000], ["Litro", 7000]] });
  assert.deepEqual(pickChoices(ON_OFFER), { simple: 7000, variants: [] }, "con oferta vigente se pide como simple");
  assert.deepEqual(pickChoices(BEER, true).variants, [["Pinta", 0], ["Litro", 0]], "con precios ocultos van en 0");
});

test("lo no disponible no se puede agregar", () => {
  assert.equal(pickProduct(SOLD_OUT, undefined), null);
  assert.deepEqual(pickProduct(BEER, "Litro"), { itemId: "beer", title: "Cerveza", option: "Litro", unitPrice: 7000 });
  assert.equal(pickProduct(BEER, "Balde"), null, "variante que ya no existe");
});

test("sumar: la misma variante sube la cantidad, otra variante es otra línea", () => {
  const pinta = pickProduct(BEER, "Pinta")!;
  let lines = addPicked([], pinta);
  lines = addPicked(lines, pinta);
  lines = addPicked(lines, pickProduct(BEER, "Litro")!);
  assert.deepEqual(lines.map(line => [line.option, line.quantity]), [["Pinta", 2], ["Litro", 1]]);

  let many = lines;
  for (let i = 0; i < 30; i += 1) many = addPicked(many, pinta);
  assert.equal(many[0].quantity, MAX_LINE_QUANTITY);
});

test("otra vuelta: lo último primero, sin repetir y con el precio de hoy", () => {
  const data = menu([BEER, FRIES, SOLD_OUT]);
  const orders = [
    order([ordered("fries"), ordered("beer", "Pinta")]),
    order([ordered("flan"), ordered("beer", "Pinta"), ordered("gone")]),
    order([ordered("beer", "Litro")], "cancelled"),
  ];
  const repeat = repeatCandidates(orders, data);
  // El flan se agotó, "gone" ya no está en la carta y lo cancelado no cuenta.
  assert.deepEqual(repeat.map(product => [product.itemId, product.option ?? null, product.unitPrice]), [
    ["beer", "Pinta", 4000],
    ["fries", null, 5000],
  ]);
  assert.equal(repeatCandidates(orders, data, false, 1).length, 1);
});
