import { Maximize, Palette, RefreshCw, SunMoon } from "lucide-react";
import { panelThemeStore, publicThemeStore, type ThemeMode } from "../../lib/themeStores.ts";
import { resolveMenuItems } from "./lib/contextMenu.ts";
import type { ContextMenuItem, ResolvedItem } from "./types";

// Menú contextual global: el que aparece con clic derecho en cualquier parte
// de la app donde no haya un menú más específico (una fila, una pantalla).
// Para sumar una opción general alcanza con agregarla a buildGlobalMenu.

/** Qué preferencia de tema gobierna la pantalla actual (ver lib/themeStores.ts). */
export type ThemeArea = "panel" | "public";

/**
 * Pedido de abrir la ventana de apariencia del panel (tema, acento y tamaño
 * de letra). La escuchan los layouts de los paneles, que son los que la tienen.
 */
export const OPEN_PANEL_APPEARANCE_EVENT = "md:open-panel-appearance";

export interface GlobalMenuContext {
  /** null en pantallas sin tema claro/oscuro (la carta pública de un local). */
  themeArea: ThemeArea | null;
  theme: ThemeMode;
  /** El navegador deja usar pantalla completa (y si ya está en pantalla completa). */
  fullscreen: { available: boolean; active: boolean };
}

export interface GlobalMenuHandlers {
  reload: () => void;
  toggleTheme: (area: ThemeArea) => void;
  openPanelAppearance: () => void;
  toggleFullscreen: (active: boolean) => void;
}

export function buildGlobalMenu(handlers: GlobalMenuHandlers): ContextMenuItem<GlobalMenuContext>[] {
  return [
    { id: "reload", label: "Actualizar", icon: RefreshCw, run: handlers.reload },
    {
      id: "fullscreen",
      label: (context) => (context.fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"),
      icon: Maximize,
      visible: (context) => context.fullscreen.available,
      run: (context) => handlers.toggleFullscreen(context.fullscreen.active),
    },
    // En los paneles el tema va dentro de "Apariencia del panel", con el acento y el tamaño de letra.
    {
      id: "appearance",
      label: "Apariencia del panel…",
      icon: Palette,
      visible: (context) => context.themeArea === "panel",
      run: handlers.openPanelAppearance,
    },
    {
      id: "theme",
      label: (context) => (context.theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"),
      icon: SunMoon,
      visible: (context) => context.themeArea === "public",
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
  openPanelAppearance: () => window.dispatchEvent(new Event(OPEN_PANEL_APPEARANCE_EVENT)),
  toggleFullscreen: (active) => {
    if (active) void document.exitFullscreen?.().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  },
});

/** Opciones del menú global para la pantalla actual (lo consume ContextMenuProvider). */
export function getGlobalMenuItems(): ResolvedItem[] {
  const themeArea = currentThemeArea();
  return resolveMenuItems(GLOBAL_MENU, {
    themeArea,
    theme: themeArea ? THEME_STORES[themeArea].get() : "dark",
    fullscreen: { available: document.fullscreenEnabled === true, active: document.fullscreenElement !== null },
  });
}
