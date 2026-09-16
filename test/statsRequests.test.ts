import test from "node:test";
import assert from "node:assert/strict";
import { requestStatsData, isStatsData, isItemStatsData } from "../src/components/User/Panel/Stats/statsRequests.ts";

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
