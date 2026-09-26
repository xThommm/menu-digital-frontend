// Analítica de la carta pública: decide qué carga es una visita y qué
// eventos del embudo se mandan. El backend solo suma lo que esto le dice
// (ver utils/menuAnalytics.js del backend):
//   GET /:slug/menu?track=0|1&nv=1&ret=1&src=qr
//   POST /:slug/menu/events { type: "engaged" | "cart" | "order", items? }
//
// Una visita es una sesión: recargar o volver dentro de 30 minutos no suma
// otra. No cuentan el dueño mirando su propia carta, el personal de la
// plataforma ni la vista previa del panel. Todo vive en localStorage del
// dispositivo del cliente, sin cookies ni datos personales.

const SESSION_MS = 30 * 60_000;
// Sin actividad por más de esto, el dispositivo se olvida (y vuelve a ser
// un visitante nuevo): el plazo de las analíticas en la política de
// privacidad (src/pages/Legal/Privacy.tsx).
const RETENTION_MS = 90 * 24 * 60 * 60_000;
// Tope de marcas por sesión (productos abiertos, pedidos mandados).
const SENT_MAX = 200;
const STORAGE_PREFIX = "md:visit:";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface VisitState {
  // Última actividad (ms): la sesión dura mientras no pasen 30 minutos.
  last: number;
  // Primer día y último día (Buenos Aires) en que este dispositivo abrió la carta.
  firstSeen: string;
  lastDay: string;
  // Lo que ya se mandó en esta sesión ("item:<id>", "engaged", "order:<hash>"…).
  sent: string[];
}

export type VisitDecision =
  | { track: false }
  | { track: true; newVisitor: boolean; returning: boolean; qr: boolean };

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Mismo corte de día que el backend (medianoche de Buenos Aires).
export const buenosAiresDay = (now: number) => dayFormatter.format(new Date(now));

// Sin localStorage (bloqueado o lleno) la sesión dura lo que la pestaña.
const memoryStorage = new Map<string, string>();
const memory: KeyValueStorage = {
  getItem: key => memoryStorage.get(key) ?? null,
  setItem: (key, value) => { memoryStorage.set(key, value); },
};

function readState(storage: KeyValueStorage, slug: string): VisitState | null {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_PREFIX + slug) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Record<string, unknown>;
    if (typeof state.last !== "number" || !Number.isFinite(state.last)) return null;
    if (typeof state.firstSeen !== "string" || typeof state.lastDay !== "string") return null;
    const sent = Array.isArray(state.sent) ? state.sent.filter((key): key is string => typeof key === "string") : [];
    return { last: state.last, firstSeen: state.firstSeen, lastDay: state.lastDay, sent };
  } catch {
    return null;
  }
}

function writeState(storage: KeyValueStorage, slug: string, state: VisitState) {
  try {
    storage.setItem(STORAGE_PREFIX + slug, JSON.stringify({ ...state, sent: state.sent.slice(-SENT_MAX) }));
  } catch {
    // Storage lleno o bloqueado: la analítica nunca frena la carta.
  }
}

function defaultStorage(): KeyValueStorage {
  try {
    const probe = "md:visit:probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memory;
  }
}

/**
 * Decide si esta carga de la carta es una visita nueva y actualiza la
 * sesión del dispositivo. `skip` es para el dueño, el personal o la vista
 * previa: no cuenta ni deja rastro.
 */
export function decideVisit(
  slug: string,
  { now = Date.now(), storage = defaultStorage(), skip = false, qr = false }:
    { now?: number; storage?: KeyValueStorage; skip?: boolean; qr?: boolean } = {},
): VisitDecision {
  if (skip) return { track: false };
  const today = buenosAiresDay(now);
  const stored = readState(storage, slug);
  const state = stored && now - stored.last <= RETENTION_MS ? stored : null;

  if (state && now - state.last >= 0 && now - state.last < SESSION_MS) {
    writeState(storage, slug, { ...state, last: now });
    return { track: false };
  }

  const newVisitor = !state || state.lastDay !== today;
  const returning = newVisitor && !!state && state.firstSeen < today;
  writeState(storage, slug, {
    last: now,
    firstSeen: state && state.firstSeen < today ? state.firstSeen : today,
    lastDay: today,
    sent: [],
  });
  return { track: true, newVisitor, returning, qr };
}

/** Parámetros de GET /:slug/menu para la decisión tomada. */
export function visitQuery(decision: VisitDecision): string {
  if (!decision.track) return "track=0";
  const params = new URLSearchParams({ track: "1" });
  if (decision.newVisitor) params.set("nv", "1");
  if (decision.returning) params.set("ret", "1");
  if (decision.qr) params.set("src", "qr");
  return params.toString();
}

/**
 * Marca algo como mandado en la sesión actual. Devuelve true solo la
 * primera vez: con eso cada producto, "abrió un producto" y "armó un
 * pedido" se cuentan una vez por sesión.
 */
export function markOnce(
  slug: string,
  key: string,
  { now = Date.now(), storage = defaultStorage() }: { now?: number; storage?: KeyValueStorage } = {},
): boolean {
  const today = buenosAiresDay(now);
  const state = readState(storage, slug) ?? { last: now, firstSeen: today, lastDay: today, sent: [] };
  if (state.sent.includes(key)) {
    writeState(storage, slug, { ...state, last: Math.max(state.last, now) });
    return false;
  }
  writeState(storage, slug, { ...state, last: Math.max(state.last, now), sent: [...state.sent, key] });
  return true;
}

/**
 * Clave de un pedido para no contarlo dos veces si el cliente vuelve a tocar
 * "Pedir por WhatsApp" con el mismo carrito (o elige otra sucursal).
 */
export function orderKey(lines: { itemId: string; selectedOption?: string; quantity: number }[]): string {
  const text = lines
    .map(line => `${line.itemId}:${line.selectedOption ?? ""}:${line.quantity}`)
    .sort()
    .join("|");
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `order:${hash.toString(36)}`;
}

/**
 * El dueño de esta carta, un admin o un vendedor con la sesión iniciada en
 * este navegador: sus visitas no son de clientes.
 */
export function isStaffViewer(slug: string, storage: KeyValueStorage = defaultStorage()): boolean {
  try {
    if (!storage.getItem("token")) return false;
    const user = JSON.parse(storage.getItem("user") ?? "null") as { role?: unknown; slug?: unknown } | null;
    if (!user || typeof user !== "object") return false;
    if (user.role === "admin" || user.role === "seller") return true;
    return typeof user.slug === "string" && user.slug.toLowerCase() === slug.toLowerCase();
  } catch {
    return false;
  }
}

/** Evento del embudo, fire-and-forget: sobrevive a que el cliente se vaya a WhatsApp. */
export function sendMenuEvent(slug: string, type: "engaged" | "cart" | "order", items?: string[]) {
  fetch(`/api/users/${encodeURIComponent(slug)}/menu/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items ? { type, items } : { type }),
    keepalive: true,
  }).catch(() => {});
}
