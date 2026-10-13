import test from "node:test";
import assert from "node:assert/strict";
import {
  amountInput, eventText, formatAmount, parseAmount, shareFraction, suggestedAmount, toggleShare, withWeight,
} from "../src/features/orders/lib/bill.ts";

// Cuenta de la mesa: lo que resuelve la pantalla (los importes los calcula el backend).

const share = (guestId: number, weight = 1, amount = 0) => ({ guestId, weight, amount });
// Intl mete espacios duros: se comparan sin espacios.
const plain = (text: string) => text.replace(/\s/g, "");

test("importes: con centavos solo cuando los hay", () => {
  assert.equal(plain(formatAmount(18000)), "$18.000");
  assert.equal(plain(formatAmount(3333.34)), "$3.333,34");
  assert.equal(plain(formatAmount(2500.5)), "$2.500,50");
  assert.equal(plain(formatAmount(0)), "$0");
});

test("campo de importe: acepta las formas en que se tipea plata acá", () => {
  assert.equal(parseAmount("1500"), 1500);
  assert.equal(parseAmount("1.500"), 1500);
  assert.equal(parseAmount("12.500,50"), 12500.5);
  assert.equal(parseAmount("1500,5"), 1500.5);
  assert.equal(parseAmount("1500.50"), 1500.5);
  assert.equal(parseAmount(" $ 2.000 "), 2000);
  assert.equal(parseAmount("0,999"), 1);
  assert.equal(parseAmount("1.5"), 1.5, "un punto solo con un decimal es decimal, no miles");
});

test("campo de importe: lo que no es un importe no pasa", () => {
  for (const bad of ["", "   ", "abc", "-100", "1,2,3", "12e3", "1.500.50,", "$"]) {
    assert.equal(parseAmount(bad), null, bad);
  }
});

test("campo de importe: lo que se muestra vuelve a leerse igual", () => {
  for (const value of [0, 1500, 3333.34, 2500.5, 0.01]) assert.equal(parseAmount(amountInput(value)), value);
  assert.equal(amountInput(2500.5), "2500,50");
});

test("reparto: tocar un comensal lo suma con una parte o lo saca", () => {
  assert.deepEqual(toggleShare([], 1), [{ guestId: 1, weight: 1 }]);
  assert.deepEqual(toggleShare([share(1, 2)], 3), [{ guestId: 1, weight: 2 }, { guestId: 3, weight: 1 }]);
  assert.deepEqual(toggleShare([share(1), share(3)], 1), [{ guestId: 3, weight: 1 }]);
  assert.deepEqual(toggleShare([share(1)], 1), [], "sin nadie queda sin asignar");
});

test("reparto: cambiar las partes de uno no toca a los demás ni baja de una", () => {
  const shares = [share(1), share(2, 3)];
  assert.deepEqual(withWeight(shares, 1, 2), [{ guestId: 1, weight: 2 }, { guestId: 2, weight: 3 }]);
  assert.deepEqual(withWeight(shares, 2, 0), [{ guestId: 1, weight: 1 }, { guestId: 2, weight: 1 }]);
  assert.deepEqual(withWeight(shares, 2, 500)[1], { guestId: 2, weight: 100 });
});

test("reparto: fracción que le toca a cada uno", () => {
  const thirds = [share(1), share(2), share(3)];
  assert.equal(shareFraction(thirds[0], thirds), "1/3");
  const uneven = [share(1, 2), share(2, 1)];
  assert.equal(shareFraction(uneven[0], uneven), "2/3");
  assert.equal(shareFraction(share(1), [share(1)]), "todo");
});

test("cobrar: se propone lo que debe el comensal, sin pasarse de lo que falta", () => {
  const guests = [
    { id: 1, name: "Ana", fromGroup: false, customAmount: null, owed: 6000, paid: 0, balance: 6000 },
    { id: 2, name: "Beto", fromGroup: false, customAmount: null, owed: 6000, paid: 6000, balance: 0 },
    { id: 3, name: "Caro", fromGroup: false, customAmount: null, owed: 6000, paid: 8000, balance: -2000 },
  ];
  assert.equal(suggestedAmount({ pending: 4000, guests }, null), 4000, "sin comensal: todo lo que falta");
  assert.equal(suggestedAmount({ pending: 10000, guests }, 1), 6000);
  assert.equal(suggestedAmount({ pending: 4000, guests }, 1), 4000, "no más de lo que falta de la mesa");
  assert.equal(suggestedAmount({ pending: 4000, guests }, 2), 4000, "ya pagó lo suyo: se ofrece el resto");
  assert.equal(suggestedAmount({ pending: 4000, guests }, 3), 4000);
  assert.equal(suggestedAmount({ pending: 4000, guests }, 99), 4000);
});

test("historial: cada cambio se lee en una línea", () => {
  const line = (type: string, detail: Record<string, unknown>) => plain(eventText({ type, detail }));
  assert.equal(line("guest_added", { names: ["Ana", "Beto"] }), plain("Se sumó a la cuenta: Ana, Beto"));
  assert.equal(line("guest_renamed", { from: "Persona 1", to: "Ana" }), plain("Persona 1 ahora es Ana"));
  assert.equal(line("guest_removed", { name: "Ana" }), plain("Se quitó de la cuenta a Ana"));
  assert.equal(line("split_changed", { from: "none", to: "equal" }), plain("Forma de dividir: Partes iguales"));
  assert.equal(line("amounts_set", { amounts: [{ name: "Ana", amount: 5000 }, { name: "Beto", amount: 1500.5 }] }), plain("Importes: Ana $5.000, Beto $1.500,50"));
  assert.equal(line("item_assigned", { title: "Pizza", guests: [{ name: "Ana", weight: 2 }, { name: "Beto", weight: 1 }] }), plain("Pizza: Ana ×2, Beto"));
  assert.equal(line("item_assigned", { title: "Pizza", guests: [] }), plain("Pizza: quedó sin asignar"));
  assert.equal(line("payment_recorded", { amount: 6000, method: "Efectivo", payer: "Ana" }), plain("Pago de $6.000 · Efectivo · Ana"));
  assert.equal(line("payment_recorded", { amount: 6000, method: "Débito", payer: null }), plain("Pago de $6.000 · Débito"));
  assert.equal(line("payment_voided", { amount: 6000, method: "Efectivo", reason: "Error" }), plain("Pago anulado: $6.000 · Efectivo (Error)"));
  assert.equal(line("group_order", { orderNumber: 12 }), plain("Pedido grupal #12 sumado a la cuenta"));
});

test("historial: un evento desconocido o incompleto no rompe la pantalla", () => {
  assert.equal(eventText({ type: "algo_nuevo", detail: {} }), "Cambio en la cuenta");
  assert.doesNotThrow(() => eventText({ type: "amounts_set", detail: {} }));
  assert.doesNotThrow(() => eventText({ type: "item_assigned", detail: { title: 5 } }));
  assert.doesNotThrow(() => eventText({ type: "payment_recorded", detail: { amount: "mil" } }));
});
