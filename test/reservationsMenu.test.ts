import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReservationMenu, buildReservationsPageMenu, reservationSummary, type ReservationMenuActions,
} from "../src/features/reservations/components/panel/reservationsMenu.ts";
import type { OwnerReservation } from "../src/features/reservations/types.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

const reservation = (overrides: Partial<OwnerReservation> = {}): OwnerReservation => ({
  id: 7, code: "AB12", name: "Ana", phone: "1123456789", partySize: 4, date: "2026-10-20", time: "21:00", status: "pending",
  source: "web", tableLabel: null, altDate: null, altTime: null, message: null, notes: null, internalNotes: null,
  createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z", ...overrides,
});

function menu(target: OwnerReservation, busy = false) {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions: ReservationMenuActions = {
    confirm: fn("confirm"), reject: fn("reject"), cancel: fn("cancel"), noShow: fn("no-show"),
    complete: async (r) => { calls.push(`complete #${r.id}`); },
    reopen: async (r) => { calls.push(`reopen #${r.id}`); },
  };
  return { items: resolve(buildReservationMenu(env), { reservation: target, busy, actions }), calls, log };
}

const stateActions = (target: OwnerReservation) =>
  ids(menu(target).items).filter((id) => !["whatsapp", "copy", "copy/phone", "copy/code", "copy/summary"].includes(id));

test("cada estado ofrece lo mismo que sus botones (y volver a pendiente en los cierres del local)", () => {
  assert.deepEqual(stateActions(reservation({ status: "pending" })), ["confirm", "reject", "cancel"]);
  assert.deepEqual(stateActions(reservation({ status: "confirmed" })), ["complete", "no-show", "reject", "cancel"]);
  assert.deepEqual(stateActions(reservation({ status: "rejected" })), ["reopen", "cancel"]);
  assert.deepEqual(stateActions(reservation({ status: "completed" })), ["reopen"]);
  assert.deepEqual(stateActions(reservation({ status: "no_show" })), ["reopen"]);
  assert.deepEqual(stateActions(reservation({ status: "cancelled" })), []);
  assert.equal(action(menu(reservation({ status: "confirmed" })).items, "reject").label, "Cambiar horario…");
});

test("cancelar, confirmar y no asistió abren su modal; volver a pendiente confirma solo si estaba cerrada", async () => {
  const pending = menu(reservation());
  await run(action(pending.items, "cancel"));
  await run(action(pending.items, "confirm"));
  assert.deepEqual(pending.calls, ["cancel #7", "confirm #7"]);
  assert.equal(action(pending.items, "cancel").danger, true);

  const closed = menu(reservation({ status: "no_show" }));
  const reopen = action(closed.items, "reopen");
  assert.match(reopen.confirm?.title ?? "", /Volver a pendiente/);
  assert.equal((await run(reopen, { accept: false })).outcome, "cancelled");
  assert.deepEqual(closed.calls, []);
  const done = await run(reopen);
  assert.deepEqual(done.notices, ["ok:La reserva volvió a pendiente."]);

  assert.equal(action(menu(reservation({ status: "rejected" })).items, "reopen").confirm, null);
  assert.equal(action(menu(reservation({ status: "confirmed" }), true).items, "complete").disabled, true);
});

test("WhatsApp con un saludo y copiar teléfono, código o los datos", async () => {
  const { items, log } = menu(reservation({ tableLabel: "Mesa 4", notes: "Cumpleaños" }));
  await run(action(items, "whatsapp"));
  await run(action(items, "copy/summary"));
  assert.match(log[0], /^open:https:\/\/wa\.me\/.+text=/);
  assert.equal(log[1], `copy:${reservationSummary(reservation({ tableLabel: "Mesa 4", notes: "Cumpleaños" }))}`);
  assert.match(log[1], /Reserva AB12 · Pendiente/);
  assert.match(log[1], /Mesa: Mesa 4/);

  assert.ok(!ids(menu(reservation({ phone: null })).items).includes("whatsapp"));
});

test("fondo: nueva reserva, vistas, filtros y configuración", async () => {
  const { calls, fn } = recorder();
  const items = resolve(buildReservationsPageMenu(), {
    view: "kanban", activeFilters: 2,
    actions: { create: fn("create"), setView: fn("view"), clearFilters: fn("clear"), openSettings: fn("settings") },
  });
  assert.equal(action(items, "kanban").disabled, true);
  await run(action(items, "clear"));
  await run(action(items, "settings"));
  assert.deepEqual(calls, ["clear", "settings"]);
});
