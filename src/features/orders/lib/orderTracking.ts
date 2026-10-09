import type { OnlineCheckoutStatus, OnlineEstimate, OnlineServiceType } from "../types";
import { readJson, removeKey, writeJson } from "./storage";

// Seguimiento del pedido que el cliente pagó online: qué le mostramos según el
// estado, la frase del tiempo estimado y el recuerdo del pedido en este
// navegador (para volver a verlo sin el link de Mercado Pago). Sin datos
// personales: solo la referencia del pago, que es un código aleatorio.

export const TRACKING_STEPS: Record<OnlineServiceType, string[]> = {
  takeaway: ["Recibido", "Preparando", "Listo para retirar", "Entregado"],
  delivery: ["Recibido", "Preparando", "Listo", "En camino", "Entregado"],
};

const ACTIVE_ORDER = ["pending", "confirmed", "ready"];
const PAID = ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"];

// ¿Hay algo más que esperar? (el pago se confirma, o el pedido sigue en marcha)
export const isTrackingActive = (status: OnlineCheckoutStatus): boolean => {
  if (status.status === "PENDING") return !status.expired;
  if (!PAID.includes(status.status)) return false;
  return status.orderStatus === null || ACTIVE_ORDER.includes(status.orderStatus);
};

// "Tu pedido estará listo entre 10 y 25 minutos" (null si el local no cargó tiempos).
export const estimateSentence = (estimate: OnlineEstimate | null | undefined): string | null => {
  if (!estimate) return null;
  return estimate.minMinutes === estimate.maxMinutes
    ? `Tu pedido estará listo en unos ${estimate.maxMinutes} minutos`
    : `Tu pedido estará listo entre ${estimate.minMinutes} y ${estimate.maxMinutes} minutos`;
};

const clock = (date: Date) => date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// "20:40 y 20:55": la franja contada desde que el local confirmó el pedido.
export const estimateWindow = (estimate: OnlineEstimate, fromIso: string): string => {
  const from = new Date(fromIso).getTime();
  return `${clock(new Date(from + estimate.minMinutes * 60_000))} y ${clock(new Date(from + estimate.maxMinutes * 60_000))}`;
};

export interface TrackingView {
  title: string;
  text: string;
  // Etapa actual (0-3; 0-4 en delivery) o -1 si todavía no hay pedido / terminó sin entregarse.
  step: number;
  tone: "wait" | "ok" | "bad";
}

export const trackingView = (status: OnlineCheckoutStatus | null, gaveUp: boolean): TrackingView => {
  if (!status) {
    return {
      title: "Estamos confirmando tu pago",
      text: gaveUp ? "Está tardando más de lo normal. Si ya pagaste, tu pedido le llegará al local apenas Mercado Pago lo confirme." : "Esto puede tardar unos segundos. No cierres esta pantalla.",
      step: -1,
      tone: "wait",
    };
  }

  if (status.status === "REJECTED") {
    return { title: "El pago no se completó", text: "No se realizó ningún cobro. Tu carrito sigue armado: podés intentar de nuevo o pedir por WhatsApp.", step: -1, tone: "bad" };
  }
  if (status.status === "PENDING") {
    if (status.expired) return { title: "El pago venció", text: "No se realizó ningún cobro. Tu carrito sigue armado: podés intentar de nuevo.", step: -1, tone: "bad" };
    return {
      title: "Estamos confirmando tu pago",
      text: gaveUp ? "Todavía no recibimos la confirmación. Si ya pagaste, el pedido le llegará al local apenas Mercado Pago lo confirme." : "Esto puede tardar unos segundos. No cierres esta pantalla.",
      step: -1,
      tone: "wait",
    };
  }

  // Pagado.
  const delivery = status.serviceType === "delivery";
  switch (status.orderStatus) {
    case null:
      return { title: "¡Pago aprobado!", text: "Tu pago está acreditado. En un momento el pedido aparece en el local.", step: 0, tone: "ok" };
    case "pending":
      return { title: "Esperando que el local confirme", text: "Ya recibieron tu pago. Apenas confirmen el pedido empiezan a prepararlo.", step: 0, tone: "wait" };
    case "confirmed":
      return { title: "Estamos preparando tu pedido", text: "El local ya confirmó tu pedido y lo está preparando.", step: 1, tone: "ok" };
    case "ready":
      if (!delivery) return { title: "¡Tu pedido está listo!", text: "Ya podés pasar a retirarlo.", step: 2, tone: "ok" };
      return status.dispatchedAt
        ? { title: "Tu pedido va en camino", text: "Ya salió del local hacia la dirección que dejaste.", step: 3, tone: "ok" }
        : { title: "¡Tu pedido está listo!", text: "Está esperando al repartidor para salir hacia tu dirección.", step: 2, tone: "ok" };
    case "delivered":
      return { title: "Pedido entregado", text: "¡Gracias por tu compra! Que lo disfrutes.", step: delivery ? 4 : 3, tone: "ok" };
    default: {
      // Cancelado o devuelto por el local.
      const refund = status.refund === "none"
        ? "Estamos gestionando la devolución de tu dinero."
        : "Te devolvimos el dinero a tu cuenta de Mercado Pago; puede tardar unos días en verse reflejado.";
      return { title: "El local no pudo tomar tu pedido", text: refund, step: -1, tone: "bad" };
    }
  }
};

// ── Recuerdo del pedido en este navegador ──
const KEY = (slug: string) => `md:online-order:${slug}`;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface Tracked { ref: string; savedAt: number }
const isTracked = (value: unknown): value is Tracked =>
  typeof value === "object" && value !== null
  && typeof (value as Tracked).ref === "string" && typeof (value as Tracked).savedAt === "number";

export const saveTrackedOrder = (slug: string, ref: string) => writeJson(KEY(slug), { ref, savedAt: Date.now() });

export const readTrackedOrder = (slug: string): string | null => {
  const tracked = readJson(KEY(slug), isTracked);
  return tracked && Date.now() - tracked.savedAt < MAX_AGE_MS && /^[0-9a-f]{48}$/.test(tracked.ref) ? tracked.ref : null;
};

export const forgetTrackedOrder = (slug: string) => removeKey(KEY(slug));
