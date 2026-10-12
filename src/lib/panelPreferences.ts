// Preferencias de apariencia del panel del dueño: color de acento y tamaño de
// letra. Son del dispositivo, igual que el tema claro/oscuro (hooks/useTheme):
// se guardan en localStorage y no viajan al backend.
//
// Los colores reales viven en globals.css ([data-panel-accent]), con una
// variante por tema. `swatch` es solo la muestra del selector.

export const PANEL_ACCENTS = [
  { id: "orange", name: "Naranja", swatch: { dark: "#E85D3C", light: "#E85D3C" } },
  { id: "gold", name: "Dorado", swatch: { dark: "#D9AE4E", light: "#A87A1B" } },
  { id: "blue", name: "Azul", swatch: { dark: "#5B9DFF", light: "#2563EB" } },
  // Neutro: claro sobre el tema oscuro y grafito sobre el claro, donde un
  // acento claro no se vería.
  { id: "light", name: "Claro", swatch: { dark: "#EDE8DF", light: "#3A4150" } },
] as const;

export const PANEL_FONT_SIZES = [
  { id: "sm", name: "Chica" },
  { id: "md", name: "Normal" },
  { id: "lg", name: "Grande" },
  { id: "xl", name: "Muy grande" },
] as const;

export type PanelAccent = typeof PANEL_ACCENTS[number]["id"];
export type PanelFontSize = typeof PANEL_FONT_SIZES[number]["id"];

export interface PanelPreferences {
  accent: PanelAccent;
  fontSize: PanelFontSize;
}

export const DEFAULT_PANEL_PREFERENCES: PanelPreferences = { accent: "orange", fontSize: "md" };

export const PANEL_ACCENT_KEY = "panel-accent";
export const PANEL_FONT_SIZE_KEY = "panel-font-size";

// Un valor ausente, viejo o editado a mano cae al default en vez de dejar el
// panel con un atributo que ningún bloque de CSS reconoce.
export function resolvePanelAccent(value: unknown): PanelAccent {
  return PANEL_ACCENTS.find(accent => accent.id === value)?.id ?? DEFAULT_PANEL_PREFERENCES.accent;
}

export function resolvePanelFontSize(value: unknown): PanelFontSize {
  return PANEL_FONT_SIZES.find(size => size.id === value)?.id ?? DEFAULT_PANEL_PREFERENCES.fontSize;
}

// Atributos del <html>. El default no escribe nada: sin atributo aplican los
// tokens de siempre, así que quien no tocó las preferencias no cambia de CSS.
export function panelPreferenceAttributes(preferences: PanelPreferences) {
  return {
    "data-panel-accent": preferences.accent === DEFAULT_PANEL_PREFERENCES.accent ? null : preferences.accent,
    "data-panel-font": preferences.fontSize === DEFAULT_PANEL_PREFERENCES.fontSize ? null : preferences.fontSize,
  };
}
