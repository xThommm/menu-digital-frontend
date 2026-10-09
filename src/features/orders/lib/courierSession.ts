import { isObject, readJson, removeKey, writeJson } from "./storage";

// Sesión del repartidor en su celular. El token lo da el backend al canjear el
// QR de vinculación y se guarda por local. Si el dueño cierra la sesión o pausa
// al repartidor, el backend responde 401 y se borra.
export interface StoredCourierSession {
  token: string;
  courierName: string;
}

const key = (slug: string) => `md:courier:${slug}`;

const isSession = (value: unknown): value is StoredCourierSession =>
  isObject(value) && typeof value.token === "string" && typeof value.courierName === "string";

export const readCourierSession = (slug: string) => readJson(key(slug), isSession);
export const saveCourierSession = (slug: string, session: StoredCourierSession) => writeJson(key(slug), session);
export const clearCourierSession = (slug: string) => removeKey(key(slug));
