import apiClient from "./client"
import type {
  AdminPaymentEntitlement,
  AdminPaymentOperation,
  AdminPaymentsResponse,
} from "../types"

export interface AdminPaymentParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  entitlement?: AdminPaymentEntitlement | "all"
  operation?: AdminPaymentOperation | "all"
  userID?: string
}

// Historial durable local. No consulta ni modifica datos en Mercado Pago.
export const listAdminPayments = async (
  params: AdminPaymentParams = {}
): Promise<AdminPaymentsResponse> => {
  const res = await apiClient.get("/admin/payments", { params })
  return res.data
}
