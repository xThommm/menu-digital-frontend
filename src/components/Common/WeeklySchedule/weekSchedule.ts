import type { DayKey, TimeRange } from "../../../types";

// Datos y helpers del editor semanal (WeeklySchedule.tsx) y de su rango de
// fechas (ScheduleDateRange.tsx). Viven acá y no en los componentes para que
// cada archivo .tsx exporte solo su componente (react-refresh).

/** Horario semanal plano, tal como lo guardan el backend y el modelo Item. */
export type WeekRanges = Record<DayKey, TimeRange[]>;

export const WEEK_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_INITIAL: Record<DayKey, string> = {
  mon: "L", tue: "M", wed: "M", thu: "J", fri: "V", sat: "S", sun: "D",
};

export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Lunes", tue: "Martes", wed: "Miércoles", thu: "Jueves",
  fri: "Viernes", sat: "Sábado", sun: "Domingo",
};

export const DAY_SHORT: Record<DayKey, string> = {
  mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom",
};

export const DAY_PRESETS: { label: string; days: DayKey[] }[] = [
  { label: "Todos los días", days: WEEK_DAYS },
  { label: "Lun a Vie", days: ["mon", "tue", "wed", "thu", "fri"] },
  { label: "Fin de semana", days: ["sat", "sun"] },
];

export const DEFAULT_RANGE: TimeRange = { from: "09:00", to: "18:00" };

// Horas iguales son las 24 horas del día, mismo criterio que el backend
// (utils/itemAvailability.js) y que el horario de atención del negocio.
export const ALL_DAY_RANGE: TimeRange = { from: "00:00", to: "00:00" };

export const isAllDay = (range: TimeRange) => range.from === range.to;

export const emptyWeekRanges = (): WeekRanges =>
  WEEK_DAYS.reduce((acc, day) => { acc[day] = []; return acc; }, {} as WeekRanges);

export const cloneRanges = (ranges: TimeRange[]) => ranges.map(range => ({ ...range }));

export const serializeRanges = (ranges: TimeRange[]) =>
  ranges.map(range => `${range.from}-${range.to}`).join("|");

export interface WeekState {
  base: TimeRange[];
  active: DayKey[];
  custom: Partial<Record<DayKey, TimeRange[]>>;
}

/**
 * El horario "general" es el que comparte la mayor cantidad de días activos;
 * el resto quedan como excepciones. Así un horario cargado con la interfaz
 * anterior (uno distinto por día) se abre acá sin perder nada.
 */
export function readWeek(value: WeekRanges): WeekState {
  const active = WEEK_DAYS.filter(day => (value[day] ?? []).length > 0);
  if (active.length === 0) {
    return { base: [{ ...DEFAULT_RANGE }], active: [], custom: {} };
  }

  const groups = new Map<string, DayKey[]>();
  for (const day of active) {
    const key = serializeRanges(value[day]);
    groups.set(key, [...(groups.get(key) ?? []), day]);
  }

  // Las claves se recorren en orden de inserción (orden semanal), así que
  // ante un empate gana el grupo que empieza antes en la semana.
  let baseKey = "";
  let baseDays: DayKey[] = [];
  for (const [key, days] of groups) {
    if (days.length > baseDays.length) { baseKey = key; baseDays = days; }
  }

  const custom: Partial<Record<DayKey, TimeRange[]>> = {};
  for (const day of active) {
    if (serializeRanges(value[day]) !== baseKey) custom[day] = cloneRanges(value[day]);
  }

  return { base: cloneRanges(value[baseDays[0]]), active, custom };
}

export function writeWeek(state: WeekState): WeekRanges {
  return WEEK_DAYS.reduce((acc, day) => {
    acc[day] = state.active.includes(day)
      ? cloneRanges(state.custom[day] ?? state.base)
      : [];
    return acc;
  }, {} as WeekRanges);
}

export function formatRange(range: TimeRange): string {
  if (isAllDay(range)) return "las 24 h";
  return `${range.from} a ${range.to}${range.to < range.from ? " (+1 día)" : ""}`;
}

/**
 * "Lun a Vie · 09:00 a 18:00", agrupando días consecutivos con el mismo
 * horario para que el dueño lea de un vistazo lo que acaba de configurar.
 */
export function describeWeek(value: WeekRanges): string[] {
  const lines: string[] = [];
  let group: { days: DayKey[]; key: string; ranges: TimeRange[] } | null = null;

  const flush = () => {
    if (!group) return;
    const { days, ranges } = group;
    const label = days.length === 1
      ? DAY_SHORT[days[0]]
      : `${DAY_SHORT[days[0]]} a ${DAY_SHORT[days[days.length - 1]]}`;
    lines.push(`${label} · ${ranges.map(formatRange).join(" y ")}`);
    group = null;
  };

  for (const day of WEEK_DAYS) {
    const ranges = value[day] ?? [];
    if (ranges.length === 0) { flush(); continue; }
    const key = serializeRanges(ranges);
    if (group && group.key === key) group.days.push(day);
    else { flush(); group = { days: [day], key, ranges }; }
  }
  flush();
  return lines;
}

// ── Rango de fechas opcional ───────────────────────────────────────────────
// Fechas en formato "YYYY-MM-DD" (input date); el backend las interpreta como
// días completos en el huso de Buenos Aires. Los extremos son independientes:
// solo "desde", solo "hasta", los dos o ninguno.

export interface DateRangeValue {
  from: string;
  to: string;
}

export const EMPTY_DATE_RANGE: DateRangeValue = { from: "", to: "" };

export const hasDateRange = (value?: DateRangeValue | null) =>
  Boolean(value?.from || value?.to);
