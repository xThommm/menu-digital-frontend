import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAdminNotificationsUnreadCount,
  markAdminNotificationEventRead,
} from "../api/adminNotifications"

// Prefijo común: invalidarlo refresca el badge Y la lista de la bandeja.
export const ADMIN_NOTIFICATIONS_KEY = ["admin-notifications"] as const
export const adminNotificationsUnreadKey = [...ADMIN_NOTIFICATIONS_KEY, "unread-count"] as const

// Query param que agrega el service worker al abrir el panel desde una push
// (ver public/firebase-messaging-sw.js).
const PUSH_EVENT_PARAM = "notification"

/**
 * Badge de no leídas de la bandeja del panel admin. Se refresca solo:
 * polling liviano mientras la pestaña está visible, al instante cuando llega
 * una push con el panel abierto, y marca como leído el aviso cuando el panel
 * se abre tocando una push.
 */
export function useAdminNotifications() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const unread = useQuery({
    queryKey: adminNotificationsUnreadKey,
    queryFn: getAdminNotificationsUnreadCount,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  // El service worker avisa a las pestañas abiertas cuando llega una push.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "admin-notification") {
        void queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATIONS_KEY })
      }
      // Click en una push con el panel ya abierto: el SW no puede navegar
      // esta pestaña (no la controla), así que le pasa la ruta.
      const path = event.data?.path
      if (event.data?.type === "admin-notification-open" && typeof path === "string"
        && path.startsWith("/") && !path.startsWith("//")) {
        navigate(path)
      }
    }
    navigator.serviceWorker.addEventListener("message", handleMessage)
    // Las páginas que el SW no controla (tiene scope propio) necesitan esto
    // para empezar a recibir mensajes.
    navigator.serviceWorker.startMessages()
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage)
  }, [navigate, queryClient])

  // Abierto desde una push: marca ese aviso como leído y limpia la URL.
  const eventID = new URLSearchParams(location.search).get(PUSH_EVENT_PARAM)
  useEffect(() => {
    if (!eventID) return
    const params = new URLSearchParams(location.search)
    params.delete(PUSH_EVENT_PARAM)
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true })

    markAdminNotificationEventRead(eventID)
      .catch(() => undefined)
      .finally(() => queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATIONS_KEY }))
  }, [eventID, location.pathname, location.search, navigate, queryClient])

  return { unreadCount: unread.data ?? 0 }
}
