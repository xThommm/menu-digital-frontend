import type { ReservationStatus } from "../types";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  rejected: "Sin disponibilidad",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistió",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
});

// "2026-10-12" → "lunes 12 de octubre". La fecha es "de pared" (sin zona
// horaria): se formatea en UTC para que no se corra un día.
export function formatReservationDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export const formatPeople = (count: number) => `${count} ${count === 1 ? "persona" : "personas"}`;

const baFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
});

// Hoy en Buenos Aires ("YYYY-MM-DD"), la zona en que se interpretan las reservas.
export const todayBuenosAires = (now = new Date()) => baFormatter.format(now);

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export const reservationWhen = (date: string, time: string) => `${formatReservationDate(date)} · ${time} hs`;

// Mensaje de WhatsApp para pasarle su código al cliente.
export const codeMessage = (businessName: string, code: string, date: string, time: string) =>
  `Hola! Tu reserva en ${businessName} para el ${formatReservationDate(date)} a las ${time} hs quedó registrada. ` +
  `Tu código de reserva es ${code}: con él podés consultar el estado desde la carta del local.`;
