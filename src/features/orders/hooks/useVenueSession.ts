import { useCallback, useEffect, useState } from "react";
import { getVenueContext } from "../api/publicOrdersApi";
import {
  clearVenueSession, readVenueSession, saveVenueSession, type InVenueContext,
} from "../lib/venueSession";

// ¿El comensal está en el local? Lo decide el token del QR (?mesa=<token>),
// validado contra el backend. Sin token válido la carta funciona como
// siempre (carrito → WhatsApp).
//
// El token se lee UNA vez al montar (antes de que nadie toque la URL) y se
// saca de la barra de direcciones: así un link copiado desde la carta no
// "lleva" la mesa. La sesión queda en localStorage unas horas (ver
// venueSession.ts) para que recargar no la pierda.

export interface VenueState {
  token: string | null;
  context: InVenueContext | null;
  // Se puede perder si el dueño regenera el QR mientras el cliente está sentado.
  invalidate: () => void;
}

const readTokenFromUrl = (): string | null => {
  const token = new URLSearchParams(window.location.search).get("mesa");
  return token && /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
};

const stripTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("mesa")) return;
  params.delete("mesa");
  const search = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
};

export function useVenueSession(slug: string | undefined): VenueState {
  const [urlToken] = useState(readTokenFromUrl);
  const [session, setSession] = useState(() => (slug ? readVenueSession(slug) : null));
  const [prevSlug, setPrevSlug] = useState(slug);
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setSession(slug ? readVenueSession(slug) : null);
  }

  useEffect(() => {
    stripTokenFromUrl();
    if (!slug || !urlToken) return;
    const controller = new AbortController();
    getVenueContext(slug, urlToken, controller.signal)
      .then(context => {
        if (context.inVenue) {
          saveVenueSession(slug, urlToken, context);
          setSession(readVenueSession(slug));
        } else {
          // QR viejo o de otro local: la carta sigue como siempre.
          clearVenueSession(slug);
          setSession(null);
        }
      })
      .catch(() => {
        // Sin conexión con el módulo de pedidos: la carta sigue como siempre.
      });
    return () => controller.abort();
  }, [slug, urlToken]);

  const invalidate = useCallback(() => {
    if (slug) clearVenueSession(slug);
    setSession(null);
  }, [slug]);

  return { token: session?.token ?? null, context: session?.context ?? null, invalidate };
}
