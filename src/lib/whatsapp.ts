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

// Arma el texto del pedido: cada línea con cantidad, variante (si la hay) y
// subtotal, más el total al final. Formato legible para que el dueño no
// tenga que interpretar nada al recibirlo por WhatsApp. `extraText` es el
// "Mensaje de pedido" de Mi negocio (contactInfo.orderMessage): va después
// del detalle, separado por una línea en blanco; vacío = mensaje de siempre.
// Con `hidePrices` (opción "Ocultar precios" de la carta) el carrito sigue
// andando pero salen solo cantidades y productos, sin subtotales ni total.
export function buildOrderMessage(
  cart: CartLine[],
  businessName: string,
  extraText?: string,
  { hidePrices = false }: { hidePrices?: boolean } = {},
): string {
  const lines = cart.map((l) => {
    const variant = l.selectedOption ? ` (${l.selectedOption})` : "";
    const subtotal = hidePrices ? "" : ` — ${fmt(l.unitPrice * l.quantity)}`;
    return `• ${l.quantity}x ${l.title}${variant}${subtotal}`;
  });
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const extra = extraText?.trim();

  return [
    `¡Hola! Quiero hacer un pedido en *${businessName}*:`, "", ...lines,
    ...(hidePrices ? [] : ["", `*Total: ${fmt(total)}*`]),
    ...(extra ? ["", extra] : []),
  ].join("\n");
}

// null si no hay número cargado — el caller oculta el botón en ese caso.
export function buildWaLink(number: number | string | null, message: string): string | null {
  const phone = sanitizePhoneForWa(number);
  if (!phone) return null;
  return buildWaHref(phone, message);
}
