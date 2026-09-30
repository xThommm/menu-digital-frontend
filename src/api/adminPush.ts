import apiClient from "./client"

export interface AdminPushStatus {
  /** El backend tiene Firebase configurado (FIREBASE_SERVICE_ACCOUNT). */
  enabled: boolean
  /** Dispositivos del admin logueado que reciben push. */
  devices: number
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

export const sendAdminPushTest = async (): Promise<void> => {
  await apiClient.post("/admin/push/test")
}
