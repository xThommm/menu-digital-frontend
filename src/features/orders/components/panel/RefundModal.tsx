import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getOrderPayment, refundOrder, retryRefund } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney } from "../../lib/format";
import type { Order, OrderPaymentResponse, RefundResult, RefundStatus } from "../../types";
import p from "./panel.module.css";

// Devolución de un pedido pagado online con Mercado Pago. El reintegro sale de
// la cuenta de Mercado Pago del local; el pedido y el pago solo cambian cuando
// Mercado Pago confirma la operación.

interface Props {
  order: Order;
  // Anular el pedido junto con la devolución (rechazar un pedido ya pagado).
  cancelOrder?: boolean;
  onClose: () => void;
  // Algo cambió en el pedido o en el pago: que la pantalla de atrás se actualice.
  onChanged: () => void;
}

const REFUND_LABEL: Record<RefundStatus, string> = {
  PENDING: "Esperando confirmación",
  COMPLETED: "Confirmada",
  FAILED: "No se pudo hacer",
};

const CANCELLABLE = ["pending", "confirmed", "ready"];

export default function RefundModal({ order, cancelOrder = false, onClose, onChanged }: Props) {
  const [info, setInfo] = useState<OrderPaymentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"total" | "partial">("total");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [alsoCancel, setAlsoCancel] = useState(cancelOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrderPayment(order.id)
      .then(data => { if (!cancelled) setInfo(data); })
      .catch(err => { if (!cancelled) setLoadError(errorMessage(err, "No se pudo cargar el pago del pedido.")); });
    return () => { cancelled = true; };
  }, [order.id]);

  const payment = info?.payment ?? null;
  const pending = info?.refunds.find(refund => refund.status === "PENDING") ?? null;
  const canCancel = CANCELLABLE.includes(order.status);
  const partialAmount = Number(amount.replace(",", "."));
  const partialValid = Number.isFinite(partialAmount) && partialAmount > 0 && payment !== null && partialAmount <= payment.refundable;

  const apply = (response: RefundResult) => {
    setResult(response);
    setInfo({ payment: response.payment, refunds: response.refunds });
    if (response.outcome === "completed" || response.orderCancelled) onChanged();
  };

  // 422 (Mercado Pago la rechazó) llega como respuesta normal con su mensaje.
  const run = async (action: () => Promise<RefundResult>) => {
    setBusy(true);
    setError(null);
    try {
      apply(await action());
    } catch (err) {
      setError(errorMessage(err, "No se pudo hacer la devolución."));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => run(() => refundOrder(order.id, {
    amount: mode === "partial" ? partialAmount : undefined,
    reason: reason.trim() || undefined,
    cancelOrder: alsoCancel && canCancel,
  }));

  const finished = result?.outcome === "completed";

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Devolver el pedido ${order.number}`} onClick={onClose}>
      <div className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Devolver pedido #{order.number}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>

        <div className={`${p.modalBody} ${p.stack}`}>
          {loadError && <p className={p.error} role="alert">{loadError}</p>}
          {!info && !loadError && <p className={p.loading}>Cargando…</p>}

          {payment && (
            <>
              <p className={p.cardDesc} style={{ margin: 0 }}>
                Pagó {formatMoney(payment.amount)} por Mercado Pago
                {payment.refundedAmount > 0 && ` · ya devuelto ${formatMoney(payment.refundedAmount)}`}.
                La plata se devuelve desde tu cuenta de Mercado Pago, que necesita saldo disponible.
              </p>

              {result && (
                <p className={result.outcome === "completed" ? p.success : result.outcome === "failed" ? p.error : p.notice} role="status">
                  {result.outcome === "completed" && (result.orderCancelled
                    ? "Devolución confirmada y pedido cancelado."
                    : "Devolución confirmada por Mercado Pago.")}
                  {result.outcome === "failed" && (result.message ?? "Mercado Pago rechazó la devolución.")}
                  {result.outcome === "pending"
                    && "Mercado Pago todavía no confirmó la devolución. El pedido no se cancela hasta que se confirme: reintentá en unos minutos."}
                </p>
              )}

              {pending && !finished && (
                <div className={p.notice}>
                  Hay una devolución de {formatMoney(pending.amount)} esperando confirmación.
                  <div style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className={`${p.btn} ${p.small}`}
                      disabled={busy}
                      onClick={() => run(() => retryRefund(order.id, pending.id))}
                    >
                      {busy ? "Verificando…" : "Verificar / reintentar"}
                    </button>
                  </div>
                </div>
              )}

              {payment.canRefund && !finished && (
                <>
                  <div className={p.segmented} role="radiogroup" aria-label="Importe a devolver">
                    <button type="button" role="radio" aria-checked={mode === "total"} className={`${p.segment} ${mode === "total" ? p.segmentActive : ""}`} onClick={() => setMode("total")}>
                      Total ({formatMoney(payment.refundable)})
                    </button>
                    <button type="button" role="radio" aria-checked={mode === "partial"} className={`${p.segment} ${mode === "partial" ? p.segmentActive : ""}`} onClick={() => setMode("partial")}>
                      Parcial
                    </button>
                  </div>

                  {mode === "partial" && (
                    <label className={p.field}>
                      <span className={p.label}>Importe a devolver (máx. {formatMoney(payment.refundable)})</span>
                      <input
                        className={p.input}
                        inputMode="decimal"
                        value={amount}
                        autoFocus
                        onChange={event => setAmount(event.target.value)}
                        placeholder="Ej: 1500"
                      />
                    </label>
                  )}

                  <label className={p.field}>
                    <span className={p.label}>Motivo (opcional)</span>
                    <input
                      className={p.input}
                      value={reason}
                      maxLength={200}
                      onChange={event => setReason(event.target.value)}
                      placeholder="Ej: sin stock, no llegamos a entregar"
                    />
                  </label>

                  {canCancel && (
                    <label className={p.switchRow} style={{ borderTop: "none", padding: 0 }}>
                      <div className={p.switchText}>
                        <span className={p.switchTitle}>Cancelar también el pedido</span>
                        <span className={p.switchHint}>Solo se cancela si Mercado Pago confirma la devolución.</span>
                      </div>
                      <input type="checkbox" className={p.switch} checked={alsoCancel} onChange={event => setAlsoCancel(event.target.checked)} />
                    </label>
                  )}
                </>
              )}

              {info && info.refunds.length > 0 && (
                <div className={p.stack} style={{ gap: "0.4rem" }}>
                  <span className={p.label}>Devoluciones de este pedido</span>
                  <ul className={p.refundList}>
                    {info.refunds.map(refund => (
                      <li key={refund.id} className={p.refundItem}>
                        <span>
                          {formatMoney(refund.amount)}{refund.isPartial ? " (parcial)" : ""} · {formatDateTime(refund.requestedAt)}
                          {refund.requestedByName ? ` · ${refund.requestedByName}` : ""}
                          {refund.reason ? ` · ${refund.reason}` : ""}
                        </span>
                        <strong>{REFUND_LABEL[refund.status]}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!payment && info && <p className={p.notice}>Este pedido no tiene un pago online para devolver.</p>}
          {error && <p className={p.error} role="alert">{error}</p>}
        </div>

        <footer className={p.modalFooter}>
          <button type="button" className={p.btn} onClick={onClose}>{finished ? "Cerrar" : "Volver"}</button>
          {payment?.canRefund && !finished && (
            <button
              type="button"
              className={p.btnDanger}
              disabled={busy || (mode === "partial" && !partialValid)}
              onClick={submit}
            >
              {busy ? "Devolviendo…" : mode === "total" ? `Devolver ${formatMoney(payment.refundable)}` : "Devolver importe"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
