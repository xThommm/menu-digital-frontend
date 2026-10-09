import { useEffect, useRef, useState } from "react";
import { getCustomerDelivery, getOnlineCheckoutStatus } from "../api/publicOrdersApi";
import { useOrdersSocket } from "./useOrdersSocket";
import { errorStatus } from "../lib/errors";
import { isTrackingActive } from "../lib/orderTracking";
import type { CustomerDeliveryInfo, OnlineCheckoutStatus } from "../types";

// Sigue el estado de un pedido pagado online hasta que termina. Escucha el
// WebSocket del pedido: cuando Mercado Pago confirma el pago, el local avanza
// el estado o quita un producto, o el repartidor lo retira o entrega, se vuelve
// a consultar al instante. La consulta periódica es el respaldo: espaciada con
// el socket conectado (15 s esperando el pago, 60 s después) y al ritmo de
// siempre sin él (3 s / 15 s). Pausa mientras la pestaña está oculta. El
// resultado SIEMPRE sale del servidor, nunca de la URL de retorno.

const FAST_MS = 3000;
const SLOW_MS = 15000;
const FAST_TRIES = 20;
// Respaldo con el WebSocket conectado: el aviso es el que manda.
const LIVE_FAST_MS = 15000;
const LIVE_SLOW_MS = 60000;

// Cuánto esperar hasta la próxima consulta. `fast`: se espera la confirmación del pago.
const nextDelay = (fast: boolean, live: boolean) =>
  live ? (fast ? LIVE_FAST_MS : LIVE_SLOW_MS) : (fast ? FAST_MS : SLOW_MS);

export interface OrderTrackingState {
  status: OnlineCheckoutStatus | null;
  // El pago tarda más de lo normal en confirmarse.
  gaveUp: boolean;
  // El servidor no conoce esa referencia (otro local, vencida o mal copiada).
  missing: boolean;
  // Delivery que ya salió: repartidor y código de entrega (solo mientras va en camino).
  delivery: CustomerDeliveryInfo | null;
}

// ¿Hay que pedir los datos del envío? Solo un delivery que ya salió y sigue en camino.
const onTheWay = (status: OnlineCheckoutStatus) =>
  status.serviceType === "delivery" && status.orderStatus === "ready" && !!status.dispatchedAt;

export function useOrderTracking(slug: string, reference: string | null): OrderTrackingState {
  const [state, setState] = useState<OrderTrackingState>({ status: null, gaveUp: false, missing: false, delivery: null });
  const [watching, setWatching] = useState(true);
  const poke = useRef<(() => void) | null>(null);

  const connected = useOrdersSocket({
    enabled: !!reference && watching,
    hello: reference ? { type: "watch", slug, ref: reference } : null,
    // "ready": el servidor ya nos anotó para este pedido; se consulta por si algo cambió justo antes.
    onMessage: message => { if (message.type === "order" || message.type === "delivery" || message.type === "ready") poke.current?.(); },
  });
  // Con el socket conectado, el pago aprobado y cada avance del pedido llegan
  // como aviso: la consulta periódica queda de respaldo, mucho más espaciada.
  const live = useRef(false);
  useEffect(() => { live.current = connected; }, [connected]);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    const schedule = (ms: number) => { timer = setTimeout(tick, ms); };
    poke.current = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      void tick();
    };

    async function tick() {
      if (document.visibilityState === "hidden") { schedule(5000); return; }
      tries += 1;
      try {
        const status = await getOnlineCheckoutStatus(slug, reference as string);
        if (cancelled) return;
        // El código de entrega solo se pide cuando el pedido va en camino; si falla, el resto del seguimiento sigue.
        const delivery = onTheWay(status)
          ? await getCustomerDelivery(slug, reference as string).catch(() => null)
          : null;
        if (cancelled) return;
        setState({ status, gaveUp: tries >= FAST_TRIES && status.status === "PENDING", missing: false, delivery });
        if (!isTrackingActive(status)) { setWatching(false); return; }
        schedule(nextDelay(status.status === "PENDING" && tries < FAST_TRIES, live.current));
      } catch (error) {
        if (cancelled) return;
        if (errorStatus(error) === 404) { setState({ status: null, gaveUp: false, missing: true, delivery: null }); setWatching(false); return; }
        setState(prev => ({ ...prev, gaveUp: tries >= FAST_TRIES }));
        schedule(nextDelay(tries < FAST_TRIES, live.current));
      }
    }

    void tick();
    return () => { cancelled = true; poke.current = null; if (timer) clearTimeout(timer); };
  }, [slug, reference]);

  return state;
}
