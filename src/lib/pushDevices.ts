// Lógica pura de las notificaciones push del panel admin: qué le impide a
// este navegador recibirlas y cómo describir un dispositivo. Sin imports de
// Firebase ni acceso a `window`, para poder testearla con node.

/** Por qué este navegador no puede activar las push (o "ready" si puede). */
export type PushBlocker =
  | "ready"
  /** iPhone/iPad en una pestaña de Safari: hay que instalar el panel. */
  | "ios-install"
  /** iPhone/iPad instalado, pero con un iOS anterior a 16.4. */
  | "ios-outdated"
  /** El navegador no soporta notificaciones push. */
  | "unsupported"

export interface PushEnvironment {
  userAgent: string
  /** navigator.maxTouchPoints: distingue un iPad que se presenta como Mac. */
  maxTouchPoints: number
  /** Abierto desde el ícono de la pantalla de inicio (app instalada). */
  standalone: boolean
  /** Existen Notification, serviceWorker y PushManager. */
  hasPushApi: boolean
}

export const isIOS = ({ userAgent, maxTouchPoints }: Pick<PushEnvironment, "userAgent" | "maxTouchPoints">) => (
  /iPhone|iPad|iPod/.test(userAgent)
  // iPadOS se identifica como "Macintosh"; una Mac real no tiene pantalla táctil.
  || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
)

/**
 * iOS solo entrega push a las web instaladas en la pantalla de inicio (desde
 * iOS 16.4). En una pestaña de Safari la API ni siquiera existe, así que se
 * distingue ese caso para poder explicarle al admin qué hacer.
 */
export const detectPushBlocker = (env: PushEnvironment): PushBlocker => {
  if (isIOS(env)) {
    if (!env.standalone) return "ios-install"
    return env.hasPushApi ? "ready" : "ios-outdated"
  }
  return env.hasPushApi ? "ready" : "unsupported"
}

/** Estado de las push en este navegador, sumando la config y el servidor. */
export type AdminPushStatus =
  | "loading"
  | PushBlocker
  /** Faltan las variables FIREBASE_* en el build del frontend. */
  | "not-configured"
  /** El backend no tiene FIREBASE_SERVICE_ACCOUNT. */
  | "server-off"
  /** No se pudo consultar el estado. */
  | "error"

/** Qué decirle al admin cuando no puede activar las notificaciones. */
export const PUSH_STATUS_HELP: Record<Exclude<AdminPushStatus, "loading" | "ready">, string> = {
  "ios-install": "En iPhone y iPad los avisos solo funcionan con el panel instalado: tocá Compartir, elegí \"Agregar a inicio\" y abrí el panel desde ese ícono.",
  "ios-outdated": "Este dispositivo necesita iOS 16.4 o posterior para recibir avisos.",
  unsupported: "Este navegador no soporta notificaciones push. Probá con Chrome, Edge, Firefox o Safari actualizados.",
  "not-configured": "Al sitio le falta la configuración de Firebase (variables FIREBASE_* del frontend).",
  "server-off": "El servidor no tiene las notificaciones configuradas (FIREBASE_SERVICE_ACCOUNT).",
  error: "No se pudo consultar el estado de las notificaciones. Recargá el panel para reintentar.",
}

const OS_PATTERNS: [RegExp, string][] = [
  [/iPhone|iPod/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
]

// El orden importa: Edge, Opera y Samsung también dicen "Chrome", y Chrome
// también dice "Safari".
const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
]

const firstMatch = (patterns: [RegExp, string][], text: string) => (
  patterns.find(([pattern]) => pattern.test(text))?.[1] ?? null
)

/** "Chrome en Android", "Safari en iPhone"… para la lista de dispositivos. */
export const describeDevice = (userAgent: string | null | undefined): string => {
  if (!userAgent) return "Dispositivo desconocido"
  const os = firstMatch(OS_PATTERNS, userAgent)
  const browser = firstMatch(BROWSER_PATTERNS, userAgent)
  if (browser && os) return `${browser} en ${os}`
  return browser ?? os ?? "Dispositivo desconocido"
}

export interface PushTestResult {
  devices: number
  delivered: number
  failed: number
  removed: number
}

/** Resultado de la notificación de prueba, en una frase para el admin. */
export const describeTestResult = (result: PushTestResult | null): { ok: boolean; message: string } => {
  // Un backend anterior a este cambio responde sin cuerpo.
  if (!result) return { ok: true, message: "Notificación de prueba enviada" }

  if (result.devices === 0) {
    return { ok: false, message: "No hay ningún dispositivo con las notificaciones activadas" }
  }
  const plural = (count: number) => (count === 1 ? "dispositivo" : "dispositivos")
  if (result.delivered === 0) {
    return { ok: false, message: `La prueba no llegó a ninguno de los ${result.devices} ${plural(result.devices)}` }
  }
  if (result.failed > 0) {
    return {
      ok: true,
      message: `Prueba enviada a ${result.delivered} de ${result.devices} ${plural(result.devices)} (${result.failed} con error)`,
    }
  }
  return { ok: true, message: `Prueba enviada a ${result.delivered} ${plural(result.delivered)}` }
}
