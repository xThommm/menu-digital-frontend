import { useEffect, useRef, useState } from "react";
import type { SocketMessage } from "../types";

// Producción: el front se sirve desde Vercel y /api se reescribe al backend,
// pero Vercel no reenvía WebSockets: hay que conectarse directo al backend.
const PRODUCTION_WS_URL = "wss://menu-digital-backend.koyeb.app/api/reservations/ws";
const WS_PATH = "/reservations/ws";

// URL del WebSocket del backend. VITE_WS_URL la fija a mano; si no, se deriva
// de VITE_API_URL (ej. http://localhost:5000/api → ws://localhost:5000/api/reservations/ws).
export function reservationsSocketUrl(): string | null {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;

  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (api && /^https?:\/\//i.test(api)) {
    return api.replace(/^http/i, "ws").replace(/\/$/, "") + WS_PATH;
  }
  // VITE_API_URL relativo ("/api"): en local el proxy de Vite alcanza; en
  // producción hay que ir directo al backend.
  if (typeof window === "undefined") return null;
  const { hostname, protocol, host } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol === "https:" ? "wss" : "ws"}://${host}/api${WS_PATH}`;
  }
  return PRODUCTION_WS_URL;
}

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

interface Options {
  enabled: boolean;
  // Primer mensaje al conectar: {type:"auth",token} (panel) o {type:"watch",code} (cliente).
  hello: { type: "auth"; token: string } | { type: "watch"; code: string } | null;
  onMessage: (message: SocketMessage) => void;
  // Cada vez que (re)conecta: sirve para volver a consultar lo que se pudo
  // perder mientras el socket estaba caído.
  onOpen?: () => void;
}

/**
 * Conexión WebSocket a las reservas con reconexión automática (backoff). La
 * pantalla que la usa debe tener además una consulta HTTP de respaldo: si el
 * socket no se puede abrir, el resto funciona igual. Devuelve si está conectado.
 */
export function useReservationSocket({ enabled, hello, onMessage, onOpen }: Options): boolean {
  const [connected, setConnected] = useState(false);
  const handlers = useRef({ onMessage, onOpen });
  useEffect(() => { handlers.current = { onMessage, onOpen }; });

  const helloKey = hello ? JSON.stringify(hello) : null;

  useEffect(() => {
    const url = reservationsSocketUrl();
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
          handlers.current.onMessage(JSON.parse(String(event.data)) as SocketMessage);
        } catch {
          // Mensaje que no es JSON: se ignora.
        }
      };
      socket.onclose = event => {
        setConnected(false);
        socket = null;
        // 1008 = el servidor rechazó la sesión o el código: reintentar no sirve.
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
