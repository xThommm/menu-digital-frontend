// URLs que llevan los QR de Gestión de pedidos.
//
// - Mesa / general: la carta con ?mesa=<token>&src=qr. `mesa` es lo que
//   prueba que el comensal está en el local; `src=qr` mantiene el conteo de
//   visitas por QR de las estadísticas.
// - Mozo: /<slug>/mozo?code=<código> (el código rota desde el panel).

const origin = () => window.location.origin;

export const venueQrUrl = (slug: string, token: string) =>
  `${origin()}/${slug}/menu?mesa=${encodeURIComponent(token)}&src=qr`;

export const waiterQrUrl = (slug: string, code: string) =>
  `${origin()}/${slug}/mozo?code=${encodeURIComponent(code)}`;
