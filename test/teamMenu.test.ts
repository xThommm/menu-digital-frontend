import test from "node:test";
import assert from "node:assert/strict";
import { buildStaffMenu, buildStaffPageMenu } from "../src/features/orders/components/panel/staffMenu.ts";
import { buildSectorMenu, buildSectorsPageMenu, stationUrl } from "../src/features/orders/components/panel/sectorsMenu.ts";
import type { Sector, Waiter } from "../src/features/orders/types.ts";
import { action, fakeEnv, ids, recorder, resolve, run, submenu } from "./support/menu.ts";

const session = (id: number, deviceLabel: string | null) =>
  ({ id, deviceLabel, startedAt: "2026-10-14T12:00:00Z", lastSeenAt: "2026-10-14T12:30:00Z" }) as Waiter["sessions"][number];

const waiter = (overrides: Partial<Waiter> = {}): Waiter =>
  ({ id: 3, name: "Ana", phone: null, notes: null, active: true, activeDevices: 0, sessions: [], ...overrides }) as Waiter;

function waiterActions() {
  const { calls, fn } = recorder();
  return {
    calls,
    actions: {
      edit: fn("edit"),
      showQr: fn("qr"),
      accessLink: async () => "https://app/lo-de-lucas/operador?code=ABC",
      showSessions: fn("sessions"),
      setActive: async (active: boolean) => { calls.push(`active ${active}`); },
      closeSession: async (id: number) => { calls.push(`close ${id}`); },
      closeAllSessions: async () => { calls.push("close-all"); },
      remove: async () => { calls.push("remove"); },
    },
  };
}

test("operador sin dispositivos: copiar el enlace de acceso, pausar sin confirmar y eliminar confirmando", async () => {
  const { env, log } = fakeEnv();
  const { calls, actions } = waiterActions();
  const items = resolve(buildStaffMenu(env, "waiter"), { member: waiter(), actions });
  assert.deepEqual(ids(items), ["edit", "qr", "access-link", "sessions", "pause", "delete"]);

  const copied = await run(action(items, "access-link"));
  assert.deepEqual(log, ["copy:https://app/lo-de-lucas/operador?code=ABC"]);
  assert.match(copied.notices[0], /sirve una sola vez/);

  assert.equal(action(items, "pause").confirm, null);
  await run(action(items, "pause"));

  const remove = action(items, "delete");
  assert.equal(remove.confirm?.title, "¿Eliminar a Ana?");
  assert.equal((await run(remove, { accept: false })).outcome, "cancelled");
  await run(remove);
  assert.deepEqual(calls, ["active false", "remove"]);
});

test("operador con dispositivos: cerrar una sesión o todas confirma, pausar también", async () => {
  const { env } = fakeEnv();
  const { calls, actions } = waiterActions();
  const busy = waiter({ activeDevices: 2, sessions: [session(10, "Moto G"), session(11, null)] });
  const items = resolve(buildStaffMenu(env, "waiter"), { member: busy, actions });
  assert.deepEqual(ids(submenu(items, "close-session").items), ["close-session/session-10", "close-session/session-11"]);

  const one = action(items, "close-session/session-11");
  assert.equal(one.confirm?.title, "¿Cerrar la sesión de Ana en Dispositivo?");
  await run(one);
  assert.match(action(items, "close-all").confirm?.message ?? "", /2 dispositivos conectados/);
  await run(action(items, "close-all"));
  assert.match(action(items, "pause").confirm?.message ?? "", /Se cierran sus sesiones/);
  assert.deepEqual(calls, ["close 11", "close-all"]);
});

test("operador pausado: activar; QR y enlace deshabilitados", () => {
  const { env } = fakeEnv();
  const items = resolve(buildStaffMenu(env, "waiter"), { member: waiter({ active: false }), actions: waiterActions().actions });
  assert.ok(ids(items).includes("activate"));
  assert.ok(!ids(items).includes("pause"));
  assert.equal(action(items, "qr").disabledReason, "El operador está pausado");
  assert.equal(action(items, "access-link").disabled, true);

  const page = resolve(buildStaffPageMenu("waiter"), { actions: { add: () => {} } });
  assert.deepEqual(ids(page), ["add"]);
  assert.equal(action(page, "add").label, "Agregar operador");
});

const sector = (overrides: Partial<Sector> = {}): Sector =>
  ({ id: 5, name: "Cocina", isDefault: false, printMode: "none", paperWidth: 80, printCopies: 1, activeDevices: 0, sessions: [], ...overrides }) as Sector;

function sectorActions() {
  const { calls, fn } = recorder();
  return {
    calls,
    actions: {
      rename: fn("rename"),
      makeDefault: async () => { calls.push("default"); },
      pair: fn("pair"),
      setPrintMode: async (mode: string) => { calls.push(`print ${mode}`); },
      unpair: async (id: number) => { calls.push(`unpair ${id}`); },
      remove: async () => { calls.push("remove"); },
    },
  };
}

test("sector: impresión, pantalla, desvincular y eliminar (confirman)", async () => {
  const { env, log } = fakeEnv();
  const { calls, actions } = sectorActions();
  const screenUrl = stationUrl("https://app", 5);
  assert.equal(screenUrl, "https://app/comandas?sector=5");
  const items = resolve(buildSectorMenu(env), { sector: sector({ sessions: [session(20, "PC cocina")] }), screenUrl, actions });
  assert.deepEqual(ids(items), [
    "rename", "default", "print", "print/print-none", "print/print-browser", "print/print-escpos",
    "pair", "unpair", "unpair/session-20", "screen", "copy-screen", "delete",
  ]);

  assert.equal(action(items, "print/print-none").disabled, true);
  await run(action(items, "print/print-browser"));
  await run(action(items, "screen"));
  await run(action(items, "copy-screen"));
  assert.deepEqual(log, ["open:https://app/comandas?sector=5", "copy:https://app/comandas?sector=5"]);

  assert.equal(action(items, "unpair/session-20").confirm?.title, "¿Desvincular PC cocina de Cocina?");
  await run(action(items, "unpair/session-20"));
  assert.equal(action(items, "delete").confirm?.danger, true);
  await run(action(items, "delete"));
  assert.deepEqual(calls, ["print browser", "unpair 20", "remove"]);
});

test("sector por defecto sin equipos; fondo de la pantalla", async () => {
  const { env, log } = fakeEnv();
  const items = resolve(buildSectorMenu(env), { sector: sector({ isDefault: true }), screenUrl: "u", actions: sectorActions().actions });
  assert.ok(!ids(items).includes("default"));
  assert.ok(!ids(items).includes("unpair"));

  const page = resolve(buildSectorsPageMenu(env), { screenUrl: stationUrl("https://app"), actions: { add: () => {} } });
  assert.deepEqual(ids(page), ["add", "screen"]);
  await run(action(page, "screen"));
  assert.deepEqual(log, ["open:https://app/comandas"]);
});

test("repartidor: ver sus entregas; con entregas sin resolver, pausar y eliminar no confirman (abre la ventana de reasignar)", async () => {
  const { env } = fakeEnv();
  const { calls, actions } = waiterActions();
  const courier = { ...waiter({ name: "Beto", sessions: [session(30, "Moto")] }), activeDeliveries: 2 };
  const items = resolve(buildStaffMenu(env, "courier"), { member: courier, actions: { ...actions, showDeliveries: () => { calls.push("deliveries"); } } });
  assert.ok(ids(items).includes("deliveries"));
  assert.equal(action(items, "pause").confirm, null);
  assert.equal(action(items, "delete").confirm, null);
  await run(action(items, "deliveries"));

  const free = resolve(buildStaffMenu(env, "courier"), { member: { ...courier, activeDeliveries: 0 }, actions });
  assert.ok(!ids(free).includes("deliveries"));
  assert.match(action(free, "delete").confirm?.message ?? "", /Sus entregas conservan el nombre/);
  assert.equal(action(free, "pause").confirm?.title, "¿Pausar a Beto?");
  assert.deepEqual(calls, ["deliveries"]);
});
