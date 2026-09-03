// ──────────────────────────────────────────────
// Identificadores y textos de UI. Los valores de precios y permisos vienen de la API.
// ──────────────────────────────────────────────
import type { Subscription, SubscriptionStatus, PlanFeatures, BooleanPlanFeature } from "../types";

// Orden técnico de upgrade/renovación, igual que PLAN_ORDER del backend.
// Los beneficios se leen completos por plan, sin heredarlos de este orden.
export const PLAN_ORDER: Subscription[] = ["free", "basic", "pro"];

// Etiquetas técnicas para estados históricos/sin catálogo; las ofertas usan label.
export const PLAN_LABEL: Record<Subscription, string> = {
  free:    "Gratuito",
  basic:   "Básico",
  pro:     "Pro",
};

export const FEATURE_LABELS: Record<BooleanPlanFeature, string> = {
  menu_editor: "Editor de menú",
  qr: "QR descargable",
  pedido_whatsapp: "Pedidos por WhatsApp",
  landing_page: "Página del local",
  sin_publicidad: "Sin publicidad",
  carga_masiva_excel: "Importar y exportar por Excel",
  programacion_productos: "Programar productos y ofertas",
  menu_pdf: "Exportar menú a PDF",
  estadisticas: "Estadísticas de visitas y productos",
};

// Solo sirve para pintar el estado mientras llega el refresh del backend; los
// permisos siguen siendo responsabilidad exclusiva del servidor.
export function isSubscriptionExpired(
  subscription: Subscription,
  subscriptionExpiresAt?: string | null,
  subscriptionStatus?: SubscriptionStatus,
): boolean {
  if (subscriptionStatus === "expired") return true;
  if (subscription === "free" || !subscriptionExpiresAt) return false;
  const expiresAt = new Date(subscriptionExpiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

export const BOOLEAN_FEATURES = Object.keys(FEATURE_LABELS) as BooleanPlanFeature[];

export function getPlanFeatureLabels(features: PlanFeatures): string[] {
  return [
    features.item_limit === null ? "Productos ilimitados" : `Hasta ${features.item_limit} productos`,
    ...BOOLEAN_FEATURES.filter(key => features[key]).map(key => FEATURE_LABELS[key]),
    `${features.templateIds.length} ${features.templateIds.length === 1 ? "diseño disponible" : "diseños disponibles"}`,
    ...(!features.sin_publicidad ? ["Incluye publicidad de MenuDigital"] : []),
  ];
}
