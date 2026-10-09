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
  // Identifica el aviso en la bandeja de notificaciones del panel.
  const eventID = data.eventID || null;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: "/favicon-96x96.png",
        badge: "/favicon-96x96.png",
        data: { url, eventID },
      }),
      // Las pestañas abiertas refrescan el contador de no leídas al instante.
      postToWindows({ type: "admin-notification" }),
    ])
  );
});

const getWindows = () => self.clients.matchAll({ type: "window", includeUncontrolled: true });

const postToWindows = async (message) => {
  const windows = await getWindows();
  windows.forEach((client) => client.postMessage(message));
};

// El backend manda la ruta relativa ("/admin/payments"); las push viejas
// traían la URL completa. En los dos casos solo se abre este mismo sitio.
const resolveTarget = (url) => {
  try {
    const target = new URL(url || "/admin", self.location.origin);
    if (target.origin === self.location.origin) return target;
  } catch {
    // URL mal formada: se abre el panel.
  }
  return new URL("/admin", self.location.origin);
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = resolveTarget(event.notification.data?.url);
  // El panel lee este parámetro, marca el aviso como leído y lo saca de la URL
  // (ver src/hooks/useAdminNotifications.ts).
  const eventID = event.notification.data?.eventID;
  if (eventID) target.searchParams.set("notification", eventID);

  event.waitUntil(
    (async () => {
      const windows = await getWindows();
      // Si el panel admin ya está abierto en alguna pestaña, se reusa esa
      // (solo el panel escucha el mensaje). No sirve client.navigate(): solo
      // funciona con páginas que este SW controla y por su scope propio no
      // controla ninguna. La pestaña navega sola dentro de la SPA.
      const existing = windows.find((client) => {
        const url = new URL(client.url);
        return url.origin === target.origin && url.pathname.startsWith("/admin");
      });
      if (existing) {
        try {
          await existing.focus();
          existing.postMessage({
            type: "admin-notification-open",
            path: `${target.pathname}${target.search}`,
          });
          return undefined;
        } catch {
          // Algunos navegadores (iOS) no dejan traer al frente una ventana
          // que este service worker no controla: se abre una nueva.
        }
      }
      return self.clients.openWindow(target.href);
    })()
  );
});
