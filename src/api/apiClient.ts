/**
 * apiClient.ts
 * ────────────────────────────────────────────────────────────────────────
 * Wrapper único sobre fetch() para todo el frontend (UserEditor, MenuEditor,
 * y cualquier componente futuro). Reemplaza los `fetch(...) + if (!res.ok)
 * throw new Error()` repetidos en cada función por una sola fuente de verdad
 * que:
 *
 *  1. Clasifica el error (red, timeout, validación, auth, servidor, etc.)
 *     en vez de un Error genérico sin información.
 *  2. Aplica un timeout con AbortController (un fetch que cuelga hoy no
 *     muestra ningún error: el usuario ve el spinner girando para siempre).
 *  3. Lee el mensaje que mande el backend (`{ message: "..." }`) y si no
 *     hay, cae a un mensaje por defecto en español, consistente en toda
 *     la app.
 *  4. Permite cancelar la solicitud desde afuera (por ejemplo al desmontar
 *     un componente o cambiar de tab) pasando un `signal`.
 *
 * No reemplaza tu lógica de negocio: vos seguís decidiendo qué hacer con
 * cada tipo de error en el componente (mostrar banner, revertir estado
 * optimista, redirigir a login, etc.) usando `err.type`.
 */

export type ApiErrorType =
  | "network"     // el fetch nunca llegó al servidor (sin conexión, DNS, CORS)
  | "timeout"     // se superó el tiempo límite configurado
  | "validation"  // 400 / 422 — datos inválidos enviados por el usuario
  | "auth"        // 401 — token vencido o inválido
  | "forbidden"   // 403 — autenticado pero sin permiso
  | "notFound"    // 404
  | "conflict"    // 409 — ej: ya existe un registro con esos datos
  | "server"      // 5xx — error del backend, no es culpa del usuario
  | "unknown";    // cualquier otro caso

const DEFAULT_MESSAGES: Record<ApiErrorType, string> = {
  network:    "No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.",
  timeout:    "La operación tardó demasiado. Intentá de nuevo.",
  validation: "Revisá los datos ingresados.",
  auth:       "Tu sesión expiró. Iniciá sesión de nuevo.",
  forbidden:  "No tenés permiso para hacer esto.",
  notFound:   "No se encontró lo que buscabas.",
  conflict:   "Ya existe un registro con esos datos.",
  server:     "Hubo un problema en el servidor. Intentá más tarde.",
  unknown:    "Algo salió mal. Intentá de nuevo.",
};

/**
 * Error tipado que viaja por toda la app. `details` guarda el payload crudo
 * del backend SOLO para logging/debug — nunca se muestra al usuario tal cual,
 * porque puede contener stack traces o nombres de campos internos.
 */
export class ApiError extends Error {
  readonly type: ApiErrorType;
  readonly status?: number;
  readonly details?: unknown;

  constructor(type: ApiErrorType, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.status = status;
    this.details = details;
  }
}

function classifyStatus(status: number): ApiErrorType {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

interface ApiFetchOptions extends RequestInit {
  /** Tiempo máximo de espera antes de abortar. Default: 10s. */
  timeoutMs?: number;
  /** Si la respuesta no es JSON (ej: 204 No Content), poner en false. Default: true. */
  parseJson?: boolean;
}

/**
 * Reemplazo directo de fetch() para llamadas a la API propia.
 *
 * Uso:
 *   const data = await apiFetch<Negocio>("/api/users/me", {
 *     headers: { Authorization: `Bearer ${token}` },
 *   });
 *
 * Si algo falla, siempre tira un ApiError (nunca un Error genérico ni un
 * TypeError de fetch), así el código que lo llama puede confiar en
 * `err instanceof ApiError` y leer `err.type` / `err.message`.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 10_000, parseJson = true, signal: callerSignal, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Si el caller pasa su propio signal (ej: AbortController por unmount),
  // lo encadenamos para que cancelar desde afuera también funcione.
  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener("abort", onCallerAbort);

  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", onCallerAbort);

    if (callerSignal?.aborted) {
      // Cancelado a propósito por el componente (unmount, cambio de tab).
      // No es un error real: quien llama debe ignorar esto silenciosamente.
      throw new ApiError("unknown", "cancelled", undefined, err);
    }
    if (controller.signal.aborted) {
      throw new ApiError("timeout", DEFAULT_MESSAGES.timeout);
    }
    throw new ApiError("network", DEFAULT_MESSAGES.network, undefined, err);
  }
  clearTimeout(timeoutId);
  callerSignal?.removeEventListener("abort", onCallerAbort);

  let body: any = null;
  if (parseJson) {
    try {
      body = await res.json();
    } catch {
      // Respuesta vacía (204) o no-JSON. No es necesariamente un error.
      body = null;
    }
  }

  if (!res.ok) {
    const type = classifyStatus(res.status);
    const serverMessage = typeof body?.message === "string" ? body.message : undefined;
    throw new ApiError(type, serverMessage || DEFAULT_MESSAGES[type], res.status, body);
  }

  return body as T;
}

/** Atajo para distinguir una cancelación intencional de un error real. */
export function isCancelled(err: unknown): boolean {
  return err instanceof ApiError && err.message === "cancelled";
}