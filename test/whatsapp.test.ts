import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderMessage, buildWaLink, sanitizePhoneForWa } from "../src/lib/whatsapp.ts";
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
