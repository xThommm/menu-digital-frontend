import test from "node:test";
import assert from "node:assert/strict";
import { getOpenStatus, BUSINESS_TIME_PATTERN, JS_DAY_TO_KEY } from "../src/Utils/businessSchedule.ts";
import type { Schedule } from "../src/types/index.ts";

const closedWeek = (): Schedule => Object.fromEntries(
  JS_DAY_TO_KEY.map(day => [day, { enabled: false, open: "09:00", close: "18:00" }]),
) as Schedule;
const at = (day: number, hour: number, minute = 0) => new Date(
  `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`,
);

test("viernes 15:30 a 01:00 sigue abierto el sábado aunque ese día esté deshabilitado", () => {
  const schedule = closedWeek();
  schedule.fri = { enabled: true, open: "15:30", close: "01:00" };
  for (const [date, expected] of [
    [at(11, 0, 30), false], [at(11, 15, 29), false], [at(11, 15, 30), true],
    [at(11, 23, 59), true], [at(12, 0), true], [at(12, 0, 59), true],
    [at(12, 1), false], [at(12, 15, 30), false],
  ] as const) assert.equal(getOpenStatus(schedule, date), expected, date.toString());
});

test("el turno del domingo continúa el lunes y puede cerrar a medianoche", () => {
  const schedule = closedWeek();
  schedule.sun = { enabled: true, open: "20:00", close: "02:00" };
  assert.equal(getOpenStatus(schedule, at(14, 1)), true);
  assert.equal(getOpenStatus(schedule, at(14, 2)), false);
  schedule.sun.close = "00:00";
  assert.equal(getOpenStatus(schedule, at(13, 23, 59)), true);
  assert.equal(getOpenStatus(schedule, at(14, 0)), false);
});

test("24 horas cubre exactamente desde la apertura hasta la misma hora siguiente", () => {
  const schedule = closedWeek();
  schedule.fri = { enabled: true, open: "00:00", close: "00:00" };
  assert.equal(getOpenStatus(schedule, at(11, 0)), true);
  assert.equal(getOpenStatus(schedule, at(11, 23, 59)), true);
  assert.equal(getOpenStatus(schedule, at(12, 0)), false);
  schedule.fri.open = schedule.fri.close = "09:00";
  assert.equal(getOpenStatus(schedule, at(11, 8, 59)), false);
  assert.equal(getOpenStatus(schedule, at(11, 9)), true);
  assert.equal(getOpenStatus(schedule, at(12, 8, 59)), true);
  assert.equal(getOpenStatus(schedule, at(12, 9)), false);
});

test("horarios diurnos, días cerrados y datos ausentes conservan su comportamiento", () => {
  const schedule = closedWeek();
  assert.equal(getOpenStatus(undefined, at(11, 12)), false);
  assert.equal(getOpenStatus(schedule, at(11, 12)), false);
  schedule.fri.enabled = true;
  assert.equal(getOpenStatus(schedule, at(11, 9)), true);
  assert.equal(getOpenStatus(schedule, at(11, 18)), false);
  schedule.fri.open = "";
  assert.equal(getOpenStatus(schedule, at(11, 12)), false);
});

test("la validación mantiene HH:mm y rechaza horas incompletas o fuera de rango", () => {
  for (const value of ["", "01", "24:00", "15:60", "9:00"]) {
    assert.equal(BUSINESS_TIME_PATTERN.test(value), false, value);
  }
  for (const value of ["00:00", "01:00", "15:30", "23:59"]) {
    assert.equal(BUSINESS_TIME_PATTERN.test(value), true, value);
  }
});
