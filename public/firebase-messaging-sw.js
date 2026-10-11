/* Service worker de notificaciones push (Firebase Cloud Messaging): las del
 * panel admin y las del dueño de cada local (pedido nuevo, mesa abierta,
 * reserva nueva; vienen con scope "owner").
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
  const owner = data.scope === "owner";
  const title = data.title || payload.notification?.title || "Menú Digital";
  const body = data.body || payload.notification?.body || "";
  const url = data.url || homeOf(owner);
  // Identifica el aviso en la bandeja de notificaciones del panel.
  const eventID = data.eventID || null;

  if (owner) {
    // Aviso del local: queda en pantalla hasta que lo toquen (un pedido no
    // se puede pasar por alto), vibra y vuelve a sonar aunque reemplace a
    // uno anterior de la misma mesa.
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/favicon-96x96.png",
        badge: "/favicon-96x96.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url, owner: true },
      })
    );
    return;
  }

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

// Pantalla que abre una push sin ruta.
const homeOf = (owner) => (owner ? "/pedidos" : "/admin");

// Pantallas del panel del dueño (para reusar una pestaña ya abierta).
const OWNER_PATHS = ["/pedidos", "/reservas", "/dashboard", "/menu/editor", "/user/editor", "/estadisticas", "/configuracion"];

const isPanelPath = (pathname, owner) => (owner
  ? OWNER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  : pathname.startsWith("/admin"));

const getWindows = () => self.clients.matchAll({ type: "window", includeUncontrolled: true });

const postToWindows = async (message) => {
  const windows = await getWindows();
  windows.forEach((client) => client.postMessage(message));
};

// El backend manda la ruta relativa ("/admin/payments"); las push viejas
// traían la URL completa. En los dos casos solo se abre este mismo sitio.
const resolveTarget = (url, owner) => {
  try {
    const target = new URL(url || homeOf(owner), self.location.origin);
    if (target.origin === self.location.origin) return target;
  } catch {
    // URL mal formada: se abre el panel.
  }
  return new URL(homeOf(owner), self.location.origin);
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const owner = event.notification.data?.owner === true;
  const target = resolveTarget(event.notification.data?.url, owner);
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
        return url.origin === target.origin && isPanelPath(url.pathname, owner);
      });
      if (existing) {
        try {
          await existing.focus();
          existing.postMessage({
            type: owner ? "owner-notification-open" : "admin-notification-open",
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
