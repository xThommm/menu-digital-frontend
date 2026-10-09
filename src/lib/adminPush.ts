import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging"
import { registerAdminPushToken, removeAdminPushToken } from "../api/adminPush"
import { detectPushBlocker, type PushBlocker } from "./pushDevices"

// Notificaciones push del panel admin (Firebase Cloud Messaging). La config
// web de Firebase es pública por diseño (va en el bundle), la clave privada
// vive solo en el backend.
const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
}
const VAPID_KEY = import.meta.env.FIREBASE_VAPID_KEY

const SW_URL = "/firebase-messaging-sw.js"
// Scope propio: el service worker solo recibe push, no controla la app.
const SW_SCOPE = "/firebase-cloud-messaging-push-scope"

// Último token registrado en este navegador, para poder darlo de baja al
// desactivar o cerrar sesión sin volver a pedirle uno a Firebase.
const TOKEN_KEY = "admin-push-token"

export const isAdminPushConfigured = () => Boolean(
  firebaseConfig.apiKey
  && firebaseConfig.projectId
  && firebaseConfig.messagingSenderId
  && firebaseConfig.appId
  && VAPID_KEY
)

/**
 * Qué le impide a ESTE navegador recibir push, mirando solo el dispositivo
 * (no la config de Firebase ni el backend). En iPhone/iPad distingue "falta
 * instalar el panel en la pantalla de inicio" de "no soportado".
 */
export const getAdminPushBlocker = async (): Promise<PushBlocker> => {
  const blocker = detectPushBlocker({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: window.matchMedia("(display-mode: standalone)").matches
      // Safari de iOS anterior a display-mode.
      || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasPushApi: "Notification" in window && "serviceWorker" in navigator && "PushManager" in window,
  })
  if (blocker !== "ready") return blocker
  // Última palabra del SDK (IndexedDB, cookies, etc.).
  return (await isSupported().catch(() => false)) ? "ready" : "unsupported"
}

const getFirebaseApp = (): FirebaseApp => getApps()[0] ?? initializeApp(firebaseConfig)

const getRegistration = () => navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })

const readStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const storeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sin storage igual funciona; solo no se podrá dar de baja al salir.
  }
}

export const hasStoredAdminPushToken = () => Boolean(readStoredToken())

/**
 * Huella (SHA-256 en hex) del token de este navegador, para reconocerlo en
 * la lista de dispositivos que devuelve el backend. null si no hay token.
 */
export const getAdminPushFingerprint = async (): Promise<string | null> => {
  const token = readStoredToken()
  if (!token || !globalThis.crypto?.subtle) return null
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Olvida el token en este navegador sin avisarle al backend: se usa cuando
 * el dispositivo ya fue quitado desde otro lado (lista de dispositivos).
 */
export const forgetAdminPushToken = () => {
  if (!readStoredToken()) return
  storeToken(null)
  if (isAdminPushConfigured()) {
    void deleteToken(getMessaging(getFirebaseApp())).catch(() => undefined)
  }
}

/**
 * Pide permiso (si hace falta), obtiene el token FCM de este navegador y lo
 * registra en el backend. Tiene que llamarse desde un click: los navegadores
 * bloquean el pedido de permiso fuera de un gesto del usuario.
 */
export const enableAdminPush = async (): Promise<NotificationPermission> => {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return permission

  const token = await getToken(getMessaging(getFirebaseApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: await getRegistration(),
  })
  await registerAdminPushToken(token)
  storeToken(token)
  return permission
}

/**
 * Vuelve a mandar el token al backend si el permiso sigue concedido. Firebase
 * rota los tokens cada tanto; sin esto el backend se quedaría con uno viejo.
 */
export const refreshAdminPushToken = async () => {
  if (Notification.permission !== "granted" || !readStoredToken()) return

  const token = await getToken(getMessaging(getFirebaseApp()), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: await getRegistration(),
  })
  const previous = readStoredToken()
  if (previous && previous !== token) {
    await removeAdminPushToken(previous).catch(() => undefined)
  }
  await registerAdminPushToken(token)
  storeToken(token)
}

/**
 * Deja de recibir push en este navegador (botón "Desactivar notificaciones").
 * El logout no la llama: las push siguen llegando con la sesión cerrada.
 */
export const disableAdminPush = async () => {
  const token = readStoredToken()
  storeToken(null)
  if (!token) return

  await removeAdminPushToken(token).catch(() => undefined)
  if (isAdminPushConfigured()) {
    // Invalida el token también del lado de Firebase; no hace falta esperarlo.
    void deleteToken(getMessaging(getFirebaseApp())).catch(() => undefined)
  }
}
