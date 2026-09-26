import type { CartLine } from "../context/CartContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// Los teléfonos se guardan como código de área + número local, 10 dígitos,
// sin 54, sin el 9, sin el 0 de discado ni el 15 (ej. "1123456789"). Es la
// misma normalización que backend/src/utils/phone.js: el backend la aplica
// al guardar, y acá se repite para los números cargados antes (hay cuentas
// con "549...", "54..." o con 0/15) y para validar el formulario sin ida y
// vuelta. Acepta "+54 9 11 2345-6789", "011 2345-6789", "11 15 2345-6789"...
// Si no reconoce la forma devuelve los dígitos tal cual.
const AR_LOCAL_LENGTH = 10;

export function normalizeArPhone(value: number | string | null | undefined): string {
  if (value == null) return "";
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Ningún código de área argentino empieza con 54: con 12 o más dígitos el
  // 54 inicial es siempre el código de país.
  if (digits.startsWith("54") && digits.length >= AR_LOCAL_LENGTH + 2) {
    digits = digits.slice(2);
    if (digits.startsWith("9") && digits.length === AR_LOCAL_LENGTH + 1) digits = digits.slice(1);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  // "15" de celular después del código de área (2, 3 o 4 dígitos).
  if (digits.length === AR_LOCAL_LENGTH + 2) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  return digits;
}

export function isValidArLocalPhone(digits: string): boolean {
  return /^[1-9]\d{9}$/.test(digits);
}

// WhatsApp necesita "54 9 <área><número>" para celulares argentinos.
export function sanitizePhoneForWa(number: number | string | null | undefined): string | null {
  const local = normalizeArPhone(number);
  return local ? `549${local}` : null;
}

// Un destino posible para el pedido o la reserva: un número por sucursal.
export interface WaTarget {
  name: string;
  phone: string; // ya en formato wa.me (549...)
}

// Los WhatsApp del local (contactInfo.whatsappNumbers, uno por sucursal) o,
// si no cargó ninguno, el teléfono de contacto — así las cuentas que solo
// tienen `number` siguen recibiendo pedidos y reservas como antes.
export function getWaTargets(info: {
  number?: number | null;
  whatsappNumbers?: { name?: string; number: string }[];
} | null | undefined): WaTarget[] {
  const list = info?.whatsappNumbers ?? [];
  if (list.length > 0) {
    return list.flatMap(({ name, number }) => {
      const phone = sanitizePhoneForWa(number);
      return phone ? [{ name: name?.trim() ?? "", phone }] : [];
    });
  }
  const phone = sanitizePhoneForWa(info?.number ?? null);
  return phone ? [{ name: "", phone }] : [];
}

export function buildWaHref(phone: string, message?: string): string {
  return message ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/${phone}`;
}

// Modalidades del pedido que ofrece el local (Mi negocio → Delivery / Take
// away). Con las dos, el cliente elige una al tocar "Pedir por WhatsApp".
export type OrderMode = "delivery" | "takeaway";

export const ORDER_MODE_LABELS: Record<OrderMode, { label: string; detail: string }> = {
  delivery: { label: "Delivery", detail: "Te lo llevan a tu domicilio" },
  takeaway: { label: "Take away", detail: "Lo retirás en el local" },
};

// Primera línea del mensaje. Es lo que WhatsApp muestra en la lista de chats,
// así el local distingue un pedido para enviar de uno para retirar sin abrir
// la conversación (y los encuentra buscando "DELIVERY" o "TAKE AWAY").
const ORDER_MODE_HEADERS: Record<OrderMode, string> = {
  delivery: "🛵 *DELIVERY*",
  takeaway: "🥡 *TAKE AWAY* (retiro en el local)",
};

// Las modalidades que ofrece el local, en el orden en que se muestran.
// `hasTakeAway` es opcional: un backend anterior al campo no lo manda.
export function getOrderModes(user: { hasDelivery?: boolean; hasTakeAway?: boolean }): OrderMode[] {
  const modes: OrderMode[] = [];
  if (user.hasDelivery === true) modes.push("delivery");
  if (user.hasTakeAway === true) modes.push("takeaway");
  return modes;
}

// Arma el texto del pedido: cada línea con cantidad, variante (si la hay) y
// subtotal, más el total al final. Formato legible para que el dueño no
// tenga que interpretar nada al recibirlo por WhatsApp. `extraText` es el
// mensaje de pedido de Mi negocio para esa modalidad (ver orderExtraText):
// va después del detalle, separado por una línea en blanco; vacío = sin
// texto extra.
// Con `hidePrices` (opción "Ocultar precios" de la carta) el carrito sigue
// andando pero salen solo cantidades y productos, sin subtotales ni total.
// Con `mode` el mensaje arranca con la modalidad (ver ORDER_MODE_HEADERS).
export function buildOrderMessage(
  cart: CartLine[],
  businessName: string,
  extraText?: string,
  { hidePrices = false, mode }: { hidePrices?: boolean; mode?: OrderMode } = {},
): string {
  const lines = cart.map((l) => {
    const variant = l.selectedOption ? ` (${l.selectedOption})` : "";
    const subtotal = hidePrices ? "" : ` — ${fmt(l.unitPrice * l.quantity)}`;
    return `• ${l.quantity}x ${l.title}${variant}${subtotal}`;
  });
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const extra = extraText?.trim();

  return [
    ...(mode ? [ORDER_MODE_HEADERS[mode]] : []),
    `¡Hola! Quiero hacer un pedido en *${businessName}*:`, "", ...lines,
    ...(hidePrices ? [] : ["", `*Total: ${fmt(total)}*`]),
    ...(extra ? ["", extra] : []),
  ].join("\n");
}

// Una opción del paso "¿Cómo querés recibir tu pedido?" de WaTargetPicker.
export interface WaMessageChoice {
  key: string;
  label: string;
  detail?: string;
  message: string;
}

// Mensajes de pedido de Mi negocio, uno por modalidad (contactInfo).
export interface OrderExtraTexts {
  orderMessage?: string;
  takeAwayMessage?: string;
}

// orderMessage es el de delivery: existía antes que el take away y lo que
// los locales cargaron ahí (dirección, entre calles) es para envíos. Un
// pedido sin modalidad también lo usa, como antes.
function orderExtraText(texts: OrderExtraTexts, mode?: OrderMode): string | undefined {
  return mode === "takeaway" ? texts.takeAwayMessage : texts.orderMessage;
}

// Un mensaje por modalidad que ofrece el local. Sin ninguna activa (un
// carrito viejo en un local que después apagó las dos) sale el mensaje de
// siempre, sin modalidad.
export function buildOrderChoices(
  cart: CartLine[],
  businessName: string,
  texts: OrderExtraTexts,
  { hidePrices = false, modes }: { hidePrices?: boolean; modes: OrderMode[] },
): WaMessageChoice[] {
  if (modes.length === 0) {
    return [{ key: "default", label: "", message: buildOrderMessage(cart, businessName, orderExtraText(texts), { hidePrices }) }];
  }
  return modes.map((mode) => ({
    key: mode,
    ...ORDER_MODE_LABELS[mode],
    message: buildOrderMessage(cart, businessName, orderExtraText(texts, mode), { hidePrices, mode }),
  }));
}

// null si no hay número cargado — el caller oculta el botón en ese caso.
export function buildWaLink(number: number | string | null, message: string): string | null {
  const phone = sanitizePhoneForWa(number);
  if (!phone) return null;
  return buildWaHref(phone, message);
}
