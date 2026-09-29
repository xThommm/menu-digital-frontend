import type { CustomerOrderReceipt, VenueContext } from "../types";
import { isObject, readJson, removeKey, writeJson } from "./storage";

// ── Sesión "en el local" ─────────────────────────────────────────────────────
// Al escanear el QR de la mesa (o el general) la carta abre con ?mesa=<token>.
// Se guarda el token y el contexto validado por el backend para que una
// recarga o volver a la carta desde la landing siga contando como "en el
// local". Vence solo: pasado este plazo hay que volver a escanear.
const VENUE_TTL_MS = 4 * 60 * 60_000;
const venueKey = (slug: string) => `md:venue:${slug}`;

export type InVenueContext = Extract<VenueContext, { inVenue: true }>;

export interface VenueSession {
  token: string;
  context: InVenueContext;
  expiresAt: number;
}

const isVenueSession = (value: unknown): value is VenueSession =>
  isObject(value)
  && typeof value.token === "string"
  && typeof value.expiresAt === "number"
  && isObject(value.context)
  && value.context.inVenue === true;

export function readVenueSession(slug: string, now = Date.now()): VenueSession | null {
  const session = readJson(venueKey(slug), isVenueSession);
  if (!session) return null;
  if (session.expiresAt <= now) {
    removeKey(venueKey(slug));
    return null;
  }
  return session;
}

export function saveVenueSession(slug: string, token: string, context: InVenueContext) {
  writeJson(venueKey(slug), { token, context, expiresAt: Date.now() + VENUE_TTL_MS });
}

export function clearVenueSession(slug: string) {
  removeKey(venueKey(slug));
}

// Mesa que eligió el comensal con un QR general (para no preguntarla de nuevo).
const tableKey = (slug: string) => `md:venue-table:${slug}`;
export const readChosenTable = (slug: string): number | null =>
  readJson(tableKey(slug), (value): value is number => Number.isSafeInteger(value) && (value as number) > 0);
export const saveChosenTable = (slug: string, table: number) => writeJson(tableKey(slug), table);

// ── Historial de pedidos del comensal ────────────────────────────────────────
// Solo en su navegador (si el local lo permite): qué pidió, cuándo y a qué mesa.
const HISTORY_MAX = 30;
const HISTORY_TTL_MS = 30 * 24 * 60 * 60_000;
const historyKey = (slug: string) => `md:orders:${slug}`;

const isReceiptList = (value: unknown): value is CustomerOrderReceipt[] =>
  Array.isArray(value) && value.every(entry => isObject(entry) && typeof entry.createdAt === "string" && Array.isArray(entry.items));

export function readOrderHistory(slug: string, now = Date.now()): CustomerOrderReceipt[] {
  return (readJson(historyKey(slug), isReceiptList) ?? [])
    .filter(entry => now - new Date(entry.createdAt).getTime() < HISTORY_TTL_MS);
}

export function appendOrderHistory(slug: string, receipt: CustomerOrderReceipt) {
  const next = [receipt, ...readOrderHistory(slug)].slice(0, HISTORY_MAX);
  writeJson(historyKey(slug), next);
  return next;
}

export function clearOrderHistory(slug: string) {
  removeKey(historyKey(slug));
}
