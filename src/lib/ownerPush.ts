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

// Token y features activados por el local en este navegador. Nada guardado =
// push desactivadas (es el estado por defecto: se activan a mano por feature).
const STORAGE_KEY = "owner-push"

/** Features cuyos avisos pueden llegar como push. */
export type OwnerPushFeature = "orders" | "reservations"

interface Stored {
  token: string
  features: OwnerPushFeature[]
}

const getFirebaseApp = (): FirebaseApp => getApps()[0] ?? initializeApp(firebaseConfig)

const getRegistration = () => navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })

const isFeature = (value: unknown): value is OwnerPushFeature => value === "orders" || value === "reservations"

const readStored = (): Stored | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Stored> | null
    if (!parsed || typeof parsed.token !== "string" || !Array.isArray(parsed.features)) return null
    const features = parsed.features.filter(isFeature)
    return features.length > 0 ? { token: parsed.token, features } : null
  } catch {
    return null
  }
}

const writeStored = (value: Stored | null) => {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Sin storage igual funciona; solo no se recuerda en este navegador.
  }
}

const currentToken = async () => getToken(getMessaging(getFirebaseApp()), {
  vapidKey: VAPID_KEY,
  serviceWorkerRegistration: await getRegistration(),
})

/** Features con push activadas en este navegador (vacío = desactivadas). */
export const getOwnerPushFeatures = (): OwnerPushFeature[] => {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return []
  return readStored()?.features ?? []
}

/**
 * Deja este navegador recibiendo las push de esos features (vacío = ninguna).
 * Si hace falta pide permiso: tiene que llamarse desde un click.
 */
export const setOwnerPushFeatures = async (features: OwnerPushFeature[]): Promise<NotificationPermission> => {
  const stored = readStored()
  if (features.length === 0) {
    writeStored(null)
    if (stored) await removeOwnerPushToken(stored.token).catch(() => undefined)
    return Notification.permission
  }

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission()
  if (permission !== "granted") return permission
  const token = await currentToken()
  if (stored && stored.token !== token) await removeOwnerPushToken(stored.token).catch(() => undefined)
  await registerOwnerPushToken(token, features)
  writeStored({ token, features })
  return permission
}

/** Vuelve a mandar el token vigente (Firebase los rota cada tanto). */
export const refreshOwnerPushToken = async () => {
  const features = getOwnerPushFeatures()
  if (features.length > 0) await setOwnerPushFeatures(features)
}
