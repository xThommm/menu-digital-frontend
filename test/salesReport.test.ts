import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCashInsights, buildSalesInsights, cashInsightsOf, isSalesReport, niceMax, percentChange, presetRange, rangeError,
  requestReportFile, requestSalesReport, type SalesReport,
} from "../src/components/User/Panel/Stats/salesReport.ts";

const totals = (orders: number, amount: number) => ({
  orders, amount, averageTicket: orders ? amount / orders : 0, discounts: 0,
  cancelledCount: 0, cancelledAmount: 0, returnedCount: 0, returnedAmount: 0,
});
const report = (over: Partial<SalesReport> = {}): SalesReport => ({
  windowDays: 7, todayDate: "2026-09-16", periodStart: "2026-09-09", periodEnd: "2026-09-15",
  previousStart: "2026-09-02", previousEnd: "2026-09-08", observedFrom: null, comparisonAvailable: false,
  totals: totals(10, 100000), previousTotals: totals(8, 50000), today: { orders: 1, amount: 9000 },
  days: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${String(9 + i).padStart(2, "0")}`, orders: i === 3 ? 10 : 0, amount: i === 3 ? 100000 : 0 })),
  previousDays: Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-0${2 + i}`, orders: 0, amount: 0 })),
  byServiceType: [{ key: "table", count: 10, amount: 100000 }], bySource: [], byWaiter: [], byPayment: [],
  hours: Array.from({ length: 24 }, (_, hour) => ({ count: hour === 23 ? 6 : hour === 0 ? 4 : 0, amount: 0 })),
  topProducts: [{ title: "Pizza", option: null, category: null, quantity: 3, amount: 30000 }],
  byCategory: [], averagePrepMinutes: null, averageServiceMinutes: null, cashSessions: [],
  ...over,
});

test("una respuesta de otro período o incompleta no se acepta como reporte", () => {
  assert.equal(isSalesReport(report(), 7), true);
  assert.equal(isSalesReport(report(), 30), false);
  assert.equal(isSalesReport({ ...report(), hours: [] }, 7), false);
  assert.equal(isSalesReport({ ...report(), totals: { orders: 1 } }, 7), false);
  assert.equal(isSalesReport(null, 7), false);
});

test("el pedido de ventas distingue plan, servidor sin reporte y errores", async (t) => {
  const signal = new AbortController().signal;
  for (const [status, kind] of [[401, "unauthorized"], [403, "locked"], [404, "unavailable"], [503, "unavailable"], [500, "error"]] as const) {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    assert.equal((await requestSalesReport(7, null, "t", signal)).kind, kind);
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "/api/orders/reports/sales?days=7");
    return Response.json(report());
  });
  assert.equal((await requestSalesReport(7, null, "t", signal)).kind, "data");
  t.mock.restoreAll();
  // Con filtro: lo pide por query y descarta una respuesta que no venga filtrada.
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "/api/orders/reports/sales?days=7&serviceType=delivery");
    return Response.json(report({ serviceType: "delivery" }));
  });
  assert.equal((await requestSalesReport(7, "delivery", "t", signal)).kind, "data");
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json(report()));
  assert.equal((await requestSalesReport(7, "delivery", "t", signal)).kind, "error");
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ windowDays: 7 }));
  assert.equal((await requestSalesReport(7, null, "t", signal)).kind, "error");
});

test("variaciones, mejor día y franja pico que cruza la medianoche", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(10, 0), null);
  const insights = buildSalesInsights(report());
  assert.equal(insights.amountTrend, 100);
  assert.equal(insights.ordersTrend, 25);
  assert.equal(insights.best?.date, "2026-09-12");
  assert.deepEqual(insights.peak, { start: 22, end: 1, share: 1 });
  assert.equal(buildSalesInsights(report({ totals: totals(0, 0) })).peak, null);
});

test("caja: la diferencia solo suma los cierres con efectivo contado", () => {
  const session = (id: number, difference: number | null) => ({ id, difference, summary: { netAmount: 1000 } });
  const insights = buildCashInsights([session(1, -500), session(2, null), session(3, 200), session(4, 0)] as never);
  assert.deepEqual(insights, { count: 4, netAmount: 4000, counted: 3, difference: -300, shortCount: 1, overCount: 1 });
});

test("caja: usa los totales del servidor y, con un backend anterior, los cierres", () => {
  const result = { closings: 5, netAmount: 9000, countedCount: 4, difference: -700, exactCount: 2, shortCount: 1, shortAmount: -900, overCount: 1, overAmount: 200 };
  const cash = {
    from: "2026-09-09", to: "2026-09-16",
    totals: { ...result, cashSalesAmount: 6000, onlineAmount: 1000, incomeAmount: 0, expenseAmount: 500, withdrawalAmount: 300 },
    byMethod: [{ kind: "cash", label: "Efectivo", count: null, amount: 6000 }],
    movements: [{ type: "expense" as const, typeLabel: "Egreso", category: "supplier", label: "Proveedor", count: 1, amount: 500 }],
    byCashier: [{ name: "Ana", ...result }], byRegister: [{ name: "Caja principal", ...result }],
  };
  assert.deepEqual(cashInsightsOf({ cash, cashSessions: [] }), { count: 5, netAmount: 9000, counted: 4, difference: -700, shortCount: 1, overCount: 1 });
  assert.equal(cashInsightsOf({ cashSessions: [] }).count, 0);
  assert.equal(isSalesReport(report({ cash }), 7), true);
  assert.equal(isSalesReport(report({ cash: { ...cash, byCashier: [{ name: "Ana" }] } as never }), 7), false);
});

test("tope del eje: redondo y apenas por encima del máximo", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(85), 100);
  assert.equal(niceMax(722400), 800000);
  assert.equal(niceMax(2300), 2500);
  assert.equal(niceMax(1000), 1000);
});

test("atajos de período para exportar", () => {
  assert.deepEqual(presetRange("period7", "2026-10-11"), { from: "2026-10-04", to: "2026-10-10" });
  assert.deepEqual(presetRange("period30", "2026-10-11"), { from: "2026-09-11", to: "2026-10-10" });
  assert.deepEqual(presetRange("month", "2026-10-11"), { from: "2026-10-01", to: "2026-10-11" });
  assert.deepEqual(presetRange("lastMonth", "2026-03-15"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(presetRange("lastMonth", "2026-01-05"), { from: "2025-12-01", to: "2025-12-31" });
});

test("rango a exportar: fechas completas, en orden, hasta hoy y de un año como máximo", () => {
  assert.equal(rangeError("2026-10-01", "2026-10-11", "2026-10-11"), null);
  assert.ok(rangeError("", "2026-10-11", "2026-10-11"));
  assert.ok(rangeError("2026-10-11", "2026-10-01", "2026-10-11"));
  assert.ok(rangeError("2026-10-01", "2026-10-12", "2026-10-11"));
  assert.ok(rangeError("2025-10-01", "2026-10-11", "2026-10-11"));
  assert.equal(rangeError("2025-10-11", "2026-10-11", "2026-10-11"), null);
});

test("exportación: arma la consulta y devuelve el mensaje del servidor si falla", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/users/me/reports/export?from=2026-10-01&to=2026-10-11&sheets=ventas%2Ccaja");
    assert.deepEqual(options.headers, { Authorization: "Bearer t" });
    return new Response("xlsx");
  });
  const range = { from: "2026-10-01", to: "2026-10-11" };
  const file = await requestReportFile(range, ["ventas", "caja"], "t");
  assert.equal(file.kind, "file");
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Tu plan no incluye los reportes que elegiste." }, { status: 403 }));
  assert.deepEqual(await requestReportFile(range, ["ventas"], "t"), { kind: "error", message: "Tu plan no incluye los reportes que elegiste." });
});
