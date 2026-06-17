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
 * No reemplaza los banners de error/success que ya existen en la UI — al
 * contrario, expone `error` / `success` con la misma forma (string) para que
 * sigan funcionando con el JSX y el useEffect de auto-clear que ya tenés.
 */
import { useCallback, useRef, useState } from "react";
import { ApiError, isCancelled } from "./../api/apiClient";

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
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  // Evita pisar el estado de un componente ya desmontado (ej: el usuario
  // navega afuera del editor mientras una request todavía está en vuelo).
  const mountedRef = useRef(true);

  const run = useCallback(async <T,>(
    fn: () => Promise<T>,
    opts: RunOptions = {}
  ): Promise<T | undefined> => {
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
        : new ApiError("unknown", "Algo salió mal. Intentá de nuevo.");

      opts.onError?.(apiErr);
      if (mountedRef.current) setError(apiErr.message);
      return undefined;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  return { loading, error, success, setError, setSuccess, run, mountedRef };
}