import apiClient from "./client"
import type { AdminNotificationType } from "./adminNotifications"
import type { PushTestResult } from "../lib/pushDevices"

export interface AdminPushStatus {
  /** El backend tiene Firebase configurado (FIREBASE_SERVICE_ACCOUNT). */
  enabled: boolean
  /** Dispositivos del admin logueado que reciben push. */
  devices: number
}

export interface AdminPushDevice {
  id: string
  userAgent: string | null
  /** SHA-256 del token: sirve para reconocer cuál es este navegador. */
  fingerprint: string
  createdAt: string | null
  lastSeenAt: string | null
}

export interface AdminPushPreferences {
  /** Tipos de aviso que se pueden silenciar. */
  types: AdminNotificationType[]
  /** Tipos que este admin NO recibe como push (la bandeja los guarda igual). */
  mutedTypes: AdminNotificationType[]
}

export const getAdminPushStatus = async (): Promise<AdminPushStatus> => {
  const res = await apiClient.get("/admin/push/status")
  return res.data
}

export const registerAdminPushToken = async (token: string): Promise<void> => {
  await apiClient.post("/admin/push/tokens", { token })
}

export const removeAdminPushToken = async (token: string): Promise<void> => {
  await apiClient.delete("/admin/push/tokens", { data: { token } })
}

export const listAdminPushDevices = async (): Promise<AdminPushDevice[]> => {
  const res = await apiClient.get("/admin/push/devices")
  return res.data.devices
}

export const removeAdminPushDevice = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/push/devices/${id}`)
}

export const getAdminPushPreferences = async (): Promise<AdminPushPreferences> => {
  const res = await apiClient.get("/admin/push/preferences")
  return res.data
}

export const updateAdminPushPreferences = async (
  mutedTypes: AdminNotificationType[]
): Promise<AdminPushPreferences> => {
  const res = await apiClient.put("/admin/push/preferences", { mutedTypes })
  return res.data
}

/** Devuelve el resultado real del envío (null si el backend no lo informa). */
export const sendAdminPushTest = async (): Promise<PushTestResult | null> => {
  const res = await apiClient.post("/admin/push/test")
  return res.data && typeof res.data.devices === "number" ? res.data : null
}
