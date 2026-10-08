// Código de reserva del cliente en SU navegador (sin cuenta): al volver a
// abrir la landing, con ese código se consulta el estado. localStorage "a
// prueba de todo": modo privado o cuota llena se comportan como vacío.

const key = (slug: string) => `md:reservation:${slug}`;

// "ABCD-EFGH" (o "abcd efgh") → "ABCD-EFGH". null si no tiene la forma de un código.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeCode(value: string): string | null {
  const clean = value.toUpperCase().replace(/[\s-]/g, "");
  if (clean.length !== 8 || [...clean].some(char => !ALPHABET.includes(char))) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function readReservationCode(slug: string): string | null {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? normalizeCode(raw) : null;
  } catch {
    return null;
  }
}

export function saveReservationCode(slug: string, code: string) {
  try {
    localStorage.setItem(key(slug), code);
  } catch {
    // Sin almacenamiento: queda en memoria mientras la pestaña esté abierta.
  }
}

export function clearReservationCode(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    // idem
  }
}

// ── Historial de reservas de este dispositivo ──
// Cada código que se crea o consulta queda guardado (las más nuevas primero)
// para poder ver las reservas anteriores aunque ya no haya una activa.
const HISTORY_MAX = 15;
const historyKey = (slug: string) => `md:reservation-history:${slug}`;

export function readReservationHistory(slug: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(historyKey(slug)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(value => (typeof value === "string" ? [normalizeCode(value)] : [])).filter((code): code is string => !!code);
  } catch {
    return [];
  }
}

function writeHistory(slug: string, codes: string[]) {
  try {
    localStorage.setItem(historyKey(slug), JSON.stringify(codes));
  } catch {
    // Sin almacenamiento: se pierde el historial, no la reserva.
  }
}

export function addToReservationHistory(slug: string, code: string): string[] {
  const next = [code, ...readReservationHistory(slug).filter(existing => existing !== code)].slice(0, HISTORY_MAX);
  writeHistory(slug, next);
  return next;
}

export function removeFromReservationHistory(slug: string, code: string): string[] {
  const next = readReservationHistory(slug).filter(existing => existing !== code);
  writeHistory(slug, next);
  return next;
}
