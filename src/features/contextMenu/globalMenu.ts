import { RefreshCw, SunMoon } from "lucide-react";
import { panelThemeStore, publicThemeStore, type ThemeMode } from "../../lib/themeStores.ts";
import { resolveMenuItems } from "./lib/contextMenu.ts";
import type { ContextMenuItem, ResolvedItem } from "./types";

// Menú contextual global: el que aparece con clic derecho en cualquier parte
// de la app donde no haya un menú más específico (una fila, una pantalla).
// Para sumar una opción general alcanza con agregarla a buildGlobalMenu.

/** Qué preferencia de tema gobierna la pantalla actual (ver lib/themeStores.ts). */
export type ThemeArea = "panel" | "public";

export interface GlobalMenuContext {
  /** null en pantallas sin tema claro/oscuro (la carta pública de un local). */
  themeArea: ThemeArea | null;
  theme: ThemeMode;
}

export interface GlobalMenuHandlers {
  reload: () => void;
  toggleTheme: (area: ThemeArea) => void;
}

export function buildGlobalMenu(handlers: GlobalMenuHandlers): ContextMenuItem<GlobalMenuContext>[] {
  return [
    { id: "reload", label: "Actualizar", icon: RefreshCw, run: handlers.reload },
    {
      id: "theme",
      label: (context) => (context.theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"),
      icon: SunMoon,
      visible: (context) => context.themeArea !== null,
      run: (context) => { if (context.themeArea) handlers.toggleTheme(context.themeArea); },
    },
  ];
}

const THEME_STORES = { panel: panelThemeStore, public: publicThemeStore };

// Las páginas públicas con tema marcan su contenedor con data-auth-theme y los
// layouts de los paneles con data-theme-area="panel". Se mira la página entera
// y no el elemento clickeado: un modal en un portal queda fuera del layout.
function currentThemeArea(): ThemeArea | null {
  if (document.querySelector("[data-auth-theme]")) return "public";
  if (document.querySelector("[data-theme-area='panel']")) return "panel";
  return null;
}

const GLOBAL_MENU = buildGlobalMenu({
  reload: () => window.location.reload(),
  toggleTheme: (area) => THEME_STORES[area].toggle(),
});

/** Opciones del menú global para la pantalla actual (lo consume ContextMenuProvider). */
export function getGlobalMenuItems(): ResolvedItem[] {
  const themeArea = currentThemeArea();
  return resolveMenuItems(GLOBAL_MENU, {
    themeArea,
    theme: themeArea ? THEME_STORES[themeArea].get() : "dark",
  });
}
