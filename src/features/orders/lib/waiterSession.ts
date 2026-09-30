import { isObject, readJson, removeKey, writeJson } from "./storage";

// Sesión del tomador de pedidos en el dispositivo del operador. El token lo da
// el backend al canjear el QR y se guarda por local (un mismo celular podría
// trabajar en dos locales). Si el dueño cierra la sesión o pausa al operador, el
// backend responde 401 y se borra.
export interface StoredWaiterSession {
  token: string;
  waiterName: string;
}

const key = (slug: string) => `md:waiter:${slug}`;

const isSession = (value: unknown): value is StoredWaiterSession =>
  isObject(value) && typeof value.token === "string" && typeof value.waiterName === "string";

export const readWaiterSession = (slug: string) => readJson(key(slug), isSession);
export const saveWaiterSession = (slug: string, session: StoredWaiterSession) => writeJson(key(slug), session);
export const clearWaiterSession = (slug: string) => removeKey(key(slug));
