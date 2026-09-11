import test from "node:test";
import assert from "node:assert/strict";
import { formatDateAR } from "../src/lib/dates.ts";
import { getBusinessDayIndex, getOpenStatus, JS_DAY_TO_KEY } from "../src/Utils/businessSchedule.ts";
import type { Schedule } from "../src/types/index.ts";

test("los instantes UTC se muestran en el día y la hora de Buenos Aires", () => {
  const instant = "2026-09-12T01:30:00.000Z";
  assert.equal(formatDateAR(instant), "11/9/2026");
  assert.equal(formatDateAR(instant, { hour: "2-digit", minute: "2-digit" }), "22:30");
  assert.equal(formatDateAR(instant, { output: "date-input" }), "2026-09-11");
  assert.equal(formatDateAR(instant, { output: "datetime-input" }), "2026-09-11T22:30");
});

test("medianoche y cambio de año se resuelven en Buenos Aires", () => {
  assert.equal(formatDateAR("2027-01-01T02:59:00Z", { output: "date-input" }), "2026-12-31");
  assert.equal(formatDateAR("2027-01-01T03:00:00Z", { output: "datetime-input" }), "2027-01-01T00:00");
});

test("las fechas de calendario conservan el día elegido, incluidos ISO heredados", () => {
  assert.equal(formatDateAR("2026-09-11"), "11/9/2026");
  assert.equal(formatDateAR("2026-09-11T00:00:00.000Z", { calendarDate: true }), "11/9/2026");
  assert.equal(formatDateAR("2026-09-11T00:00:00.000Z", { calendarDate: true, output: "date-input" }), "2026-09-11");
  assert.equal(formatDateAR("2026-09-11", { weekday: "long" }), "viernes");
  // Un instante real a medianoche UTC sí corresponde al día anterior.
  assert.equal(formatDateAR("2026-09-11T00:00:00.000Z"), "10/9/2026");
});

test("los ISO con offset y sin offset no dependen de la zona del equipo", () => {
  assert.equal(formatDateAR("2026-09-11T15:30", { output: "datetime-input" }), "2026-09-11T15:30");
  assert.equal(formatDateAR("2026-09-11T15:30:00-03:00", { output: "datetime-input" }), "2026-09-11T15:30");
  assert.equal(formatDateAR("2026-09-11T15:30:00+02:00", { output: "datetime-input" }), "2026-09-11T10:30");
});

test("valores ausentes o inválidos tienen fallback y no rompen el render", () => {
  for (const value of [null, undefined, "", "no-es-fecha", "2026-13-01", "2026-02-30", "2026-09-11T99:00", new Date(NaN)]) {
    assert.equal(formatDateAR(value), "—");
    assert.equal(formatDateAR(value, { fallback: "" }), "");
  }
  assert.equal(formatDateAR("2028-02-29"), "29/2/2028");
});

test("el formateador acepta Date y timestamps sin modificar el instante", () => {
  const date = new Date("2026-09-11T18:30:00Z");
  const timestamp = date.getTime();
  assert.equal(formatDateAR(date, { output: "datetime-input" }), "2026-09-11T15:30");
  assert.equal(formatDateAR(timestamp, { output: "datetime-input" }), "2026-09-11T15:30");
  assert.equal(date.getTime(), timestamp);
});

test("el día resaltado y el estado del comercio coinciden con Buenos Aires", () => {
  const schedule = Object.fromEntries(JS_DAY_TO_KEY.map(day => [day, {
    enabled: day === "fri", open: "20:00", close: "23:00",
  }])) as Schedule;
  const now = new Date("2026-09-12T00:30:00Z");
  assert.equal(JS_DAY_TO_KEY[getBusinessDayIndex(now)], "fri");
  assert.equal(getOpenStatus(schedule, now), true);
  assert.equal(getOpenStatus(schedule, new Date("2026-09-12T02:00:00Z")), false);
});
