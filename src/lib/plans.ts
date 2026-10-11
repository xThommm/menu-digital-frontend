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
  image_manager: "Gestor de imágenes",
  // Mismos nombres que en el panel: "Elegir desde plantilla" copia productos,
  // "Diseño de carta" es el estilo y templateIds son las paletas de colores.
  menu_templates: "Cargar productos desde plantilla",
  menu_styles: "Diseños de carta",
  premium_menu_styles: "Diseños de carta premium",
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

const paletteLabel = (count: number) => `${count} ${count === 1 ? "paleta de colores" : "paletas de colores"}`;

// Con los diseños comunes y los premium juntos va una sola línea, para que la
// lista del plan no repita "diseños" dos veces seguidas.
function featureLabels(keys: BooleanPlanFeature[]): string[] {
  const bothStyles = keys.includes("menu_styles") && keys.includes("premium_menu_styles");
  return keys
    .filter(key => !(bothStyles && key === "premium_menu_styles"))
    .map(key => (bothStyles && key === "menu_styles" ? "Diseños de carta, incluidos los premium" : FEATURE_LABELS[key]));
}

export function getPlanFeatureLabels(features: PlanFeatures): string[] {
  return [
    features.item_limit === null ? "Productos ilimitados" : `Hasta ${features.item_limit} productos`,
    ...featureLabels(BOOLEAN_FEATURES.filter(key => features[key])),
    paletteLabel(features.templateIds.length),
    ...(!features.sin_publicidad ? ["Incluye publicidad de MenuDigital"] : []),
  ];
}

// Solo lo que un plan agrega por encima del anterior en PLAN_ORDER — para no
// repetir en la lista del plan Pro lo que ya se leyó en la del plan Básico
// (o en la del Básico lo que ya venía en el Gratuito). Sin plan anterior
// (o si por algún motivo no queda nada que agregar), cae a la lista completa.
export function getPlanUpgradeLabels(features: PlanFeatures, previousFeatures: PlanFeatures | null): string[] {
  if (!previousFeatures) return getPlanFeatureLabels(features);

  const added: string[] = [];

  if (features.item_limit !== previousFeatures.item_limit) {
    added.push(features.item_limit === null ? "Productos ilimitados" : `Hasta ${features.item_limit} productos`);
  }

  added.push(...featureLabels(BOOLEAN_FEATURES.filter(key => features[key] && !previousFeatures[key])));

  const newTemplates = features.templateIds.length - previousFeatures.templateIds.length;
  if (newTemplates > 0) {
    added.push(`+${newTemplates} ${newTemplates === 1 ? "paleta de colores nueva" : "paletas de colores nuevas"}`);
  }

  return added.length > 0 ? added : getPlanFeatureLabels(features);
}
