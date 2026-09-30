import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging"
import { registerAdminPushToken, removeAdminPushToken } from "../api/adminPush"

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

export const isAdminPushSupported = async () => (
  isAdminPushConfigured()
  && "Notification" in window
  && "serviceWorker" in navigator
  && (await isSupported())
)

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
