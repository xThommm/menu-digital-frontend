import { useEffect, useState } from "react";
import { getOnlineOrdering } from "../api/publicOrdersApi";
import type { OnlineOrderingConfig } from "../types";

// ¿Cobra pedidos online este local? Se consulta al entrar a la carta (no al
// abrir el carrito), así los botones de pago aparecen todos juntos y no uno
// después del otro. Mientras llega la respuesta `ready` es false y el carrito
// muestra un lugar reservado; si la consulta falla se trata como "no cobra
// online" y la carta sigue pidiendo por WhatsApp como siempre.

export interface OnlineOrderingState {
  ready: boolean;
  config: OnlineOrderingConfig;
}

const OFF: OnlineOrderingConfig = { enabled: false, modes: [], hideWhatsapp: false };

// Por sesión de navegación: reabrir la carta no vuelve a esperar.
const cache = new Map<string, OnlineOrderingConfig>();

export function useOnlineOrdering(slug: string | undefined, active: boolean): OnlineOrderingState {
  const [loaded, setLoaded] = useState<{ slug: string; config: OnlineOrderingConfig } | null>(() => {
    const cached = slug ? cache.get(slug) : undefined;
    return slug && cached ? { slug, config: cached } : null;
  });

  useEffect(() => {
    if (!active || !slug || cache.has(slug)) return;
    const controller = new AbortController();
    getOnlineOrdering(slug, controller.signal)
      .catch(() => OFF)
      .then(config => {
        if (controller.signal.aborted) return;
        cache.set(slug, config);
        setLoaded({ slug, config });
      });
    return () => controller.abort();
  }, [active, slug]);

  if (!active || !slug) return { ready: true, config: OFF };
  const config = loaded?.slug === slug ? loaded.config : cache.get(slug);
  return config ? { ready: true, config } : { ready: false, config: OFF };
}
