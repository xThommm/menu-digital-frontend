import type { Bill, BillEvent, BillShare, PaymentKind, SplitMode } from "../types";

// Cuenta de la mesa: textos y cuentas chicas de la pantalla. Los importes los
// calcula siempre el backend (services/billMath.js); acá solo se muestran.

export const PAYMENT_KINDS: { kind: PaymentKind; label: string }[] = [
  { kind: "cash", label: "Efectivo" },
  { kind: "debit", label: "Débito" },
  { kind: "credit", label: "Crédito" },
  { kind: "transfer", label: "Transferencia / QR" },
  { kind: "other", label: "Otro" },
];

export const SPLIT_MODES: { mode: SplitMode; label: string; hint: string }[] = [
  { mode: "none", label: "Sin dividir", hint: "Una sola cuenta para toda la mesa." },
  { mode: "items", label: "Por productos", hint: "Cada uno paga lo que pidió. Tocá los nombres en cada producto; con más de uno se reparte." },
  { mode: "equal", label: "Partes iguales", hint: "El total se divide entre los comensales de la cuenta." },
  { mode: "custom", label: "Importes", hint: "Poné a mano cuánto paga cada uno." },
];

const splitLabel = (mode: unknown) => SPLIT_MODES.find(entry => entry.mode === mode)?.label ?? "Sin dividir";

const whole = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Con centavos solo cuando los hay (dividir entre tres casi siempre los deja).
export const formatAmount = (value: number) => (Number.isInteger(value) ? whole : cents).format(value);

// Lo que se tipea en un campo de importe → número. Acepta "1500", "1.500",
// "1.500,50", "1500,5" y "1500.50". null si no es un importe válido.
export function parseAmount(text: string): number | null {
  const raw = text.replace(/[\s$]/g, "");
  if (raw === "") return null;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100) / 100;
  return Number.isFinite(value) ? value : null;
}

// Valor inicial de un campo de importe (sin separador de miles, coma decimal).
export const amountInput = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ","));

type ShareInput = { guestId: number; weight: number };

// Tocar un comensal en un producto: lo suma al reparto (una parte) o lo saca.
export function toggleShare(shares: BillShare[], guestId: number): ShareInput[] {
  const current = shares.map(({ guestId: id, weight }) => ({ guestId: id, weight }));
  return current.some(share => share.guestId === guestId)
    ? current.filter(share => share.guestId !== guestId)
    : [...current, { guestId, weight: 1 }];
}

// Cambia cuántas partes le tocan a un comensal (mínimo 1).
export function withWeight(shares: BillShare[], guestId: number, weight: number): ShareInput[] {
  return shares.map(share => ({
    guestId: share.guestId,
    weight: share.guestId === guestId ? Math.max(1, Math.min(100, weight)) : share.weight,
  }));
}

// "1/3", "2/3"… o "todo" si el producto es de uno solo.
export function shareFraction(share: BillShare, shares: BillShare[]): string {
  const total = shares.reduce((sum, entry) => sum + entry.weight, 0);
  return shares.length === 1 ? "todo" : `${share.weight}/${total}`;
}

// Importe que se propone al cobrar: lo que debe ese comensal, sin pasarse de lo que falta de la mesa.
export function suggestedAmount(bill: Pick<Bill, "pending" | "guests">, guestId: number | null): number {
  const guest = guestId === null ? undefined : bill.guests.find(entry => entry.id === guestId);
  if (!guest || guest.balance <= 0) return bill.pending;
  return Math.min(guest.balance, bill.pending);
}

export const BILL_STATUS_LABEL: Record<Bill["status"], string> = {
  open: "Sin cobrar",
  partial: "Cobro parcial",
  paid: "Cobrada",
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const amount = (value: unknown) => (typeof value === "number" ? formatAmount(value) : "");
const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

// Renglón del historial de la cuenta.
export function eventText(event: Pick<BillEvent, "type" | "detail">): string {
  const d = event.detail;
  switch (event.type) {
    case "guest_added": return `Se sumó a la cuenta: ${list<string>(d.names).join(", ")}`;
    case "guest_renamed": return `${text(d.from)} ahora es ${text(d.to)}`;
    case "guest_removed": return `Se quitó de la cuenta a ${text(d.name)}`;
    case "split_changed": return `Forma de dividir: ${splitLabel(d.to)}`;
    case "amounts_set":
      return `Importes: ${list<{ name: string; amount: number }>(d.amounts).map(entry => `${entry.name} ${formatAmount(entry.amount)}`).join(", ")}`;
    case "item_assigned": {
      const guests = list<{ name: string; weight: number }>(d.guests);
      if (guests.length === 0) return `${text(d.title)}: quedó sin asignar`;
      return `${text(d.title)}: ${guests.map(guest => (guest.weight > 1 ? `${guest.name} ×${guest.weight}` : guest.name)).join(", ")}`;
    }
    case "payment_recorded":
      return `Pago de ${amount(d.amount)} · ${text(d.method)}${d.payer ? ` · ${text(d.payer)}` : ""}`;
    case "payment_voided":
      return `Pago anulado: ${amount(d.amount)} · ${text(d.method)}${d.reason ? ` (${text(d.reason)})` : ""}`;
    case "group_order": return `Pedido grupal #${String(d.orderNumber ?? "")} sumado a la cuenta`;
    default: return "Cambio en la cuenta";
  }
}
