import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCashPageMenu, buildClosedCashMenu, buildClosedShiftMenu, buildOpenCashMenu, buildShiftMenu,
} from "../src/features/orders/components/panel/cashMenu.ts";
import { cashCloseHtml } from "../src/features/orders/lib/print/cashClose.ts";
import { cashCloseFileName } from "../src/features/orders/lib/download.ts";
import type { CashSession, Shift } from "../src/features/orders/types.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

const session = (overrides: Partial<CashSession> = {}): CashSession => ({
  id: 9, registerId: 1, registerName: "Barra <1>", shiftId: 1, cashierId: null, cashierName: "Ana", openingAmount: 5000,
  openedAt: "2026-10-14T12:00:00Z", openedByName: "Lucas", closedAt: "2026-10-14T23:30:00Z", closedByName: "Lucas",
  cashCounted: 18250, difference: -250, cashWithdrawn: 15000, cashLeft: 3250, closingNotes: "Faltó cambio",
  summary: {
    ordersCount: 12, salesCount: 11, salesAmount: 20000, cancelledCount: 1, cancelledAmount: 1500, returnedCount: 0,
    returnedAmount: 0, discountsAmount: 500, netAmount: 19500, onlineAmount: 3000, cashSalesAmount: 14000, incomeAmount: 0,
    expenseAmount: 500, withdrawalAmount: 0, expectedCash: 18500,
    paymentsBreakdown: [{ method: "Débito", kind: "debit", count: 2, amount: 2500 }], pendingCount: 0,
  },
  ...overrides,
});

const shift = { id: 4, label: "Noche 14/10" } as Shift;

test("caja abierta: cajero y fondo, movimientos, exportar, imprimir y cerrar (abre el arqueo)", async () => {
  const { calls, fn } = recorder();
  const items = resolve(buildOpenCashMenu(), {
    session: session({ closedAt: null }),
    actions: { editCashier: fn("cashier"), showPanel: fn("panel"), exportExcel: async () => { calls.push("export"); }, print: fn("print") },
  });
  assert.deepEqual(ids(items), ["cashier", "movement", "ledger", "export", "print", "close"]);
  const exported = await run(action(items, "export"));
  assert.deepEqual(exported.notices, ["ok:Excel descargado."]);
  await run(action(items, "close"));
  assert.deepEqual(calls, ["export", 'panel "close"']);
});

test("turno: abrir sin turno; cerrar confirma y no cierra la caja", async () => {
  const { calls, fn } = recorder();
  const actions = { open: async () => { calls.push("open"); }, close: async () => { calls.push("close"); }, showOrders: fn("orders") };
  assert.deepEqual(ids(resolve(buildShiftMenu(), { shift: null, busy: false, actions })), ["open"]);

  const open = resolve(buildShiftMenu(), { shift, busy: false, actions });
  assert.deepEqual(ids(open), ["orders", "close"]);
  const close = action(open, "close");
  assert.equal(close.confirm?.title, "¿Cerrar el turno Noche 14/10?");
  assert.match(close.confirm?.message ?? "", /no cierra la caja/);
  assert.equal((await run(close, { accept: false })).outcome, "cancelled");
  await run(close);
  assert.deepEqual(calls, ["close"]);
});

test("historial: detalle, exportar e imprimir el cierre; resumen y pedidos de un turno", async () => {
  const { calls, fn } = recorder();
  const closed = resolve(buildClosedCashMenu(), {
    session: session(), actions: { showDetail: fn("detail"), exportExcel: async () => { calls.push("export"); }, print: fn("print") },
  });
  assert.deepEqual(ids(closed), ["detail", "export", "print"]);
  assert.equal(action(closed, "export").label, "Exportar cierre a Excel");

  const { env, log } = fakeEnv();
  const shiftRow = resolve(buildClosedShiftMenu(env), { shift, actions: { showSummary: fn("summary") } });
  await run(action(shiftRow, "orders"));
  assert.deepEqual(log, ["go:/pedidos/historial?turno=4"]);

  const page = resolve(buildCashPageMenu(), { actions: { addRegister: fn("add") } });
  await run(action(page, "add-register"));
  assert.ok(calls.includes("add"));
});

test("el cierre impreso trae el arqueo y escapa lo que carga el usuario", () => {
  const html = cashCloseHtml(session(), "Lo de Lucas");
  assert.match(html, /<title>Cierre de Barra &lt;1&gt;<\/title>/);
  assert.match(html, /Esperado en el cajón/);
  assert.match(html, /Débito \(2\)/);
  assert.match(html, /Faltó cambio/);
  assert.doesNotMatch(html, /Barra <1>/);
  assert.equal(cashCloseFileName("Barra Principal", "2026-10-15T02:00:00Z"), "cierre-barra-principal-2026-10-14.xlsx");
});
