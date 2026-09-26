import test from "node:test";
import assert from "node:assert/strict";
import { requestStatsData, isStatsData, isItemStatsData, sanitizeItemStatsData, sanitizeStatsData } from "../src/components/User/Panel/Stats/statsRequests.ts";

test("respuestas incompletas o de otro período no se muestran con etiquetas incorrectas", () => {
  for (const response of [null, {}, { totalViews: 0, last30Days: [] }, { topItems: [], windowDays: 30 }]) {
    assert.equal(isStatsData(response, 7), false);
    assert.equal(isItemStatsData(response, 7), false);
  }
});

test("interpreta 401 y 403 también para el ranking y distingue fallos HTTP", async (t) => {
  for (const [status, kind] of [[401, "unauthorized"], [403, "locked"], [500, "error"], [503, "error"]] as const) {
    t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    assert.equal((await requestStatsData("/api/users/me/item-stats", "test", new AbortController().signal)).kind, kind);
    t.mock.restoreAll();
  }
});

test("cero visitas es un resultado válido; red o JSON inválido son errores", async (t) => {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options?.signal, signal);
    assert.deepEqual(options?.headers, { Authorization: "Bearer test" });
    return Response.json({ totalViews: 0 });
  });
  assert.deepEqual(await requestStatsData("/api/users/me/stats", "test", signal), { kind: "data", data: { totalViews: 0 } });
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("offline"); });
  assert.deepEqual(await requestStatsData("/api/users/me/stats", "test", signal), { kind: "error" });
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => new Response("not-json"));
  assert.deepEqual(await requestStatsData("/api/users/me/stats", "test", signal), { kind: "error" });
});

const period = {
  windowDays: 7, todayDate: "2026-09-16", periodStart: "2026-09-09", periodEnd: "2026-09-15",
  previousStart: "2026-09-02", previousEnd: "2026-09-08", observedFrom: "2026-01-01", comparisonAvailable: true,
} as const;
const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${String(i + 9).padStart(2, "0")}`, count: 1 }));
const base = { ...period, totalViews: 7, previousTotalViews: 0, todayViews: 0, days, previousDays: days };
const audience = { from: "2026-09-10", visits: 5, visitors: 4, returning: 1, qr: 2, engaged: 3, carts: 1, orders: 1 };

test("campos nuevos válidos se conservan; mal formados se descartan sin tirar el resto", () => {
  const hours = Array(24).fill(1);
  const good = sanitizeStatsData({ ...base, hours, hoursFrom: "2026-09-09", audience });
  assert.deepEqual(good.hours, hours);
  assert.equal(good.hoursFrom, "2026-09-09");
  assert.deepEqual(good.audience, audience);

  for (const broken of [
    { hours: Array(23).fill(1), hoursFrom: null },
    { hours: [...Array(23).fill(1), -1], hoursFrom: null },
    { hours: Array(24).fill(1), hoursFrom: "ayer" },
    { audience: { ...audience, qr: "2" } },
    { audience: { ...audience, from: 3 } },
  ]) {
    const result = sanitizeStatsData({ ...base, ...broken } as never);
    assert.ok(isStatsData(result, 7));
    assert.equal(result.totalViews, 7);
    if ("hours" in broken) assert.equal(result.hours, undefined);
    if ("audience" in broken) assert.equal(result.audience, undefined);
  }
  // Backend anterior: nada que sanear.
  assert.deepEqual(sanitizeStatsData(base), base);
});

test("ranking: pedidos inválidos por producto o lista de más pedidos rota se descartan", () => {
  const topItem = { itemID: "1", title: "Flan", image: "", totalViews: 3, previousViews: 1 };
  const good = sanitizeItemStatsData({ ...period, topItems: [{ ...topItem, orders: 2 }], topOrdered: [{ ...topItem, orders: 2 }] });
  assert.equal(good.topItems[0].orders, 2);
  assert.equal(good.topOrdered?.length, 1);
  const broken = sanitizeItemStatsData({ ...period, topItems: [{ ...topItem, orders: -1 }], topOrdered: [{ itemID: 1 }] } as never);
  assert.equal("orders" in broken.topItems[0], false);
  assert.equal(broken.topOrdered, undefined);
});
