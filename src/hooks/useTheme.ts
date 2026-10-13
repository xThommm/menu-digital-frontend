import { useSyncExternalStore } from "react";
import { panelThemeStore, type ThemeMode } from "../lib/themeStores";

// ──────────────────────────────────────────────
// Tema claro/oscuro del PANEL (dashboard + editores). Solo afecta a los
// componentes que consumen los tokens --admin-* de globals.css; las páginas
// públicas (carta por slug) y las de auth usan sus propios colores y no se
// ven afectadas por esto.
//
// El default es "dark" (el look histórico del panel): sin data-theme en el
// <html>, o con data-theme="dark", aplican los tokens oscuros. El toggle
// setea data-theme="light" y guarda la preferencia en localStorage.
//
// La primera aplicación (antes del primer render, para no mostrar un flash
// del tema equivocado) la hace un script inline en index.html. Este hook solo
// se encarga de leer el estado actual y de escribir/aplicar en cada toggle.
// ──────────────────────────────────────────────

// El valor vive en panelThemeStore (lib/themeStores.ts): lo comparten todos los
// que usan este hook y el menú contextual global, que también lo cambia.

export type PanelTheme = ThemeMode;

export function useTheme() {
  const theme = useSyncExternalStore(panelThemeStore.subscribe, panelThemeStore.get);
  return { theme, toggle: panelThemeStore.toggle, setTheme: panelThemeStore.set };
}
