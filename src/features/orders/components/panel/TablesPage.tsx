import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { closeTableSession, listTableSessions, setTableGuests } from "../../api/ordersApi";
import { ownerHello, useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorCode, errorMessage } from "../../lib/errors";
import { durationLabel, elapsedLabel, formatDateTime, formatMoney, formatTime, STATUS_LABEL } from "../../lib/format";
import type { TableSession } from "../../types";
import TableBill from "../shared/TableBill";
import p from "./panel.module.css";

// Mesas: sesiones de mesa abiertas (de la primera comanda hasta que se
// cierra la cuenta) con su consumo, y el historial de las cerradas. Desde
// acá se puede cerrar cualquier mesa; el operador cierra las suyas desde su
// tomador de pedidos.

const POLL_MS = 15_000;

export default function TablesPage() {
  const [open, setOpen] = useState<TableSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [historyVersion, setHistoryVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setOpen((await listTableSessions("open")).sessions);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron cargar las mesas."));
    }
  }, []);

  // Mesas abiertas al día con los avisos del servidor; sin conexión en vivo, cada POLL_MS.
  useLiveRefresh({ hello: ownerHello(), refresh, offlineMs: POLL_MS });

  const replace = (updated: TableSession) =>
    setOpen(prev => (prev ?? []).map(session => (session.id === updated.id ? { ...session, ...updated } : session)));

  const closed = (session: TableSession) => {
    setOpen(prev => (prev ?? []).filter(s => s.id !== session.id));
    setNotice(`Mesa ${session.tableNumber} cerrada · ${formatMoney(session.totalAmount)} en ${session.ordersCount} pedido(s).`);
    setHistoryVersion(v => v + 1);
  };

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Mesas</h1>
          <p className={p.subtitle}>
            Una mesa se abre sola con su primer pedido y queda abierta hasta que se cierra la cuenta. Los pedidos nuevos se suman a la misma mesa.
          </p>
        </div>
      </header>

      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}
      {open === null && !error && <p className={p.loading}>Cargando…</p>}

      {open !== null && (
        <section aria-label="Mesas abiertas" style={{ marginTop: "1rem" }}>
          <h2 className={p.cardTitle}>Abiertas ({open.length})</h2>
          {open.length === 0 ? (
            <p className={`${p.card} ${p.empty}`}>No hay mesas abiertas.</p>
          ) : (
            <div className={p.tableGrid}>
              {open.map(session => (
                <OpenTableCard
                  key={session.id}
                  session={session}
                  now={now}
                  onUpdated={replace}
                  onClosed={closed}
                  onError={setError}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className={p.card} style={{ marginTop: "1.5rem" }}>
        <h2 className={p.cardTitle}>Mesas cerradas</h2>
        <ClosedTables version={historyVersion} onError={setError} />
      </section>
    </div>
  );
}

function OpenTableCard({ session, now, onUpdated, onClosed, onError }: {
  session: TableSession;
  now: number;
  onUpdated: (session: TableSession) => void;
  onClosed: (session: TableSession) => void;
  onError: (message: string | null) => void;
}) {
  const [showOrders, setShowOrders] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState(session.guests === null ? "" : String(session.guests));

  const close = async (force: boolean) => {
    setBusy(true);
    onError(null);
    try {
      onClosed(await closeTableSession(session.id, force));
    } catch (err) {
      if (errorCode(err) === "ACTIVE_ORDERS") setConfirm(errorMessage(err, "La mesa tiene pedidos sin entregar."));
      else onError(errorMessage(err, "No se pudo cerrar la mesa."));
    } finally {
      setBusy(false);
    }
  };

  const saveGuests = async () => {
    const value = guests === "" ? null : Number(guests);
    if (value === session.guests) return;
    try {
      onUpdated(await setTableGuests(session.id, value));
    } catch (err) {
      onError(errorMessage(err, "No se pudo guardar la cantidad de comensales."));
    }
  };

  return (
    <article className={p.tableCard} aria-label={`Mesa ${session.tableNumber}`}>
      <div className={p.tableHead}>
        <div className={p.titleBlock}>
          <span className={p.tableName}>Mesa {session.tableNumber}</span>
          <span className={p.tableMeta}>
            {session.waiterName ?? "Sin operador"} · abierta {elapsedLabel(session.openedAt, now)} ({formatTime(session.openedAt)})
          </span>
        </div>
        <span className={p.tableTotal}>{formatMoney(session.totalAmount)}</span>
      </div>

      <div className={p.row} style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span className={p.tableMeta}>
          {session.ordersCount} pedido(s){session.activeOrders > 0 && ` · ${session.activeOrders} sin entregar`}
        </span>
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
      </div>

      <TableBill orders={session.orders ?? []} total={session.totalAmount} />

      <button type="button" className={`${p.btnGhost} ${p.small}`} style={{ alignSelf: "flex-start" }} onClick={() => setShowOrders(v => !v)}>
        {showOrders ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} {showOrders ? "Ocultar pedidos" : "Ver pedidos"}
      </button>
      {showOrders && (
        <ul className={p.stack} style={{ gap: "0.4rem", margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
          {(session.orders ?? []).map(order => (
            <li key={order.id}>
              #{order.number} · {formatTime(order.createdAt)} · {STATUS_LABEL[order.status]} · {formatMoney(order.total)}
            </li>
          ))}
        </ul>
      )}

      {confirm ? (
        <div className={p.error}>
          {confirm} ¿Cerrar la mesa igual? Esos pedidos siguen en el panel.
          <div className={p.headerActions} style={{ marginTop: "0.5rem" }}>
            <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={() => close(true)}>Cerrar igual</button>
            <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirm(null)}>Volver</button>
          </div>
        </div>
      ) : (
        <button type="button" className={p.btnPrimary} disabled={busy} onClick={() => close(false)}>
          {busy ? "Cerrando…" : "Cerrar mesa"}
        </button>
      )}
    </article>
  );
}

const CLOSED_COLUMNS: DataTableColumn<TableSession>[] = [
  { id: "table", header: "Mesa", width: "80px", render: s => s.tableNumber },
  { id: "waiter", header: "Operador", width: "140px", render: s => s.waiterName ?? "—" },
  { id: "opened", header: "Apertura", width: "160px", render: s => formatDateTime(s.openedAt) },
  { id: "duration", header: "Duración", width: "110px", render: s => durationLabel(s.openedAt, s.closedAt) },
  { id: "orders", header: "Pedidos", width: "90px", align: "right", render: s => s.ordersCount },
  { id: "guests", header: "Comensales", width: "110px", align: "right", render: s => s.guests ?? "—" },
  { id: "total", header: "Total", width: "120px", align: "right", render: s => formatMoney(s.totalAmount) },
  {
    id: "closedBy",
    header: "Cerrada por",
    width: "140px",
    render: s => (s.closedByType === "panel" ? "Panel" : s.closedByName ?? "Operador"),
  },
];

function ClosedTables({ version, onError }: { version: number; onError: (message: string | null) => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ sessions: TableSession[]; total: number; pageSize: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTableSessions("closed", page)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) onError(errorMessage(err, "No se pudieron cargar las mesas cerradas.")); });
    return () => { cancelled = true; };
  }, [page, version, onError]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <DataTable<TableSession>
      caption="Mesas cerradas"
      rows={data?.sessions ?? []}
      columns={CLOSED_COLUMNS}
      getRowId={s => String(s.id)}
      minWidth={950}
      loading={!data}
      emptyMessage="Todavía no se cerró ninguna mesa."
      footer={pages > 1 && (
        <div className={p.pager}>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => setPage(prev => prev + 1)}>Siguiente</button>
        </div>
      )}
    />
  );
}
