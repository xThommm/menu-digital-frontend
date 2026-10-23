import type { Bill, Order } from "../../types";
import { formatDateTime, placeLabel } from "../format.ts";
import { wrapText } from "./ticketLayout.ts";

// Cuenta impresa (la que se le lleva a la mesa o se entrega con el pedido),
// independiente de cómo se imprima: la usan el ticket HTML (impresora del
// sistema) y el codificador ESC/POS (comandera térmica directa).
//
// Sale de la cuenta de una mesa (todos sus pedidos) o de un pedido suelto
// (take away, delivery, barra). Los importes son los del backend: acá solo
// se suman las líneas para mostrar el subtotal y el descuento.

export interface BillLayoutLine {
  quantity: number;
  title: string;
  // Precio de la línea sin descuento (cantidad × precio unitario).
  amount: number;
}

export interface BillLayout {
  business: string | null;
  // "Mesa 4" / "Take away · Juan" / "Delivery"
  place: string;
  // "Pedido #12" / "Pedidos #12, #15"
  orders: string;
  dateTime: string;
  waiter: string | null;
  lines: BillLayoutLine[];
  subtotal: number;
  discount: number;
  total: number;
  // Cuenta dividida: lo que le toca a cada uno (vacío sin dividir).
  split: { name: string; amount: number }[];
  payments: { label: string; amount: number }[];
  paid: number;
  pending: number;
}

interface LayoutOptions {
  business?: string | null;
  now?: Date;
}

const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => cents(value) / 100;

const ordersLabel = (numbers: number[]) =>
  numbers.length === 0 ? "" : `${numbers.length === 1 ? "Pedido" : "Pedidos"} ${numbers.map(number => `#${number}`).join(", ")}`;

// Junta lo que se pidió igual en varios pedidos ("2 x Coca" + "1 x Coca" = "3 x Coca").
function mergeLines(lines: { title: string; option: string | null; quantity: number; unitPrice: number }[]): BillLayoutLine[] {
  const merged = new Map<string, BillLayoutLine>();
  for (const line of lines) {
    const title = line.option ? `${line.title} (${line.option})` : line.title;
    const key = `${title}\u0000${cents(line.unitPrice)}`;
    const amount = money(line.quantity * line.unitPrice);
    const current = merged.get(key);
    if (current) {
      current.quantity += line.quantity;
      current.amount = money(current.amount + amount);
    } else {
      merged.set(key, { quantity: line.quantity, title, amount });
    }
  }
  return [...merged.values()];
}

/** Cuenta de una mesa: todos sus pedidos, la división y los pagos registrados. */
export function billLayoutFromTable(bill: Bill, { business = null, now = new Date() }: LayoutOptions = {}): BillLayout {
  const lines = mergeLines(bill.items);
  const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));
  const approved = bill.payments.filter(payment => payment.status === "approved");
  return {
    business,
    place: `Mesa ${bill.tableNumber}`,
    orders: ordersLabel([...new Set(bill.items.map(item => item.orderNumber))]),
    dateTime: formatDateTime(now.toISOString()),
    waiter: null,
    lines,
    subtotal,
    discount: Math.max(0, money(subtotal - bill.total)),
    total: bill.total,
    split: bill.mode === "none" ? [] : bill.guests.filter(guest => guest.owed > 0).map(guest => ({ name: guest.name, amount: guest.owed })),
    payments: approved.map(payment => ({
      label: payment.payerName ? `${payment.methodName} · ${payment.payerName}` : payment.methodName,
      amount: payment.amount,
    })),
    paid: bill.paid,
    pending: bill.pending,
  };
}

/** Cuenta de un pedido suelto. Lo pagado online (Mercado Pago) figura como pago. */
export function billLayoutFromOrder(order: Order, { business = null, now = new Date() }: LayoutOptions = {}): BillLayout {
  const paidOnline = order.paymentMode === "mercadopago" && order.paymentStatus === "APPROVED";
  const place = placeLabel(order);
  return {
    business,
    place: order.customerName && (order.serviceType === "takeaway" || order.serviceType === "delivery")
      ? `${place} · ${order.customerName}`
      : place,
    orders: ordersLabel([order.number]),
    dateTime: formatDateTime(now.toISOString()),
    waiter: order.waiterName,
    lines: mergeLines(order.items),
    subtotal: order.subtotal,
    discount: Math.max(0, order.discountAmount),
    total: order.total,
    split: [],
    payments: paidOnline ? [{ label: "Mercado Pago", amount: order.total }] : [],
    paid: paidOnline ? order.total : 0,
    pending: paidOnline ? 0 : order.total,
  };
}

// Leyenda al pie: el ticket no reemplaza la factura.
export const BILL_FOOTER = ["No válido como factura", "¡Gracias por su visita!"];

// Renglón con texto a la izquierda e importe a la derecha, en `width`
// caracteres. Si el texto no entra, sigue en los renglones de abajo y el
// importe va en el último.
export function columns(left: string, right: string, width: number): string[] {
  // La sangría del texto (renglones de "Pagos:") se respeta en todos los renglones.
  const indent = /^ */.exec(left)![0];
  const room = Math.max(1, width - right.length - 1 - indent.length);
  // Los renglones de arriba usan todo el ancho; el último deja lugar al importe.
  const rows = wrapText(left, width - indent.length);
  const tail = rows.pop() ?? "";
  rows.push(...(tail.length <= room ? [tail] : wrapText(tail, room)));
  for (let i = 0; i < rows.length; i += 1) rows[i] = indent + rows[i];
  const last = rows.length - 1;
  return rows.map((row, index) => (index === last ? `${row}${" ".repeat(Math.max(1, width - row.length - right.length))}${right}` : row));
}
