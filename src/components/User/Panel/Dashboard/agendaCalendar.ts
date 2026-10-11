import { addDays } from "../../../../features/reservations/lib/format";

// Fechas "de pared" (YYYY-MM-DD) para el calendario de la agenda. Se calculan
// en UTC para que la zona del navegador no corra ningún día.

const toDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// Lunes de la semana de `date`.
export function startOfWeek(date: string): string {
  const weekday = (toDate(date).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(date, -weekday);
}

export const weekDays = (date: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index));

// "2026-10" → las 6 semanas (42 días, de lunes a domingo) que cubren el mes.
export function monthGrid(month: string): string[] {
  const first = startOfWeek(`${month}-01`);
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function addMonths(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
}

const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

// "2026-10" → "octubre 2026"
export const formatMonth = (month: string) => monthFormatter.format(toDate(`${month}-01`)).replace(" de ", " ");

export const dayOfMonth = (date: string) => Number(date.slice(8, 10));

// Límites de un día de Buenos Aires (UTC-3, sin horario de verano) para
// consultar pedidos por `created_at`.
export const dayRangeBuenosAires = (date: string) => ({
  from: `${date}T00:00:00-03:00`,
  to: `${addDays(date, 1)}T00:00:00-03:00`,
});
