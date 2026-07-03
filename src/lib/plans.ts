// ──────────────────────────────────────────────
// Helpers de planes en el frontend. Espejo del backend (config/plans.js):
// la fuente de verdad del gating vive en el server, esto es para mostrar
// candados/labels/upsell en la UI. Si cambia el backend, actualizar acá.
// ──────────────────────────────────────────────
import type { Subscription } from "../types";

// Orden de menor a mayor (igual que PLAN_ORDER del backend). El índice ES la
// jerarquía: planMeetsMin() compara posiciones.
export const PLAN_ORDER: Subscription[] = ["free", "starter", "pro", "premium"];

// Nombre visible de cada plan para la UI.
export const PLAN_LABEL: Record<Subscription, string> = {
  free:    "Gratis",
  starter: "Starter",
  pro:     "Pro",
  premium: "Premium",
};

// ¿El plan del usuario alcanza el mínimo requerido?
export function planMeetsMin(userPlan: Subscription, minPlan: Subscription): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan);
}

// Plan mínimo requerido por cada template. Espeja TEMPLATE_MIN_PLAN del
// backend (config/plans.js) — ese es el que realmente bloquea; esto decide
// qué candado/etiqueta mostrar en el editor.
export const TEMPLATE_MIN_PLAN: Record<number, Subscription> = {
  1: "free",    3: "free",    5: "free",
  2: "starter", 4: "starter", 8: "starter", 9: "starter",
  10: "pro",    11: "pro",    12: "pro",
  6: "premium", 7: "premium", 13: "premium",
};
