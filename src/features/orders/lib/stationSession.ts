import { isObject, readJson, removeKey, writeJson } from "./storage";

// Equipo vinculado a un sector (la PC de la cocina, la tablet de la barra).
// El token lo da el backend al canjear el código que se tipea; un equipo
// trabaja para un solo sector. Si el dueño lo desvincula o borra el sector,
// el backend responde 401 y se borra.
export interface StoredStationSession {
  token: string;
  sectorName: string;
}

const SESSION_KEY = "md:station";

const isSession = (value: unknown): value is StoredStationSession =>
  isObject(value) && typeof value.token === "string" && typeof value.sectorName === "string";

export const readStationSession = () => readJson(SESSION_KEY, isSession);
export const saveStationSession = (session: StoredStationSession) => writeJson(SESSION_KEY, session);
export const clearStationSession = () => removeKey(SESSION_KEY);

// Preferencias de este equipo (no del sector: dos equipos del mismo sector
// pueden querer cosas distintas, ej. solo uno imprime).
export interface StationPrefs {
  sound: boolean;
  autoPrint: boolean;
}

const PREFS_KEY = "md:station:prefs";
// Imprimir solo arranca apagado: con la impresora del sistema cada comanda
// abre el diálogo de impresión (y frena la pantalla) salvo que el navegador
// esté en modo kiosco (--kiosk-printing). Se prende a conciencia por equipo.
const DEFAULT_PREFS: StationPrefs = { sound: true, autoPrint: false };

const isPrefs = (value: unknown): value is StationPrefs =>
  isObject(value) && typeof value.sound === "boolean" && typeof value.autoPrint === "boolean";

export const readStationPrefs = (): StationPrefs => readJson(PREFS_KEY, isPrefs) ?? DEFAULT_PREFS;
export const saveStationPrefs = (prefs: StationPrefs) => writeJson(PREFS_KEY, prefs);
