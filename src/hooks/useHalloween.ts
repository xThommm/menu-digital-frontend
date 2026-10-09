import { useSyncExternalStore } from "react";
import { isHalloweenSeason } from "../lib/halloween";

// Preferencia del visitante: encendido por defecto durante la temporada.
// Guarda solo el "apagado" para que la decisión de la fecha mande sobre un
// valor viejo en el storage. Store de módulo para que el interruptor, los
// murciélagos y las telarañas lean el mismo estado sin un provider.
const STORAGE_KEY = "halloween-off";

const listeners = new Set<() => void>();
let off = readOff();

function readOff(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setHalloweenEnabled(enabled: boolean) {
  off = !enabled;
  try {
    if (off) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage bloqueado: la preferencia vale solo esta sesión */ }
  listeners.forEach((l) => l());
}

export function useHalloween() {
  const isOff = useSyncExternalStore(subscribe, () => off, () => false);
  const season = isHalloweenSeason();
  return {
    season,
    enabled: season && !isOff,
    toggle: () => setHalloweenEnabled(isOff),
  };
}
