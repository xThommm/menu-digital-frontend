export const TIMEZONE_BA = "America/Argentina/Buenos_Aires";

type DateOptions = Omit<Intl.DateTimeFormatOptions, "timeZone"> & {
  // Solo para campos cuyo contrato representa un día, aunque lleguen como ISO
  // a medianoche UTC (seguimientos y fecha de ingreso de vendedores).
  calendarDate?: boolean;
  output?: "text" | "date-input" | "datetime-input";
  fallback?: string;
};

/** Único formateador de fechas del frontend. No modifica el valor guardado.
 * Los instantes se muestran en Buenos Aires; YYYY-MM-DD conserva su día.
 * Una fecha/hora ISO sin offset se interpreta como hora de Buenos Aires.
 */
export function formatDateAR(
  value: string | number | Date | null | undefined,
  { calendarDate = false, output = "text", fallback = "—", ...options }: DateOptions = {},
): string {
  if (value == null || value === "") return fallback;
  let input = value;
  if (typeof input === "string") {
    if (calendarDate) input = input.slice(0, 10);
    // Rechaza días inexistentes que Date normalizaría al mes siguiente.
    const day = /^\d{4}-\d{2}-\d{2}(?=$|T)/.exec(input)?.[0];
    const calendar = new Date(`${day}T00:00:00Z`);
    if (!day || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return fallback;
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) input += "T00:00:00-03:00";
    else if (/T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(input)) input += "-03:00";
  }
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return fallback;

  if (output !== "text") {
    const parts = new Intl.DateTimeFormat("es-AR", {
      timeZone: TIMEZONE_BA,
      year: "numeric", month: "2-digit", day: "2-digit",
      ...(output === "datetime-input" ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const : {}),
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
    const day = `${values.year}-${values.month}-${values.day}`;
    return output === "date-input" ? day : `${day}T${values.hour}:${values.minute}`;
  }

  return new Intl.DateTimeFormat("es-AR", {
    ...options,
    timeZone: TIMEZONE_BA,
    hourCycle: "h23",
  }).format(date);
}
