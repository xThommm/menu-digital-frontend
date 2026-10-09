import apiClient from "./client"

export type AdminNotificationType =
  | "registration"
  | "payment"
  | "payment_failed"
  | "refund"
  | "subscription"
  | "test"
  | "other"
export type AdminNotificationBox = "inbox" | "archived"
export type AdminNotificationStatus = "all" | "unread" | "read"
export type AdminNotificationBulkAction = "read" | "unread" | "archive" | "unarchive" | "delete"

export interface AdminNotification {
  id: string
  eventID: string
  type: AdminNotificationType
  title: string
  body: string
  /** Ruta del panel a la que lleva el aviso (ej. "/admin/payments"). */
  url: string
  read: boolean
  readAt: string | null
  archived: boolean
  archivedAt: string | null
  createdAt: string
}

export interface AdminNotificationsResponse {
  notifications: AdminNotification[]
  /** No leídas de la bandeja de entrada (las archivadas no cuentan). */
  unreadCount: number
  pagination: { page: number; limit: number; total: number; pages: number }
}

export interface AdminNotificationParams {
  box?: AdminNotificationBox
  status?: AdminNotificationStatus
  page?: number
  limit?: number
}

export const listAdminNotifications = async (
  params: AdminNotificationParams = {}
): Promise<AdminNotificationsResponse> => {
  const res = await apiClient.get("/admin/notifications", { params })
  return res.data
}

export const getAdminNotificationsUnreadCount = async (): Promise<number> => {
  const res = await apiClient.get("/admin/notifications/unread-count")
  return res.data.unreadCount
}

/** Devuelve la notificación y la marca como leída. */
export const openAdminNotification = async (id: string): Promise<AdminNotification> => {
  const res = await apiClient.get(`/admin/notifications/${id}`)
  return res.data
}

export const updateAdminNotification = async (
  id: string,
  changes: { read?: boolean; archived?: boolean }
): Promise<AdminNotification> => {
  const res = await apiClient.patch(`/admin/notifications/${id}`, changes)
  return res.data
}

export const deleteAdminNotification = async (id: string): Promise<void> => {
  await apiClient.delete(`/admin/notifications/${id}`)
}

export const bulkUpdateAdminNotifications = async (
  ids: string[],
  action: AdminNotificationBulkAction
): Promise<{ affected: number; unreadCount: number }> => {
  const res = await apiClient.post("/admin/notifications/bulk", { ids, action })
  return res.data
}

export const markAllAdminNotificationsRead = async (): Promise<void> => {
  await apiClient.post("/admin/notifications/read-all")
}

/** Marca como leído el aviso que abrió el panel desde una push. */
export const markAdminNotificationEventRead = async (eventID: string): Promise<void> => {
  await apiClient.post(`/admin/notifications/events/${encodeURIComponent(eventID)}/read`)
}
