import test from "node:test";
import assert from "node:assert/strict";
import { buildChartMenu, buildRankingItemMenu, buildStatsPageMenu } from "../src/components/User/Panel/Stats/statsMenu.ts";
import { chartFileName, chartSvg } from "../src/components/User/Panel/Stats/chartImage.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

test("fondo: exportar y cambiar de pestaña (la actual, deshabilitada)", async () => {
  const { calls, fn } = recorder();
  const items = resolve(buildStatsPageMenu(), { tab: "sales", actions: { exportExcel: fn("export"), setTab: fn("tab") } });
  assert.deepEqual(ids(items), ["export", "tab-visits", "tab-sales", "tab-cash"]);
  assert.equal(action(items, "tab-sales").disabledReason, "Ya estás en esta pestaña");
  await run(action(items, "tab-cash"));
  await run(action(items, "export"));
  assert.deepEqual(calls, ['tab "cash"', "export"]);
});

test("producto del ranking: abrir en el editor (con ?producto=) y copiar nombre", async () => {
  const { env, log } = fakeEnv();
  const items = resolve(buildRankingItemMenu(env), { item: { itemID: "abc 1", title: "Milanesa napolitana" } });
  await run(action(items, "editor"));
  const copied = await run(action(items, "copy-name"));
  assert.deepEqual(log, ["go:/menu/editor?producto=abc%201", "copy:Milanesa napolitana"]);
  assert.deepEqual(copied.notices, ["ok:Nombre copiado."]);
});

test("gráfico: copiar la barra (solo sobre una), todos los valores y descargar la imagen", async () => {
  const { env, log } = fakeEnv();
  let downloads = 0;
  const actions = { downloadImage: async () => { downloads++; } };
  const table = "Día\tVisitas\nMartes 14/10\t12";
  const onBar = resolve(buildChartMenu(env), { point: "Martes 14/10: 12 visitas", table, actions });
  assert.deepEqual(ids(onBar), ["copy-value", "copy-all", "image"]);
  await run(action(onBar, "copy-value"));
  await run(action(onBar, "copy-all"));
  await run(action(onBar, "image"));
  assert.deepEqual(log, ["copy:Martes 14/10: 12 visitas", `copy:${table}`]);
  assert.equal(downloads, 1);

  const outside = resolve(buildChartMenu(env), { point: null, table, actions });
  assert.deepEqual(ids(outside), ["copy-all", "image"]);
});

test("la imagen del gráfico: una barra por día, eje redondo y textos escapados", () => {
  const svg = chartSvg({
    title: "Ventas <netas> por día",
    subtitle: "1/10 al 3/10",
    points: [{ label: "1/10", value: 30 }, { label: "2/10", value: 0 }, { label: "3/10", value: 70 }],
    formatAxis: value => `$${value}`,
  });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="1200" height="630"/);
  assert.equal((svg.match(/fill="#2f6fed"/g) ?? []).length, 3);
  assert.match(svg, />\$100</);
  assert.match(svg, />\$50</);
  assert.match(svg, /Ventas &lt;netas&gt; por día/);
  assert.doesNotMatch(svg, /<netas>/);
  assert.equal(chartFileName("Visitas por día", new Date("2026-10-14T15:00:00Z")), "visitas-por-dia-2026-10-14.png");
});
