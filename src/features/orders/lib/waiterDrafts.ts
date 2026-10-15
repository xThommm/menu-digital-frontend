import type { TableDraft } from "./quickPick.ts";
import { isObject, readJson, removeKey, writeJson } from "./storage.ts";

// Lo cargado en cada mesa y todavía sin enviar, guardado en el dispositivo del
// operador por local: sobrevive a una recarga, a salir de la app con "atrás"
// o a que el celular cierre la pestaña. Lo de hace más de DRAFT_TTL_MS se
// descarta (el turno de ayer no vuelve a aparecer).

export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export interface StoredDraft extends TableDraft {
  savedAt: number;
}

export type StoredDrafts = Record<number, StoredDraft>;

const key = (slug: string) => `md:waiter-drafts:${slug}`;

const isLine = (value: unknown) =>
  isObject(value)
  && typeof value.itemId === "string"
  && typeof value.title === "string"
  && typeof value.unitPrice === "number"
  && typeof value.quantity === "number" && value.quantity >= 1
  && Array.isArray(value.unitNotes) && value.unitNotes.every(note => typeof note === "string")
  && (value.option === undefined || typeof value.option === "string");

const isDraft = (value: unknown): value is StoredDraft =>
  isObject(value)
  && typeof value.savedAt === "number"
  && typeof value.notes === "string"
  && Array.isArray(value.lines) && value.lines.every(isLine);

// Se queda con las mesas válidas y vigentes; lo roto o viejo se ignora.
export function parseDrafts(value: unknown, now = Date.now()): StoredDrafts {
  if (!isObject(value)) return {};
  const result: StoredDrafts = {};
  for (const [table, draft] of Object.entries(value)) {
    const tableNumber = Number(table);
    if (!Number.isInteger(tableNumber) || tableNumber < 1) continue;
    if (!isDraft(draft) || now - draft.savedAt > DRAFT_TTL_MS) continue;
    if (draft.lines.length === 0 && !draft.notes) continue;
    result[tableNumber] = draft;
  }
  return result;
}

export const readDrafts = (slug: string, now = Date.now()) =>
  parseDrafts(readJson(key(slug), (value): value is unknown => isObject(value)), now);

export function saveDrafts(slug: string, drafts: StoredDrafts) {
  if (Object.keys(drafts).length === 0) removeKey(key(slug));
  else writeJson(key(slug), drafts);
}
