import test from "node:test";
import assert from "node:assert/strict";
import { buildInsights } from "../src/components/User/Panel/Stats/statsInsights.ts";
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
