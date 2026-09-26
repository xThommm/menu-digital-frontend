import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderChoices, buildOrderMessage, buildWaLink, getOrderModes, getWaTargets, isValidArLocalPhone,
  normalizeArPhone, sanitizePhoneForWa,
} from "../src/lib/whatsapp.ts";
import type { CartLine } from "../src/context/CartContext.tsx";

// Mismo formateador que whatsapp.ts: es-AR separa con espacios no
// separables, así que el esperado no se puede tipear a mano con espacios
// comunes.
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const cart: CartLine[] = [
  { itemId: "a", title: "Pizza muzzarella", unitPrice: 12500, quantity: 2 },
  { itemId: "b", title: "Empanada", unitPrice: 1800, quantity: 3, selectedOption: "Carne" },
];

// El mensaje tal como salía antes de sumar el "Mensaje de pedido": si esto
// cambia, cambia lo que reciben hoy todos los locales por WhatsApp.
const baseMessage = [
  "¡Hola! Quiero hacer un pedido en *La Esquina*:",
  "",
  `• 2x Pizza muzzarella — ${fmt(25000)}`,
  `• 3x Empanada (Carne) — ${fmt(5400)}`,
  "",
  `*Total: ${fmt(30400)}*`,
].join("\n");

test("sin texto extra el pedido sale exactamente como antes", () => {
  assert.equal(buildOrderMessage(cart, "La Esquina"), baseMessage);
  assert.equal(buildOrderMessage(cart, "La Esquina", undefined), baseMessage);
  // Y los montos siguen saliendo en pesos con punto de miles.
  assert.match(buildOrderMessage(cart, "La Esquina").replace(/\s/g, " "), /\*Total: \$ 30\.400\*$/);
});

test("el texto extra va después del total, separado por una línea en blanco", () => {
  const extra = "Nombre y apellido:\nDirección:\nEntre calles:";
  assert.equal(buildOrderMessage(cart, "La Esquina", extra), `${baseMessage}\n\n${extra}`);
});

test("texto extra vacío o solo espacios = mensaje de siempre", () => {
  for (const extra of ["", "   ", "\n\t \n"]) {
    assert.equal(buildOrderMessage(cart, "La Esquina", extra), baseMessage);
  }
});

test("el texto extra se recorta antes de agregarlo", () => {
  assert.equal(
    buildOrderMessage(cart, "La Esquina", "  \nDirección:\n  "),
    `${baseMessage}\n\nDirección:`,
  );
});

test("con precios ocultos salen solo cantidades y productos, sin subtotales ni total", () => {
  const hidden = [
    "¡Hola! Quiero hacer un pedido en *La Esquina*:",
    "",
    "• 2x Pizza muzzarella",
    "• 3x Empanada (Carne)",
  ].join("\n");
  // `cart` trae unitPrice reales (p. ej. un carrito guardado antes de
  // activar la opción): no pueden aparecer en el mensaje.
  assert.equal(buildOrderMessage(cart, "La Esquina", undefined, { hidePrices: true }), hidden);
  assert.equal(
    buildOrderMessage(cart, "La Esquina", " Dirección: ", { hidePrices: true }),
    `${hidden}\n\nDirección:`,
  );
  assert.doesNotMatch(buildOrderMessage(cart, "La Esquina", "", { hidePrices: true }), /\$|Total/);
  // hidePrices: false explícito = mensaje de siempre.
  assert.equal(buildOrderMessage(cart, "La Esquina", undefined, { hidePrices: false }), baseMessage);
});

test("con modalidad, el mensaje arranca con ella en su propia línea", () => {
  assert.equal(buildOrderMessage(cart, "La Esquina", undefined, { mode: "delivery" }), `🛵 *DELIVERY*\n${baseMessage}`);
  assert.equal(
    buildOrderMessage(cart, "La Esquina", "Nombre:", { mode: "takeaway" }),
    `🥡 *TAKE AWAY* (retiro en el local)\n${baseMessage}\n\nNombre:`,
  );
});

test("getOrderModes: delivery primero, y un backend sin hasTakeAway = sin take away", () => {
  assert.deepEqual(getOrderModes({ hasDelivery: true, hasTakeAway: true }), ["delivery", "takeaway"]);
  assert.deepEqual(getOrderModes({ hasDelivery: true }), ["delivery"]);
  assert.deepEqual(getOrderModes({ hasDelivery: false, hasTakeAway: true }), ["takeaway"]);
  assert.deepEqual(getOrderModes({ hasDelivery: false, hasTakeAway: false }), []);
});

test("buildOrderChoices: cada modalidad lleva su propio texto extra", () => {
  const texts = { orderMessage: "Dirección:", takeAwayMessage: "Horario de retiro:" };
  const choices = buildOrderChoices(cart, "La Esquina", texts, { modes: ["delivery", "takeaway"] });

  assert.deepEqual(choices.map(c => [c.key, c.label]), [["delivery", "Delivery"], ["takeaway", "Take away"]]);
  assert.equal(choices[0].message, `🛵 *DELIVERY*\n${baseMessage}\n\nDirección:`);
  assert.equal(choices[1].message, `🥡 *TAKE AWAY* (retiro en el local)\n${baseMessage}\n\nHorario de retiro:`);

  // Sin mensaje de take away cargado, el de delivery no se cuela en el retiro.
  const [takeaway] = buildOrderChoices(cart, "La Esquina", { orderMessage: "Dirección:" }, { modes: ["takeaway"] });
  assert.equal(takeaway.message, `🥡 *TAKE AWAY* (retiro en el local)\n${baseMessage}`);
});

test("buildOrderChoices sin modalidades: el mensaje de siempre con orderMessage", () => {
  const choices = buildOrderChoices(cart, "La Esquina", { orderMessage: "Dirección:", takeAwayMessage: "Nombre:" }, { modes: [] });
  assert.equal(choices.length, 1);
  assert.equal(choices[0].message, `${baseMessage}\n\nDirección:`);
});

test("sanitizePhoneForWa arma 549 + área + número", () => {
  assert.equal(sanitizePhoneForWa(null), null);
  assert.equal(sanitizePhoneForWa(1112345678), "5491112345678");
  // Con código de país ya cargado: solo se agrega el 9 si falta.
  assert.equal(sanitizePhoneForWa(541112345678), "5491112345678");
  assert.equal(sanitizePhoneForWa(5491112345678), "5491112345678");
});

test("buildWaLink codifica el mensaje y devuelve null sin teléfono", () => {
  const message = buildOrderMessage(cart, "La Esquina", "Dirección:");
  assert.equal(buildWaLink(null, message), null);
  const link = buildWaLink(1112345678, message);
  assert.equal(link, `https://wa.me/5491112345678?text=${encodeURIComponent(message)}`);
  assert.equal(new URL(link ?? "").searchParams.get("text"), message);
});

test("normalizeArPhone deja código de área + número, sin 54/9/0/15", () => {
  for (const input of [
    "11 2345-6789", "1123456789", 1123456789, "+54 9 11 2345-6789", "5491123456789",
    "54 11 2345 6789", "541123456789", "011 2345-6789", "11 15 2345-6789", "011 15 2345 6789",
    "0054 9 11 2345 6789",
  ]) {
    assert.equal(normalizeArPhone(input), "1123456789", String(input));
  }
  // Áreas de 3 y 4 dígitos con el 15 en el medio.
  assert.equal(normalizeArPhone("351 15 234-5678"), "3512345678");
  assert.equal(normalizeArPhone("2972 15 45-6789"), "2972456789");
  assert.equal(normalizeArPhone(null), "");
  assert.equal(isValidArLocalPhone("1123456789"), true);
  assert.equal(isValidArLocalPhone("123456"), false);
  assert.equal(isValidArLocalPhone("0123456789"), false);
});

test("getWaTargets usa los WhatsApp por sucursal y si no hay, el teléfono", () => {
  assert.deepEqual(getWaTargets({ number: 1123456789 }), [{ name: "", phone: "5491123456789" }]);
  assert.deepEqual(getWaTargets({ number: 1123456789, whatsappNumbers: [] }), [{ name: "", phone: "5491123456789" }]);
  assert.deepEqual(getWaTargets({ number: null }), []);
  assert.deepEqual(getWaTargets(undefined), []);
  assert.deepEqual(
    getWaTargets({
      number: 1123456789,
      whatsappNumbers: [{ name: " Centro ", number: "1133334444" }, { name: "Norte", number: "3515556666" }],
    }),
    [{ name: "Centro", phone: "5491133334444" }, { name: "Norte", phone: "5493515556666" }],
  );
});
