import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBusinessPageMenu, buildGalleryPhotoMenu, buildMediaMenu, buildScheduleDayMenu, buildWhatsAppRowMenu,
} from "../src/components/User/Panel/UserEditor/businessEditorMenu.ts";
import { closeDay, copyDayToOthers, emptyWeekRanges, openDay } from "../src/components/Common/WeeklySchedule/weekSchedule.ts";
import { action, fakeEnv, ids, recorder, resolve, run, submenu } from "./support/menu.ts";

test("fondo: guardar solo con cambios; descartar confirma", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions = { save: fn("save"), discard: fn("discard") };
  const clean = resolve(buildBusinessPageMenu(env), { dirty: false, canSave: false, pageUrl: "https://app/local", actions });
  assert.deepEqual(ids(clean), ["save", "page"]);
  assert.equal(action(clean, "save").disabledReason, "No hay cambios para guardar");

  const dirty = resolve(buildBusinessPageMenu(env), { dirty: true, canSave: true, pageUrl: "https://app/local", actions });
  const discard = action(dirty, "discard");
  assert.equal(discard.confirm?.danger, true);
  assert.equal((await run(discard, { accept: false })).outcome, "cancelled");
  await run(action(dirty, "save"));
  await run(discard);
  await run(action(dirty, "page"));
  assert.deepEqual(calls, ["save", "discard"]);
  assert.deepEqual(log, ["open:https://app/local"]);
});

test("galería: usar como portada, abrir y quitar con confirmación", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const items = resolve(buildGalleryPhotoMenu(env), {
    url: "https://x/a.jpg", index: 2, isBackground: false, busy: false,
    actions: { useAsBackground: async (i) => { calls.push(`background ${i}`); }, remove: fn("remove") },
  });
  const background = await run(action(items, "background"));
  assert.deepEqual(background.notices, ["ok:Portada actualizada."]);
  await run(action(items, "open"));
  assert.equal((await run(action(items, "remove"), { accept: false })).outcome, "cancelled");
  await run(action(items, "remove"));
  assert.deepEqual(calls, ["background 2", "remove 2"]);
  assert.deepEqual(log, ["open:https://x/a.jpg"]);

  const already = resolve(buildGalleryPhotoMenu(env), { url: "u", index: 0, isBackground: true, busy: false, actions: { useAsBackground: async () => {}, remove: fn("r") } });
  assert.equal(action(already, "background").disabledReason, "Ya es la portada");
});

test("portada y logo: cambiar, abrir y quitar con confirmación (sin foto no hay qué quitar)", async () => {
  const { env } = fakeEnv();
  const { calls, fn } = recorder();
  const portada = resolve(buildMediaMenu(env), { kind: "portada", url: "https://x/p.jpg", busy: false, actions: { change: fn("change"), remove: fn("remove") } });
  assert.deepEqual(ids(portada), ["change", "open", "remove"]);
  assert.equal(action(portada, "change").label, "Cambiar la portada");
  assert.equal(action(portada, "remove").confirm?.title, "¿Quitar la portada?");
  const removed = await run(action(portada, "remove"));
  assert.deepEqual(removed.notices, ["ok:Portada quitada."]);

  const noLogo = resolve(buildMediaMenu(env), { kind: "logo", url: "", busy: false, actions: { change: fn("change"), remove: fn("remove") } });
  assert.deepEqual(ids(noLogo), ["change"]);
  assert.equal(action(noLogo, "change").label, "Subir el logo");
  assert.deepEqual(calls, ["remove"]);
});

test("WhatsApp: copiar, chat de prueba y quitar", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const items = resolve(buildWhatsAppRowMenu(env), { name: "Centro", number: "11 2345-6789", actions: { remove: fn("remove") } });
  await run(action(items, "copy"));
  await run(action(items, "test"));
  await run(action(items, "remove"));
  assert.equal(log[0], "copy:11 2345-6789");
  assert.match(log[1], /^open:https:\/\/wa\.me\/\d+\?text=/);
  assert.deepEqual(calls, ["remove"]);
});

test("horario: copiar el de un día a los abiertos o a todos, marcar cerrado y abierto", async () => {
  const week = { ...emptyWeekRanges(), mon: [{ from: "09:00", to: "18:00" }], tue: [{ from: "09:00", to: "18:00" }], sat: [{ from: "10:00", to: "14:00" }] };

  const toOpen = copyDayToOthers(week, "sat", "open");
  assert.deepEqual(toOpen.mon, [{ from: "10:00", to: "14:00" }]);
  assert.deepEqual(toOpen.wed, [], "un día cerrado sigue cerrado");
  const toAll = copyDayToOthers(week, "sat", "all");
  assert.deepEqual(toAll.sun, [{ from: "10:00", to: "14:00" }]);

  assert.deepEqual(closeDay(week, "mon").mon, []);
  assert.deepEqual(openDay(week, "wed").wed, [{ from: "09:00", to: "18:00" }], "abre con el horario general");
  assert.notEqual(toAll.sat, week.sat, "no comparte referencias con el original");

  const { calls, fn } = recorder();
  const items = resolve(buildScheduleDayMenu(), {
    dayLabel: "Sábado", open: true, otherOpenDays: true, actions: { copyTo: fn("copy"), close: fn("close"), open: fn("open") },
  });
  assert.equal(submenu(items, "copy").label, "Copiar el horario del sábado a");
  await run(action(items, "copy/all"));
  await run(action(items, "close"));
  assert.deepEqual(calls, ['copy "all"', "close"]);

  const closed = resolve(buildScheduleDayMenu(), { dayLabel: "Domingo", open: false, otherOpenDays: true, actions: { copyTo: fn("c"), close: fn("x"), open: fn("o") } });
  assert.deepEqual(ids(closed), ["reopen"]);
});
