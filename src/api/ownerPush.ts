import apiClient from "./client"
import type { PushTestResult } from "../lib/pushDevices"

// Avisos push del dueño del local (pedido nuevo, mesa abierta, reserva nueva).

export interface OwnerPushStatus {
  /** El backend tiene Firebase configurado. */
  enabled: boolean
  /** Dispositivos del local que reciben los avisos. */
  devices: number
}

export const getOwnerPushStatus = async (): Promise<OwnerPushStatus> => {
  const res = await apiClient.get("/push/status")
  return res.data
}

export const registerOwnerPushToken = async (token: string): Promise<void> => {
  await apiClient.post("/push/tokens", { token })
}

export const removeOwnerPushToken = async (token: string): Promise<void> => {
  await apiClient.delete("/push/tokens", { data: { token } })
}

export const sendOwnerPushTest = async (): Promise<PushTestResult | null> => {
  const res = await apiClient.post("/push/test")
  return res.data && typeof res.data.devices === "number" ? res.data : null
}
