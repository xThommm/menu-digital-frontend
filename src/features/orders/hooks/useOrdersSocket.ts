import { useEffect, useRef, useState } from "react";
import { reservationsSocketUrl } from "../../reservations/hooks/useReservationSocket";

// WebSocket de pedidos y Delivery (/api/orders/ws). Los mensajes son AVISOS sin
// datos: al recibirlos la pantalla vuelve a pedir el estado por HTTP, que sigue
// siendo la fuente de verdad. Por eso la pantalla que lo usa debe tener además
// una consulta periódica de respaldo: si el socket no abre, todo sigue andando.

export type SocketHello =
  | { type: "auth"; token: string }                          // panel del local (JWT)
  | { type: "auth"; role: "courier"; token: string }         // repartidor
  | { type: "watch"; slug: string; ref: string };            // cliente

export interface OrdersSocketMessage {
  type: "ready" | "error" | "delivery" | "order";
  event?: string;
  orderId?: number | null;
  orderNumber?: number | null;
  code?: string;
  role?: string;
}

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const PRODUCTION_WS_URL = "wss://menu-digital-backend.koyeb.app/api/orders/ws";

// Misma derivación que Reservas (VITE_WS_URL / VITE_API_URL / producción), con el path de pedidos.
export function ordersSocketUrl(): string | null {
  const explicit = import.meta.env.VITE_ORDERS_WS_URL as string | undefined;
  if (explicit) return explicit;
  const reservations = reservationsSocketUrl();
  if (!reservations) return null;
  return reservations.endsWith("/reservations/ws")
    ? reservations.replace(/\/reservations\/ws$/, "/orders/ws")
    : PRODUCTION_WS_URL;
}

interface Options {
  enabled: boolean;
  hello: SocketHello | null;
  onMessage: (message: OrdersSocketMessage) => void;
  // Cada vez que (re)conecta: sirve para volver a consultar lo que se pudo perder.
  onOpen?: () => void;
}

/** Conexión con reconexión automática (backoff). Devuelve si está conectado. */
export function useOrdersSocket({ enabled, hello, onMessage, onOpen }: Options): boolean {
  const [connected, setConnected] = useState(false);
  const handlers = useRef({ onMessage, onOpen });
  useEffect(() => { handlers.current = { onMessage, onOpen }; });

  const helloKey = hello ? JSON.stringify(hello) : null;

  useEffect(() => {
    const url = ordersSocketUrl();
    if (!enabled || !helloKey || !url || typeof WebSocket === "undefined") return;

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = MIN_DELAY_MS;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      try {
        socket = new WebSocket(url);
      } catch {
        schedule();
        return;
      }
      socket.onopen = () => {
        delay = MIN_DELAY_MS;
        setConnected(true);
        socket?.send(helloKey);
        handlers.current.onOpen?.();
      };
      socket.onmessage = event => {
        try {
          handlers.current.onMessage(JSON.parse(String(event.data)) as OrdersSocketMessage);
        } catch {
          // Mensaje que no es JSON: se ignora.
        }
      };
      socket.onclose = event => {
        setConnected(false);
        socket = null;
        // 1008 = el servidor rechazó la sesión: reintentar no sirve.
        if (!stopped && event.code !== 1008) schedule();
      };
      socket.onerror = () => { socket?.close(); };
    };

    const schedule = () => {
      if (stopped) return;
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, MAX_DELAY_MS);
    };

    // Al volver a la pestaña no se espera el backoff.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !socket && !stopped) {
        clearTimeout(retry);
        delay = MIN_DELAY_MS;
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
      socket?.close();
      setConnected(false);
    };
  }, [enabled, helloKey]);

  return connected;
}
