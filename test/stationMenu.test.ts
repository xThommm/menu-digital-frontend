import test from "node:test";
import assert from "node:assert/strict";
import { buildStationBoardMenu, buildTicketMenu, type StationBoardMenuContext } from "../src/features/orders/components/station/stationMenu.ts";
import type { Ticket, TicketStatus } from "../src/features/orders/types.ts";
import { action, ids, resolve, run } from "./support/menu.ts";

const ticket = (status: TicketStatus, printedAt: string | null = null) => ({ id: 1, status, printedAt, printCount: printedAt ? 1 : 0 }) as Ticket;

function ticketContext(status: TicketStatus, { printedAt = null as string | null, canPrint = true, busy = false } = {}) {
  const calls: string[] = [];
  return {
    calls,
    context: {
      ticket: ticket(status, printedAt), busy, canPrint,
      actions: { setStatus: async (next: TicketStatus) => { calls.push(next); }, print: async () => { calls.push("print"); } },
    },
  };
}

test("comanda: nueva → preparando / lista / imprimir; en preparación → volver a nuevas; lista → deshacer", async () => {
  const fresh = ticketContext("new");
  const items = resolve(buildTicketMenu(), fresh.context);
  assert.deepEqual(ids(items), ["preparing", "done", "print"]);
  assert.equal(action(items, "print").label, "Imprimir");
  await run(action(items, "preparing"));
  await run(action(items, "print"));
  assert.deepEqual(fresh.calls, ["preparing", "print"]);

  const preparing = resolve(buildTicketMenu(), ticketContext("preparing", { printedAt: "2026-10-14T12:00:00Z" }).context);
  assert.deepEqual(ids(preparing), ["done", "back-to-new", "print"]);
  assert.equal(action(preparing, "print").label, "Reimprimir");

  const done = ticketContext("done");
  const doneItems = resolve(buildTicketMenu(), done.context);
  assert.deepEqual(ids(doneItems), ["undo"]);
  await run(action(doneItems, "undo"));
  assert.deepEqual(done.calls, ["preparing"]);

  const noPrinter = resolve(buildTicketMenu(), ticketContext("new", { canPrint: false, busy: true }).context);
  assert.ok(!ids(noPrinter).includes("print"));
  assert.equal(action(noPrinter, "done").disabled, true);
});

function boardContext(overrides: Partial<StationBoardMenuContext> = {}) {
  const calls: string[] = [];
  const context: StationBoardMenuContext = {
    sound: true, autoPrint: null, canConnectPrinter: false, fullscreen: { available: true, active: false }, paired: true,
    actions: {
      toggleSound: () => { calls.push("sound"); },
      toggleAutoPrint: () => { calls.push("auto"); },
      connectPrinter: async () => { calls.push("printer"); },
      toggleFullscreen: () => { calls.push("fullscreen"); },
      unpair: async () => { calls.push("unpair"); },
    },
    ...overrides,
  };
  return { calls, context };
}

test("fondo: sonido, impresión, comandera, pantalla completa y desvincular (confirma)", async () => {
  const { calls, context } = boardContext();
  const items = resolve(buildStationBoardMenu(), context);
  assert.deepEqual(ids(items), ["mute", "fullscreen", "unpair"]);
  const unpair = action(items, "unpair");
  assert.equal(unpair.confirm?.title, "¿Desvincular este equipo?");
  assert.equal((await run(unpair, { accept: false })).outcome, "cancelled");
  await run(unpair);
  assert.deepEqual(calls, ["unpair"]);

  const printing = resolve(buildStationBoardMenu(), boardContext({
    sound: false, autoPrint: true, canConnectPrinter: true, fullscreen: { available: true, active: true }, paired: false,
  }).context);
  assert.deepEqual(ids(printing), ["unmute", "auto-print", "printer", "exit-fullscreen"]);
  assert.equal(action(printing, "auto-print").label, "Pasar a impresión manual");
});
