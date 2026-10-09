// ──────────────────────────────────────────────
// Temporada de Halloween. Todo el adorno cuelga de esta fecha: pasada, el
// interruptor desaparece y no se monta ningún efecto, sin necesidad de otro
// deploy. Para otro año basta con cambiar HALLOWEEN_UNTIL.
// ──────────────────────────────────────────────

// Primer instante SIN adorno: 3 de noviembre 00:00 hora local (el 2 incluido).
export const HALLOWEEN_UNTIL = new Date(2026, 10, 3, 0, 0, 0, 0);

export function isHalloweenSeason(now: Date = new Date()): boolean {
  return now.getTime() < HALLOWEEN_UNTIL.getTime();
}

// "full": landing y pantallas de auth (cursor, murciélagos, telarañas).
// "low":  paneles de trabajo (menos murciélagos, más discretos).
// null:   sin adorno. Las cartas públicas de los comercios y las apps de
//         operación (pedidos, comandas) nunca se tocan: son la marca del local.
export type HalloweenLevel = "full" | "low";

export function halloweenLevelFor(pathname: string): HalloweenLevel | null {
  if (pathname === "/" || pathname === "/login" || pathname === "/register" || pathname.startsWith("/register/")) {
    return "full";
  }
  if (pathname === "/dashboard" || pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "low";
  }
  return null;
}
