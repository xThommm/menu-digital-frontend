import { useCallback, useEffect, useState } from "react"
import { getAdminPushStatus, sendAdminPushTest } from "../api/adminPush"
import { useNotifications } from "../context/useNotifications"
import {
  disableAdminPush,
  enableAdminPush,
  hasStoredAdminPushToken,
  isAdminPushSupported,
  refreshAdminPushToken,
} from "../lib/adminPush"

// Traduce los fallos más comunes a algo accionable; el resto muestra el
// mensaje crudo (el detalle completo queda en la consola).
const describePushError = (err: unknown): string => {
  const e = err as { code?: string; name?: string; message?: string; response?: { status?: number } }
  if (e?.response?.status) return `el servidor respondió ${e.response.status}`
  if (e?.name === "AbortError" || e?.message?.includes("push service error")) {
    return "el navegador no tiene habilitado el servicio de push (en Brave: brave://settings/privacy → \"Usar servicios de Google para mensajería push\")"
  }
  if (e?.code === "messaging/failed-service-worker-registration") return "no se pudo registrar el service worker"
  return e?.code || e?.message || "error desconocido"
}

/**
 * Estado y acciones de las notificaciones push del panel admin en ESTE
 * navegador. `available` es false si el navegador no soporta push, si falta
 * la config de Firebase en el front o si el backend no la tiene: en ese caso
 * el panel directamente no muestra la opción.
 */
export function useAdminPush() {
  const { success, error, info } = useNotifications()
  const [available, setAvailable] = useState(false)
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        if (!(await isAdminPushSupported())) return
        const status = await getAdminPushStatus()
        if (cancelled || !status.enabled) return

        const granted = Notification.permission === "granted" && hasStoredAdminPushToken()
        setAvailable(true)
        setActive(granted)
        if (granted) await refreshAdminPushToken()
      } catch {
        // Las push son un extra: si algo falla acá, el panel sigue igual.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (active) {
        await disableAdminPush()
        setActive(false)
        info("Notificaciones desactivadas en este dispositivo")
        return
      }

      const permission = await enableAdminPush()
      if (permission === "granted") {
        setActive(true)
        success("Notificaciones activadas en este dispositivo")
      } else if (permission === "denied") {
        error("El navegador bloqueó las notificaciones. Habilitalas desde la configuración del sitio.")
      }
    } catch (err) {
      console.error("No se pudieron activar las notificaciones push:", err)
      error(`No se pudieron activar las notificaciones: ${describePushError(err)}`)
    } finally {
      setBusy(false)
    }
  }, [active, busy, error, info, success])

  const sendTest = useCallback(async () => {
    try {
      await sendAdminPushTest()
      info("Notificación de prueba enviada")
    } catch {
      error("No se pudo enviar la notificación de prueba")
    }
  }, [error, info])

  return { available, active, busy, toggle, sendTest }
}
