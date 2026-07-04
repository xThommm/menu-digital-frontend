import type { CartLine } from "../context/CartContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// El teléfono se guarda como dígitos sin código de país (ver el placeholder
// de UserEditor: "11 1234-5678" = código de área + número local, sin el 0
// de discado ni el 15 de celular). WhatsApp necesita el formato
// "54 9 <área><número>" para celulares argentinos — si el dueño cargó un 0
// inicial (hábito de discado tipo "011..."), lo sacamos; el resto se asume
// ya sin 0 ni 15, tal como pide el formulario. Si el número real no sigue
// esa convención, el link puede no abrir el chat correcto — validar con un
// número de prueba real antes de dar por cerrado el feature.
export function sanitizePhoneForWa(number: number | null): string | null {
  if (number == null) return null;
  let digits = String(number).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("54")) {
    return digits.startsWith("549") ? digits : `549${digits.slice(2)}`;
  }
  return `549${digits}`;
}

// Arma el texto del pedido: cada línea con cantidad, variante (si la hay) y
// subtotal, más el total al final. Formato legible para que el dueño no
// tenga que interpretar nada al recibirlo por WhatsApp.
export function buildOrderMessage(cart: CartLine[], businessName: string): string {
  const lines = cart.map((l) => {
    const variant = l.selectedOption ? ` (${l.selectedOption})` : "";
    return `• ${l.quantity}x ${l.title}${variant} — ${fmt(l.unitPrice * l.quantity)}`;
  });
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return [`¡Hola! Quiero hacer un pedido en *${businessName}*:`, "", ...lines, "", `*Total: ${fmt(total)}*`].join("\n");
}

// null si no hay número cargado — el caller oculta el botón en ese caso.
export function buildWaLink(number: number | null, message: string): string | null {
  const phone = sanitizePhoneForWa(number);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
