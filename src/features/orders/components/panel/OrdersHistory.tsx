import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { listOrders, updateOrderStatus, type OrdersQuery } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney, SOURCE_LABEL, STATUS_LABEL } from "../../lib/format";
import type { Order, OrderStatus } from "../../types";
import p from "./panel.module.css";

// Historial de pedidos: todos los turnos, con filtros. Desde acá se marca
// un pedido entregado como devuelto o se reabre uno cancelado por error.
//
// Los filtros y la paginación van al servidor, así que las columnas no se
// ordenan: ordenar solo la página visible haría creer que es el total.

const STATUSES: OrderStatus[] = ["pending", "confirmed", "ready", "delivered", "cancelled", "returned"];

// "YYYY-MM-DD" del input date → inicio de ese día en Buenos Aires (UTC-3).
const dayStart = (day: string) => (day ? `${day}T00:00:00-03:00` : undefined);
const dayEnd = (day: string) => {
  if (!day) return undefined;
  const date = new Date(`${day}T00:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
};

const COLUMNS: DataTableColumn<Order>[] = [
  { id: "number", header: "Pedido", width: "96px", render: order => `#${order.number}` },
  { id: "date", header: "Fecha", width: "170px", render: order => formatDateTime(order.createdAt) },
  { id: "table", header: "Mesa", width: "90px", render: order => order.tableNumber ?? "—" },
  { id: "waiter", header: "Mozo", width: "140px", render: order => order.waiterName ?? "—" },
  {
    id: "status",
    header: "Estado",
    width: "150px",
    render: order => <span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span>,
  },
  { id: "total", header: "Total", width: "120px", align: "right", render: order => formatMoney(order.total) },
];

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

  const changeStatus = useCallback(async (order: Order, next: OrderStatus) => {
    setBusyId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, next);
      setData(prev => prev && { ...prev, orders: prev.orders.map(o => (o.id === updated.id ? updated : o)) });
    } catch (err) {
      setError(errorMessage(err, "No se pudo actualizar el pedido."));
    } finally {
      setBusyId(null);
    }
  }, []);

  const resetPage = () => setPage(1);
  const clearFilters = () => {
    setStatus("");
    setFrom("");
    setTo("");
    setTable("");
    resetPage();
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const expandable = useMemo(() => ({
    label: (order: Order) => `Detalle del pedido ${order.number}`,
    renderPanel: (order: Order) => (
      <div className={p.stack} style={{ gap: "0.6rem" }}>
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
    ),
  }), [busyId, changeStatus]);

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

      {/* Con datos ya cargados, un error (de una acción o de un filtro) se
          avisa arriba sin tapar la tabla. */}
      {error && data && <p className={p.error} role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}

      <DataTable<Order>
        caption="Historial de pedidos"
        rows={data?.orders ?? []}
        columns={COLUMNS}
        getRowId={order => String(order.id)}
        minWidth={760}
        filters={(
          <>
            <label>
              Estado
              <select value={status} onChange={event => { setStatus(event.target.value as OrderStatus | ""); resetPage(); }}>
                <option value="">Todos</option>
                {STATUSES.map(value => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
              </select>
            </label>
            <label>
              Desde
              <input type="date" value={from} onChange={event => { setFrom(event.target.value); resetPage(); }} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} onChange={event => { setTo(event.target.value); resetPage(); }} />
            </label>
            <label>
              Mesa
              <input type="number" min={1} inputMode="numeric" value={table} onChange={event => { setTable(event.target.value); resetPage(); }} placeholder="Todas" />
            </label>
          </>
        )}
        activeFilterCount={[status, from, to, table].filter(Boolean).length}
        onClearFilters={clearFilters}
        expandable={expandable}
        loading={!data && !error}
        error={data ? null : error}
        onRetry={() => void load()}
        emptyMessage="No hay pedidos con esos filtros."
        footer={data && pages > 1 && (
          <div className={p.pager}>
            <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</button>
            <span>Página {page} de {pages}</span>
            <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => setPage(prev => prev + 1)}>Siguiente</button>
          </div>
        )}
      />
    </div>
  );
}
