import test from "node:test";
import assert from "node:assert/strict";
import { pickHighlights, highlightPrice, MIN_PICKS } from "../src/lib/landingHighlights.ts";
import type { PublicMenuData, PublicMenuItem } from "../src/types/index.ts";

const item = (id: string, extra: Partial<PublicMenuItem> = {}): PublicMenuItem => ({
  _id: id, title: `Plato ${id}`, price: 1000, image: `https://img.test/${id}.jpg`, ...extra,
});
const menuOf = (items: PublicMenuItem[]): PublicMenuData => ({
  secciones: [{ title: "Cocina", categorias: [{ title: "Platos", items }] }],
  sinSeccion: [],
} as unknown as PublicMenuData);
const ids = (items: PublicMenuItem[]) => items.map(entry => entry._id);

test("sin carta o con muy pocos platos con foto no hay vidriera", () => {
  assert.deepEqual(pickHighlights(null, { hidePrices: false }), { picks: [], offer: null });
  const few = Array.from({ length: MIN_PICKS - 1 }, (_, i) => item(`a${i}`));
  assert.deepEqual(pickHighlights(menuOf(few), { hidePrices: false }).picks, []);
});

test("solo entran platos disponibles y con foto, sin repetir", () => {
  const menu = menuOf([
    item("1"), item("2", { image: undefined }), item("3", { available: false }), item("1"), item("4"),
  ]);
  assert.deepEqual(ids(pickHighlights(menu, { hidePrices: false }).picks), ["1", "4"]);
});

test("los recomendados van primero y el resto completa la fila", () => {
  const menu = menuOf([item("1"), item("2", { recommended: true }), item("3"), item("4", { recommended: true }), item("5")]);
  assert.deepEqual(ids(pickHighlights(menu, { hidePrices: false }).picks), ["2", "4", "1", "3"]);
});

test("con una fila entera de recomendados no se mezclan los demás", () => {
  const recommended = Array.from({ length: 5 }, (_, i) => item(`r${i}`, { recommended: true }));
  const menu = menuOf([item("x"), ...recommended]);
  assert.deepEqual(ids(pickHighlights(menu, { hidePrices: false }).picks), ["r0", "r1", "r2", "r3"]);
});

test("son cuatro platos, u ocho si la carta alcanza para dos filas", () => {
  const many = Array.from({ length: 11 }, (_, i) => item(`m${i}`));
  assert.equal(pickHighlights(menuOf(many.slice(0, 7)), { hidePrices: false }).picks.length, 4);
  assert.equal(pickHighlights(menuOf(many), { hidePrices: false }).picks.length, 8);
});

test("la oferta destacada prefiere un plato que no esté ya en la vidriera", () => {
  const menu = menuOf([
    item("1", { offerPrice: 800 }), item("2"), item("3"), item("4"), item("5", { offerPrice: 700 }),
  ]);
  assert.equal(pickHighlights(menu, { hidePrices: false }).offer?._id, "5");
  assert.equal(pickHighlights(menuOf([item("1", { offerPrice: 800 }), item("2")]), { hidePrices: false }).offer?._id, "1");
  // Con los precios ocultos no hay nada que anunciar.
  assert.equal(pickHighlights(menu, { hidePrices: true }).offer, null);
});

test("el precio sigue el criterio de la carta: oferta, variantes, simple", () => {
  assert.deepEqual(highlightPrice(item("1"), { hidePrices: false }), { current: 1000 });
  assert.deepEqual(highlightPrice(item("1", { offerPrice: 750 }), { hidePrices: false }), { current: 750, previous: 1000, discount: 25 });
  assert.deepEqual(
    highlightPrice(item("1", { price: null, options: { Chico: 900, Grande: 1400 } }), { hidePrices: false }),
    { current: 900, from: true },
  );
  assert.equal(highlightPrice(item("1", { price: null }), { hidePrices: false }), null);
  assert.equal(highlightPrice(item("1", { offerPrice: 750 }), { hidePrices: true }), null);
});
