import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getAdminPushStatus, listAdminPushDevices, sendAdminPushTest } from "../api/adminPush"
import { useNotifications } from "../context/useNotifications"
import {
  disableAdminPush,
  enableAdminPush,
  forgetAdminPushToken,
  getAdminPushBlocker,
  getAdminPushFingerprint,
  hasStoredAdminPushToken,
  isAdminPushConfigured,
  refreshAdminPushToken,
} from "../lib/adminPush"
import { describeTestResult, PUSH_STATUS_HELP, type AdminPushStatus } from "../lib/pushDevices"

// Dispositivos y preferencias de push (pantalla de Notificaciones).
export const ADMIN_PUSH_KEY = ["admin-push"] as const
export const adminPushDevicesKey = [...ADMIN_PUSH_KEY, "devices"] as const
export const adminPushPreferencesKey = [...ADMIN_PUSH_KEY, "preferences"] as const

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

// ── Estado compartido ────────────────────────────────────────────────────────
// La barra lateral y la pantalla de Notificaciones muestran el mismo botón:
// el estado vive fuera de React para que las dos lo vean igual.

interface AdminPushState {
  /** Si este navegador puede recibir push y, si no, por qué. */
  status: AdminPushStatus
  /** Las push están activadas en ESTE navegador. */
  active: boolean
  busy: boolean
}

let state: AdminPushState = { status: "loading", active: false, busy: false }
const listeners = new Set<() => void>()

const setState = (patch: Partial<AdminPushState>) => {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const getSnapshot = () => state

// Cada carga invalida a la anterior (cambio de usuario sin recargar la página).
let loadID = 0

const resolveStatus = async (): Promise<Pick<AdminPushState, "status" | "active">> => {
  if (!isAdminPushConfigured()) return { status: "not-configured", active: false }

  const blocker = await getAdminPushBlocker()
  if (blocker !== "ready") return { status: blocker, active: false }

  const server = await getAdminPushStatus()
  if (!server.enabled) return { status: "server-off", active: false }

  let active = Notification.permission === "granted" && hasStoredAdminPushToken()
  if (active) {
    // Si este navegador ya no figura entre los dispositivos del admin (lo
    // quitó desde otro lado, o el token era de otro usuario), no se vuelve a
    // registrar solo: queda desactivado hasta que lo active de nuevo.
    try {
      const [devices, fingerprint] = await Promise.all([listAdminPushDevices(), getAdminPushFingerprint()])
      if (fingerprint && !devices.some((device) => device.fingerprint === fingerprint)) {
        forgetAdminPushToken()
        active = false
      }
    } catch {
      // Backend sin la lista de dispositivos: se sigue como antes.
    }
  }
  return { status: "ready", active }
}

const loadAdminPush = async () => {
  const id = ++loadID
  setState({ status: "loading", active: false })
  try {
    const next = await resolveStatus()
    if (id !== loadID) return
    setState(next)
    // Firebase rota los tokens cada tanto: se vuelve a mandar el vigente.
    if (next.active) await refreshAdminPushToken().catch(() => undefined)
  } catch {
    // Las push son un extra: si algo falla acá, el panel sigue igual.
    if (id === loadID) setState({ status: "error", active: false })
  }
}

/** Carga el estado de las push al entrar al panel. Va una sola vez, en el layout. */
export function useAdminPushBootstrap() {
  useEffect(() => {
    void loadAdminPush()
  }, [])
}

/**
 * Estado y acciones de las notificaciones push del panel admin en ESTE
 * navegador. `available` es false si el navegador no puede recibirlas o si
 * falta configuración; `status` dice por qué y `help` lo explica.
 */
export function useAdminPush() {
  const { success, error, info } = useNotifications()
  const queryClient = useQueryClient()
  const { status, active, busy } = useSyncExternalStore(subscribe, getSnapshot)
  const available = status === "ready"
  const help = status === "ready" || status === "loading" ? null : PUSH_STATUS_HELP[status]

  const toggle = useCallback(async () => {
    if (state.busy) return
    // No disponible: en vez de esconder el botón, se explica el motivo.
    if (state.status !== "ready") {
      if (state.status !== "loading") info(PUSH_STATUS_HELP[state.status])
      return
    }

    setState({ busy: true })
    try {
      if (state.active) {
        await disableAdminPush()
        setState({ active: false })
        info("Notificaciones desactivadas en este dispositivo")
        return
      }

      const permission = await enableAdminPush()
      if (permission === "granted") {
        setState({ active: true })
        success("Notificaciones activadas en este dispositivo")
      } else if (permission === "denied") {
        error("El navegador bloqueó las notificaciones. Habilitalas desde la configuración del sitio.")
      }
    } catch (err) {
      console.error("No se pudieron activar las notificaciones push:", err)
      error(`No se pudieron activar las notificaciones: ${describePushError(err)}`)
    } finally {
      setState({ busy: false })
      void queryClient.invalidateQueries({ queryKey: adminPushDevicesKey })
    }
  }, [error, info, queryClient, success])

  const sendTest = useCallback(async () => {
    try {
      const result = describeTestResult(await sendAdminPushTest())
      if (result.ok) info(result.message)
      else error(result.message)
    } catch (err) {
      error(`No se pudo enviar la notificación de prueba: ${describePushError(err)}`)
    } finally {
      // La prueba da de baja los dispositivos que ya no existen.
      void queryClient.invalidateQueries({ queryKey: adminPushDevicesKey })
    }
  }, [error, info, queryClient])

  /** Este navegador fue quitado desde la lista de dispositivos. */
  const markRemovedHere = useCallback(() => {
    forgetAdminPushToken()
    setState({ active: false })
  }, [])

  return { status, help, available, active, busy, toggle, sendTest, markRemovedHere }
}
