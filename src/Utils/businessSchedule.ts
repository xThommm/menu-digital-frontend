import type { DayKey, Schedule } from "../types/index";
import { formatDateAR } from "../lib/dates.ts";

export const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const BUSINESS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Cada rango pertenece al día de apertura. Cierre <= apertura termina al
// día siguiente; horas iguales representan un turno de 24 horas.
// El día y la hora se leen siempre en Buenos Aires.
export function getOpenStatus(schedule?: Schedule, now = new Date()): boolean {
  if (!schedule) return false;
  const dayIndex = getBusinessDayIndex(now);
  const today = schedule[JS_DAY_TO_KEY[dayIndex]];
  const previous = schedule[JS_DAY_TO_KEY[(dayIndex + 6) % 7]];
  const hhmm = formatDateAR(now, { hour: "2-digit", minute: "2-digit" });
  const valid = (day: typeof today) => day?.enabled
    && BUSINESS_TIME_PATTERN.test(day.open) && BUSINESS_TIME_PATTERN.test(day.close);

  if (valid(today) && hhmm >= today.open
    && (today.close <= today.open || hhmm < today.close)) return true;

  return !!(valid(previous) && previous.close <= previous.open && hhmm < previous.close);
}

export function getBusinessDayIndex(now = new Date()): number {
  const day = formatDateAR(now, { output: "date-input" });
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}
