import type { DayKey, ItemOfferSchedule, PublicMenuItem, TimeRange } from "../types";
import { formatDateAR } from "./dates.ts";

// Espejo de utils/offers.js + utils/itemAvailability.js del backend.
// Con el contrato v2 de la carta el servidor ya resuelve la oferta: manda
// offerPrice (junto con price) solo si rige ahora y NO manda offerRange ni
// offerSchedule; sin ellos, este cálculo la da por vigente. Con la respuesta
// legacy sí llegan y la carta puede quedar abierta cruzando el borde de un
// horario, así que el front vuelve a resolverla con los mismos datos.

// Lo único que mira isOfferActive: alcanza con un Item completo (editor) o
// con un PublicMenuItem (carta pública, donde offerRange/offerSchedule
// pueden faltar).
type OfferFields = Pick<PublicMenuItem, "price" | "offerPrice" | "offerRange" | "offerSchedule">

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (time: string): number | null => {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

function isWithinDateRange(
  range: { from?: string | null; to?: string | null } | null | undefined,
  now: number,
): boolean {
  const from = range?.from ? new Date(range.from).getTime() : null;
  const to = range?.to ? new Date(range.to).getTime() : null;
  if (from !== null && Number.isFinite(from) && now < from) return false;
  if (to !== null && Number.isFinite(to) && now > to) return false;
  return true;
}

// El día y la hora se leen siempre en Buenos Aires, igual que
// Utils/businessSchedule.ts y que el backend.
function buenosAiresParts(now: number) {
  const date = new Date(now);
  const day = formatDateAR(date, { output: "date-input" });
  const jsDay = new Date(`${day}T00:00:00Z`).getUTCDay();
  const [hours, minutes] = formatDateAR(date, { hour: "2-digit", minute: "2-digit" })
    .split(":")
    .map(Number);
  // getUTCDay() arranca en domingo; DAY_KEYS arranca en lunes.
  return { dayIndex: (jsDay + 6) % 7, minutes: hours * 60 + minutes };
}

export function isScheduleActiveAt(
  schedule: { enabled: boolean } & Partial<Record<DayKey, TimeRange[]>> | null | undefined,
  now: number,
): boolean {
  if (!schedule?.enabled) return true;

  const { dayIndex, minutes } = buenosAiresParts(now);
  const today = schedule[DAY_KEYS[dayIndex]] ?? [];
  const previousDay = schedule[DAY_KEYS[(dayIndex + 6) % 7]] ?? [];

  const inside = (ranges: TimeRange[], overnightOnly: boolean) =>
    ranges.some(({ from, to }) => {
      const start = toMinutes(from);
      const end = toMinutes(to);
      if (start === null || end === null) return false;
      // Horas iguales son las 24 horas del día a partir de `from`.
      if (overnightOnly) return end <= start && minutes < end;
      return end > start ? minutes >= start && minutes < end : minutes >= start;
    });

  return inside(today, false) || inside(previousDay, true);
}

export function isOfferActive(item: OfferFields, now = Date.now()): boolean {
  if (item.offerPrice == null || item.price == null) return false;
  if (!isWithinDateRange(item.offerRange, now)) return false;
  return isScheduleActiveAt(item.offerSchedule as ItemOfferSchedule | undefined, now);
}
