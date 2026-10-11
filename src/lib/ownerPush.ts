import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getMessaging, getToken } from "firebase/messaging"
import { registerOwnerPushToken, removeOwnerPushToken } from "../api/ownerPush"

// Avisos push del dueño del local (Firebase Cloud Messaging). Misma app de
// Firebase y mismo service worker que las push del admin (ver adminPush.ts);
// el backend marca estos avisos con scope "owner" para que al tocarlos se
// abra el panel del local.
export { isAdminPushConfigured as isPushConfigured, getAdminPushBlocker as getPushBlocker } from "./adminPush"

const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
}
const VAPID_KEY = import.meta.env.FIREBASE_VAPID_KEY

const SW_URL = "/firebase-messaging-sw.js"
const SW_SCOPE = "/firebase-cloud-messaging-push-scope"

// Último token registrado por el local en este navegador (para darlo de baja).
const TOKEN_KEY = "owner-push-token"

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
    // Sin storage igual funciona; solo no se podrá dar de baja después.
  }
}

const currentToken = async () => getToken(getMessaging(getFirebaseApp()), {
  vapidKey: VAPID_KEY,
  serviceWorkerRegistration: await getRegistration(),
})

/** Las push del local están activas en este navegador. */
export const isOwnerPushActive = () =>
  typeof Notification !== "undefined" && Notification.permission === "granted" && Boolean(readStoredToken())

/**
 * Pide permiso, obtiene el token de este navegador y lo registra para el
 * local. Tiene que llamarse desde un click (el navegador lo exige).
 */
export const enableOwnerPush = async (): Promise<NotificationPermission> => {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return permission
  const token = await currentToken()
  await registerOwnerPushToken(token)
  storeToken(token)
  return permission
}

/** Vuelve a mandar el token vigente (Firebase los rota cada tanto). */
export const refreshOwnerPushToken = async () => {
  if (!isOwnerPushActive()) return
  const token = await currentToken()
  const previous = readStoredToken()
  if (previous && previous !== token) await removeOwnerPushToken(previous).catch(() => undefined)
  await registerOwnerPushToken(token)
  storeToken(token)
}

/**
 * Deja de recibir los avisos del local en este navegador. No borra el token
 * de Firebase: el mismo navegador puede seguir recibiendo otras push.
 */
export const disableOwnerPush = async () => {
  const token = readStoredToken()
  storeToken(null)
  if (token) await removeOwnerPushToken(token).catch(() => undefined)
}
