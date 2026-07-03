import { useCallback, useState } from "react";

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

export type PanelTheme = "dark" | "light";
const STORAGE_KEY = "panel-theme";

function readTheme(): PanelTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: PanelTheme) {
  // "dark" es el default sin atributo, así que en oscuro lo sacamos en vez de
  // escribir data-theme="dark" (deja el <html> limpio).
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<PanelTheme>(readTheme);

  const setTheme = useCallback((next: PanelTheme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage no disponible (modo privado, etc.): el tema igual se
      // aplica en esta sesión, solo no persiste.
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, toggle, setTheme };
}
