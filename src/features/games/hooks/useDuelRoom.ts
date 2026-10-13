import { useCallback, useEffect, useRef, useState } from "react";
import { reservationsSocketUrl } from "../../reservations/hooks/useReservationSocket";
import { clockOffset } from "../lib/games";
import type { DuelServerMessage, DuelState } from "../types";

// Duelo de la carta: la partida de este celular contra el servidor, por
// WebSocket (/api/games/ws). El servidor lleva el juego; acá solo se mandan las
// acciones y se guarda la última foto de la partida que llegó.
//
// - El socket se abre recién al crear una sala o sumarse (no por abrir la carta).
// - El acceso a la sala (código + token) queda en sessionStorage: si se corta
//   la conexión o se recarga la página, se vuelve a entrar solo ("rejoin") y la
//   partida sigue donde está.
// - Sin conexión se reintenta con espera creciente; mientras tanto se muestra
//   lo último que se vio.

const PRODUCTION_WS_URL = "wss://menu-digital-backend.koyeb.app/api/games/ws";
const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 15_000;

// Misma derivación que Reservas y Pedidos (VITE_WS_URL / VITE_API_URL / producción), con el path de juegos.
export function gamesSocketUrl(): string | null {
  const explicit = import.meta.env.VITE_GAMES_WS_URL as string | undefined;
  if (explicit) return explicit;
  const reservations = reservationsSocketUrl();
  if (!reservations) return null;
  return reservations.endsWith("/reservations/ws")
    ? reservations.replace(/\/reservations\/ws$/, "/games/ws")
    : PRODUCTION_WS_URL;
}

interface StoredRoom { code: string; token: string }

const roomKey = (slug: string) => `md:duel:${slug}`;

const readRoom = (slug: string): StoredRoom | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(roomKey(slug)) ?? "null") as Partial<StoredRoom> | null;
    return parsed && typeof parsed.code === "string" && typeof parsed.token === "string"
      ? { code: parsed.code, token: parsed.token }
      : null;
  } catch {
    return null;
  }
};

const writeRoom = (slug: string, room: StoredRoom | null) => {
  try {
    if (room) sessionStorage.setItem(roomKey(slug), JSON.stringify(room));
    else sessionStorage.removeItem(roomKey(slug));
  } catch {
    // Sin almacenamiento: funciona igual mientras no se recargue.
  }
};

// Errores que significan "esa sala ya no es tuya": no tiene sentido reintentar.
const GONE = new Set(["ROOM_NOT_FOUND", "PLAYER_NOT_FOUND", "GAME_UNAVAILABLE"]);

type Entry = { type: "create"; name: string } | { type: "join"; code: string; name: string };

export interface DuelRoom {
  state: DuelState | null;
  // Reloj del servidor menos el de este celular (ms), para la cuenta regresiva.
  offset: number;
  // connecting: entrando · online: en la sala · offline: en la sala, reconectando.
  connection: "idle" | "connecting" | "online" | "offline";
  error: string | null;
  // Hay una sala guardada de antes (recarga): se está volviendo a entrar.
  resuming: boolean;
  create: (name: string) => void;
  join: (code: string, name: string) => void;
  start: () => void;
  answer: (round: number, option: number) => void;
  again: () => void;
  leave: () => void;
  clearError: () => void;
}

export function useDuelRoom(slug: string): DuelRoom {
  const [state, setState] = useState<DuelState | null>(null);
  const [offset, setOffset] = useState(0);
  const [connection, setConnection] = useState<DuelRoom["connection"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(() => readRoom(slug) !== null);

  const socket = useRef<WebSocket | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const delay = useRef(MIN_DELAY_MS);
  // Lo que hay que mandar al abrir: entrar por primera vez, o nada (se vuelve con lo guardado).
  const entry = useRef<Entry | null>(null);
  const alive = useRef(true);
  // El reintento llama a la versión vigente de connect (que se define más abajo).
  const reconnect = useRef<() => void>(() => {});

  const reset = useCallback((message: string | null) => {
    writeRoom(slug, null);
    entry.current = null;
    clearTimeout(retry.current);
    const current = socket.current;
    socket.current = null;
    current?.close();
    setState(null);
    setResuming(false);
    setConnection("idle");
    setError(message);
  }, [slug]);

  const connect = useCallback(() => {
    const url = gamesSocketUrl();
    if (!url || typeof WebSocket === "undefined") {
      setError("No pudimos conectarnos al juego. Revisá la conexión.");
      setConnection("idle");
      return;
    }
    clearTimeout(retry.current);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      setError("No pudimos conectarnos al juego. Revisá la conexión.");
      setConnection("idle");
      return;
    }
    socket.current = ws;

    ws.onopen = () => {
      delay.current = MIN_DELAY_MS;
      const stored = readRoom(slug);
      // Con una sala guardada siempre se vuelve a esa; si no, se entra con lo pedido.
      if (stored) ws.send(JSON.stringify({ type: "rejoin", slug, code: stored.code, token: stored.token }));
      else if (entry.current) ws.send(JSON.stringify({ ...entry.current, slug }));
      else ws.close();
    };

    ws.onmessage = event => {
      let message: DuelServerMessage;
      try {
        message = JSON.parse(String(event.data)) as DuelServerMessage;
      } catch {
        return;
      }
      if (message.type === "joined") {
        writeRoom(slug, { code: message.code, token: message.playerToken });
        entry.current = null;
        setResuming(false);
        setError(null);
      }
      if (message.type === "joined" || message.type === "state") {
        setOffset(clockOffset(message.state.serverNow, Date.now()));
        setState(message.state);
        setConnection("online");
      } else if (message.type === "closed") {
        reset("La partida se cerró.");
      } else if (message.type === "left") {
        reset(null);
      } else if (message.type === "error") {
        // La sala guardada ya no existe (o no pudo entrar): vuelve al inicio del juego.
        if (GONE.has(message.code ?? "") || !readRoom(slug)) reset(message.message);
        else setError(message.message);
      }
    };

    ws.onclose = () => {
      if (socket.current !== ws) return; // lo cerramos nosotros
      socket.current = null;
      if (!alive.current) return;
      // En una sala: se reintenta solo. Sin sala (no llegó a entrar): se avisa.
      if (readRoom(slug)) {
        setConnection("offline");
        retry.current = setTimeout(() => reconnect.current(), delay.current);
        delay.current = Math.min(delay.current * 2, MAX_DELAY_MS);
      } else if (entry.current) {
        entry.current = null;
        setConnection("idle");
        setError("No pudimos conectarnos al juego. Revisá la conexión y probá de nuevo.");
      }
    };
    ws.onerror = () => { ws.close(); };
  }, [slug, reset]);

  useEffect(() => { reconnect.current = connect; }, [connect]);

  // Al montar: si quedó una sala de antes (recarga de la página), se vuelve a entrar.
  useEffect(() => {
    alive.current = true;
    const first = readRoom(slug) ? setTimeout(() => { setConnection("connecting"); connect(); }, 0) : undefined;
    // Al volver a la pestaña no se espera el reintento.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !socket.current && readRoom(slug)) {
        delay.current = MIN_DELAY_MS;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      clearTimeout(first);
      clearTimeout(retry.current);
      document.removeEventListener("visibilitychange", onVisible);
      const current = socket.current;
      socket.current = null;
      current?.close();
    };
  }, [slug, connect]);

  const enter = useCallback((next: Entry) => {
    entry.current = next;
    setError(null);
    setConnection("connecting");
    const current = socket.current;
    if (current && current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ ...next, slug }));
    else if (!current) connect();
  }, [slug, connect]);

  const send = useCallback((message: Record<string, unknown>) => {
    const current = socket.current;
    if (current && current.readyState === WebSocket.OPEN) current.send(JSON.stringify(message));
  }, []);

  const leave = useCallback(() => {
    const current = socket.current;
    if (current && current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: "leave" }));
    reset(null);
  }, [reset]);

  return {
    state,
    offset,
    connection,
    error,
    resuming,
    create: useCallback((name: string) => enter({ type: "create", name }), [enter]),
    join: useCallback((code: string, name: string) => enter({ type: "join", code, name }), [enter]),
    start: useCallback(() => send({ type: "start" }), [send]),
    answer: useCallback((round: number, option: number) => send({ type: "answer", round, option }), [send]),
    again: useCallback(() => send({ type: "again" }), [send]),
    leave,
    clearError: useCallback(() => setError(null), []),
  };
}
