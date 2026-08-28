import type { AdminPaymentEntitlement, AdminPaymentOperation } from "../types"

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  authorized: "Autorizado",
  in_process: "En proceso",
  in_mediation: "En mediación",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Contracargo",
}

export const ENTITLEMENT_LABEL: Record<AdminPaymentEntitlement, string> = {
  applied: "Plan acreditado",
  pending: "Acreditación pendiente",
  not_applied: "Plan no acreditado",
}

export const OPERATION_LABEL: Record<AdminPaymentOperation, string> = {
  registration: "Alta",
  upgrade: "Upgrade",
  renewal: "Renovación",
  unknown: "Sin identificar",
}

const REASON_LABEL: Record<string, string> = {
  payment_not_approved: "El pago no fue aprobado",
  payment_environment_mismatch: "El pago pertenece a otro ambiente",
  stale_checkout_would_downgrade: "Checkout anterior: se evitó reducir el plan",
  legacy_open_ended_entitlement: "Plan legacy sin vencimiento",
  user_not_found: "No se encontró el cliente",
  invalid_external_reference: "Referencia de cliente inválida",
  missing_external_reference: "Falta la referencia del cliente",
  invalid_plan: "Plan inválido",
  invalid_months: "Período inválido",
  invalid_operation: "Operación inválida",
  checkout_not_found: "No se encontró el checkout",
  checkout_operation_mismatch: "La operación no coincide con el checkout",
  checkout_association_mismatch: "El cliente no coincide con el checkout",
  checkout_plan_mismatch: "El plan no coincide con el checkout",
  checkout_months_mismatch: "El período no coincide con el checkout",
  checkout_amount_mismatch: "El importe no coincide con el checkout",
  checkout_currency_mismatch: "La moneda no coincide con el checkout",
  registration_username_conflict: "Conflicto con el usuario del alta",
  registration_completed_by_other_payment: "El alta se completó con otro pago",
  pending_registration_not_found: "No se encontró el registro pendiente",
}

export const humanizePaymentCode = (value: string | null) => {
  if (!value) return "—"
  return REASON_LABEL[value] || value.replaceAll("_", " ")
}

export const formatPaymentAmount = (amount: number | null, currency = "ARS") => {
  if (amount === null) return "Importe no disponible"
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatPaymentDate = (iso: string | null) => (
  iso
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"
)
