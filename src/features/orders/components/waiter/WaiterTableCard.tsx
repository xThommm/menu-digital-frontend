import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Receipt } from "lucide-react";
import { closeWaiterTable, setWaiterTableGuests } from "../../api/publicOrdersApi";
import { errorCode, errorMessage } from "../../lib/errors";
import { elapsedLabel, formatMoney, formatTime } from "../../lib/format";
import type { BillApi, GroupSession, GroupStaffApi, TableSession } from "../../types";
import BillPanel from "../shared/BillPanel";
import GroupPanel from "../shared/GroupPanel";
import TableBill from "../shared/TableBill";
import WaiterOrderCard from "./WaiterOrderCard";
import p from "../panel/panel.module.css";

// Cuenta de una mesa abierta del operador: el total, los pedidos, cuántos
// comensales hay, la cuenta dividida con sus cobros, el pedido grupal y el
// cierre. Va en la pestaña "Cuenta" de la pantalla de la mesa.

// Avisos del cierre que piden confirmar: pedidos sin entregar o cuenta sin terminar de cobrar.
const CLOSE_WARNINGS = ["ACTIVE_ORDERS", "BILL_PENDING"];

export default function WaiterTableCard({ session, group, now, slug, token, billApi, groupApi, onAuthError, onNewOrder, onClosed, onReload, onNotice, onUpdated }: {
  session: TableSession;
  group: GroupSession | null;
  now: number;
  slug: string;
  token: string;
  billApi: BillApi;
  groupApi: GroupStaffApi;
  onAuthError: (err: unknown) => boolean;
  onNewOrder: (tableNumber: number) => void;
  onClosed: (session: TableSession) => void;
  onReload: () => void;
  onNotice: (message: string) => void;
  onUpdated: (session: TableSession) => void;
}) {
  const [showOrders, setShowOrders] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guests, setGuests] = useState(session.guests === null ? "" : String(session.guests));
  const paid = session.paidAmount ?? 0;

  const close = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onClosed((await closeWaiterTable(token, session.id, force)).session);
    } catch (err) {
      if (onAuthError(err)) return;
      if (CLOSE_WARNINGS.includes(errorCode(err) ?? "")) setConfirm(errorMessage(err, "La mesa tiene pedidos sin entregar."));
      else setError(errorMessage(err, "No se pudo cerrar la mesa."));
    } finally {
      setBusy(false);
    }
  };

  const saveGuests = async () => {
    const value = guests === "" ? null : Number(guests);
    if (value === session.guests) return;
    try {
      onUpdated((await setWaiterTableGuests(token, session.id, value)).session);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudo guardar la cantidad de comensales."));
    }
  };

  return (
    <article className={p.tableCard} aria-label={`Mesa ${session.tableNumber}`}>
      <div className={p.tableHead}>
        <div className={p.titleBlock}>
          {/* El número de mesa ya está en el título de la hoja. */}
          <span className={p.tableMeta}>
            Abierta {elapsedLabel(session.openedAt, now)} ({formatTime(session.openedAt)}) · {session.ordersCount} pedido(s)
            {session.activeOrders > 0 && ` · ${session.activeOrders} sin entregar`}
          </span>
        </div>
        <span className={p.tableTotal}>{formatMoney(session.totalAmount)}</span>
      </div>

      <label className={p.guestsField}>
        Comensales
        <input
          className={p.input}
          type="number"
          min={1}
          max={200}
          inputMode="numeric"
          value={guests}
          onChange={event => setGuests(event.target.value)}
          onBlur={saveGuests}
        />
      </label>

      <TableBill orders={session.orders ?? []} total={session.totalAmount} />

      {paid > 0 && (
        <span className={p.tableMeta}>
          Cobrado {formatMoney(paid)} · falta {formatMoney(Math.max(0, session.totalAmount - paid))}
        </span>
      )}

      <div className={p.headerActions}>
        <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setShowBill(true)}>
          <Receipt size={14} aria-hidden /> Dividir y cobrar
        </button>
        <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setShowOrders(v => !v)}>
          {showOrders ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} {showOrders ? "Ocultar pedidos" : "Ver pedidos"}
        </button>
      </div>
      {showOrders && (session.orders ?? []).map(order => <WaiterOrderCard key={order.id} order={order} showPlace={false} />)}

      <GroupPanel
        api={groupApi}
        slug={slug}
        tableNumber={session.tableNumber}
        group={group}
        onChanged={onReload}
        onAuthError={onAuthError}
        onNotice={onNotice}
      />

      {error && <p className={p.error} role="alert">{error}</p>}

      {confirm ? (
        <div className={p.error}>
          {confirm} ¿Cerrar la mesa igual?
          <div className={p.headerActions} style={{ marginTop: "0.5rem" }}>
            <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={() => close(true)}>Cerrar igual</button>
            <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirm(null)}>Volver</button>
          </div>
        </div>
      ) : (
        <div className={p.headerActions}>
          <button type="button" className={p.btn} onClick={() => onNewOrder(session.tableNumber)}>
            <Plus size={16} aria-hidden /> Agregar pedido
          </button>
          <button type="button" className={p.btnPrimary} style={{ flex: 1 }} disabled={busy} onClick={() => close(false)}>
            {busy ? "Cerrando…" : "Cerrar mesa"}
          </button>
        </div>
      )}

      {showBill && (
        <BillPanel
          api={billApi}
          sessionId={session.id}
          tableNumber={session.tableNumber}
          refreshKey={now}
          onClose={() => setShowBill(false)}
          onChanged={onReload}
          onAuthError={onAuthError}
        />
      )}
    </article>
  );
}
