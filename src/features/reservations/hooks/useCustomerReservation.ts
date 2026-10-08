import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isCancelled } from "../../../api/apiClient";
import {
  acceptAlternative, cancelReservation, createReservation, getReservation, getReservationConfig,
} from "../api/reservationsApi";
import { errorMessage } from "../../orders/lib/errors";
import {
  addToReservationHistory, clearReservationCode, normalizeCode, readReservationCode, readReservationHistory,
  removeFromReservationHistory, saveReservationCode,
} from "../lib/storage";
import type { CustomerReservation, NewReservationInput, ReservationConfig, SocketMessage } from "../types";
import { useReservationSocket } from "./useReservationSocket";

// Respaldo si el WebSocket no conecta: se vuelve a consultar cada tanto.
const FALLBACK_POLL_MS = 20_000;

// "Activa" = la que todavía le importa al cliente: pendiente, confirmada, o
// rechazada pero con un horario alternativo para responder. Una cancelada,
// cerrada o rechazada sin alternativa ya no cuenta: el botón de la landing
// vuelve a ofrecer reservar como si nunca hubiera pedido.
export const isActiveReservation = (reservation: CustomerReservation | null): boolean =>
  !!reservation && (
    reservation.status === "pending"
    || reservation.status === "confirmed"
    || (reservation.status === "rejected" && !!reservation.altTime)
  );

// Configuración pública de reservas del local. Ante cualquier error se
// comporta como "sin reservas online": la landing queda como siempre.
export function useReservationConfig(slug: string | undefined): ReservationConfig | null {
  const [state, setState] = useState<{ slug: string; config: ReservationConfig } | null>(null);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    getReservationConfig(slug, controller.signal)
      .then(config => setState({ slug, config }))
      .catch(() => { if (!controller.signal.aborted) setState({ slug, config: { enabled: false } }); });
    return () => controller.abort();
  }, [slug]);

  return state && state.slug === slug ? state.config : null;
}

/**
 * Reserva del cliente en este dispositivo: el código vive en localStorage,
 * el estado se consulta al backend y se mantiene al día por WebSocket.
 */
export function useCustomerReservation(slug: string, enabled: boolean) {
  const [code, setCode] = useState<string | null>(() => readReservationCode(slug));
  const [history, setHistory] = useState<string[]>(() => readReservationHistory(slug));
  const [reservation, setReservation] = useState<CustomerReservation | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef(code);
  useEffect(() => { codeRef.current = code; });

  // El código ya no existe: se saca del dispositivo (y del historial).
  const forget = useCallback(() => {
    const current = codeRef.current;
    clearReservationCode(slug);
    setCode(null);
    setReservation(null);
    if (current) setHistory(removeFromReservationHistory(slug, current));
  }, [slug]);

  const adopt = useCallback((next: CustomerReservation, name?: string) => {
    saveReservationCode(slug, next.code);
    setHistory(addToReservationHistory(slug, next.code));
    setCode(next.code);
    setReservation(next);
    if (name) setBusinessName(name);
    setError(null);
  }, [slug]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = codeRef.current;
    if (!current) return;
    try {
      const result = await getReservation(slug, current, signal);
      setReservation(result.reservation);
      setBusinessName(result.businessName);
      setError(null);
    } catch (err) {
      if (isCancelled(err)) return;
      // El código ya no existe (o es de otro local): no tiene sentido guardarlo.
      if (err instanceof ApiError && err.status === 404) forget();
      else setError(errorMessage(err, "No pudimos consultar tu reserva."));
    }
  }, [slug, forget]);

  // Carga inicial con el código guardado.
  useEffect(() => {
    if (!enabled || !code) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      refresh(controller.signal).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
    // `code` solo cambia al crear/consultar/olvidar; esos flujos ya traen la reserva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, slug]);

  const onMessage = useCallback((message: SocketMessage) => {
    if (message.type !== "reservation") return;
    const next = message.reservation as CustomerReservation;
    if (next.code === codeRef.current) setReservation(next);
  }, []);

  const connected = useReservationSocket({
    enabled: enabled && !!code,
    hello: code ? { type: "watch", code } : null,
    onMessage,
    onOpen: () => { void refresh(); },
  });

  // Sin socket, se consulta cada tanto mientras la pestaña esté visible.
  useEffect(() => {
    if (!enabled || !code || connected) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, code, connected, refresh]);

  const run = useCallback(async (task: () => Promise<{ reservation: CustomerReservation; businessName: string }>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      adopt(result.reservation, result.businessName);
      return result.reservation;
    } catch (err) {
      setError(errorMessage(err, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  }, [adopt]);

  const create = useCallback(
    (input: NewReservationInput) => run(() => createReservation(slug, input), "No pudimos enviar tu reserva."),
    [run, slug]
  );

  // "Consultar mi reserva": el código tipeado en otro dispositivo.
  const lookup = useCallback((raw: string) => {
    const normalized = normalizeCode(raw);
    if (!normalized) {
      setError("El código tiene 8 letras y números, por ejemplo ABCD-EFGH.");
      return Promise.resolve(null);
    }
    return run(() => getReservation(slug, normalized), "No pudimos consultar esa reserva.");
  }, [run, slug]);

  const accept = useCallback(
    () => run(() => acceptAlternative(slug, codeRef.current ?? ""), "No pudimos solicitar el nuevo horario."),
    [run, slug]
  );

  const cancel = useCallback(
    () => run(() => cancelReservation(slug, codeRef.current ?? ""), "No pudimos cancelar la reserva."),
    [run, slug]
  );

  // Abre una reserva del historial como la actual de este dispositivo.
  const select = useCallback((next: CustomerReservation) => adopt(next), [adopt]);

  const dropFromHistory = useCallback((target: string) => {
    setHistory(removeFromReservationHistory(slug, target));
    if (target === codeRef.current) {
      clearReservationCode(slug);
      setCode(null);
      setReservation(null);
    }
  }, [slug]);

  return {
    code, history, reservation, businessName, loading, error, busy, connected,
    setError, create, lookup, accept, cancel, forget, select, dropFromHistory,
  };
}
