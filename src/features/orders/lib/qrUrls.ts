// URLs que llevan los QR de Gestión de pedidos.
//
// - Mesa / general: la carta con ?mesa=<token>&src=qr. `mesa` es lo que
//   prueba que el comensal está en el local; `src=qr` mantiene el conteo de
//   visitas por QR de las estadísticas.
// - Operador: /<slug>/operador?code=<código> (el código rota desde el panel).
//   /<slug>/mozo sigue funcionando (nombre anterior).

const origin = () => window.location.origin;

export const venueQrUrl = (slug: string, token: string) =>
  `${origin()}/${slug}/menu?mesa=${encodeURIComponent(token)}&src=qr`;

export const waiterQrUrl = (slug: string, code: string) =>
  `${origin()}/${slug}/operador?code=${encodeURIComponent(code)}`;

// Pedido grupal: la carta con ?grupo=<token>. Quien lo abre se suma al pedido de esa mesa.
export const groupJoinUrl = (slug: string, joinToken: string) =>
  `${origin()}/${slug}/menu?grupo=${encodeURIComponent(joinToken)}`;

// Repartidor: /<slug>/repartidor?code=<código> (el código rota desde el panel y sirve una sola vez).
export const courierQrUrl = (slug: string, code: string) =>
  `${origin()}/${slug}/repartidor?code=${encodeURIComponent(code)}`;

// Página donde el repartidor tipea el código corto (sin escanear ni conocer el slug del local).
export const courierManualUrl = () => `${origin()}/repartidor`;
