import { useEffect, useRef } from "react";
import { useOrdersSocket, type OrdersSocketMessage, type SocketHello } from "./useOrdersSocket";

// Mantiene una pantalla al día por avisos del WebSocket en vez de consultar a
// intervalos fijos. El aviso no trae datos: dispara `refresh`, que vuelve a
// pedir el estado por HTTP (la fuente de verdad).
//
// La consulta periódica queda solo como red de seguridad:
//   - con el socket conectado, muy espaciada (por si se perdió un aviso);
//   - sin socket (red caída, backend anterior), al ritmo de antes, así la
//     pantalla nunca queda peor que cuando solo consultaba.

const ONLINE_FALLBACK_MS = 60_000;
// Varios avisos seguidos (un pedido que genera tres comandas) son una sola consulta.
const COALESCE_MS = 150;

// "ready": el servidor ya suscribió a esta pantalla (al conectar o reconectar); se
// consulta ahí, y no al abrir el socket, para no perder lo que pase en el medio.
const NOTICE_TYPES: OrdersSocketMessage["type"][] = ["delivery", "order", "orders", "ready"];

// Sesión del panel del local (JWT del dueño), o null si no hay.
export const ownerHello = (): SocketHello | null => {
  try {
    const token = localStorage.getItem("token");
    return token ? { type: "auth", token } : null;
  } catch {
    return null;
  }
};

interface Options {
  hello: SocketHello | null;
  refresh: () => void | Promise<void>;
  // Cada cuánto consultar mientras el socket NO está conectado.
  offlineMs: number;
  // Cada cuánto consultar con el socket conectado.
  onlineMs?: number;
  enabled?: boolean;
  // Primera consulta al montar (false si la pantalla ya carga sus datos por otro lado).
  initial?: boolean;
}

/** Devuelve si el socket está conectado. */
export function useLiveRefresh({ hello, refresh, offlineMs, onlineMs = ONLINE_FALLBACK_MS, enabled = true, initial = true }: Options): boolean {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const poke = () => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = undefined;
      void refreshRef.current();
    }, COALESCE_MS);
  };

  const connected = useOrdersSocket({
    enabled: enabled && !!hello,
    hello,
    // Un aviso se atiende aunque la pestaña esté en segundo plano: así suena el
    // aviso de pedido nuevo y el título se actualiza sin tener la pantalla al frente.
    onMessage: message => { if (NOTICE_TYPES.includes(message.type)) poke(); },
  });

  useEffect(() => {
    if (!enabled) return;
    const first = initial ? setTimeout(() => void refreshRef.current(), 0) : undefined;
    const onVisible = () => { if (document.visibilityState === "visible") void refreshRef.current(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearTimeout(pending.current);
      pending.current = undefined;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, initial]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshRef.current();
    }, connected ? onlineMs : offlineMs);
    return () => clearInterval(timer);
  }, [enabled, connected, onlineMs, offlineMs]);

  return connected;
}
