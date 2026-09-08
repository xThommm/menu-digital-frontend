import type {
  CrmAttentionCode,
  CrmAttentionSummary,
  CrmClient,
  CrmStage,
} from "../../../types";
import { PLAN_LABEL } from "../../../lib/plans";

// ── Metadata de cada etapa del pipeline: etiqueta visible + color del punto. ──
export const STAGE_META: Record<CrmStage, { label: string; color: string }> = {
  lead:       { label: "Lead",       color: "#6b8ca0" },
  onboarding: { label: "Onboarding", color: "#c9a84c" },
  activo:     { label: "Activo",     color: "#4caf82" },
  en_riesgo:  { label: "En riesgo",  color: "#d98a3d" },
  baja:       { label: "Baja",       color: "#c97070" },
};
export const STAGE_ORDER: CrmStage[] = ["lead", "onboarding", "activo", "en_riesgo", "baja"];

export const ATTENTION_META: Record<CrmAttentionCode, { label: string; shortLabel: string }> = {
  payment_issue: { label: "Pagos con incidencia", shortLabel: "Pago" },
  subscription_expired: { label: "Suscripciones vencidas", shortLabel: "Vencida" },
  subscription_expiring: { label: "Vencen en 30 días", shortLabel: "Por vencer" },
  subscription_missing_expiry: { label: "Planes sin vencimiento", shortLabel: "Sin vencimiento" },
  follow_up_overdue: { label: "Seguimientos vencidos", shortLabel: "Seguimiento" },
  onboarding_incomplete: { label: "Onboarding incompleto", shortLabel: "Onboarding" },
  no_traffic: { label: "Carta sin visitas (30 días)", shortLabel: "Sin visitas" },
};

export const EMPTY_ATTENTION_SUMMARY: CrmAttentionSummary = {
  clients: 0,
  paymentIssues: 0,
  expiredSubscriptions: 0,
  expiringSubscriptions: 0,
  missingExpirySubscriptions: 0,
  overdueFollowUps: 0,
  incompleteOnboarding: 0,
  noTraffic: 0,
};

export const ONBOARDING_ITEMS = [
  { key: "businessInfo", label: "Datos del negocio", detail: "Nombre y dirección" },
  { key: "contactChannel", label: "Canal de contacto", detail: "Email o WhatsApp" },
  { key: "schedule", label: "Horarios", detail: "Al menos un día habilitado" },
  { key: "branding", label: "Identidad visual", detail: "Portada o galería" },
  { key: "menuStructure", label: "Categorías", detail: "Estructura de la carta" },
  { key: "products", label: "Productos", detail: "Al menos uno cargado" },
  { key: "publicMenu", label: "Carta operativa", detail: "Cuenta activa y carta con productos" },
] as const;

// ── Helpers de fecha ──
export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "";

// Los seguimientos son días de calendario (no instantes). El backend los
// persiste como Date a medianoche UTC, así que usamos YYYY-MM-DD para evitar
// que Buenos Aires los muestre como el día anterior.
export const calendarDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};
export const fmtFollowUpDate = (iso: string) =>
  calendarDate(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

// Una fecha de seguimiento está "vencida" si ya pasó (comparando por día).
export const isOverdue = (iso: string | null) => {
  if (!iso) return false;
  const d = calendarDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

// value del <input type="date"> (YYYY-MM-DD) desde un ISO.
export const dateInputValue = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export const planExpiryLabel = (subscription: CrmClient["subscription"], iso: string | null) => {
  if (subscription === "free") return "Sin vencimiento";
  if (!iso) return "Sin fecha registrada";
  const expiryMs = new Date(iso).getTime();
  if (!Number.isFinite(expiryMs)) return "Fecha inválida — revisar";
  return `${expiryMs <= Date.now() ? "Venció" : "Vence"} ${fmtDate(iso)}`;
};

export type SubscriptionView = {
  subscription: CrmClient["subscription"];
  effectiveSubscription?: CrmClient["effectiveSubscription"];
  subscriptionStatus?: CrmClient["subscriptionStatus"];
  subscriptionExpiresAt?: string | null;
};

// El backend entrega el plan efectivo. El fallback mantiene el CRM correcto
// durante un despliegue escalonado y para respuestas cacheadas antiguas.
export const effectiveSubscriptionFor = (record: SubscriptionView): CrmClient["subscription"] => {
  if (record.effectiveSubscription) return record.effectiveSubscription;
  if (record.subscription === "free") return "free";
  if (record.subscriptionStatus === "expired") return "free";
  if (!record.subscriptionExpiresAt) return record.subscription;
  const expiryMs = new Date(record.subscriptionExpiresAt).getTime();
  return !Number.isFinite(expiryMs) || expiryMs <= Date.now() ? "free" : record.subscription;
};

export const planBadgeLabel = (record: SubscriptionView) => {
  const effective = effectiveSubscriptionFor(record);
  if (effective === "free" && record.subscription !== "free") {
    return `Gratis · ${PLAN_LABEL[record.subscription]} vencido`;
  }
  return PLAN_LABEL[effective];
};

// Compatibilidad durante un despliegue escalonado: si todavía responde el
// backend anterior, conservamos al menos la alerta de seguimiento que ya podía
// deducirse del contrato viejo. Las demás señales siguen siendo del servidor.
export const normalizeAttention = (clients: CrmClient[]) => clients.map((client) => {
  if (client.attention) return client;
  const attention: CrmAttentionCode[] = [];
  if (client.subscription !== "free") {
    const effective = effectiveSubscriptionFor(client);
    if (effective === "free") attention.push("subscription_expired");
    else if (!client.subscriptionExpiresAt) attention.push("subscription_missing_expiry");
    else if (new Date(client.subscriptionExpiresAt).getTime() <= Date.now() + 30 * 86_400_000) {
      attention.push("subscription_expiring");
    }
  }
  if (isOverdue(client.nextFollowUp)) attention.push("follow_up_overdue");
  return {
    ...client,
    attention,
  };
});

export const summarizeAttention = (clients: CrmClient[]): CrmAttentionSummary => ({
  clients: clients.filter((client) => (client.attention || []).length > 0).length,
  paymentIssues: clients.filter((client) => client.attention?.includes("payment_issue")).length,
  expiredSubscriptions: clients.filter((client) => client.attention?.includes("subscription_expired")).length,
  expiringSubscriptions: clients.filter((client) => client.attention?.includes("subscription_expiring")).length,
  missingExpirySubscriptions: clients.filter((client) => client.attention?.includes("subscription_missing_expiry")).length,
  overdueFollowUps: clients.filter((client) => client.attention?.includes("follow_up_overdue")).length,
  incompleteOnboarding: clients.filter((client) => client.attention?.includes("onboarding_incomplete")).length,
  noTraffic: clients.filter((client) => client.attention?.includes("no_traffic")).length,
});
