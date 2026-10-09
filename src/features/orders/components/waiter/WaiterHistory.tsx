import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getWaiterHistory, getWaiterOrders } from "../../api/publicOrdersApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorMessage } from "../../lib/errors";
import { durationLabel, formatDateTime, formatMoney } from "../../lib/format";
import type { Order, TableSession } from "../../types";
import TableBill from "../shared/TableBill";
import WaiterOrderCard from "./WaiterOrderCard";
import p from "../panel/panel.module.css";

// Historial del operador: las mesas que atendió y ya se cerraron (con su
// cuenta), y los pedidos que tomó en el turno abierto (incluidos los de
// barra, take away y delivery, que no tienen mesa).

type Tab = "tables" | "orders";

export default function WaiterHistory({ token, onAuthError }: { token: string; onAuthError: (err: unknown) => boolean }) {
  const [tab, setTab] = useState<Tab>("tables");

  return (
    <section className={p.stack}>
      <div className={p.segmented} role="tablist" aria-label="Historial">
        <button type="button" role="tab" aria-selected={tab === "tables"} className={`${p.segment} ${tab === "tables" ? p.segmentActive : ""}`} onClick={() => setTab("tables")}>
          Mesas cerradas
        </button>
        <button type="button" role="tab" aria-selected={tab === "orders"} className={`${p.segment} ${tab === "orders" ? p.segmentActive : ""}`} onClick={() => setTab("orders")}>
          Pedidos del turno
        </button>
      </div>
      {tab === "tables"
        ? <ClosedTables token={token} onAuthError={onAuthError} />
        : <ShiftOrders token={token} onAuthError={onAuthError} />}
    </section>
  );
}

function ClosedTables({ token, onAuthError }: { token: string; onAuthError: (err: unknown) => boolean }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ sessions: TableSession[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getWaiterHistory(token, page, controller.signal)
      .then(result => { setData(result); setError(null); })
      .catch(err => {
        if (controller.signal.aborted || onAuthError(err)) return;
        setError(errorMessage(err, "No se pudo cargar el historial."));
      });
    return () => controller.abort();
  }, [token, page, onAuthError]);

  if (!data && !error) return <p className={p.loading}>Cargando…</p>;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      {error && <p className={p.error} role="alert">{error}</p>}
      {data?.sessions.length === 0 && <p className={p.empty}>Todavía no cerraste ninguna mesa.</p>}
      {data?.sessions.map(session => (
        <article key={session.id} className={p.tableCard}>
          <div className={p.tableHead}>
            <div className={p.titleBlock}>
              <span className={p.tableName}>Mesa {session.tableNumber}</span>
              <span className={p.tableMeta}>
                {formatDateTime(session.openedAt)} · {durationLabel(session.openedAt, session.closedAt)} · {session.ordersCount} pedido(s)
                {session.guests ? ` · ${session.guests} comensal(es)` : ""}
              </span>
            </div>
            <span className={p.tableTotal}>{formatMoney(session.totalAmount)}</span>
          </div>
          <button type="button" className={`${p.btnGhost} ${p.small}`} style={{ alignSelf: "flex-start" }} onClick={() => setOpen(open === session.id ? null : session.id)}>
            {open === session.id ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />} {open === session.id ? "Ocultar cuenta" : "Ver cuenta"}
          </button>
          {open === session.id && <TableBill orders={session.orders ?? []} total={session.totalAmount} />}
        </article>
      ))}
      {pages > 1 && (
        <div className={p.pager}>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => setPage(prev => prev + 1)}>Siguiente</button>
        </div>
      )}
    </>
  );
}

function ShiftOrders({ token, onAuthError }: { token: string; onAuthError: (err: unknown) => boolean }) {
  const [orders, setOrders] = useState<Order[] | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders((await getWaiterOrders(token)).orders);
    } catch (err) {
      onAuthError(err);
    }
  }, [token, onAuthError]);

  useLiveRefresh({ hello: { type: "auth", role: "waiter", token }, refresh: load, offlineMs: 15_000 });

  if (orders === null) return <p className={p.loading}>Cargando…</p>;
  if (orders.length === 0) return <p className={p.empty}>Todavía no tomaste pedidos en este turno.</p>;
  return <>{orders.map(order => <WaiterOrderCard key={order.id} order={order} />)}</>;
}
