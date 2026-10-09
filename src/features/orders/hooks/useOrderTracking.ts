import { useEffect, useState } from "react";
import { getOnlineCheckoutStatus } from "../api/publicOrdersApi";
import { errorStatus } from "../lib/errors";
import { isTrackingActive } from "../lib/orderTracking";
import type { OnlineCheckoutStatus } from "../types";

// Consulta el estado de un pedido pagado online hasta que termina. El ritmo
// depende de qué se espera: el pago (cada 3 s al principio) o el avance del
// pedido (cada 15 s). Pausa mientras la pestaña está oculta. El resultado
// SIEMPRE sale del servidor, nunca de la URL de retorno.

const FAST_MS = 3000;
const SLOW_MS = 15000;
const FAST_TRIES = 20;

export interface OrderTrackingState {
  status: OnlineCheckoutStatus | null;
  // El pago tarda más de lo normal en confirmarse.
  gaveUp: boolean;
  // El servidor no conoce esa referencia (otro local, vencida o mal copiada).
  missing: boolean;
}

export function useOrderTracking(slug: string, reference: string | null): OrderTrackingState {
  const [state, setState] = useState<OrderTrackingState>({ status: null, gaveUp: false, missing: false });

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    const schedule = (ms: number) => { timer = setTimeout(tick, ms); };

    async function tick() {
      if (document.visibilityState === "hidden") { schedule(5000); return; }
      tries += 1;
      try {
        const status = await getOnlineCheckoutStatus(slug, reference as string);
        if (cancelled) return;
        setState({ status, gaveUp: tries >= FAST_TRIES && status.status === "PENDING", missing: false });
        if (!isTrackingActive(status)) return;
        schedule(status.status === "PENDING" && tries < FAST_TRIES ? FAST_MS : SLOW_MS);
      } catch (error) {
        if (cancelled) return;
        if (errorStatus(error) === 404) { setState({ status: null, gaveUp: false, missing: true }); return; }
        setState(prev => ({ ...prev, gaveUp: tries >= FAST_TRIES }));
        schedule(tries < FAST_TRIES ? FAST_MS : SLOW_MS);
      }
    }

    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [slug, reference]);

  return state;
}
