import { useSyncExternalStore } from "react";
import { publicThemeStore, type ThemeMode } from "../lib/themeStores";

// ──────────────────────────────────────────────
// Tema claro/oscuro de las páginas PÚBLICAS que usan los tokens --auth-*:
// AdminHome (landing), el blog, las páginas de Legal.module.css (términos,
// privacidad, contacto, arrepentimiento, baja) y el flujo de auth (Login,
// Register, VerifyEmail, RegisterPlans, RegisterSuccess).
//
// El toggle visible está en la landing, el blog y las legales; las pantallas
// de auth leen la misma preferencia para no cortar el tema a mitad del alta,
// pero no la cambian.
//
// Independiente del tema del panel admin (--admin-*, useTheme.ts): storage
// key y atributo propios, y el atributo se aplica sobre el contenedor de
// cada página (.hpage / .page), no sobre <html> — así conviven sin
// pisarse si alguien navega del panel a la landing en la misma sesión.
// Los valores del tema claro viven en globals.css bajo
// [data-auth-theme="light"] (compartidos por los dos .module.css en vez de
// duplicados).
//
// El valor vive en publicThemeStore (lib/themeStores.ts): lo comparten todas
// las páginas que usan este hook y el menú contextual global.
// ──────────────────────────────────────────────

export type AuthTheme = ThemeMode;

export function useAuthTheme() {
  const theme = useSyncExternalStore(publicThemeStore.subscribe, publicThemeStore.get);
  return { theme, toggle: publicThemeStore.toggle };
}
