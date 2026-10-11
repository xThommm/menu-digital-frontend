import { formatDateAR } from "../../../../lib/dates.ts";

// Formatos compartidos por las pestañas de Estadísticas.

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

// "entre las 20 y las 23 h", "entre las 23 y la 1 h", "entre las 21 h y la medianoche".
export function hourRange(start: number, end: number) {
  if (end === 0) return `entre las ${start} h y la medianoche`;
  return `entre ${start === 1 ? "la 1" : `las ${start}`} y ${end === 1 ? "la 1" : `las ${end}`} h`;
}

export function formatDay(dateStr?: string) {
  return formatDateAR(dateStr, { day: "numeric", month: "short", fallback: "" });
}

export function formatDayLong(dateStr?: string) {
  return formatDateAR(dateStr, { weekday: "short", day: "numeric", month: "short", fallback: "" });
}

// Un decimal solo cuando aporta: "53" se lee mejor que "53,0".
export function formatDecimal(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

const moneyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const formatMoney = (value: number) => moneyFormatter.format(value);

// Para los ejes: "120 mil", "1,2 M". El valor exacto está en el tooltip y en la tabla.
const compactFormatter = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (value: number) => compactFormatter.format(value);
export const formatCompactMoney = (value: number) => `$ ${compactFormatter.format(value)}`;

export const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
