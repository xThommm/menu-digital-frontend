import test from "node:test";
import assert from "node:assert/strict";
import { cartUnitPrice, repriceCartLines } from "../src/lib/cartPricing.ts";
import { buildOrderMessage } from "../src/lib/whatsapp.ts";
import type { CartLine } from "../src/context/CartContext.tsx";
import type { PublicMenuItem } from "../src/types/index.ts";

// Un producto de la carta pública v2 con lo mínimo que mira el carrito: solo
// _id y title son obligatorios, el resto se omite cuando está vacío. No trae
// available, hidden ni offerRange/offerSchedule.
const item = (overrides: Partial<PublicMenuItem>): PublicMenuItem => ({
  _id: "pizza",
  title: "Pizza",
  ...overrides,
});

// El mismo producto como lo manda un backend anterior (respuesta sin ?v=2):
// con los campos de más que el front nuevo tiene que tolerar.
const legacy = (it: PublicMenuItem, overrides: Partial<PublicMenuItem> = {}): PublicMenuItem => ({
  price: null,
  offerPrice: null,
  offerRange: { from: null, to: null },
  options: {},
  available: true,
  hidden: false,
  ...it,
  ...overrides,
});

// Lo que manda v2 con "Ocultar precios": sin price ni offerPrice y las
// variantes con las mismas claves en 0.
const sinPrecios = (it: PublicMenuItem): PublicMenuItem => ({
  _id: it._id,
  title: it.title,
  ...(it.options ? { options: Object.fromEntries(Object.keys(it.options).map(name => [name, 0])) } : {}),
});

const line = (overrides: Partial<CartLine>): CartLine => ({
  itemId: "pizza",
  title: "Pizza",
  unitPrice: 1000,
  quantity: 1,
  ...overrides,
});

const at = (iso: string) => new Date(iso).getTime();

const pizza = item({ price: 1000 });
const empanada = item({ _id: "empanada", title: "Empanada", options: { Carne: 900, Pollo: 850 } });
const carta = [pizza, empanada];

test("un pedido armado con los precios ocultos vuelve a tener precios si el dueño los muestra", () => {
  const armado = repriceCartLines(
    [line({ quantity: 2 }), line({ itemId: "empanada", title: "Empanada", selectedOption: "Carne", quantity: 3 })],
    carta.map(sinPrecios),
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
    carta.map(sinPrecios),
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
    repriceCartLines(cart, carta.map(sinPrecios), { hidePrices: true }).map(l => l.selectedOption),
    ["Carne"],
  );
});

test("v2: sin el campo available un producto se puede pedir (no viene apagado, no viaja si no está)", () => {
  // Regresión que evita isItemUnavailable: con `!item.available` todos los
  // productos de la v2 (que no manda available) quedarían descartados.
  assert.deepEqual(repriceCartLines([line({})], [pizza]), [line({})]);
});

test("v2: se descartan los productos que ya no están en la carta (los agotados y ocultos no viajan)", () => {
  const cart = [
    line({ itemId: "pizza" }),
    line({ itemId: "empanada", selectedOption: "Carne" }),
    line({ itemId: "flan", title: "Flan" }),
    line({ itemId: "borrado", title: "Borrado" }),
  ];
  // Pizza y empanada estaban en el carrito pero el servidor ya no las manda
  // (agotadas, ocultas o fuera de horario): solo queda el flan.
  const items = [item({ _id: "flan", title: "Flan", price: 500 })];
  assert.deepEqual(repriceCartLines(cart, items).map(l => l.itemId), ["flan"]);
  assert.deepEqual(
    repriceCartLines(cart, items.map(sinPrecios), { hidePrices: true }).map(l => l.itemId),
    ["flan"],
  );
});

test("legacy: un producto con available en false se descarta, con true se conserva", () => {
  const cart = [
    line({ itemId: "pizza" }),
    line({ itemId: "empanada", selectedOption: "Carne" }),
    line({ itemId: "flan", title: "Flan" }),
  ];
  const items = [
    legacy(pizza, { available: false }),
    legacy(empanada, { available: false }),
    legacy(item({ _id: "flan", title: "Flan", price: 500 })),
  ];
  assert.deepEqual(repriceCartLines(cart, items).map(l => l.itemId), ["flan"]);
  assert.deepEqual(
    repriceCartLines(cart, items.map(it => legacy(sinPrecios(it), { available: it.available })), { hidePrices: true })
      .map(l => l.itemId),
    ["flan"],
  );
});

test("v2: el offerPrice llega resuelto por el servidor y sin él rige el precio normal", () => {
  // v2 manda offerPrice solo si la oferta rige ahora, siempre junto con price
  // y sin offerRange/offerSchedule: sin ellos la oferta cuenta como vigente.
  const promo = item({ price: 1000, offerPrice: 800 });
  const cart = [line({ unitPrice: 1000 })];
  assert.equal(repriceCartLines(cart, [promo])[0].unitPrice, 800);
  // Oferta vencida o fuera de horario: el servidor no manda offerPrice.
  assert.equal(repriceCartLines(cart, [item({ price: 1000 })])[0].unitPrice, 1000);
  // Con los precios ocultos no hay oferta que valga (v2 omite price y offerPrice).
  assert.equal(repriceCartLines(cart, [sinPrecios(promo)], { hidePrices: true })[0].unitPrice, 0);
});

test("una oferta sin precio original no se aplica", () => {
  // v2 nunca manda offerPrice sin price; el front igual no lo toma.
  const sinPrecio = item({ offerPrice: 800, options: { Chico: 900, Grande: 1200 } });
  assert.equal(cartUnitPrice(sinPrecio), 900);
});

test("legacy: con offerRange la oferta vigente es la de oferta, y vencida vuelve al precio normal", () => {
  const promo = legacy(item({
    price: 1000,
    offerPrice: 800,
    offerRange: { from: null, to: "2026-08-31T23:59:59.000-03:00" },
  }));
  const cart = [line({ unitPrice: 1000 })];
  assert.equal(repriceCartLines(cart, [promo], { now: at("2026-08-20T12:00:00-03:00") })[0].unitPrice, 800);
  assert.equal(repriceCartLines(cart, [promo], { now: at("2026-09-01T12:00:00-03:00") })[0].unitPrice, 1000);
  // Con los precios ocultos no hay oferta que valga.
  assert.equal(
    repriceCartLines(cart, [sinPrecios(promo)], { hidePrices: true, now: at("2026-08-20T12:00:00-03:00") })[0].unitPrice,
    0,
  );
});

test("un producto sin precio se descarta, salvo con los precios ocultos", () => {
  const sinPrecio = item({});
  assert.deepEqual(repriceCartLines([line({})], [sinPrecio]), []);
  assert.deepEqual(repriceCartLines([line({})], [sinPrecio], { hidePrices: true }), [line({ unitPrice: 0 })]);
  // El legacy lo manda con price en null.
  assert.deepEqual(repriceCartLines([line({})], [legacy(sinPrecio)]), []);
});

test("cartUnitPrice sigue a la tarjeta: sin precio propio usa el mínimo de las variantes", () => {
  assert.equal(cartUnitPrice(empanada), 850);
  assert.equal(cartUnitPrice(empanada, "Carne"), 900);
  assert.equal(cartUnitPrice(empanada, "Verdura"), null);
  assert.equal(cartUnitPrice(item({})), null);
  assert.equal(cartUnitPrice(sinPrecios(pizza), undefined, { hidePrices: true }), 0);
  assert.equal(cartUnitPrice(sinPrecios(empanada), "Carne", { hidePrices: true }), 0);
});
