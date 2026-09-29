// localStorage "a prueba de todo": modo privado, cuota llena o datos viejos
// con otro formato nunca rompen la pantalla (se comporta como vacío).

export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: funciona en memoria durante la sesión.
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // idem
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export { isObject };

// UUID v4 para identificar un envío (reintentos = mismo id) o el dispositivo.
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Id anónimo del dispositivo (sin datos personales): el backend lo usa para
// frenar pedidos repetidos o demasiado seguidos desde un mismo teléfono.
export function deviceId(): string {
  const key = "md:device";
  try {
    const existing = localStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = uuid();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return uuid();
  }
}
