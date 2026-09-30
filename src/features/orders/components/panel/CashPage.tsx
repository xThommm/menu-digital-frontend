import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { closeShift, getShiftSummary, listShifts, openShift } from "../../api/ordersApi";
import { errorCode, errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney, SOURCE_LABEL } from "../../lib/format";
import type { Shift, ShiftSummary } from "../../types";
import p from "./panel.module.css";

// Caja y turnos: resumen del turno abierto, cierre de caja (que cierra el
// turno) e historial de turnos cerrados con su resumen.

export default function CashPage() {
  const [current, setCurrent] = useState<{ shift: Shift | null; summary: ShiftSummary | null } | null>(null);
  const [shifts, setShifts] = useState<{ shifts: Shift[]; total: number; pageSize: number } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [needsForce, setNeedsForce] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ shift: Shift; summary: ShiftSummary } | null>(null);

  const load = useCallback(async () => {
    try {
      const [cur, list] = await Promise.all([getShiftSummary("current"), listShifts(page)]);
      setCurrent(cur);
      setShifts(list);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar la caja."));
    }
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const doClose = async (force: boolean) => {
    setClosing(true);
    setError(null);
    try {
      const closed = await closeShift({ cashCounted: cash === "" ? null : Number(cash), notes: notes.trim() || undefined, force });
      setNotice(`Caja cerrada: ${closed.label} · ${formatMoney(closed.totalAmount ?? 0)} en ${closed.ordersCount ?? 0} pedido(s).`);
      setCash("");
      setNotes("");
      setNeedsForce(null);
      await load();
    } catch (err) {
      if (errorCode(err) === "ACTIVE_ORDERS") setNeedsForce(errorMessage(err, "Hay pedidos sin entregar."));
      else setError(errorMessage(err, "No se pudo cerrar la caja."));
    } finally {
      setClosing(false);
    }
  };

  const start = async () => {
    try {
      await openShift();
      setNotice(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "No se pudo abrir el turno."));
    }
  };

  const showShift = async (shift: Shift) => {
    try {
      const data = await getShiftSummary(shift.id);
      if (data.shift && data.summary) setSelected({ shift: data.shift, summary: data.summary });
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar el turno."));
    }
  };

  const summary = current?.summary;
  const cashNumber = cash === "" ? null : Number(cash);
  const pages = shifts ? Math.max(1, Math.ceil(shifts.total / shifts.pageSize)) : 1;

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Caja y turnos</h1>
          <p className={p.subtitle}>El cierre de caja termina el turno actual. El próximo pedido abre uno nuevo.</p>
        </div>
      </header>

      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}
      {!current && !error && <p className={p.loading}>Cargando…</p>}

      {current && !current.shift && (
        <div className={p.card} style={{ marginTop: "1rem" }}>
          <p className={p.empty} style={{ padding: "1rem 0" }}>No hay un turno abierto.</p>
          <div style={{ textAlign: "center" }}>
            <button type="button" className={p.btnPrimary} onClick={start}>Abrir turno ahora</button>
          </div>
        </div>
      )}

      {current?.shift && summary && (
        <div className={p.stack} style={{ marginTop: "1rem" }}>
          <h2 className={p.cardTitle} style={{ margin: 0 }}>
            {current.shift.label} · abierto el {formatDateTime(current.shift.openedAt)}
          </h2>
          <SummaryView summary={summary} />

          <form className={`${p.card} ${p.stack}`} onSubmit={event => { event.preventDefault(); doClose(false); }}>
            <h2 className={p.cardTitle}>Cierre de caja</h2>
            <p className={p.cardDesc}>
              Contá el efectivo y registralo. Se guarda junto al total vendido del turno para que puedas comparar.
            </p>
            <div className={p.row}>
              <label className={p.field}>
                <span className={p.label}>Efectivo contado (opcional)</span>
                <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" value={cash} onChange={e => setCash(e.target.value)} />
              </label>
              <label className={p.field} style={{ flex: "2 1 240px" }}>
                <span className={p.label}>Notas (opcional)</span>
                <input className={p.input} value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} placeholder="Ej: faltante por vuelto, pago con transferencia…" />
              </label>
            </div>
            {cashNumber !== null && Number.isFinite(cashNumber) && (
              <p className={p.notice}>
                Vendido en el turno: {formatMoney(summary.totalAmount)} · Contado: {formatMoney(cashNumber)} ·
                Diferencia: {formatMoney(cashNumber - summary.totalAmount)} (el total incluye todos los medios de pago)
              </p>
            )}
            {needsForce ? (
              <div className={p.error}>
                {needsForce} Esos pedidos van a seguir en el panel.
                <div className={p.headerActions} style={{ marginTop: "0.5rem" }}>
                  <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={closing} onClick={() => doClose(true)}>Cerrar igual</button>
                  <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setNeedsForce(null)}>Volver</button>
                </div>
              </div>
            ) : (
              <div className={p.headerActions}>
                <button type="submit" className={p.btnPrimary} disabled={closing}>{closing ? "Cerrando…" : "Cerrar caja"}</button>
              </div>
            )}
          </form>
        </div>
      )}

      {shifts && shifts.shifts.some(shift => shift.closedAt) && (
        <section className={p.card} style={{ marginTop: "1.5rem" }}>
          <h2 className={p.cardTitle}>Turnos cerrados</h2>
          {/* Viene paginado del servidor: sin orden por columna (ver OrdersHistory). */}
          <DataTable<Shift>
            caption="Turnos cerrados"
            rows={shifts.shifts.filter(shift => shift.closedAt)}
            columns={[
              { id: "label", header: "Turno", width: "170px", render: shift => shift.label },
              { id: "opened", header: "Apertura", width: "170px", render: shift => formatDateTime(shift.openedAt) },
              { id: "closed", header: "Cierre", width: "170px", render: shift => (shift.closedAt ? formatDateTime(shift.closedAt) : "—") },
              { id: "orders", header: "Pedidos", width: "100px", align: "right", render: shift => shift.ordersCount ?? 0 },
              { id: "total", header: "Vendido", width: "120px", align: "right", render: shift => formatMoney(shift.totalAmount ?? 0) },
              { id: "cash", header: "Efectivo contado", width: "150px", align: "right", render: shift => (shift.cashCounted === null ? "—" : formatMoney(shift.cashCounted)) },
              {
                id: "actions",
                header: "",
                headerLabel: "Acciones",
                width: "200px",
                resizable: false,
                render: shift => (
                  <div className={p.headerActions}>
                    <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => showShift(shift)}>Resumen</button>
                    <Link className={`${p.btnGhost} ${p.small}`} to={`/pedidos/historial?turno=${shift.id}`}>Pedidos</Link>
                  </div>
                ),
              },
            ]}
            getRowId={shift => String(shift.id)}
            minWidth={900}
            countLabel={visible => `${visible} ${visible === 1 ? "turno" : "turnos"} en esta página`}
            footer={pages > 1 && (
              <div className={p.pager}>
                <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => setPage(prev => prev - 1)}>Anterior</button>
                <span>Página {page} de {pages}</span>
                <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => setPage(prev => prev + 1)}>Siguiente</button>
              </div>
            )}
          />
        </section>
      )}

      {selected && (
        <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Resumen de ${selected.shift.label}`} onClick={() => setSelected(null)}>
          <div className={p.modal} onClick={event => event.stopPropagation()}>
            <header className={p.modalHeader}>
              <h2 className={p.modalTitle}>{selected.shift.label}</h2>
              <button type="button" className={p.btn} onClick={() => setSelected(null)}>Cerrar</button>
            </header>
            <div className={p.modalBody}>
              {selected.shift.closingNotes && <p className={p.notice} style={{ marginBottom: "1rem" }}>Notas del cierre: {selected.shift.closingNotes}</p>}
              <SummaryView summary={selected.summary} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryView({ summary }: { summary: ShiftSummary }) {
  return (
    <div className={p.stack}>
      <div className={p.stats}>
        <Stat label="Vendido" value={formatMoney(summary.totalAmount)} />
        <Stat label="Pedidos" value={String(summary.ordersCount)} />
        <Stat label="Ticket promedio" value={formatMoney(summary.averageTicket)} />
        <Stat label="Sin entregar" value={String(summary.pendingDelivery)} />
        <Stat label="Cancelados" value={String(summary.byStatus.cancelled?.count ?? 0)} />
        <Stat label="Preparación promedio" value={summary.averagePrepMinutes === null ? "—" : `${summary.averagePrepMinutes} min`} />
      </div>

      <div className={p.summaryGrid}>
        <MiniTable
          title="Productos más pedidos"
          rows={summary.topProducts.map(row => ({ label: `${row.title}${row.option ? ` · ${row.option}` : ""}`, count: row.quantity, amount: row.amount }))}
          head={["Producto", "Cant.", "Total"]}
        />
        <MiniTable
          title="Por mozo"
          rows={summary.byWaiter.map(row => ({ label: row.name, count: row.count, amount: row.amount }))}
          head={["Mozo", "Pedidos", "Total"]}
        />
        <MiniTable
          title="Por origen"
          rows={summary.bySource.map(row => ({ label: SOURCE_LABEL[row.source], count: row.count, amount: row.amount }))}
          head={["Origen", "Pedidos", "Total"]}
        />
        <MiniTable
          title="Por mesa"
          rows={summary.byTable.map(row => ({ label: `Mesa ${row.tableNumber}`, count: row.count, amount: row.amount }))}
          head={["Mesa", "Pedidos", "Total"]}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={p.stat}>
      <div className={p.statLabel}>{label}</div>
      <div className={p.statValue}>{value}</div>
    </div>
  );
}

// Fila de las tablas del resumen: una etiqueta, una cantidad y un monto.
interface SummaryRow {
  label: string;
  count: number;
  amount: number;
}

// Tablas chicas del resumen: están completas (no paginan), así que se pueden
// ordenar. Sin barra de herramientas: no tienen filtros ni anchos ajustables.
function MiniTable({ title, head, rows }: { title: string; head: [string, string, string]; rows: SummaryRow[] }) {
  const columns: DataTableColumn<SummaryRow>[] = [
    { id: "label", header: head[0], resizable: false, sortValue: row => row.label, render: row => row.label },
    { id: "count", header: head[1], align: "right", resizable: false, initialDirection: "desc", sortValue: row => row.count, render: row => row.count },
    { id: "amount", header: head[2], align: "right", resizable: false, initialDirection: "desc", sortValue: row => row.amount, render: row => formatMoney(row.amount) },
  ];
  return (
    <section className={p.card}>
      <h3 className={p.cardTitle}>{title}</h3>
      <DataTable<SummaryRow>
        caption={title}
        rows={rows}
        columns={columns}
        getRowId={row => row.label}
        emptyMessage="Sin datos todavía."
      />
    </section>
  );
}
