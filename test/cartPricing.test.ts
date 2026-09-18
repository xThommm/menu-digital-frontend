import test from "node:test";
import assert from "node:assert/strict";
import { cartUnitPrice, repriceCartLines } from "../src/lib/cartPricing.ts";
import { buildOrderMessage } from "../src/lib/whatsapp.ts";
import type { CartLine } from "../src/context/CartContext.tsx";
import type { Item } from "../src/types/index.ts";

// Un producto de la carta pública con lo mínimo que mira el carrito.
const item = (overrides: Partial<Item>): Item => ({
  _id: "pizza",
  title: "Pizza",
  price: 1000,
  offerPrice: null,
  offerRange: { from: null, to: null },
  options: {},
  available: true,
  hidden: false,
  ...overrides,
} as Item);

// Lo que manda el backend con "Ocultar precios": precios en null y las
// variantes con las mismas claves en 0.
const hidden = (it: Item): Item => ({
  ...it,
  price: null,
  offerPrice: null,
  offerRange: { from: null, to: null },
  options: Object.fromEntries(Object.keys(it.options).map(name => [name, 0])),
});

const line = (overrides: Partial<CartLine>): CartLine => ({
  itemId: "pizza",
  title: "Pizza",
  unitPrice: 1000,
  quantity: 1,
  ...overrides,
});

const at = (iso: string) => new Date(iso).getTime();

const pizza = item({});
const empanada = item({ _id: "empanada", title: "Empanada", price: null, options: { Carne: 900, Pollo: 850 } });
const carta = [pizza, empanada];

test("un pedido armado con los precios ocultos vuelve a tener precios si el dueño los muestra", () => {
  const armado = repriceCartLines(
    [line({ quantity: 2 }), line({ itemId: "empanada", title: "Empanada", selectedOption: "Carne", quantity: 3 })],
    carta.map(hidden),
    { hidePrices: true },
  );
  assert.deepEqual(armado.map(l => l.unitPrice), [0, 0]);

  // El dueño desactiva la opción y el cliente vuelve a abrir la carta.
  const repriced = repriceCartLines(armado, carta);
  assert.deepEqual(repriced, [
    line({ quantity: 2, unitPrice: 1000 }),
    line({ itemId: "empanada", title: "Empanada", selectedOption: "Carne", quantity: 3, unitPrice: 900 }),
  ]);

  const message = buildOrderMessage(repriced, "La Esquina");
  assert.doesNotMatch(message, /\$\s?0\b/);
  assert.match(message, /\*Total: \$\s?4\.700\*/);
});

test("un carrito viejo toma los precios y nombres actuales de la carta", () => {
  const repriced = repriceCartLines(
    [
      line({ title: "Pizza vieja", unitPrice: 700, quantity: 2 }),
      line({ itemId: "empanada", title: "Empanada", selectedOption: "Pollo", unitPrice: 600 }),
    ],
    [item({ title: "Pizza muzzarella", price: 1200 }), empanada],
  );
  assert.deepEqual(repriced, [
    line({ title: "Pizza muzzarella", unitPrice: 1200, quantity: 2 }),
    line({ itemId: "empanada", title: "Empanada", selectedOption: "Pollo", unitPrice: 850 }),
  ]);
});

test("con los precios ocultos todo queda en 0 y se conservan cantidad y variante", () => {
  const repriced = repriceCartLines(
    [line({ unitPrice: 1000, quantity: 4 }), line({ itemId: "empanada", selectedOption: "Pollo", unitPrice: 850, quantity: 6 })],
    carta.map(hidden),
    { hidePrices: true },
  );
  assert.deepEqual(repriced, [
    line({ unitPrice: 0, quantity: 4 }),
    line({ itemId: "empanada", title: "Empanada", selectedOption: "Pollo", unitPrice: 0, quantity: 6 }),
  ]);
});

test("una variante que ya no existe se descarta, con o sin precios", () => {
  const cart = [
    line({ itemId: "empanada", selectedOption: "Verdura" }),
    line({ itemId: "empanada", selectedOption: "Carne" }),
  ];
  assert.deepEqual(repriceCartLines(cart, carta).map(l => l.selectedOption), ["Carne"]);
  assert.deepEqual(
    repriceCartLines(cart, carta.map(hidden), { hidePrices: true }).map(l => l.selectedOption),
    ["Carne"],
  );
});

test("se descartan los productos no disponibles, ocultos o que ya no están en la carta", () => {
  const cart = [
    line({ itemId: "pizza" }),
    line({ itemId: "empanada", selectedOption: "Carne" }),
    line({ itemId: "flan", title: "Flan" }),
    line({ itemId: "borrado", title: "Borrado" }),
  ];
  const items = [
    item({ available: false }),
    { ...empanada, hidden: true },
    item({ _id: "flan", title: "Flan", price: 500 }),
  ];
  assert.deepEqual(repriceCartLines(cart, items).map(l => l.itemId), ["flan"]);
  assert.deepEqual(
    repriceCartLines(cart, items.map(hidden), { hidePrices: true }).map(l => l.itemId),
    ["flan"],
  );
});

test("con oferta vigente el precio es el de oferta, y vencida vuelve al precio normal", () => {
  const promo = item({
    price: 1000,
    offerPrice: 800,
    offerRange: { from: null, to: "2026-08-31T23:59:59.000-03:00" },
  });
  const cart = [line({ unitPrice: 1000 })];
  assert.equal(repriceCartLines(cart, [promo], { now: at("2026-08-20T12:00:00-03:00") })[0].unitPrice, 800);
  assert.equal(repriceCartLines(cart, [promo], { now: at("2026-09-01T12:00:00-03:00") })[0].unitPrice, 1000);
  // Con los precios ocultos no hay oferta que valga.
  assert.equal(
    repriceCartLines(cart, [promo], { hidePrices: true, now: at("2026-08-20T12:00:00-03:00") })[0].unitPrice,
    0,
  );
});

test("un producto sin precio se descarta, salvo con los precios ocultos", () => {
  const sinPrecio = item({ price: null });
  assert.deepEqual(repriceCartLines([line({})], [sinPrecio]), []);
  assert.deepEqual(repriceCartLines([line({})], [sinPrecio], { hidePrices: true }), [line({ unitPrice: 0 })]);
});

test("cartUnitPrice sigue a la tarjeta: sin precio propio usa el mínimo de las variantes", () => {
  assert.equal(cartUnitPrice(empanada), 850);
  assert.equal(cartUnitPrice(empanada, "Carne"), 900);
  assert.equal(cartUnitPrice(empanada, "Verdura"), null);
  assert.equal(cartUnitPrice(item({ price: null })), null);
  assert.equal(cartUnitPrice(hidden(pizza), undefined, { hidePrices: true }), 0);
  assert.equal(cartUnitPrice(hidden(empanada), "Carne", { hidePrices: true }), 0);
});
