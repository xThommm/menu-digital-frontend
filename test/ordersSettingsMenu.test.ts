import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMpMenu, buildOrdersSettingsPageMenu, buildQrMenu, buildQrSectionMenu, buildShiftEntryMenu,
} from "../src/features/orders/components/panel/ordersSettingsMenu.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

test("QR de mesa: descargar, imprimir, copiar enlace y regenerar (confirma)", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const items = resolve(buildQrMenu(env), {
    label: "Mesa 4", target: "4", url: "https://app/lo-de-lucas/m/abc",
    actions: { download: fn("download"), print: fn("print"), regenerate: async () => { calls.push("regenerate"); } },
  });
  assert.deepEqual(ids(items), ["download", "print", "copy", "regenerate"]);
  await run(action(items, "print"));
  await run(action(items, "copy"));
  assert.deepEqual(log, ["copy:https://app/lo-de-lucas/m/abc"]);

  const regenerate = action(items, "regenerate");
  assert.equal(regenerate.confirm?.title, "¿Regenerar el QR de la Mesa 4?");
  assert.equal(regenerate.confirm?.danger, true);
  assert.equal((await run(regenerate, { accept: false })).outcome, "cancelled");
  const done = await run(regenerate);
  assert.deepEqual(done.notices, ["ok:QR regenerado: imprimí el nuevo."]);
  assert.deepEqual(calls, ["print", "regenerate"]);
});

test("sección de QR: imprimir y regenerar todos (confirma); QR general", async () => {
  const { calls, fn } = recorder();
  const actions = { printAll: fn("print"), regenerateAll: async () => { calls.push("regenerate"); } };
  const tables = resolve(buildQrSectionMenu(), { general: false, count: 0, actions });
  assert.equal(action(tables, "print-all").label, "Imprimir todos");
  assert.equal(action(tables, "print-all").disabled, true);
  assert.equal(action(tables, "regenerate-all").confirm?.title, "¿Regenerar los QR?");
  await run(action(tables, "regenerate-all"));

  const general = resolve(buildQrSectionMenu(), { general: true, count: 1, actions });
  assert.equal(action(general, "regenerate-all").label, "Regenerar QR");
  await run(action(general, "print-all"));
  assert.deepEqual(calls, ["regenerate", "print"]);
});

test("turno del horario: quitar confirma; fondo: guardar solo con cambios", async () => {
  const { calls, fn } = recorder();
  const entry = resolve(buildShiftEntryMenu(), { entry: { name: "Noche", from: "19:00", to: "01:00" }, actions: { remove: fn("remove") } });
  assert.equal(action(entry, "remove").confirm?.title, "¿Quitar el turno Noche?");
  assert.equal((await run(action(entry, "remove"), { accept: false })).outcome, "cancelled");
  await run(action(entry, "remove"));
  assert.deepEqual(calls, ["remove"]);

  const clean = resolve(buildOrdersSettingsPageMenu(), { dirty: false, saving: false, actions: { save: () => {} } });
  assert.equal(action(clean, "save").disabledReason, "No hay cambios sin guardar");
  const dirty = resolve(buildOrdersSettingsPageMenu(), { dirty: true, saving: false, actions: { save: () => {} } });
  assert.equal(action(dirty, "save").disabled, false);
});

test("Mercado Pago: conectar / reconectar y desconectar (confirma)", async () => {
  const calls: string[] = [];
  const actions = { connect: async () => { calls.push("connect"); }, disconnect: async () => { calls.push("disconnect"); } };
  const off = resolve(buildMpMenu(), { connected: false, needsReconnect: false, busy: false, actions });
  assert.deepEqual(ids(off), ["connect"]);
  assert.equal(action(off, "connect").label, "Conectar Mercado Pago");

  const on = resolve(buildMpMenu(), { connected: true, needsReconnect: false, busy: false, actions });
  assert.equal(action(on, "connect").label, "Reconectar cuenta");
  const disconnect = action(on, "disconnect");
  assert.equal(disconnect.confirm?.title, "¿Desconectar Mercado Pago?");
  assert.equal((await run(disconnect, { accept: false })).outcome, "cancelled");
  await run(disconnect);
  assert.deepEqual(calls, ["disconnect"]);

  const busy = resolve(buildMpMenu(), { connected: true, needsReconnect: false, busy: true, actions });
  assert.equal(action(busy, "disconnect").disabled, true);
});
