import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import QRCode from "qrcode";
import { ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import {
  closeTableSession, listTableSessions, ownerBillApi, ownerGroupApi, setTableGuests,
} from "../../api/ordersApi";
import { ownerHello, useLiveRefresh } from "../../hooks/useLiveRefresh";
import { useOrderSettings, useWaiters } from "../../hooks/usePanelData";
import { venueQrUrl } from "../../lib/qrUrls";
import { useContextMenu } from "../../../contextMenu/hooks/useContextMenu";
import { useMenuEnv } from "../../../contextMenu/hooks/useMenuEnv";
import { errorCode, errorMessage } from "../../lib/errors";
import { durationLabel, elapsedLabel, formatDateTime, formatMoney, formatTime, STATUS_LABEL } from "../../lib/format";
import type { GroupSession, TableSession } from "../../types";
import BillPanel from "../shared/BillPanel";
import GroupPanel, { OpenGroupForm } from "../shared/GroupPanel";
import TableBill from "../shared/TableBill";
import ManualOrderModal from "./ManualOrderModal";
import type { TableFocusState } from "./ordersBoardMenu";
import { buildTableMenu } from "./tablesMenu";
import p from "./panel.module.css";

// Mesas: sesiones de mesa abiertas (de la primera comanda hasta que se
// cierra la cuenta) con su consumo, y el historial de las cerradas. Desde
// acá se puede cerrar cualquier mesa, dividir su cuenta, registrar los pagos y
// manejar su pedido grupal; el operador hace lo mismo con las suyas desde su
// tomador de pedidos.

const POLL_MS = 15_000;
// Avisos del cierre que piden confirmar: pedidos sin entregar o cuenta sin terminar de cobrar.
const CLOSE_WARNINGS = ["ACTIVE_ORDERS", "BILL_PENDING"];

export default function TablesPage() {
  const slug = useAuth().user?.slug ?? "";
  const [open, setOpen] = useState<TableSession[] | null>(null);
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [historyVersion, setHistoryVersion] = useState(0);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const settings = useOrderSettings();
  const waiters = useWaiters();
  // Se llegó desde el tablero ("Ir a la mesa" / "Abrir la cuenta de la mesa").
  const focus = (useLocation().state as TableFocusState | null) ?? null;

  // Link de la carta que abre el QR de la mesa (o el QR general, según la configuración).
  const tableLink = (tableNumber: number): string | null => {
    const data = settings.data;
    if (!data) return null;
    if (data.settings.qrMode === "general") return venueQrUrl(data.slug, data.settings.generalQrToken);
    const table = data.tables.find(entry => entry.number === tableNumber);
    return table ? venueQrUrl(data.slug, table.qrToken) : null;
  };

  const refresh = useCallback(async () => {
    try {
      const [sessions, openGroups] = await Promise.all([
        listTableSessions("open").then(result => result.sessions),
        // Con un backend anterior no hay pedidos grupales: las mesas se ven igual.
        ownerGroupApi.list().catch(() => [] as GroupSession[]),
      ]);
      setOpen(sessions);
      setGroups(openGroups);
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

  // Pedidos grupales de mesas que todavía no tienen ningún pedido.
  const openTables = new Set((open ?? []).map(session => session.tableNumber));
  const waiting = groups.filter(group => !openTables.has(group.tableNumber));

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
                  group={groups.find(group => group.tableNumber === session.tableNumber) ?? null}
                  slug={slug}
                  now={now}
                  onUpdated={replace}
                  onClosed={closed}
                  onError={setError}
                  onReload={refresh}
                  onNotice={setNotice}
                  tableLink={tableLink(session.tableNumber)}
                  focused={focus?.tableSessionId === session.id}
                  openBill={focus?.tableSessionId === session.id && focus.bill === true}
                  onAddOrder={() => setAddingTo(session.tableNumber)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {open !== null && (
        <section className={p.card} style={{ marginTop: "1.5rem" }} aria-label="Pedidos grupales">
          <h2 className={p.cardTitle}>Pedidos grupales</h2>
          <p className={p.switchHint} style={{ marginBottom: "0.75rem" }}>
            Los comensales de una mesa arman el pedido entre todos, cada uno desde su celular, y sale como un solo pedido con el nombre de quién pidió cada cosa.
            Abrilo acá para una mesa que todavía no pidió nada; en las mesas abiertas está dentro de cada una.
          </p>
          <div className={p.stack}>
            {waiting.map(group => (
              <div key={group.id} className={p.stack} style={{ gap: "0.4rem" }}>
                <span className={p.tableName}>Mesa {group.tableNumber}</span>
                <GroupPanel api={ownerGroupApi} slug={slug} tableNumber={group.tableNumber} group={group} onChanged={refresh} onNotice={setNotice} />
              </div>
            ))}
            <OpenGroupForm api={ownerGroupApi} onOpened={refresh} />
          </div>
        </section>
      )}

      {addingTo !== null && (
        <ManualOrderModal
          tableCount={settings.data?.settings.tableCount ?? 0}
          waiters={waiters.data ?? []}
          initialTable={addingTo}
          onClose={() => setAddingTo(null)}
          onCreated={order => {
            setAddingTo(null);
            setNotice(`Pedido #${order.number} cargado · Mesa ${order.tableNumber}.`);
            void refresh();
          }}
        />
      )}

      <section className={p.card} style={{ marginTop: "1.5rem" }}>
        <h2 className={p.cardTitle}>Mesas cerradas</h2>
        <ClosedTables version={historyVersion} onError={setError} />
      </section>
    </div>
  );
}

function OpenTableCard({
  session, group, slug, now, onUpdated, onClosed, onError, onReload, onNotice, tableLink, focused, openBill, onAddOrder,
}: {
  session: TableSession;
  group: GroupSession | null;
  slug: string;
  now: number;
  onUpdated: (session: TableSession) => void;
  onClosed: (session: TableSession) => void;
  onError: (message: string | null) => void;
  onReload: () => void;
  onNotice: (message: string) => void;
  tableLink: string | null;
  focused: boolean;
  openBill: boolean;
  onAddOrder: () => void;
}) {
  const [showOrders, setShowOrders] = useState(false);
  const [showBill, setShowBill] = useState(openBill);
  const cardRef = useRef<HTMLElement>(null);
  const env = useMenuEnv();
  const tableMenu = useMemo(() => buildTableMenu(env), [env]);
  const openTableMenu = useContextMenu(tableMenu, { highlightTarget: true });

  useEffect(() => {
    if (focused) cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focused]);

  const downloadQr = async () => {
    if (!tableLink) return;
    const link = document.createElement("a");
    link.href = await QRCode.toDataURL(tableLink, { width: 480, margin: 1 });
    link.download = `qr-${slug}-mesa-${session.tableNumber}.png`;
    link.click();
  };
  const paid = session.paidAmount ?? 0;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState(session.guests === null ? "" : String(session.guests));

  const close = async (force: boolean) => {
    setBusy(true);
    onError(null);
    try {
      onClosed(await closeTableSession(session.id, force));
    } catch (err) {
      if (CLOSE_WARNINGS.includes(errorCode(err) ?? "")) setConfirm(errorMessage(err, "La mesa tiene pedidos sin entregar."));
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
    <article
      ref={cardRef}
      className={`${p.tableCard} ${focused ? p.tableCardFocus : ""}`}
      aria-label={`Mesa ${session.tableNumber}`}
      onContextMenu={event => openTableMenu(event, {
        session,
        group,
        showingOrders: showOrders,
        tableLink,
        busy,
        actions: {
          toggleOrders: () => setShowOrders(v => !v),
          openBill: () => setShowBill(true),
          addOrder: onAddOrder,
          openGroup: async () => { await ownerGroupApi.open(session.tableNumber); onReload(); },
          downloadQr,
          closeTable: () => close(false),
        },
      })}
    >
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
      {showOrders && (
        <ul className={p.stack} style={{ gap: "0.4rem", margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
          {(session.orders ?? []).map(order => (
            <li key={order.id}>
              #{order.number} · {formatTime(order.createdAt)} · {STATUS_LABEL[order.status]} · {formatMoney(order.total)}
            </li>
          ))}
        </ul>
      )}

      <GroupPanel api={ownerGroupApi} slug={slug} tableNumber={session.tableNumber} group={group} onChanged={onReload} onNotice={onNotice} />

      {confirm ? (
        <div className={p.error}>
          {confirm} ¿Cerrar la mesa igual?
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

      {showBill && (
        <BillPanel
          api={ownerBillApi}
          sessionId={session.id}
          tableNumber={session.tableNumber}
          refreshKey={now}
          onClose={() => setShowBill(false)}
          onChanged={onReload}
        />
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
  { id: "paid", header: "Cobrado", width: "120px", align: "right", render: s => (s.paidAmount ? formatMoney(s.paidAmount) : "—") },
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
      minWidth={1070}
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
