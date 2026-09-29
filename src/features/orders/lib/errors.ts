import { isAxiosError } from "axios";
import { ApiError } from "../../../api/apiClient";
import { extractServerMessage } from "../../../lib/apiErrors";

// Mensaje para mostrar de un error de axios (panel) o de apiFetch (carta y
// tomador de pedidos). Los mensajes del módulo de pedidos del backend están
// pensados para el usuario.
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return extractServerMessage(err, fallback);
}

// Código de error del backend (ej. "ACTIVE_ORDERS"), si lo mandó.
export function errorCode(err: unknown): string | undefined {
  if (err instanceof ApiError) {
    const details = err.details as { code?: unknown } | null;
    return typeof details?.code === "string" ? details.code : undefined;
  }
  if (isAxiosError<{ code?: string }>(err)) return err.response?.data?.code;
  return undefined;
}

export const errorStatus = (err: unknown): number | undefined =>
  err instanceof ApiError ? err.status : isAxiosError(err) ? err.response?.status : undefined;
