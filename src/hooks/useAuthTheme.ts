import { useEffect, useState } from "react";

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
// ──────────────────────────────────────────────

export type AuthTheme = "dark" | "light";
const STORAGE_KEY = "public-theme";

export function useAuthTheme() {
  const [theme, setTheme] = useState<AuthTheme>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage no disponible (modo privado, etc.): el tema igual se
      // aplica en esta sesión, solo no persiste.
    }
  }, [theme]);

  const toggle = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
