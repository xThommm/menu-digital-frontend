import { isAxiosError } from "axios";

// Extrae el mensaje real que mandó el backend de un error de axios (ej: "Esa
// etapa no existe") en vez de mostrar siempre un string fijo que oculta el
// motivo real del rechazo. Devuelve `fallback` si el error no vino de axios
// o la respuesta no traía `data.message`.
export function extractServerMessage(err: unknown, fallback: string): string {
  const serverMessage = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : null;
  return serverMessage || fallback;
}
