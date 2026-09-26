import test from "node:test";
import assert from "node:assert/strict";
import {
  buenosAiresDay, decideVisit, isStaffViewer, markOnce, orderKey, visitQuery, type KeyValueStorage,
} from "../src/lib/menuAnalytics.ts";

function storage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

// Viernes 25 de septiembre de 2026, 21:00 en Buenos Aires.
const NOW = new Date("2026-09-25T21:00:00-03:00").getTime();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

test("el día se corta a la medianoche de Buenos Aires, no en UTC", () => {
  assert.equal(buenosAiresDay(new Date("2026-09-25T23:59:00-03:00").getTime()), "2026-09-25");
  assert.equal(buenosAiresDay(new Date("2026-09-26T00:00:00-03:00").getTime()), "2026-09-26");
});

test("primera visita del dispositivo: cuenta como visitante nuevo, no recurrente", () => {
  const s = storage();
  const visit = decideVisit("cafe", { now: NOW, storage: s, qr: true });
  assert.deepEqual(visit, { track: true, newVisitor: true, returning: false, qr: true });
  assert.equal(visitQuery(visit), "track=1&nv=1&src=qr");
});

test("recargar dentro de los 30 minutos no suma; la sesión se extiende con cada carga", () => {
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  assert.deepEqual(decideVisit("cafe", { now: NOW + 20 * MIN, storage: s }), { track: false });
  // 20 + 25 minutos: la sesión se extendió en la recarga anterior.
  assert.deepEqual(decideVisit("cafe", { now: NOW + 45 * MIN, storage: s }), { track: false });
  assert.equal(visitQuery({ track: false }), "track=0");
});

test("pasados 30 minutos es otra visita del mismo visitante del día", () => {
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  const again = decideVisit("cafe", { now: NOW + 31 * MIN, storage: s });
  assert.deepEqual(again, { track: true, newVisitor: false, returning: false, qr: false });
  assert.equal(visitQuery(again), "track=1");
});

test("otro día es un visitante del día que vuelve", () => {
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  const next = decideVisit("cafe", { now: NOW + DAY, storage: s });
  assert.deepEqual(next, { track: true, newVisitor: true, returning: true, qr: false });
  assert.equal(visitQuery(next), "track=1&nv=1&ret=1");
  // El primer día visto se conserva.
  assert.equal(JSON.parse(s.data.get("md:visit:cafe")!).firstSeen, "2026-09-25");
});

test("pasados 90 días sin entrar, el dispositivo se olvida y es un visitante nuevo", () => {
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  // A los 89 días todavía lo recuerda: vuelve.
  assert.equal((decideVisit("cafe", { now: NOW + 89 * DAY, storage: s }) as { returning: boolean }).returning, true);
  // 90 días después de esa última visita, ya no.
  const later = NOW + 179 * DAY + MIN;
  assert.deepEqual(decideVisit("cafe", { now: later, storage: s }), {
    track: true, newVisitor: true, returning: false, qr: false,
  });
  assert.equal(JSON.parse(s.data.get("md:visit:cafe")!).firstSeen, buenosAiresDay(later));
});

test("cada carta tiene su propia sesión", () => {
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  assert.equal(decideVisit("bar", { now: NOW + MIN, storage: s }).track, true);
});

test("skip (dueño o personal) no cuenta ni deja rastro", () => {
  const s = storage();
  assert.deepEqual(decideVisit("cafe", { now: NOW, storage: s, skip: true, qr: true }), { track: false });
  assert.equal(s.data.size, 0);
});

test("estado corrupto o reloj atrasado: se trata como visita nueva", () => {
  for (const raw of ["{", "null", '{"last":"x"}', "[]"]) {
    const s = storage({ "md:visit:cafe": raw });
    assert.equal(decideVisit("cafe", { now: NOW, storage: s }).track, true);
  }
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  assert.equal(decideVisit("cafe", { now: NOW - 5 * MIN, storage: s }).track, true);
});

test("un storage que falla no rompe la carta", () => {
  const broken: KeyValueStorage = {
    getItem: () => { throw new Error("bloqueado"); },
    setItem: () => { throw new Error("lleno"); },
  };
  assert.equal(decideVisit("cafe", { now: NOW, storage: broken }).track, true);
  assert.equal(markOnce("cafe", "engaged", { now: NOW, storage: broken }), true);
});

test("markOnce: una vez por sesión, y una visita nueva empieza de cero", () => {
  const s = storage();
  decideVisit("cafe", { now: NOW, storage: s });
  assert.equal(markOnce("cafe", "item:1", { now: NOW + MIN, storage: s }), true);
  assert.equal(markOnce("cafe", "item:1", { now: NOW + 2 * MIN, storage: s }), false);
  assert.equal(markOnce("cafe", "item:2", { now: NOW + 3 * MIN, storage: s }), true);
  // Marcar también mantiene viva la sesión: recargar a los 32 minutos del
  // inicio pero 29 de la última marca no es otra visita.
  assert.equal(decideVisit("cafe", { now: NOW + 32 * MIN, storage: s }).track, false);
  decideVisit("cafe", { now: NOW + 70 * MIN, storage: s });
  assert.equal(markOnce("cafe", "item:1", { now: NOW + 71 * MIN, storage: s }), true);
});

test("orderKey: el mismo carrito da la misma clave sin importar el orden", () => {
  const a = orderKey([{ itemId: "1", quantity: 2 }, { itemId: "2", selectedOption: "Grande", quantity: 1 }]);
  const b = orderKey([{ itemId: "2", selectedOption: "Grande", quantity: 1 }, { itemId: "1", quantity: 2 }]);
  assert.equal(a, b);
  assert.match(a, /^order:[a-z0-9]+$/);
  assert.notEqual(a, orderKey([{ itemId: "1", quantity: 3 }, { itemId: "2", selectedOption: "Grande", quantity: 1 }]));
});

test("isStaffViewer: el dueño de esta carta y el personal, con sesión iniciada", () => {
  const session = (user: object) => storage({ token: "t", user: JSON.stringify(user) });
  assert.equal(isStaffViewer("cafe", session({ role: "user", slug: "cafe" })), true);
  assert.equal(isStaffViewer("Cafe", session({ role: "user", slug: "cafe" })), true);
  assert.equal(isStaffViewer("cafe", session({ role: "user", slug: "otro-local" })), false);
  assert.equal(isStaffViewer("cafe", session({ role: "admin", slug: "admin" })), true);
  assert.equal(isStaffViewer("cafe", session({ role: "seller" })), true);
  // Sin token (cerró sesión) o datos corruptos: es un cliente más.
  assert.equal(isStaffViewer("cafe", storage({ user: JSON.stringify({ role: "admin" }) })), false);
  assert.equal(isStaffViewer("cafe", storage({ token: "t", user: "{" })), false);
  assert.equal(isStaffViewer("cafe", storage()), false);
});
