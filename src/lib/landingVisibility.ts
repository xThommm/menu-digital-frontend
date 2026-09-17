import type { LandingVisibility, LandingVisibilityKey } from "../types/index.ts";

// Mismo orden en que el panel de Configuración lista los toggles.
export const LANDING_VISIBILITY_KEYS: LandingVisibilityKey[] = [
  "phone", "whatsappReserve", "mail", "address", "schedule", "instagram", "facebook",
];

// Completa lo que falte con "visible": un backend anterior a la opción no
// manda landingVisibility, y una cuenta que nunca tocó un toggle tiene todo
// visible (mismo default que el schema). Solo `false` explícito oculta.
export function resolveLandingVisibility(value?: Partial<LandingVisibility> | null): LandingVisibility {
  return Object.fromEntries(
    LANDING_VISIBILITY_KEYS.map(key => [key, value?.[key] !== false]),
  ) as LandingVisibility;
}
