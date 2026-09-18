import type { MenuDisplay, MenuDisplayKey } from "../types/index.ts";

// Mismo orden en que el panel de Configuración lista los toggles.
export const MENU_DISPLAY_KEYS: MenuDisplayKey[] = [
  "featuredSection", "collapsibleCategories", "hidePrices",
];

// Al revés que landingVisibility: las tres opciones cambian cómo se ve una
// carta que ya existe, así que vienen apagadas. Un backend anterior a la
// opción no manda menuDisplay y la carta se ve como siempre. Solo `true`
// explícito activa.
export function resolveMenuDisplay(value?: Partial<MenuDisplay> | null): MenuDisplay {
  return Object.fromEntries(
    MENU_DISPLAY_KEYS.map(key => [key, value?.[key] === true]),
  ) as MenuDisplay;
}
