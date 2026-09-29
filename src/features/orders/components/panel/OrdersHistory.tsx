import { Fragment, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { listOrders, updateOrderStatus, type OrdersQuery } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney, SOURCE_LABEL, STATUS_LABEL } from "../../lib/format";
import type { Order, OrderStatus } from "../../types";
import p from "./panel.module.css";

// Historial de pedidos: todos los turnos, con filtros. Desde acá se marca
// un pedido entregado como devuelto o se reabre uno cancelado por error.

const STATUSES: OrderStatus[] = ["pending", "confirmed", "ready", "delivered", "cancelled", "returned"];

// "YYYY-MM-DD" del input date → inicio de ese día en Buenos Aires (UTC-3).
const dayStart = (day: string) => (day ? `${day}T00:00:00-03:00` : undefined);
const dayEnd = (day: string) => {
  if (!day) return undefined;
  const date = new Date(`${day}T00:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
};

export default function OrdersHistory() {
  const [params, setParams] = useSearchParams();
  const shiftId = params.get("turno");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ orders: Order[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const query: OrdersQuery = { page };
    if (shiftId) query.shiftId = Number(shiftId);
    if (status) query.status = status;
    if (from) query.from = dayStart(from);
    if (to) query.to = dayEnd(to);
    if (table) query.table = Number(table);
    try {
      setData(await listOrders(query));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar el historial."));
    }
  }, [page, shiftId, status, from, to, table]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const changeStatus = async (order: Order, next: OrderStatus) => {
    setBusyId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, next);
      setData(prev => prev && { ...prev, orders: prev.orders.map(o => (o.id === updated.id ? updated : o)) });
    } catch (err) {
      setError(errorMessage(err, "No se pudo actualizar el pedido."));
    } finally {
      setBusyId(null);
    }
  };

  const resetPage = () => setPage(1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Historial de pedidos</h1>
          <p className={p.subtitle}>
            {shiftId ? "Pedidos de un turno puntual." : "Todos los pedidos, de todos los turnos."}
            {data && ` ${data.total} en total.`}
          </p>
        </div>
        {shiftId && (
          <div className={p.headerActions}>
            <button type="button" className={p.btn} onClick={() => { setParams({}); resetPage(); }}>Ver todos los turnos</button>
          </div>
        )}
      </header>

      <div className={`${p.card} ${p.row}`} style={{ marginBottom: "1rem" }}>
        <label className={p.field}>
          <span className={p.label}>Estado</span>
          <select className={p.select} value={status} onChange={event => { setStatus(event.target.value as OrderStatus | ""); resetPage(); }}>
            <option value="">Todos</option>
            {STATUSES.map(value => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
          </select>
        </label>
        <label className={p.field}>
          <span className={p.label}>Desde</span>
          <input className={p.input} type="date" value={from} onChange={event => { setFrom(event.target.value); resetPage(); }} />
        </label>
        <label className={p.field}>
          <span className={p.label}>Hasta</span>
          <input className={p.input} type="date" value={to} onChange={event => { setTo(event.target.value); resetPage(); }} />
        </label>
        <label className={p.field}>
          <span className={p.label}>Mesa</span>
          <input className={p.input} type="number" min={1} inputMode="numeric" value={table} onChange={event => { setTable(event.target.value); resetPage(); }} placeholder="Todas" />
        </label>
      </div>

      {error && <p className={p.error} role="alert">{error}</p>}
      {!data && !error && <p className={p.loading}>Cargando…</p>}
      {data && data.orders.length === 0 && <p className={p.empty}>No hay pedidos con esos filtros.</p>}

      {data && data.orders.length > 0 && (
        <div className={`${p.card} ${p.tableWrap}`}>
          <table className={p.table}>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Fecha</th>
                <th>Mesa</th>
                <th>Mozo</th>
                <th>Estado</th>
                <th className={p.num}>Total</th>
                <th aria-label="Detalle" />
              </tr>
            </thead>
            <tbody>
              {data.orders.map(order => (
                <Fragment key={order.id}>
                  <tr>
                    <td>#{order.number}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{order.tableNumber ?? "—"}</td>
                    <td>{order.waiterName ?? "—"}</td>
                    <td><span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span></td>
                    <td className={p.num}>{formatMoney(order.total)}</td>
                    <td>
                      <button
                        type="button"
                        className={p.iconBtn}
                        onClick={() => setExpanded(prev => (prev === order.id ? null : order.id))}
                        aria-expanded={expanded === order.id}
                        aria-label={`Detalle del pedido ${order.number}`}
                      >
                        {expanded === order.id ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                      </button>
                    </td>
                  </tr>
                  {expanded === order.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className={p.stack} style={{ gap: "0.6rem", padding: "0.25rem 0 0.5rem" }}>
                          <span className={p.label}>{SOURCE_LABEL[order.source]}</span>
                          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                            {order.items.map(item => (
                              <li key={item.id}>
                                {item.quantity}× {item.title}{item.option ? ` · ${item.option}` : ""} — {formatMoney(item.unitPrice * item.quantity)}
                                {item.notes && <em> ({item.notes})</em>}
                              </li>
                            ))}
                          </ul>
                          {order.notes && <span>Nota: {order.notes}</span>}
                          <div className={p.headerActions}>
                            {order.status === "delivered" && (
                              <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busyId === order.id} onClick={() => changeStatus(order, "returned")}>
                                Marcar como devuelto
                              </button>
                            )}
                            {order.status === "cancelled" && (
                              <button type="button" className={`${p.btn} ${p.small}`} disabled={busyId === order.id} onClick={() => changeStatus(order, "pending")}>
                                Reabrir pedido
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className={p.pager}>
            <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</button>
            <span>Página {page} de {pages}</span>
            <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => setPage(prev => prev + 1)}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
