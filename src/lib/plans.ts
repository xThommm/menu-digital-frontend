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

// Lo que el plan Pro suma por fuera del catálogo: el backend habilita pedidos
// y reservas con el plan Pro vigente (requireProPlan), no con una feature.
export const PRO_EXTRA_LABELS = [
  "Gestión de pedidos: mesas, mozos, comandas y caja",
  "Delivery y take away con cobro por Mercado Pago",
  "Reservas online",
];

// ¿El plan trae todo lo del otro? El catálogo no lo garantiza (cada plan se
// edita por separado en el panel), así que se comprueba antes de resumir.
function includesAllOf(features: PlanFeatures, previous: PlanFeatures): boolean {
  return BOOLEAN_FEATURES.every(key => !previous[key] || features[key])
    && (features.item_limit === null || (previous.item_limit !== null && features.item_limit >= previous.item_limit))
    && previous.templateIds.every(id => features.templateIds.includes(id));
}

type CatalogPlan = { name: Subscription; label: string; features: PlanFeatures };

// Tarjeta de plan resumida: "Todo lo del plan <base>, más:" y solo lo que
// agrega. Si el plan anterior en PLAN_ORDER no está en el catálogo o tiene
// algo que este no trae, base es null y va la lista completa.
export function getPlanCardSummary(plan: CatalogPlan, catalog: CatalogPlan[]): { base: string | null; labels: string[] } {
  const previousName = PLAN_ORDER[PLAN_ORDER.indexOf(plan.name) - 1];
  const previous = catalog.find(p => p.name === previousName);
  if (!previous || !includesAllOf(plan.features, previous.features)) {
    return { base: null, labels: getPlanFeatureLabels(plan.features) };
  }
  return { base: previous.label, labels: getPlanUpgradeLabels(plan.features, previous.features) };
}
