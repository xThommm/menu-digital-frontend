import { useCallback, useLayoutEffect, useState } from "react";
import {
  DEFAULT_PANEL_PREFERENCES, PANEL_ACCENT_KEY, PANEL_FONT_SIZE_KEY,
  panelPreferenceAttributes, resolvePanelAccent, resolvePanelFontSize,
  type PanelAccent, type PanelFontSize, type PanelPreferences,
} from "../lib/panelPreferences";

// ──────────────────────────────────────────────
// Apariencia de los paneles (acento + tamaño de letra).
//
// A diferencia del tema (useTheme), los atributos NO se aplican desde
// index.html ni quedan puestos para siempre: el tamaño de letra escala el
// font-size del <html>, y eso afectaría también a la carta pública y a la
// landing abiertas en el mismo navegador. Por eso cada layout que las usa
// (DashboardLayout, OrdersLayout, AdminLayout, SellerLayout) llama a este hook, que los pone al montar
// y los saca al desmontar. useLayoutEffect: se aplican antes del primer
// pintado del layout, sin parpadeo.
// ──────────────────────────────────────────────

function readPreferences(): PanelPreferences {
  try {
    return {
      accent: resolvePanelAccent(localStorage.getItem(PANEL_ACCENT_KEY)),
      fontSize: resolvePanelFontSize(localStorage.getItem(PANEL_FONT_SIZE_KEY)),
    };
  } catch {
    return DEFAULT_PANEL_PREFERENCES;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin localStorage (modo privado): vale para esta sesión, no persiste.
  }
}

export function usePanelPreferences() {
  const [preferences, setPreferences] = useState<PanelPreferences>(readPreferences);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const attributes = panelPreferenceAttributes(preferences);
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
    return () => {
      for (const name of Object.keys(attributes)) root.removeAttribute(name);
    };
  }, [preferences]);

  const setAccent = useCallback((accent: PanelAccent) => {
    setPreferences(current => ({ ...current, accent }));
    store(PANEL_ACCENT_KEY, accent);
  }, []);

  const setFontSize = useCallback((fontSize: PanelFontSize) => {
    setPreferences(current => ({ ...current, fontSize }));
    store(PANEL_FONT_SIZE_KEY, fontSize);
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULT_PANEL_PREFERENCES);
    store(PANEL_ACCENT_KEY, DEFAULT_PANEL_PREFERENCES.accent);
    store(PANEL_FONT_SIZE_KEY, DEFAULT_PANEL_PREFERENCES.fontSize);
  }, []);

  return { preferences, setAccent, setFontSize, reset };
}
