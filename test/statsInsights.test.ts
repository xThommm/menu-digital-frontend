import test from "node:test";
import assert from "node:assert/strict";
import { buildAudience, buildHourly, buildInsights, itemTrend, lowConversionItem } from "../src/components/User/Panel/Stats/statsInsights.ts";
import type { StatsData } from "../src/types/index.ts";

function fixture(counts: number[], changes: Partial<StatsData> = {}): StatsData {
  const days = counts.map((count, index) => ({
    date: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10), count,
  }));
  return { windowDays: 30, days, previousDays: [], totalViews: counts.reduce((a, b) => a + b, 0),
    previousTotalViews: 35, todayViews: 1000, todayDate: "2026-10-01",
    periodStart: days[0]?.date ?? "2026-09-01", periodEnd: days.at(-1)?.date ?? "2026-09-30",
    previousStart: "2026-08-02", previousEnd: "2026-08-31", observedFrom: "2026-01-01", comparisonAvailable: true,
    ...changes };
}

test("hoy no modifica el total, promedio ni variación del período cerrado", () => {
  const input = fixture(Array(7).fill(10), { windowDays: 7 });
  const result = buildInsights(input);
  assert.equal(result.today, 1000);
  assert.equal(result.total, 70);
  assert.equal(result.previous, 35);
  assert.equal(result.trend, 100);
  assert.equal(result.dailyAverage, 10);
  assert.equal(buildInsights({ ...input, todayViews: 0 }).trend, 100);
});

test("sin base previa o cuenta reciente no se inventa crecimiento", () => {
  assert.equal(buildInsights(fixture([10], { previousTotalViews: 0 })).trend, null);
  assert.equal(buildInsights(fixture([10], { comparisonAvailable: false })).trend, null);
  assert.equal(buildInsights(null).trend, null);
});

test("una ventana sin visitas contra una con visitas muestra -100%", () => {
  assert.equal(buildInsights(fixture(Array(30).fill(0))).trend, -100);
});

test("el patrón requiere dos observaciones de cada día, incluidos días válidos con cero", () => {
  assert.equal(buildInsights(fixture(Array(13).fill(10))).hasWeekdayPattern, false);
  assert.equal(buildInsights(fixture(Array(14).fill(10))).hasWeekdayPattern, true);
  assert.equal(buildInsights(fixture(Array(14).fill(0))).hasWeekdayPattern, false);
  const counts = Array(14).fill(0); counts[0] = 10;
  assert.equal(buildInsights(fixture(counts)).hasWeekdayPattern, true);
});

test("no usa el día parcial del alta ni ceros anteriores como muestras", () => {
  const result = buildInsights(fixture([...Array(20).fill(0), ...Array(10).fill(10)], { observedFrom: "2026-09-20" }));
  assert.equal(result.averageDays, 10);
  assert.equal(result.dailyAverage, 10);
  assert.equal(result.hasWeekdayPattern, false);
  assert.equal(buildInsights(fixture(Array(30).fill(1), { observedFrom: null })).hasWeekdayPattern, false);
});

const hoursWith = (entries: Record<number, number>) => Array.from({ length: 24 }, (_, hour) => entries[hour] ?? 0);

test("horario pico: franja de 3 horas, cruza la medianoche y exige volumen mínimo", () => {
  const dinner = buildHourly(fixture([10], { hours: hoursWith({ 20: 8, 21: 10, 22: 6, 13: 4, 9: 2 }), hoursFrom: "2026-09-01" }));
  assert.equal(dinner?.total, 30);
  assert.deepEqual(dinner?.peak, { start: 20, end: 23, share: 0.8 });
  assert.equal(dinner?.enough, true);

  const late = buildHourly(fixture([10], { hours: hoursWith({ 23: 10, 0: 9, 1: 8 }) }));
  assert.deepEqual(late?.peak, { start: 23, end: 2, share: 1 });

  assert.equal(buildHourly(fixture([10], { hours: hoursWith({ 20: 5 }) }))?.enough, false);
  assert.equal(buildHourly(fixture([10], { hours: hoursWith({}) }))?.peak, null);
  // Backend anterior: sin horas no hay tarjeta.
  assert.equal(buildHourly(fixture([10])), null);
});

const audienceFixture = (changes: Partial<NonNullable<StatsData["audience"]>> = {}) => fixture([10], {
  audience: { from: "2026-09-10", visits: 200, visitors: 150, returning: 30, qr: 120, engaged: 140, carts: 40, orders: 20, ...changes },
});

test("embudo: proporciones sobre las visitas medidas y pasos de pedido según el plan", () => {
  const withOrders = buildAudience(audienceFixture(), { showOrders: true });
  assert.deepEqual(withOrders?.funnel.map(step => [step.key, step.count, step.rate]), [
    ["visits", 200, 1], ["engaged", 140, 0.7], ["carts", 40, 0.2], ["orders", 20, 0.1],
  ]);
  assert.equal(withOrders?.qrShare, 0.6);
  assert.equal(withOrders?.returningShare, 0.2);

  const noOrders = buildAudience(audienceFixture({ carts: 0, orders: 0 }), { showOrders: false });
  assert.deepEqual(noOrders?.funnel.map(step => step.key), ["visits", "engaged"]);
  // Si igual llegaron pedidos (ej. bajó de plan), se muestran.
  assert.equal(buildAudience(audienceFixture(), { showOrders: false })?.funnel.length, 4);
});

test("embudo: sin visitas medidas no hay tarjeta y nada supera el 100%", () => {
  assert.equal(buildAudience(audienceFixture({ visits: 0 }), { showOrders: true }), null);
  assert.equal(buildAudience(fixture([10]), { showOrders: true }), null);
  const odd = buildAudience(audienceFixture({ visits: 10, engaged: 12, visitors: 0 }), { showOrders: true });
  assert.equal(odd?.funnel[1].rate, 1);
  assert.equal(odd?.returningShare, null);
});

const item = (totalViews: number, previousViews: number, orders?: number) =>
  ({ itemID: `${totalViews}-${previousViews}`, title: `P${totalViews}`, image: "", totalViews, previousViews, orders });

test("variación por producto: nuevo, cambio relevante o nada con base chica", () => {
  assert.deepEqual(itemTrend(item(10, 0), true), { kind: "new" });
  assert.deepEqual(itemTrend(item(15, 10), true), { kind: "change", pct: 50 });
  assert.deepEqual(itemTrend(item(5, 10), true), { kind: "change", pct: -50 });
  assert.equal(itemTrend(item(10, 2), true), null);
  assert.equal(itemTrend(item(105, 100), true), null);
  assert.equal(itemTrend(item(10, 0), false), null);
});

test("mirado pero no pedido: solo con pedidos en uso y volumen suficiente", () => {
  const hint = lowConversionItem([item(40, 0, 1), item(30, 0, 6), item(12, 0, 0), item(8, 0, 0)]);
  assert.equal(hint?.totalViews, 40);
  assert.equal(lowConversionItem([item(40, 0, 0), item(30, 0, 0)]), null);
  assert.equal(lowConversionItem([item(40, 0), item(30, 0)]), null);
  assert.equal(lowConversionItem([item(40, 0, 10), item(9, 0, 0)]), null);
});
