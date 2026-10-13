import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Receipt } from "lucide-react";
import {
  closeWaiterTable, getWaiterTables, setWaiterTableGuests, waiterBillApi, waiterGroupApi,
} from "../../api/publicOrdersApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorCode, errorMessage } from "../../lib/errors";
import { elapsedLabel, formatMoney, formatTime } from "../../lib/format";
import type { BillApi, GroupSession, GroupStaffApi, TableSession } from "../../types";
import BillPanel from "../shared/BillPanel";
import GroupPanel, { OpenGroupForm } from "../shared/GroupPanel";
import TableBill from "../shared/TableBill";
import WaiterOrderCard from "./WaiterOrderCard";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// "Mis mesas": las mesas abiertas que atiende el operador (y las que todavía
// no tomó nadie, ej. abiertas por un pedido desde el QR). Para cada una, la
// cuenta con el total, los pedidos, cuántos comensales hay, la cuenta
// dividida con sus cobros, el pedido grupal y el cierre de la mesa.

const POLL_MS = 15_000;
// Avisos del cierre que piden confirmar: pedidos sin entregar o cuenta sin terminar de cobrar.
const CLOSE_WARNINGS = ["ACTIVE_ORDERS", "BILL_PENDING"];

interface Props {
  slug: string;
  token: string;
  waiterId: number;
  onAuthError: (err: unknown) => boolean;
  onNewOrder: (tableNumber: number) => void;
  onCountChange: (count: number) => void;
}

export default function WaiterTables({ slug, token, waiterId, onAuthError, onNewOrder, onCountChange }: Props) {
  const [sessions, setSessions] = useState<TableSession[] | null>(null);
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const billApi = useMemo(() => waiterBillApi(token), [token]);
  const groupApi = useMemo(() => waiterGroupApi(token), [token]);

  const load = useCallback(async () => {
    try {
      const [result, openGroups] = await Promise.all([
        getWaiterTables(token).then(response => response.sessions),
        // Con un backend anterior no hay pedidos grupales: las mesas se ven igual.
        groupApi.list().catch(() => [] as GroupSession[]),
      ]);
      setSessions(result);
      setGroups(openGroups);
      onCountChange(result.filter(session => session.waiterId === waiterId).length);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudieron cargar tus mesas."));
    }
  }, [token, waiterId, onAuthError, onCountChange, groupApi]);

  // Las mesas se actualizan con los avisos del servidor; sin conexión en vivo, cada POLL_MS.
  useLiveRefresh({ hello: { type: "auth", role: "waiter", token }, refresh: load, offlineMs: POLL_MS });

  if (sessions === null && !error) return <p className={p.loading}>Cargando…</p>;

  const mine = (sessions ?? []).filter(session => session.waiterId === waiterId);
  const unassigned = (sessions ?? []).filter(session => session.waiterId === null);
  const groupOf = (tableNumber: number) => groups.find(group => group.tableNumber === tableNumber) ?? null;
  // Pedidos grupales de mesas que todavía no tienen ningún pedido (no hay mesa abierta que mostrar).
  const openTables = new Set((sessions ?? []).map(session => session.tableNumber));
  const waiting = groups.filter(group => !openTables.has(group.tableNumber));

  const onClosed = (session: TableSession) => {
    setNotice(`Mesa ${session.tableNumber} cerrada · ${formatMoney(session.totalAmount)}.`);
    load();
  };

  const card = (session: TableSession) => (
    <TableCard
      key={session.id}
      session={session}
      group={groupOf(session.tableNumber)}
      now={now}
      slug={slug}
      token={token}
      billApi={billApi}
      groupApi={groupApi}
      onAuthError={onAuthError}
      onNewOrder={onNewOrder}
      onClosed={onClosed}
      onReload={load}
      onNotice={setNotice}
      onUpdated={updated => setSessions(prev => (prev ?? []).map(s2 => (s2.id === updated.id ? updated : s2)))}
    />
  );

  return (
    <section className={p.stack}>
      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}
      {mine.length === 0 && <p className={p.empty}>No tenés mesas abiertas. Se abren solas cuando cargás el primer pedido de una mesa.</p>}
      {mine.map(card)}

      {unassigned.length > 0 && (
        <>
          <h2 className={s.sectionTitle}>Mesas sin operador</h2>
          <p className={p.switchHint} style={{ marginTop: "-0.5rem" }}>
            Se abrieron con un pedido desde el QR o el panel. Si les cargás un pedido pasan a ser tuyas.
          </p>
          {unassigned.map(card)}
        </>
      )}

      <h2 className={s.sectionTitle}>Pedidos grupales</h2>
      <p className={p.switchHint} style={{ marginTop: "-0.5rem" }}>
        Los comensales de una mesa arman el pedido entre todos, cada uno desde su celular. Abrilo acá para una mesa que todavía no pidió nada.
      </p>
      {waiting.map(group => (
        <article key={group.id} className={p.tableCard} aria-label={`Pedido grupal de la mesa ${group.tableNumber}`}>
          <span className={p.tableName}>Mesa {group.tableNumber}</span>
          <GroupPanel api={groupApi} slug={slug} tableNumber={group.tableNumber} group={group} onChanged={load} onAuthError={onAuthError} onNotice={setNotice} />
        </article>
      ))}
      <OpenGroupForm api={groupApi} onOpened={load} onAuthError={onAuthError} />
    </section>
  );
}

function TableCard({ session, group, now, slug, token, billApi, groupApi, onAuthError, onNewOrder, onClosed, onReload, onNotice, onUpdated }: {
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
