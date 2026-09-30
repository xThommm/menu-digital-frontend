/* Service worker de notificaciones push del panel admin (Firebase Cloud
 * Messaging).
 *
 * No carga el SDK de Firebase: el backend manda mensajes "data-only"
 * ({ title, body, url }) y acá los mostramos a mano con el evento `push`
 * estándar. Así no hace falta repetir la config de Firebase en este archivo
 * (un service worker no puede leer import.meta.env) ni importar scripts de
 * un CDN externo.
 *
 * Se registra con un scope propio (ver src/lib/adminPush.ts) para no tomar
 * control de las páginas de la app: solo recibe push.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  // FCM entrega { data: {...} } en mensajes data-only; `notification` queda
  // como respaldo por si algún día se manda desde la consola de Firebase.
  const data = payload.data || {};
  const title = data.title || payload.notification?.title || "Menú Digital";
  const body = data.body || payload.notification?.body || "";
  const url = data.url || "/admin";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon-96x96.png",
      badge: "/favicon-96x96.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin", self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si el panel ya está abierto en alguna pestaña, se reusa esa.
      const existing = windows.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) return existing.navigate(target.href);
        return undefined;
      }
      return self.clients.openWindow(target.href);
    })()
  );
});
