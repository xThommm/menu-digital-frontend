import test from "node:test";
import assert from "node:assert/strict";
import {
  describeWeek,
  emptyWeekRanges,
  readWeek,
  writeWeek,
} from "../src/components/Common/WeeklySchedule/weekSchedule.ts";
import type { WeekRanges } from "../src/components/Common/WeeklySchedule/weekSchedule.ts";

const buildWeek = (days: Partial<WeekRanges>): WeekRanges => ({ ...emptyWeekRanges(), ...days });

test("el horario general es el que comparten más días activos", () => {
  const state = readWeek(buildWeek({
    mon: [{ from: "09:00", to: "18:00" }],
    tue: [{ from: "09:00", to: "18:00" }],
    wed: [{ from: "09:00", to: "18:00" }],
    sat: [{ from: "10:00", to: "14:00" }],
  }));

  assert.deepEqual(state.base, [{ from: "09:00", to: "18:00" }]);
  assert.deepEqual(state.active, ["mon", "tue", "wed", "sat"]);
  assert.deepEqual(Object.keys(state.custom), ["sat"]);
});

test("un horario distinto por día se abre sin perder ninguno", () => {
  const original = buildWeek({
    mon: [{ from: "09:00", to: "13:00" }],
    tue: [{ from: "10:00", to: "14:00" }],
    wed: [{ from: "11:00", to: "15:00" }],
  });

  assert.deepEqual(writeWeek(readWeek(original)), original);
});

test("varios turnos el mismo día viajan enteros", () => {
  const original = buildWeek({
    fri: [{ from: "12:00", to: "15:00" }, { from: "20:00", to: "23:30" }],
    sat: [{ from: "12:00", to: "15:00" }, { from: "20:00", to: "23:30" }],
  });

  const state = readWeek(original);
  assert.equal(state.base.length, 2);
  assert.deepEqual(state.custom, {});
  assert.deepEqual(writeWeek(state), original);
});

test("una semana vacía propone un horario por defecto sin días prendidos", () => {
  const state = readWeek(emptyWeekRanges());

  assert.deepEqual(state.active, []);
  assert.equal(state.base.length, 1);
  assert.deepEqual(writeWeek(state), emptyWeekRanges());
});

test("el resumen agrupa días consecutivos con el mismo horario", () => {
  assert.deepEqual(
    describeWeek(buildWeek({
      mon: [{ from: "09:00", to: "18:00" }],
      tue: [{ from: "09:00", to: "18:00" }],
      wed: [{ from: "09:00", to: "18:00" }],
      thu: [{ from: "09:00", to: "18:00" }],
      fri: [{ from: "09:00", to: "18:00" }],
      sat: [{ from: "10:00", to: "14:00" }],
    })),
    ["Lun a Vie · 09:00 a 18:00", "Sáb · 10:00 a 14:00"],
  );
});

test("el resumen distingue las 24 horas y los cierres del día siguiente", () => {
  assert.deepEqual(
    describeWeek(buildWeek({
      mon: [{ from: "00:00", to: "00:00" }],
      fri: [{ from: "20:00", to: "02:00" }],
    })),
    ["Lun · las 24 h", "Vie · 20:00 a 02:00 (+1 día)"],
  );
});
