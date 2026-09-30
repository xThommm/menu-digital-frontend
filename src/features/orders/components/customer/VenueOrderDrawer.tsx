import { useMemo, useRef, useState } from "react";
import { CheckCircle2, MapPin, Send } from "lucide-react";
import { useCart } from "../../../../context/useCart";
import type { CartLine } from "../../../../context/CartContext";
import { sendCustomerOrder } from "../../api/publicOrdersApi";
import { errorCode, errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/format";
import { deviceId, uuid } from "../../lib/storage";
import { lineKey, toOrderLines, type UnitLine } from "../../lib/units";
import {
  appendOrderHistory, readChosenTable, saveChosenTable, type InVenueContext,
} from "../../lib/venueSession";
import type { CustomerOrderReceipt } from "../../types";
import UnitLinesEditor from "../shared/UnitLinesEditor";
import cart from "../../../../components/User/Home/Menu/CartDrawer.module.css";
import s from "./VenueOrder.module.css";

// Carrito del comensal cuando está en el local (escaneó el QR y el local
// acepta pedidos desde la mesa). Reemplaza al carrito de WhatsApp: mismo
// contenido (CartProvider), más aclaraciones por unidad y la mesa, y un
// botón que manda el pedido directo al panel.

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  token: string;
  context: InVenueContext;
  hidePrices: boolean;
  onSent: (lines: CartLine[], receipt: CustomerOrderReceipt) => void;
  onInvalidQr: () => void;
  onRequestClear: () => void;
}

export default function VenueOrderDrawer({
  open, onClose, slug, token, context, hidePrices, onSent, onInvalidQr, onRequestClear,
}: Props) {
  const { items, updateQuantity, removeItem, clearCart, totalPrice } = useCart();
  // Aclaraciones por unidad, por línea del carrito (el carrito compartido no las guarda).
  const [notes, setNotes] = useState<Record<string, string[]>>({});
  const [table, setTable] = useState<string>(() => String(context.tableNumber ?? readChosenTable(slug) ?? ""));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CustomerOrderReceipt | null>(null);
  // Mismo contenido = mismo id de envío: un reintento tras un corte de red no duplica el pedido.
  const request = useRef<{ key: string; id: string } | null>(null);

  const lines: UnitLine[] = useMemo(() => items.map(line => ({
    itemId: line.itemId,
    title: line.title,
    option: line.selectedOption,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    unitNotes: notes[lineKey(line.itemId, line.selectedOption)] ?? [],
  })), [items, notes]);

  if (!open) return null;

  const onLinesChange = (next: UnitLine[]) => {
    const nextKeys = new Set(next.map(line => lineKey(line.itemId, line.option)));
    for (const line of lines) {
      if (!nextKeys.has(lineKey(line.itemId, line.option))) removeItem(line.itemId, line.option);
    }
    const nextNotes: Record<string, string[]> = {};
    for (const line of next) {
      const current = lines.find(l => lineKey(l.itemId, l.option) === lineKey(line.itemId, line.option));
      if (current && current.quantity !== line.quantity) updateQuantity(line.itemId, line.option, line.quantity);
      nextNotes[lineKey(line.itemId, line.option)] = line.unitNotes;
    }
    setNotes(nextNotes);
  };

  const tableNumber = context.tableNumber ?? (table ? Number(table) : null);

  const send = async () => {
    if (lines.length === 0 || !tableNumber) return;
    const orderLines = toOrderLines(lines);
    const key = JSON.stringify([tableNumber, orderLines]);
    if (request.current?.key !== key) request.current = { key, id: uuid() };

    setSending(true);
    setError(null);
    try {
      const { order } = await sendCustomerOrder(slug, {
        token,
        tableNumber: context.tableNumber ? undefined : tableNumber,
        items: orderLines,
        clientRequestId: request.current.id,
        deviceId: deviceId(),
      });
      if (context.history) appendOrderHistory(slug, order);
      if (!context.tableNumber) saveChosenTable(slug, tableNumber);
      onSent(items, order);
      clearCart();
      setNotes({});
      request.current = null;
      setReceipt(order);
    } catch (err) {
      const code = errorCode(err);
      if (code === "QR_INVALID" || code === "CUSTOMER_ORDERING_OFF") onInvalidQr();
      setError(errorMessage(err, "No pudimos enviar el pedido. Probá de nuevo o pedile al mozo."));
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    setReceipt(null);
    setError(null);
    onClose();
  };

  return (
    <div className={`${cart.overlay} ${s.scope}`} onClick={close} role="dialog" aria-modal="true" aria-label="Tu pedido">
      <div className={cart.drawer} onClick={event => event.stopPropagation()}>
        <header className={cart.header}>
          <h2 className={`${cart.title} t-family-heading`}>{receipt ? "Pedido enviado" : "Tu pedido"}</h2>
          <button className={cart.close} onClick={close} aria-label="Cerrar" type="button">✕</button>
        </header>

        {receipt ? (
          <div className={s.done} role="status">
            <span className={s.doneIcon}><CheckCircle2 size={30} aria-hidden /></span>
            <p className={s.doneTitle}>¡Listo! Pedido #{receipt.number}</p>
            <p className={s.doneText}>
              {receipt.tableNumber ? `Mesa ${receipt.tableNumber}. ` : ""}
              Ya lo recibieron en el local: en cuanto esté te lo llevan a la mesa.
            </p>
            <button type="button" className={`${s.sendBtn} ${s.doneBtn}`} onClick={close}>
              Seguir mirando la carta
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className={cart.empty}>Todavía no agregaste nada del menú.</p>
        ) : (
          <>
            <div className={s.body}>
              {context.tableNumber ? (
                <span className={s.tableBadge}><MapPin size={14} aria-hidden /> Mesa {context.tableNumber}</span>
              ) : (
                <label className={s.tableField}>
                  <span>¿En qué mesa estás?</span>
                  <select value={table} onChange={event => setTable(event.target.value)} required>
                    <option value="">Elegí tu mesa</option>
                    {Array.from({ length: context.tableCount }, (_, index) => (
                      <option key={index + 1} value={index + 1}>Mesa {index + 1}</option>
                    ))}
                  </select>
                </label>
              )}
              <p className={s.hint}>Tocá el globito de cada producto para agregar aclaraciones (una por unidad).</p>
              <UnitLinesEditor lines={lines} onChange={onLinesChange} hidePrices={hidePrices} />
            </div>

            {!hidePrices && (
              <div className={cart.total}>
                <span>Total</span>
                <span>{formatMoney(totalPrice)}</span>
              </div>
            )}

            <div className={cart.checkoutActions}>
              {error && <p className={s.error} role="alert">{error}</p>}
              <button type="button" className={s.sendBtn} onClick={send} disabled={sending || !tableNumber}>
                <Send size={17} aria-hidden /> {sending ? "Enviando…" : "Enviar pedido"}
              </button>
              <button className={cart.clearBtn} onClick={onRequestClear} type="button">Vaciar pedido</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
