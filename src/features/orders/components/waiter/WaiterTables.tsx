import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Receipt } from "lucide-react";
import {
  closeWaiterTable, getWaiterTables, setWaiterTableGuests, waiterBillApi, waiterGroupApi,
} from "../../api/publicOrdersApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorCode, errorMessage } from "../../lib/errors";
import { elapsedLabel, formatMoney, formatTime } from "../../lib/format";
import type { BillApi, GroupSession, GroupStaffApi, OccupiedTable, TableSession } from "../../types";
import BillPanel from "../shared/BillPanel";
import GroupPanel, { OpenGroupForm } from "../shared/GroupPanel";
import TableBill from "../shared/TableBill";
import type { FloorTable } from "../../lib/floor";
import TableFloor, { FloorSheet } from "../shared/TableFloor";
import WaiterOrderCard from "./WaiterOrderCard";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// Salón del operador: todas las mesas del local con su estado. Al tocar una
// abierta (suya o sin operador) se abre su cuenta con el total, los pedidos,
// los comensales, la cuenta dividida con sus cobros, el pedido grupal y el
// cierre; una libre va directo a cargarle un pedido. Las de otros operadores
// se ven ocupadas, sin su cuenta.

const POLL_MS = 15_000;
// Avisos del cierre que piden confirmar: pedidos sin entregar o cuenta sin terminar de cobrar.
const CLOSE_WARNINGS = ["ACTIVE_ORDERS", "BILL_PENDING"];

interface Props {
  slug: string;
  token: string;
  waiterId: number;
  tableCount: number;
  hidePrices?: boolean;
  onAuthError: (err: unknown) => boolean;
  onNewOrder: (tableNumber: number) => void;
  onCountChange: (count: number) => void;
}

export default function WaiterTables({ slug, token, waiterId, tableCount, hidePrices = false, onAuthError, onNewOrder, onCountChange }: Props) {
  const [sessions, setSessions] = useState<TableSession[] | null>(null);
  const [occupied, setOccupied] = useState<OccupiedTable[]>([]);
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const billApi = useMemo(() => waiterBillApi(token), [token]);
  const groupApi = useMemo(() => waiterGroupApi(token), [token]);

  const load = useCallback(async () => {
    try {
      const [result, openGroups] = await Promise.all([
        getWaiterTables(token),
        // Con un backend anterior no hay pedidos grupales: las mesas se ven igual.
        groupApi.list().catch(() => [] as GroupSession[]),
      ]);
      setSessions(result.sessions);
      setOccupied(result.occupied ?? []);
      setGroups(openGroups);
      onCountChange(result.sessions.filter(session => session.waiterId === waiterId).length);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudieron cargar las mesas."));
    }
  }, [token, waiterId, onAuthError, onCountChange, groupApi]);

  // Las mesas se actualizan con los avisos del servidor; sin conexión en vivo, cada POLL_MS.
  useLiveRefresh({ hello: { type: "auth", role: "waiter", token }, refresh: load, offlineMs: POLL_MS });

  const closeSheet = useCallback(() => setSelected(null), []);

  if (sessions === null && !error) return <p className={p.loading}>Cargando…</p>;

  const groupOf = (tableNumber: number) => groups.find(group => group.tableNumber === tableNumber) ?? null;
  const selectedSession = selected === null ? null : (sessions ?? []).find(session => session.tableNumber === selected) ?? null;
  const selectedGroup = selected === null ? null : groupOf(selected);

  const select = (table: FloorTable) => {
    setNotice(null);
    if (table.kind === "other") {
      setNotice(`La mesa ${table.tableNumber} la atiende ${table.occupied.waiterName ?? "otro operador"}.`);
    } else if (table.kind === "free" && !table.group) {
      onNewOrder(table.tableNumber);
    } else {
      setSelected(table.tableNumber);
    }
  };

  const onClosed = (session: TableSession) => {
    setSelected(null);
    setNotice(`Mesa ${session.tableNumber} cerrada · ${formatMoney(session.totalAmount)}.`);
    load();
  };

  return (
    <section className={p.stack}>
      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}

      <TableFloor
        tableCount={tableCount}
        sessions={sessions ?? []}
        occupied={occupied}
        groups={groups}
        now={now}
        waiterId={waiterId}
        hidePrices={hidePrices}
        onSelect={select}
      />
      <p className={p.switchHint}>Tocá una mesa libre para cargarle el primer pedido, o una ocupada para ver su cuenta.</p>

      <h2 className={s.sectionTitle}>Pedido grupal</h2>
      <p className={p.switchHint} style={{ marginTop: "-0.5rem" }}>
        Los comensales de una mesa arman el pedido entre todos, cada uno desde su celular. Abrilo acá para una mesa que todavía no pidió nada.
      </p>
      <OpenGroupForm api={groupApi} onOpened={load} onAuthError={onAuthError} />

      {selected !== null && (selectedSession || selectedGroup) && (
        <FloorSheet title={`Mesa ${selected}`} onClose={closeSheet}>
          {selectedSession ? (
            <TableCard
              key={selectedSession.id}
              session={selectedSession}
              group={selectedGroup}
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
          ) : (
            <>
              <GroupPanel api={groupApi} slug={slug} tableNumber={selected} group={selectedGroup} onChanged={load} onAuthError={onAuthError} onNotice={setNotice} />
              <button type="button" className={p.btnPrimary} onClick={() => onNewOrder(selected)}>
                <Plus size={16} aria-hidden /> Cargar pedido
              </button>
            </>
          )}
        </FloorSheet>
      )}
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
