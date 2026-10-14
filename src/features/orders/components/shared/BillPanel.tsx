import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatTime } from "../../lib/format";
import {
  amountInput, BILL_STATUS_LABEL, eventText, formatAmount, parseAmount, PAYMENT_KINDS, shareFraction, SPLIT_MODES,
  suggestedAmount, toggleShare, withWeight,
} from "../../lib/bill";
import { uuid } from "../../lib/storage";
import type { Bill, BillApi, BillGuest, BillItem, PaymentKind, SplitMode } from "../../types";
import p from "../panel/panel.module.css";
import s from "./Bill.module.css";
import { useDialogs } from "../../../../context/useDialogs";

// Cuenta de una mesa: dividirla (por productos, partes iguales o importes) y
// registrar pagos parciales. La usan la app del operador ("Mis mesas") y Mesas
// en el panel, cada una con su API (misma forma, distinta sesión).
//
// Acá no se cobra nada: el personal anota lo que cobró, con qué medio y quién
// pagó. Los importes los calcula siempre el backend; cada acción devuelve la
// cuenta ya recalculada.

interface Props {
  api: BillApi;
  sessionId: number;
  tableNumber: number;
  // Cambia cuando la pantalla de atrás se actualizó (pedido nuevo, otro dispositivo): se relee la cuenta.
  refreshKey?: number;
  onClose: () => void;
  // Algo cambió en la cuenta: la pantalla de atrás actualiza sus totales.
  onChanged?: () => void;
  // true si el error era de sesión y ya lo manejó la pantalla (app del operador).
  onAuthError?: (err: unknown) => boolean;
}

export default function BillPanel({ api, sessionId, tableNumber, refreshKey = 0, onClose, onChanged, onAuthError }: Props) {
  const dialogs = useDialogs();
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fail = useCallback((err: unknown, fallback: string) => {
    if (!onAuthError?.(err)) setError(errorMessage(err, fallback));
  }, [onAuthError]);

  useEffect(() => {
    let cancelled = false;
    api.get(sessionId)
      .then(next => { if (!cancelled) { setBill(next); setError(null); } })
      .catch(err => { if (!cancelled) fail(err, "No se pudo cargar la cuenta."); });
    return () => { cancelled = true; };
  }, [api, sessionId, refreshKey, fail]);

  // Corre un cambio y se queda con la cuenta que devuelve.
  const run = async (action: () => Promise<Bill>, fallback: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      setBill(await action());
      onChanged?.();
      return true;
    } catch (err) {
      fail(err, fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const readOnly = bill?.closed === true;
  const locked = busy || readOnly;

  const rename = async (guest: BillGuest) => {
    const name = await dialogs.prompt({
      title: "Cambiar nombre",
      confirmLabel: "Guardar",
      field: { label: "Nombre del comensal", defaultValue: guest.name, maxLength: 40, required: true },
    });
    if (name && name !== guest.name) void run(() => api.renameGuest(sessionId, guest.id, name), "No se pudo cambiar el nombre.");
  };

  const remove = async (guest: BillGuest) => {
    if (!(await dialogs.confirm({
      title: `¿Quitar a ${guest.name} de la cuenta?`,
      message: "Lo que tenía asignado queda sin asignar.",
      confirmLabel: "Quitar",
      danger: true,
    }))) return;
    void run(() => api.removeGuest(sessionId, guest.id), "No se pudo quitar al comensal.");
  };

  const voidPayment = async (paymentId: number) => {
    const reason = await dialogs.prompt({
      title: "¿Anular este pago?",
      confirmLabel: "Anular pago",
      danger: true,
      field: { label: "Motivo (opcional)", maxLength: 200 },
    });
    if (reason === null) return;
    void run(() => api.voidPayment(sessionId, paymentId, reason || undefined), "No se pudo anular el pago.");
  };

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Cuenta de la mesa ${tableNumber}`} onClick={onClose}>
      <div className={p.modal} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Cuenta · Mesa {tableNumber}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>

        <div className={`${p.modalBody} ${p.stack}`}>
          {error && <p className={p.error} role="alert">{error}</p>}
          {!bill && !error && <p className={p.loading}>Cargando…</p>}

          {bill && (
            <>
              <div className={s.summary} aria-label={BILL_STATUS_LABEL[bill.status]}>
                <div className={s.stat}><span className={s.statLabel}>Total</span><span className={s.statValue}>{formatAmount(bill.total)}</span></div>
                <div className={s.stat}><span className={s.statLabel}>Cobrado</span><span className={s.statValue}>{formatAmount(bill.paid)}</span></div>
                <div className={`${s.stat} ${bill.pending > 0 ? s.statDue : s.statDone}`}>
                  <span className={s.statLabel}>Falta cobrar</span>
                  <span className={s.statValue}>{formatAmount(bill.pending)}</span>
                </div>
              </div>

              {readOnly && <p className={s.hint}>La mesa está cerrada: la cuenta queda para consultar.</p>}
              {bill.overpaid > 0 && (
                <p className={s.warn}>Se cobraron {formatAmount(bill.overpaid)} de más (se quitó algo de la mesa después de cobrar): hay que devolverlos.</p>
              )}

              <section className={s.section} aria-label="Forma de dividir">
                <h3 className={s.sectionTitle}>Dividir la cuenta</h3>
                <div className={s.modes}>
                  {SPLIT_MODES.map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      className={s.mode}
                      aria-pressed={bill.mode === mode}
                      disabled={locked}
                      onClick={() => { if (bill.mode !== mode) void run(() => api.setSplit(sessionId, { mode }), "No se pudo cambiar la forma de dividir."); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className={s.hint}>{SPLIT_MODES.find(entry => entry.mode === bill.mode)?.hint}</p>
              </section>

              {bill.mode !== "none" && (
                <GuestsSection
                  bill={bill}
                  locked={locked}
                  onAdd={body => run(() => api.addGuests(sessionId, body), "No se pudo agregar al comensal.")}
                  onRename={rename}
                  onRemove={remove}
                />
              )}

              {bill.mode === "custom" && bill.guests.length > 0 && (
                <CustomAmounts
                  key={bill.guests.map(guest => `${guest.id}:${guest.customAmount ?? ""}`).join("|")}
                  bill={bill}
                  locked={locked}
                  onSave={amounts => run(() => api.setSplit(sessionId, { mode: "custom" as SplitMode, amounts }), "No se pudieron guardar los importes.")}
                />
              )}

              {bill.mode === "items" && (
                <section className={s.section} aria-label="Productos">
                  <h3 className={s.sectionTitle}>Productos</h3>
                  {bill.unassigned > 0 && <p className={s.warn}>Falta asignar {formatAmount(bill.unassigned)}.</p>}
                  {bill.guests.length === 0 && <p className={s.hint}>Agregá los comensales para repartir los productos.</p>}
                  <ul className={s.list}>
                    {bill.items.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        guests={bill.guests}
                        locked={locked}
                        onShares={shares => run(() => api.setItemShares(sessionId, item.id, shares), "No se pudo repartir el producto.")}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {!readOnly && bill.pending > 0 && (
                <PaymentForm
                  key={`${bill.payments.length}:${bill.pending}`}
                  bill={bill}
                  busy={busy}
                  onPay={body => run(() => api.recordPayment(sessionId, body), "No se pudo registrar el pago.")}
                />
              )}
              {!readOnly && bill.pending === 0 && bill.total > 0 && <p className={p.success} role="status">La cuenta está cobrada.</p>}

              {bill.payments.length > 0 && (
                <section className={s.section} aria-label="Pagos">
                  <h3 className={s.sectionTitle}>Pagos registrados</h3>
                  <ul className={s.list}>
                    {bill.payments.map(payment => (
                      <li key={payment.id} className={`${s.row} ${payment.status === "voided" ? s.voided : ""}`}>
                        <div className={s.rowHead}>
                          <span className={s.rowTitle}>
                            {payment.methodName}{payment.payerName && <em> · {payment.payerName}</em>}
                          </span>
                          <span className={s.rowAmount}>{formatAmount(payment.amount)}</span>
                        </div>
                        <span className={s.rowMeta}>
                          {formatTime(payment.createdAt)}{payment.actorName && ` · lo registró ${payment.actorName}`}
                          {payment.reference && ` · ${payment.reference}`}
                          {payment.status === "voided" && ` · ANULADO${payment.voidReason ? `: ${payment.voidReason}` : ""}`}
                        </span>
                        {payment.status === "approved" && !readOnly && (
                          <div className={s.rowActions}>
                            <button type="button" className={`${p.btnGhost} ${p.small}`} disabled={busy} onClick={() => voidPayment(payment.id)}>
                              Anular pago
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {bill.events.length > 0 && (
                <section className={s.section} aria-label="Historial de la cuenta">
                  <button type="button" className={`${p.btnGhost} ${p.small}`} style={{ alignSelf: "flex-start" }} aria-expanded={showHistory} onClick={() => setShowHistory(open => !open)}>
                    {showHistory ? "Ocultar historial" : `Ver historial de cambios (${bill.events.length})`}
                  </button>
                  {showHistory && (
                    <ul className={s.events}>
                      {bill.events.map(event => (
                        <li key={event.id} className={s.event}>
                          <span>{eventText(event)}</span>
                          <span className={s.eventMeta}>{formatDateTime(event.createdAt)}{event.actorName && ` · ${event.actorName}`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GuestsSection({ bill, locked, onAdd, onRename, onRemove }: {
  bill: Bill;
  locked: boolean;
  onAdd: (body: { name: string } | { count: number }) => Promise<boolean>;
  onRename: (guest: BillGuest) => void;
  onRemove: (guest: BillGuest) => void;
}) {
  const [name, setName] = useState("");
  const [count, setCount] = useState("2");

  const addNamed = async () => {
    if (name.trim() && await onAdd({ name: name.trim() })) setName("");
  };

  return (
    <section className={s.section} aria-label="Comensales">
      <h3 className={s.sectionTitle}>Comensales ({bill.guests.length})</h3>
      {bill.guests.length > 0 && (
        <ul className={s.list}>
          {bill.guests.map(guest => (
            <li key={guest.id} className={s.row}>
              <div className={s.rowHead}>
                <span className={s.rowTitle}>{guest.name}{guest.fromGroup && <em> · pedido grupal</em>}</span>
                <span className={s.rowAmount}>{formatAmount(guest.owed)}</span>
              </div>
              <span className={s.rowMeta}>
                Pagó {formatAmount(guest.paid)} ·{" "}
                {guest.balance > 0 && <span className={s.owes}>debe {formatAmount(guest.balance)}</span>}
                {guest.balance === 0 && <span className={s.settled}>{guest.owed > 0 ? "al día" : "sin nada asignado"}</span>}
                {guest.balance < 0 && <span className={s.settled}>pagó {formatAmount(-guest.balance)} de más</span>}
              </span>
              {!bill.closed && (
                <div className={s.rowActions}>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} disabled={locked} onClick={() => onRename(guest)}>Cambiar nombre</button>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} disabled={locked} onClick={() => onRemove(guest)}>Quitar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {bill.paidUnattributed > 0 && (
        <p className={s.hint}>Hay {formatAmount(bill.paidUnattributed)} cobrados sin imputar a un comensal.</p>
      )}

      {!bill.closed && (
        <>
          <form className={s.inline} onSubmit={event => { event.preventDefault(); void addNamed(); }}>
            <input
              className={`${p.input} ${s.grow}`}
              value={name}
              maxLength={40}
              placeholder="Nombre del comensal"
              aria-label="Nombre del comensal"
              onChange={event => setName(event.target.value)}
            />
            <button type="submit" className={p.btn} disabled={locked || !name.trim()}><Plus size={16} aria-hidden /> Agregar</button>
          </form>
          <form className={s.inline} onSubmit={event => { event.preventDefault(); void onAdd({ count: Number(count) }); }}>
            <input
              className={`${p.input} ${s.narrow}`}
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              value={count}
              aria-label="Cantidad de personas"
              onChange={event => setCount(event.target.value)}
            />
            <button type="submit" className={p.btnGhost} disabled={locked || !(Number(count) >= 1 && Number(count) <= 30)}>
              Agregar personas sin nombre
            </button>
          </form>
        </>
      )}
    </section>
  );
}

function ItemRow({ item, guests, locked, onShares }: {
  item: BillItem;
  guests: BillGuest[];
  locked: boolean;
  onShares: (shares: { guestId: number; weight: number }[]) => Promise<boolean>;
}) {
  const nameOf = (guestId: number) => guests.find(guest => guest.id === guestId)?.name ?? "";
  return (
    <li className={s.row}>
      <div className={s.rowHead}>
        <span className={s.rowTitle}>
          {item.quantity}× {item.title}{item.option && <em> · {item.option}</em>}
        </span>
        <span className={s.rowAmount}>{formatAmount(item.amount)}</span>
      </div>
      <span className={s.rowMeta}>
        Pedido #{item.orderNumber}
        {item.authorName && ` · lo pidió ${item.authorName}`}
        {item.shared && " · para compartir"}
        {item.shares.length === 0 && " · sin asignar"}
      </span>

      {guests.length > 0 && (
        <div className={s.chips} role="group" aria-label={`Quién paga ${item.title}`}>
          {guests.map(guest => {
            const share = item.shares.find(entry => entry.guestId === guest.id);
            return (
              <button
                key={guest.id}
                type="button"
                className={s.chip}
                aria-pressed={!!share}
                disabled={locked}
                onClick={() => void onShares(toggleShare(item.shares, guest.id))}
              >
                {guest.name}{share && item.shares.length > 1 && ` · ${formatAmount(share.amount)}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Repartido entre varios: se puede dar más partes a uno (ej. 2 de 3 cervezas). */}
      {item.shares.length > 1 && (
        <div className={s.weights}>
          {item.shares.map(share => (
            <span key={share.guestId} className={s.weight}>
              <button
                type="button"
                className={s.step}
                disabled={locked || share.weight <= 1}
                aria-label={`Menos partes para ${nameOf(share.guestId)}`}
                onClick={() => void onShares(withWeight(item.shares, share.guestId, share.weight - 1))}
              >
                <Minus size={14} aria-hidden />
              </button>
              {nameOf(share.guestId)} {shareFraction(share, item.shares)}
              <button
                type="button"
                className={s.step}
                disabled={locked}
                aria-label={`Más partes para ${nameOf(share.guestId)}`}
                onClick={() => void onShares(withWeight(item.shares, share.guestId, share.weight + 1))}
              >
                <Plus size={14} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function CustomAmounts({ bill, locked, onSave }: {
  bill: Bill;
  locked: boolean;
  onSave: (amounts: { guestId: number; amount: number }[]) => Promise<boolean>;
}) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(bill.guests.map(guest => [guest.id, guest.customAmount ? amountInput(guest.customAmount) : ""])));

  const parsed = bill.guests.map(guest => ({ guestId: guest.id, amount: values[guest.id]?.trim() ? parseAmount(values[guest.id]) : 0 }));
  const invalid = parsed.some(entry => entry.amount === null);
  const assigned = parsed.reduce((sum, entry) => sum + Math.round((entry.amount ?? 0) * 100), 0) / 100;
  const left = Math.round((bill.total - assigned) * 100) / 100;

  return (
    <section className={s.section} aria-label="Importe de cada comensal">
      <h3 className={s.sectionTitle}>Cuánto paga cada uno</h3>
      <ul className={s.list}>
        {bill.guests.map(guest => (
          <li key={guest.id} className={s.row}>
            <label className={s.amountField}>
              <span className={s.rowTitle}>{guest.name}</span>
              <input
                className={p.input}
                inputMode="decimal"
                value={values[guest.id] ?? ""}
                placeholder="0"
                disabled={locked}
                onChange={event => setValues(prev => ({ ...prev, [guest.id]: event.target.value }))}
              />
            </label>
          </li>
        ))}
      </ul>
      {invalid && <p className={p.error}>Revisá los importes: alguno no es un número.</p>}
      {!invalid && left > 0 && <p className={s.hint}>Faltan asignar {formatAmount(left)}.</p>}
      {!invalid && left < 0 && <p className={p.error}>Los importes superan el total por {formatAmount(-left)}.</p>}
      {!bill.closed && (
        <button
          type="button"
          className={p.btn}
          style={{ alignSelf: "flex-start" }}
          disabled={locked || invalid || left < 0}
          onClick={() => void onSave(parsed.map(entry => ({ guestId: entry.guestId, amount: entry.amount ?? 0 })))}
        >
          Guardar importes
        </button>
      )}
    </section>
  );
}

function PaymentForm({ bill, busy, onPay }: {
  bill: Bill;
  busy: boolean;
  onPay: (body: { amount: number; methodKind: PaymentKind; guestId: number | null; payerName?: string; reference?: string; idempotencyKey: string }) => Promise<boolean>;
}) {
  // Con la cuenta dividida, se arranca por el primero que debe.
  const firstDebtor = bill.guests.find(guest => guest.balance > 0)?.id ?? null;
  const [guestId, setGuestId] = useState<number | null>(firstDebtor);
  const [amount, setAmount] = useState(() => amountInput(suggestedAmount(bill, firstDebtor)));
  const [kind, setKind] = useState<PaymentKind>("cash");
  const [payer, setPayer] = useState("");
  const [reference, setReference] = useState("");
  // Mismo pago = mismo id: un reintento tras un corte de red no lo cobra dos veces.
  const request = useRef<{ key: string; id: string } | null>(null);

  const value = parseAmount(amount);
  const tooMuch = value !== null && value > bill.pending;
  const valid = value !== null && value > 0 && !tooMuch;

  const chooseGuest = (next: number | null) => {
    setGuestId(next);
    setAmount(amountInput(suggestedAmount(bill, next)));
  };

  const submit = async () => {
    if (!valid || value === null) return;
    const body = { amount: value, methodKind: kind, guestId, payerName: payer.trim() || undefined, reference: reference.trim() || undefined };
    const key = JSON.stringify(body);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    if (await onPay({ ...body, idempotencyKey: request.current.id })) request.current = null;
  };

  return (
    <section className={s.section} aria-label="Registrar un pago">
      <h3 className={s.sectionTitle}>Registrar un pago</h3>
      <form className={p.stack} style={{ gap: "0.6rem" }} onSubmit={event => { event.preventDefault(); void submit(); }}>
        {bill.guests.length > 0 && (
          <label className={p.field}>
            <span className={p.label}>¿De quién es?</span>
            <select className={p.select} value={guestId ?? ""} onChange={event => chooseGuest(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Toda la mesa / sin asignar</option>
              {bill.guests.map(guest => (
                <option key={guest.id} value={guest.id}>
                  {guest.name}{guest.balance > 0 ? ` · debe ${formatAmount(guest.balance)}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={s.inline}>
          <label className={p.field}>
            <span className={p.label}>Importe</span>
            <input className={p.input} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!valid} />
          </label>
          <label className={p.field}>
            <span className={p.label}>Medio de pago</span>
            <select className={p.select} value={kind} onChange={event => setKind(event.target.value as PaymentKind)}>
              {PAYMENT_KINDS.map(entry => <option key={entry.kind} value={entry.kind}>{entry.label}</option>)}
            </select>
          </label>
        </div>
        <div className={s.inline}>
          <label className={p.field}>
            <span className={p.label}>Quién pagó (opcional)</span>
            <input className={p.input} value={payer} maxLength={60} placeholder={guestId ? "Si pagó otra persona" : "Ej: Ana"} onChange={event => setPayer(event.target.value)} />
          </label>
          <label className={p.field}>
            <span className={p.label}>Referencia (opcional)</span>
            <input className={p.input} value={reference} maxLength={60} placeholder="Nº de operación" onChange={event => setReference(event.target.value)} />
          </label>
        </div>
        {tooMuch && <p className={p.error}>El importe supera lo que falta cobrar ({formatAmount(bill.pending)}).</p>}
        <button type="submit" className={p.btnPrimary} disabled={busy || !valid}>
          {busy ? "Guardando…" : `Registrar pago${valid && value !== null ? ` de ${formatAmount(value)}` : ""}`}
        </button>
      </form>
    </section>
  );
}
