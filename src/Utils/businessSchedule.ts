import type { DayHours, DayKey, Schedule, TimeRange } from "../types/index";
import { formatDateAR } from "../lib/dates.ts";
import { isScheduleActiveAt } from "../lib/offers.ts";

export const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const BUSINESS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Turnos de un día. Los horarios guardados antes de los turnos cortados solo
// tienen open/close, que se leen como un único turno.
export function getDayRanges(day?: DayHours): TimeRange[] {
  if (!day?.enabled) return [];
  if (day.ranges?.length) return day.ranges;
  return [{ from: day.open, to: day.close }];
}

// Cada turno pertenece al día de apertura. Cierre <= apertura termina al
// día siguiente; horas iguales representan un turno de 24 horas. Mismas
// reglas que la programación de ofertas y productos (lib/offers.ts); el día
// y la hora se leen siempre en Buenos Aires.
export function getOpenStatus(schedule?: Schedule, now = new Date()): boolean {
  if (!schedule) return false;
  const week = Object.fromEntries(
    JS_DAY_TO_KEY.map(day => [day, getDayRanges(schedule[day])]),
  ) as Record<DayKey, TimeRange[]>;
  return isScheduleActiveAt({ enabled: true, ...week }, now.getTime());
}

export function getBusinessDayIndex(now = new Date()): number {
  const day = formatDateAR(now, { output: "date-input" });
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}
