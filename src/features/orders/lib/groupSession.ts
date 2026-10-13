import type { GroupCartItem, GroupLineInput, OrderLineInput } from "../types";
import { isObject, readJson, removeKey, writeJson } from "./storage.ts";

// ── Pedido grupal en el celular del comensal ────────────────────────────────
// Al abrir un pedido grupal o sumarse a uno, el backend da un token de
// integrante. Se guarda acá para que recargar la carta no lo saque del grupo.
// Vence solo: es de una visita al local, igual que la sesión del QR.
const GROUP_TTL_MS = 6 * 60 * 60_000;
const groupKey = (slug: string) => `md:group:${slug}`;

export interface StoredGroupSession {
  token: string;
  name: string;
  expiresAt: number;
}

const isStoredGroup = (value: unknown): value is StoredGroupSession =>
  isObject(value)
  && typeof value.token === "string"
  && typeof value.name === "string"
  && typeof value.expiresAt === "number";

export function readGroupSession(slug: string, now = Date.now()): StoredGroupSession | null {
  const session = readJson(groupKey(slug), isStoredGroup);
  if (!session) return null;
  if (session.expiresAt <= now) {
    clearGroupSession(slug);
    return null;
  }
  return session;
}

export function saveGroupSession(slug: string, token: string, name: string) {
  writeJson(groupKey(slug), { token, name, expiresAt: Date.now() + GROUP_TTL_MS });
}

export function clearGroupSession(slug: string) {
  removeKey(groupKey(slug));
}

// Token del QR / enlace del grupo (?grupo=<token>), o null si no tiene esa forma.
export const readJoinToken = (search: string): string | null => {
  const token = new URLSearchParams(search).get("grupo");
  return token && /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
};

// Código que se tipea para sumarse: 6 caracteres, sin los que se confunden.
// Devuelve lo tipeado ya limpio (mayúsculas, sin espacios ni guiones).
export const cleanJoinCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const isJoinCode = (value: string) => /^[A-HJKMNP-Z2-9]{6}$/.test(value);

// Con qué llegó a la carta para sumarse: el token del QR / enlace, o el código
// (un enlace armado a mano con ?grupo=ABC-DEF también sirve).
export type JoinParam = { joinToken: string } | { code: string };

export const readJoinParam = (search: string): JoinParam | null => {
  const joinToken = readJoinToken(search);
  if (joinToken) return { joinToken };
  const raw = (new URLSearchParams(search).get("grupo") ?? "").replace(/[\s-]/g, "");
  const code = cleanJoinCode(raw);
  return raw.length === 6 && isJoinCode(code) ? { code } : null;
};

// Lo que se muestra: "ABC-DEF".
export const formatJoinCode = (code: string) => (code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

// Líneas del carrito propio → productos para el carrito del grupo. Cada una
// lleva su id de envío: un reintento tras un corte de red no la carga dos veces.
export function toGroupLines(lines: OrderLineInput[], shared: boolean, newId: () => string): GroupLineInput[] {
  return lines.map(line => ({ ...line, shared, clientItemId: newId() }));
}

export interface AuthorGroup {
  memberId: number;
  authorName: string;
  mine: boolean;
  items: GroupCartItem[];
  total: number;
}

// Carrito del grupo agrupado por quién lo cargó: primero lo propio.
export function groupByAuthor(cart: GroupCartItem[]): AuthorGroup[] {
  const groups = new Map<number, AuthorGroup>();
  for (const item of cart) {
    const group = groups.get(item.memberId)
      ?? { memberId: item.memberId, authorName: item.authorName, mine: item.mine === true, items: [], total: 0 };
    group.items.push(item);
    group.total += item.unitPrice * item.quantity;
    groups.set(item.memberId, group);
  }
  return [...groups.values()].sort((a, b) => Number(b.mine) - Number(a.mine));
}
