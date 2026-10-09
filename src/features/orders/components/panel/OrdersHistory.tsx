import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { listCouriers, listOrders, listShifts, updateOrderStatus, type OrdersQuery } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import {
  formatDateTime, formatMoney, formatTime, placeLabel, SERVICE_LABEL, SOURCE_LABEL, STATUS_LABEL,
} from "../../lib/format";
import { ASSIGNMENT_LABEL, minutesLabel } from "../../lib/delivery";
import type { Courier, Order, OrderStatus, ServiceType, Shift } from "../../types";
import { CustomerInfo } from "./OrderCard";
import { isRefundable } from "../../lib/payment";
import PaymentBadge from "./PaymentBadge";
import RefundModal from "./RefundModal";
import p from "./panel.module.css";

// Historial de pedidos. Por defecto muestra el turno abierto (o el último,
// si no hay uno abierto); "Ver todo" quita ese filtro. Desde acá se marca
// un pedido entregado como devuelto (con su motivo) o se reabre uno
// cancelado por error.
//
// Los filtros y la paginación van al servidor, así que las columnas no se
// ordenan: ordenar solo la página visible haría creer que es el total.

const STATUSES: OrderStatus[] = ["pending", "confirmed", "ready", "delivered", "cancelled", "returned"];
const SERVICES: ServiceType[] = ["table", "counter", "takeaway", "delivery"];

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
  { id: "place", header: "Destino", width: "110px", render: order => placeLabel(order) },
  { id: "waiter", header: "Operador", width: "140px", render: order => order.waiterName ?? "—" },
  {
    id: "status",
    header: "Estado",
    width: "150px",
    render: order => <span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span>,
  },
  { id: "total", header: "Total", width: "120px", align: "right", render: order => formatMoney(order.total) },
];

// Historial de envíos: el mismo historial, filtrado a delivery, con el repartidor y los tiempos reales.
const DELIVERY_COLUMNS: DataTableColumn<Order>[] = [
  { id: "number", header: "Pedido", width: "96px", render: order => `#${order.number}` },
  { id: "date", header: "Fecha", width: "170px", render: order => formatDateTime(order.createdAt) },
  { id: "address", header: "Destino", width: "220px", render: order => order.deliveryAddress ?? "—" },
  { id: "courier", header: "Repartidor", width: "150px", render: order => order.delivery?.courierName ?? "—" },
  { id: "pickup", header: "Retiro", width: "90px", render: order => (order.delivery?.pickedUpAt ? formatTime(order.delivery.pickedUpAt) : "—") },
  { id: "delivered", header: "Entrega", width: "90px", render: order => (order.delivery?.deliveredAt ? formatTime(order.delivery.deliveredAt) : "—") },
  { id: "duration", header: "Duración", width: "100px", render: order => (order.delivery?.durationMinutes != null ? minutesLabel(order.delivery.durationMinutes) : "—") },
  {
    id: "status",
    header: "Estado",
    width: "150px",
    render: order => <span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span>,
  },
];

type Scope = "shift" | "all";

export default function OrdersHistory({ deliveryOnly = false, tabs = null }: { deliveryOnly?: boolean; tabs?: React.ReactNode }) {
  const [params, setParams] = useSearchParams();
  const paramShift = params.get("turno");
  const [scope, setScope] = useState<Scope>("shift");
  // Turno actual o, si no hay uno abierto, el último (undefined: cargando).
  const [latestShift, setLatestShift] = useState<Shift | null | undefined>(undefined);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [serviceType, setServiceType] = useState<ServiceType | "">(deliveryOnly ? "delivery" : "");
  const [courier, setCourier] = useState("");
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [table, setTable] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ orders: Order[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [returning, setReturning] = useState<{ id: number; reason: string } | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);

  useEffect(() => {
    if (!deliveryOnly) return;
    let cancelled = false;
    listCouriers()
      .then(result => { if (!cancelled) setCouriers(result); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [deliveryOnly]);

  useEffect(() => {
    let cancelled = false;
    listShifts(1)
      .then(result => { if (!cancelled) setLatestShift(result.shifts[0] ?? null); })
      .catch(() => { if (!cancelled) setLatestShift(null); });
    return () => { cancelled = true; };
  }, []);

  // Turno por el que se filtra: el del link (?turno=) o el actual/último.
  const shiftId = paramShift ? Number(paramShift) : scope === "shift" ? latestShift?.id ?? null : null;
  const waitingShift = !paramShift && scope === "shift" && latestShift === undefined;

  const load = useCallback(async () => {
    if (waitingShift) return;
    const query: OrdersQuery = { page };
    if (shiftId) query.shiftId = shiftId;
    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;
    if (from) query.from = dayStart(from);
    if (to) query.to = dayEnd(to);
    if (table) query.table = Number(table);
    if (courier) query.courier = Number(courier);
    try {
      setData(await listOrders(query));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar el historial."));
    }
  }, [waitingShift, page, shiftId, status, serviceType, from, to, table, courier]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const changeStatus = useCallback(async (order: Order, next: OrderStatus, reason?: string) => {
    setBusyId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, next, reason);
      setData(prev => prev && { ...prev, orders: prev.orders.map(o => (o.id === updated.id ? updated : o)) });
      setReturning(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo actualizar el pedido."));
    } finally {
      setBusyId(null);
    }
  }, []);

  const resetPage = () => setPage(1);
  const clearFilters = () => {
    setStatus("");
    setServiceType(deliveryOnly ? "delivery" : "");
    setCourier("");
    setFrom("");
    setTo("");
    setTable("");
    resetPage();
  };
  const showAll = () => {
    if (paramShift) setParams({});
    setScope("all");
    resetPage();
  };
  const showCurrent = () => {
    if (paramShift) setParams({});
    setScope("shift");
    resetPage();
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const expandable = useMemo(() => ({
    label: (order: Order) => `Detalle del pedido ${order.number}`,
    renderPanel: (order: Order) => (
      <div className={p.stack} style={{ gap: "0.6rem" }}>
        <span className={p.label}>
          {SOURCE_LABEL[order.source]}{order.waiterName ? ` · ${order.waiterName}` : ""}
        </span>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {order.items.map(item => (
            <li key={item.id}>
              {item.quantity}× {item.title}{item.option ? ` · ${item.option}` : ""} — {formatMoney(item.unitPrice * item.quantity)}
              {item.notes && <em> ({item.notes})</em>}
            </li>
          ))}
        </ul>
        {order.notes && <span>Nota: {order.notes}</span>}
        <CustomerInfo order={order} />
        {order.delivery && (
          <div className={p.stack} style={{ gap: "0.25rem" }}>
            <span className={p.label}>
              Repartidor: {order.delivery.courierName} · {ASSIGNMENT_LABEL[order.delivery.status]}
              {order.delivery.deliveredBy === "admin" && " (marcado por el administrador)"}
            </span>
            <span className={p.switchHint}>
              Asignado {formatDateTime(order.delivery.assignedAt)}
              {order.delivery.pickedUpAt && ` · retirado ${formatDateTime(order.delivery.pickedUpAt)}`}
              {order.delivery.deliveredAt && ` · entregado ${formatDateTime(order.delivery.deliveredAt)}`}
              {order.delivery.durationMinutes != null && ` · ${minutesLabel(order.delivery.durationMinutes)} de viaje`}
            </span>
            {order.delivery.previousCouriers.length > 0 && (
              <span className={p.switchHint}>
                Responsables anteriores: {order.delivery.previousCouriers.map(previous => previous.courierName).join(", ")}
              </span>
            )}
          </div>
        )}
        {order.paymentMode === "mercadopago" && (
          <div className={p.headerActions}>
            <PaymentBadge order={order} />
            {isRefundable(order) && (
              <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setRefunding(order)}>Reembolsar</button>
            )}
          </div>
        )}
        {order.statusReason && (
          <span className={p.notice}>
            Motivo {order.status === "returned" ? "de la devolución" : "de la cancelación"}: {order.statusReason}
          </span>
        )}
        {order.status === "returned" && order.returnedAt && (
          <span className={p.switchHint}>
            Devuelto el {formatDateTime(order.returnedAt)}. No suma a la venta y se descuenta en la caja que estaba abierta en ese momento.
          </span>
        )}

        {returning?.id === order.id ? (
          <div className={p.row}>
            <label className={p.field} style={{ flex: "2 1 240px" }}>
              <span className={p.label}>Motivo de la devolución (opcional)</span>
              <input
                className={p.input}
                value={returning.reason}
                maxLength={200}
                autoFocus
                onChange={event => setReturning({ id: order.id, reason: event.target.value })}
                placeholder="Ej: llegó frío, producto equivocado"
              />
            </label>
            <div className={p.headerActions}>
              <button
                type="button"
                className={`${p.btnDanger} ${p.small}`}
                disabled={busyId === order.id}
                onClick={() => changeStatus(order, "returned", returning.reason.trim() || undefined)}
              >
                Confirmar devolución
              </button>
              <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setReturning(null)}>Volver</button>
            </div>
          </div>
        ) : (
          <div className={p.headerActions}>
            {order.status === "delivered" && (
              <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busyId === order.id} onClick={() => setReturning({ id: order.id, reason: "" })}>
                Marcar como devuelto
              </button>
            )}
            {order.status === "cancelled" && (
              <button type="button" className={`${p.btn} ${p.small}`} disabled={busyId === order.id} onClick={() => changeStatus(order, "pending")}>
                Reabrir pedido
              </button>
            )}
          </div>
        )}
      </div>
    ),
  }), [busyId, changeStatus, returning]);

  const subtitle = paramShift
    ? "Pedidos de un turno puntual."
    : scope === "all"
      ? "Todos los pedidos, de todos los turnos."
      : latestShift
        ? `${latestShift.closedAt ? "Último turno" : "Turno actual"}: ${latestShift.label}.`
        : latestShift === null ? "Todavía no hay turnos." : "Cargando turno…";

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>{deliveryOnly ? "Historial de envíos" : "Historial de pedidos"}</h1>
          <p className={p.subtitle}>
            {subtitle}
            {data && ` ${data.total} ${data.total === 1 ? "pedido" : "pedidos"}.`}
          </p>
        </div>
        {tabs}
        <div className={p.headerActions}>
          <div className={p.segmented} role="radiogroup" aria-label="Qué pedidos ver">
            <button
              type="button"
              role="radio"
              aria-checked={!paramShift && scope === "shift"}
              className={`${p.segment} ${!paramShift && scope === "shift" ? p.segmentActive : ""}`}
              onClick={showCurrent}
            >
              {latestShift?.closedAt ? "Último turno" : "Turno actual"}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!paramShift && scope === "all"}
              className={`${p.segment} ${!paramShift && scope === "all" ? p.segmentActive : ""}`}
              onClick={showAll}
            >
              Ver todo
            </button>
          </div>
        </div>
      </header>

      {/* Con datos ya cargados, un error (de una acción o de un filtro) se
          avisa arriba sin tapar la tabla. */}
      {error && data && <p className={p.error} role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}

      <DataTable<Order>
        caption={deliveryOnly ? "Historial de envíos" : "Historial de pedidos"}
        rows={data?.orders ?? []}
        columns={deliveryOnly ? DELIVERY_COLUMNS : COLUMNS}
        getRowId={order => String(order.id)}
        minWidth={deliveryOnly ? 1000 : 760}
        filters={(
          <>
            <label>
              Estado
              <select value={status} onChange={event => { setStatus(event.target.value as OrderStatus | ""); resetPage(); }}>
                <option value="">Todos</option>
                {STATUSES.map(value => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
              </select>
            </label>
            {!deliveryOnly && (
              <label>
                Tipo
                <select value={serviceType} onChange={event => { setServiceType(event.target.value as ServiceType | ""); resetPage(); }}>
                  <option value="">Todos</option>
                  {SERVICES.map(value => <option key={value} value={value}>{SERVICE_LABEL[value]}</option>)}
                </select>
              </label>
            )}
            {deliveryOnly && (
              <label>
                Repartidor
                <select value={courier} onChange={event => { setCourier(event.target.value); resetPage(); }}>
                  <option value="">Todos</option>
                  {couriers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            )}
            <label>
              Desde
              <input type="date" value={from} onChange={event => { setFrom(event.target.value); resetPage(); }} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} onChange={event => { setTo(event.target.value); resetPage(); }} />
            </label>
            {!deliveryOnly && (
              <label>
                Mesa
                <input type="number" min={1} inputMode="numeric" value={table} onChange={event => { setTable(event.target.value); resetPage(); }} placeholder="Todas" />
              </label>
            )}
          </>
        )}
        activeFilterCount={[status, deliveryOnly ? "" : serviceType, courier, from, to, table].filter(Boolean).length}
        onClearFilters={clearFilters}
        expandable={expandable}
        loading={!data && !error}
        error={data ? null : error}
        onRetry={() => void load()}
        emptyMessage={scope === "shift" && !paramShift ? "No hay pedidos en este turno con esos filtros." : "No hay pedidos con esos filtros."}
        footer={data && pages > 1 && (
          <div className={p.pager}>
            <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</button>
            <span>Página {page} de {pages}</span>
            <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => setPage(prev => prev + 1)}>Siguiente</button>
          </div>
        )}
      />

      {refunding && (
        <RefundModal order={refunding} onClose={() => setRefunding(null)} onChanged={() => void load()} />
      )}
    </div>
  );
}
