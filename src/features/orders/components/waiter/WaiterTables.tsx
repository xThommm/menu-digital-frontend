import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { closeWaiterTable, getWaiterTables, setWaiterTableGuests } from "../../api/publicOrdersApi";
import { errorCode, errorMessage } from "../../lib/errors";
import { elapsedLabel, formatMoney, formatTime } from "../../lib/format";
import type { TableSession } from "../../types";
import TableBill from "../shared/TableBill";
import WaiterOrderCard from "./WaiterOrderCard";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// "Mis mesas": las mesas abiertas que atiende el operador (y las que todavía
// no tomó nadie, ej. abiertas por un pedido desde el QR). Para cada una, la
// cuenta con el total, los pedidos, cuántos comensales hay y el cierre de la
// mesa cuando pagan.

const POLL_MS = 15_000;

interface Props {
  token: string;
  waiterId: number;
  onAuthError: (err: unknown) => boolean;
  onNewOrder: (tableNumber: number) => void;
  onCountChange: (count: number) => void;
}

export default function WaiterTables({ token, waiterId, onAuthError, onNewOrder, onCountChange }: Props) {
  const [sessions, setSessions] = useState<TableSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const result = (await getWaiterTables(token)).sessions;
      setSessions(result);
      onCountChange(result.filter(session => session.waiterId === waiterId).length);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudieron cargar tus mesas."));
    }
  }, [token, waiterId, onAuthError, onCountChange]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  if (sessions === null && !error) return <p className={p.loading}>Cargando…</p>;

  const mine = (sessions ?? []).filter(session => session.waiterId === waiterId);
  const unassigned = (sessions ?? []).filter(session => session.waiterId === null);

  const onClosed = (session: TableSession) => {
    setNotice(`Mesa ${session.tableNumber} cerrada · ${formatMoney(session.totalAmount)}.`);
    load();
  };

  return (
    <section className={p.stack}>
      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}
      {mine.length === 0 && <p className={p.empty}>No tenés mesas abiertas. Se abren solas cuando cargás el primer pedido de una mesa.</p>}
      {mine.map(session => (
        <TableCard
          key={session.id}
          session={session}
          now={now}
          token={token}
          onAuthError={onAuthError}
          onNewOrder={onNewOrder}
          onClosed={onClosed}
          onUpdated={updated => setSessions(prev => (prev ?? []).map(s2 => (s2.id === updated.id ? updated : s2)))}
        />
      ))}

      {unassigned.length > 0 && (
        <>
          <h2 className={s.sectionTitle}>Mesas sin operador</h2>
          <p className={p.switchHint} style={{ marginTop: "-0.5rem" }}>
            Se abrieron con un pedido desde el QR o el panel. Si les cargás un pedido pasan a ser tuyas.
          </p>
          {unassigned.map(session => (
            <TableCard
              key={session.id}
              session={session}
              now={now}
              token={token}
              onAuthError={onAuthError}
              onNewOrder={onNewOrder}
              onClosed={onClosed}
              onUpdated={updated => setSessions(prev => (prev ?? []).map(s2 => (s2.id === updated.id ? updated : s2)))}
            />
          ))}
        </>
      )}
    </section>
  );
}

function TableCard({ session, now, token, onAuthError, onNewOrder, onClosed, onUpdated }: {
  session: TableSession;
  now: number;
  token: string;
  onAuthError: (err: unknown) => boolean;
  onNewOrder: (tableNumber: number) => void;
  onClosed: (session: TableSession) => void;
  onUpdated: (session: TableSession) => void;
}) {
  const [showOrders, setShowOrders] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guests, setGuests] = useState(session.guests === null ? "" : String(session.guests));

  const close = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onClosed((await closeWaiterTable(token, session.id, force)).session);
    } catch (err) {
      if (onAuthError(err)) return;
      if (errorCode(err) === "ACTIVE_ORDERS") setConfirm(errorMessage(err, "La mesa tiene pedidos sin entregar."));
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
          <span className={p.tableName}>Mesa {session.tableNumber}</span>
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

      <button type="button" className={`${p.btnGhost} ${p.small}`} style={{ alignSelf: "flex-start" }} onClick={() => setShowOrders(v => !v)}>
        {showOrders ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} {showOrders ? "Ocultar pedidos" : "Ver pedidos"}
      </button>
      {showOrders && (session.orders ?? []).map(order => <WaiterOrderCard key={order.id} order={order} showPlace={false} />)}

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
    </article>
  );
}
