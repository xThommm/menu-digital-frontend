/**
 * useAsyncAction.ts
 * ────────────────────────────────────────────────────────────────────────
 * Hoy, cada función async en UserEditor.tsx y MenuEditor.tsx repite el mismo
 * patrón 9 veces:
 *
 *   setSaving(true); setError(""); setSuccess("");
 *   try {
 *     ...
 *     setSuccess("...");
 *   } catch {
 *     setError("...");
 *   } finally {
 *     setSaving(false);
 *   }
 *
 * Este hook reemplaza ese boilerplate por una sola línea por acción, y de
 * paso usa ApiError para mostrar mensajes reales (validación, sin conexión,
 * sesión vencida, servidor caído) en vez de un string fijo sin importar qué
 * pasó.
 *
 * Los mensajes se conservan como strings para los banners inline que sigan
 * siendo útiles y, mediante useFeedbackMessage, también se publican en el
 * sistema global de notificaciones.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isCancelled } from "./../api/apiClient";
import { useFeedbackMessage } from "./useFeedbackMessage";

interface RunOptions {
  /** Mensaje a mostrar en el banner de éxito si la acción termina bien. */
  successMessage?: string;
  /**
   * Se llama si la acción falla, antes de actualizar el estado de error.
   * Útil para revertir un update optimista (ej: removeImage) o reaccionar
   * a un tipo de error puntual (ej: err.type === "auth" → redirigir a login).
   */
  onError?: (err: ApiError) => void;
}

export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useFeedbackMessage("error");
  const [success, setSuccess] = useFeedbackMessage("success");

  // Evita pisar el estado de un componente ya desmontado (ej: el usuario
  // navega afuera del editor mientras una request todavía está en vuelo).
  const mountedRef = useRef(true);
  const pendingRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async <T,>(
    fn: () => Promise<T>,
    opts: RunOptions = {}
  ): Promise<T | undefined> => {
    pendingRef.current += 1;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await fn();
      if (mountedRef.current) {
        if (opts.successMessage) setSuccess(opts.successMessage);
      }
      return result;
    } catch (err) {
      if (isCancelled(err)) return undefined; // cancelación intencional, no mostrar nada

      const apiErr = err instanceof ApiError
        ? err
        : new ApiError(
            "unknown",
            err instanceof Error && err.message
              ? err.message
              : "Algo salió mal. Intentá de nuevo.",
          );

      if (mountedRef.current) {
        opts.onError?.(apiErr);
        setError(apiErr.message);
      }
      return undefined;
    } finally {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (mountedRef.current && pendingRef.current === 0) setLoading(false);
    }
  }, [setError, setSuccess]);

  return { loading, error, success, setError, setSuccess, run, mountedRef };
}
