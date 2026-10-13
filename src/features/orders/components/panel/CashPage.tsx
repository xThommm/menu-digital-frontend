import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import DataTable from "../../../../components/Common/DataTable/DataTable";
import {
  closeShift, createCashRegister, getCashOverview, getShiftSummary, listShifts, openCash, openShift,
} from "../../api/ordersApi";
import { cashierPayload, parseAmount, type CashierValue } from "../../lib/cash";
import { errorCode, errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney, SERVICE_LABEL, SOURCE_LABEL } from "../../lib/format";
import type { CashOverview, CashRegister, Shift, ShiftSummary } from "../../types";
import { CashierField, MiniTable, Pager, Stat } from "./CashParts";
import CashSessionCard from "./CashSessionCard";
import ClosedCashTable from "./ClosedCashTable";
import p from "./panel.module.css";

// Caja y turnos, por separado:
// - Turno: período de trabajo (resumen de ventas y operación). Se abre solo
//   con el primer pedido y se cierra a mano, sin tocar la caja.
// - Caja: el dinero. Cada caja se abre con su cajero y su fondo; mientras está
//   abierta se cargan los ingresos, egresos y retiros, y al cerrarla se hace el
//   arqueo y se congela su resultado. Se puede cerrar una caja y abrir otra con
//   otro cajero sin cerrar el turno, o tener más de una caja abierta.
//
// Los números, los filtros y los totales vienen resueltos del servidor.

export default function CashPage() {
  const [shiftData, setShiftData] = useState<{ shift: Shift | null; summary: ShiftSummary | null } | null>(null);
  const [overview, setOverview] = useState<CashOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<"cash" | "shifts">("cash");
  const [historyVersion, setHistoryVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const [shift, cash] = await Promise.all([getShiftSummary("current"), getCashOverview()]);
      setShiftData(shift);
      setOverview(cash);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar la caja."));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const afterChange = useCallback(async (message: string | null) => {
    setNotice(message);
    await load();
    setHistoryVersion(v => v + 1);
  }, [load]);

  const loaded = shiftData !== null && overview !== null;
  const closedRegisters = (overview?.registers ?? []).filter(register => register.active && register.openSessionId === null);

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Caja y turnos</h1>
          <p className={p.subtitle}>
            El turno y la caja se cierran por separado: podés cambiar de cajero sin cerrar el turno, o cerrar el turno y seguir con la misma caja.
          </p>
        </div>
      </header>

      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}
      {!loaded && !error && <p className={p.loading}>Cargando…</p>}

      {loaded && (
        <div className={p.stack} style={{ marginTop: "1rem" }}>
          <section className={`${p.card} ${p.stack}`} aria-label="Caja">
            <div>
              <h2 className={p.cardTitle}>Caja</h2>
              <p className={p.cardDesc}>
                Cada pedido queda en la caja abierta al cargarlo. Si no hay ninguna, se abre sola la principal con el fondo que quedó del último cierre.
                Lo que no tiene un cobro anotado con otro medio se espera en efectivo.
              </p>
            </div>
            {overview.sessions.length === 0 && <p className={p.notice}>No hay ninguna caja abierta.</p>}
            {overview.sessions.map(session => (
              <CashSessionCard
                key={session.id}
                session={session}
                cashiers={overview.cashiers}
                movementTypes={overview.movementTypes}
                onChanged={afterChange}
                onError={setError}
              />
            ))}
            {closedRegisters.length > 0 && (
              <OpenCashForm registers={closedRegisters} cashiers={overview.cashiers} onOpened={afterChange} onError={setError} />
            )}
            <AddRegister onAdded={() => afterChange(null)} onError={setError} />
          </section>

          <ShiftSection data={shiftData} onChanged={afterChange} onError={setError} />

          <section className={p.card}>
            <div className={p.header} style={{ marginBottom: "0.75rem" }}>
              <h2 className={p.cardTitle} style={{ margin: 0 }}>Historial</h2>
              <div className={p.segmented} role="tablist" aria-label="Historial">
                <button type="button" role="tab" aria-selected={historyTab === "cash"} className={`${p.segment} ${historyTab === "cash" ? p.segmentActive : ""}`} onClick={() => setHistoryTab("cash")}>
                  Cajas cerradas
                </button>
                <button type="button" role="tab" aria-selected={historyTab === "shifts"} className={`${p.segment} ${historyTab === "shifts" ? p.segmentActive : ""}`} onClick={() => setHistoryTab("shifts")}>
                  Turnos cerrados
                </button>
              </div>
            </div>
            {historyTab === "cash"
              ? <ClosedCashTable version={historyVersion} onError={setError} />
              : <ClosedShiftsTable version={historyVersion} onError={setError} />}
          </section>
        </div>
      )}
    </div>
  );
}

// ── Abrir caja ───────────────────────────────

function OpenCashForm({ registers, cashiers, onOpened, onError }: {
  registers: CashRegister[];
  cashiers: { id: number; name: string }[];
  onOpened: (message: string | null) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [registerId, setRegisterId] = useState(String(registers[0]?.id ?? ""));
  const [cashier, setCashier] = useState<CashierValue>({ id: null, name: "" });
  // null: todavía no se tocó, se propone lo que quedó del último cierre de esa caja.
  const [opening, setOpening] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = registers.find(option => String(option.id) === registerId) ?? registers[0];
  const openingValue = opening ?? (register?.suggestedOpening ? String(register.suggestedOpening) : "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!register) return;
    setBusy(true);
    onError(null);
    try {
      const session = await openCash({
        registerId: register.id,
        ...cashierPayload(cashier),
        openingAmount: parseAmount(openingValue) ?? 0,
      });
      setCashier({ id: null, name: "" });
      setOpening(null);
      await onOpened(`${session.registerName} abierta con ${formatMoney(session.openingAmount)} de fondo.`);
    } catch (err) {
      onError(errorMessage(err, "No se pudo abrir la caja."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={p.stack} onSubmit={submit} style={{ gap: "0.75rem" }}>
      <span className={p.switchTitle}>Abrir caja</span>
      <div className={p.row}>
        {registers.length > 1 && (
          <label className={p.field}>
            <span className={p.label}>Caja</span>
            <select className={p.select} value={String(register?.id ?? "")} onChange={e => { setRegisterId(e.target.value); setOpening(null); }}>
              {registers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        )}
        <CashierField cashiers={cashiers} value={cashier} onChange={setCashier} />
        <label className={p.field}>
          <span className={p.label}>
            Fondo inicial{register && register.suggestedOpening > 0 ? ` (quedaron ${formatMoney(register.suggestedOpening)})` : ""}
          </span>
          <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" value={openingValue} onChange={e => setOpening(e.target.value)} />
        </label>
        <div className={p.headerActions}>
          <button type="submit" className={p.btn} disabled={busy || !register}>
            Abrir {registers.length === 1 ? registers[0].name : "caja"}
          </button>
        </div>
      </div>
    </form>
  );
}

function AddRegister({ onAdded, onError }: { onAdded: () => void; onError: (message: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onError(null);
    try {
      await createCashRegister(name.trim());
      setName("");
      setOpen(false);
      onAdded();
    } catch (err) {
      onError(errorMessage(err, "No se pudo agregar la caja."));
    }
  };

  if (!open) {
    return (
      <button type="button" className={`${p.btnGhost} ${p.small}`} style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden /> Agregar otra caja
      </button>
    );
  }
  return (
    <form className={p.row} onSubmit={submit}>
      <label className={p.field}>
        <span className={p.label}>Nombre de la caja</span>
        <input className={p.input} value={name} maxLength={40} autoFocus onChange={e => setName(e.target.value)} placeholder="Ej: Barra, Delivery" />
      </label>
      <div className={p.headerActions}>
        <button type="submit" className={`${p.btnPrimary} ${p.small}`} disabled={!name.trim()}>Agregar</button>
        <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}

// ── Turno ────────────────────────────────────

function ShiftSection({ data, onChanged, onError }: {
  data: { shift: Shift | null; summary: ShiftSummary | null };
  onChanged: (message: string | null) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsForce, setNeedsForce] = useState<string | null>(null);

  const start = async () => {
    onError(null);
    try {
      await openShift();
      await onChanged(null);
    } catch (err) {
      onError(errorMessage(err, "No se pudo abrir el turno."));
    }
  };

  const close = async (force: boolean) => {
    setBusy(true);
    onError(null);
    try {
      const closed = await closeShift({ notes: notes.trim() || undefined, force });
      setNotes("");
      setNeedsForce(null);
      await onChanged(`Turno cerrado: ${closed.label} · ${formatMoney(closed.totalAmount ?? 0)} en ${closed.ordersCount ?? 0} pedido(s).`);
    } catch (err) {
      if (errorCode(err) === "ACTIVE_ORDERS") setNeedsForce(errorMessage(err, "Hay pedidos sin entregar."));
      else onError(errorMessage(err, "No se pudo cerrar el turno."));
    } finally {
      setBusy(false);
    }
  };

  if (!data.shift || !data.summary) {
    return (
      <section className={p.card} aria-label="Turno">
        <h2 className={p.cardTitle}>Turno</h2>
        <p className={p.empty} style={{ padding: "0.5rem 0 1rem" }}>No hay un turno abierto. Se abre solo con el primer pedido.</p>
        <div style={{ textAlign: "center" }}>
          <button type="button" className={p.btnPrimary} onClick={start}>Abrir turno ahora</button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${p.card} ${p.stack}`} aria-label="Turno">
      <div>
        <h2 className={p.cardTitle}>Turno: {data.shift.label}</h2>
        <p className={p.cardDesc}>Abierto el {formatDateTime(data.shift.openedAt)}. Cerrar el turno no cierra la caja.</p>
      </div>
      <SummaryView summary={data.summary} />
      <div className={p.row}>
        <label className={p.field} style={{ flex: "2 1 240px" }}>
          <span className={p.label}>Notas del turno (opcional)</span>
          <input className={p.input} value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} />
        </label>
        {!needsForce && (
          <div className={p.headerActions}>
            <button type="button" className={p.btnPrimary} disabled={busy} onClick={() => close(false)}>
              {busy ? "Cerrando…" : "Cerrar turno"}
            </button>
          </div>
        )}
      </div>
      {needsForce && (
        <div className={p.error}>
          {needsForce} Esos pedidos van a seguir en el panel.
          <div className={p.headerActions} style={{ marginTop: "0.5rem" }}>
            <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={() => close(true)}>Cerrar igual</button>
            <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setNeedsForce(null)}>Volver</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Historial de turnos ──────────────────────

function ClosedShiftsTable({ version, onError }: { version: number; onError: (message: string | null) => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ shifts: Shift[]; total: number; pageSize: number } | null>(null);
  const [selected, setSelected] = useState<{ shift: Shift; summary: ShiftSummary } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listShifts(page)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) onError(errorMessage(err, "No se pudieron cargar los turnos.")); });
    return () => { cancelled = true; };
  }, [page, version, onError]);

  const show = async (shift: Shift) => {
    try {
      const result = await getShiftSummary(shift.id);
      if (result.shift && result.summary) setSelected({ shift: result.shift, summary: result.summary });
    } catch (err) {
      onError(errorMessage(err, "No se pudo cargar el turno."));
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const rows = (data?.shifts ?? []).filter(shift => shift.closedAt);

  return (
    <>
      <DataTable<Shift>
        caption="Turnos cerrados"
        rows={rows}
        columns={[
          { id: "label", header: "Turno", width: "170px", render: shift => shift.label },
          { id: "opened", header: "Apertura", width: "170px", render: shift => formatDateTime(shift.openedAt) },
          { id: "closed", header: "Cierre", width: "170px", render: shift => (shift.closedAt ? formatDateTime(shift.closedAt) : "—") },
          { id: "orders", header: "Pedidos", width: "100px", align: "right", render: shift => shift.ordersCount ?? 0 },
          { id: "total", header: "Vendido", width: "120px", align: "right", render: shift => formatMoney(shift.totalAmount ?? 0) },
          {
            id: "actions",
            header: "",
            headerLabel: "Acciones",
            width: "200px",
            resizable: false,
            render: shift => (
              <div className={p.headerActions}>
                <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => show(shift)}>Resumen</button>
                <Link className={`${p.btnGhost} ${p.small}`} to={`/pedidos/historial?turno=${shift.id}`}>Pedidos</Link>
              </div>
            ),
          },
        ]}
        getRowId={shift => String(shift.id)}
        minWidth={900}
        loading={!data}
        emptyMessage="Todavía no se cerró ningún turno."
        countLabel={visible => `${visible} ${visible === 1 ? "turno" : "turnos"} en esta página`}
        footer={<Pager page={page} pages={pages} onPage={setPage} />}
      />
      {selected && (
        <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Resumen de ${selected.shift.label}`} onClick={() => setSelected(null)}>
          <div className={p.modal} onClick={event => event.stopPropagation()}>
            <header className={p.modalHeader}>
              <h2 className={p.modalTitle}>{selected.shift.label}</h2>
              <button type="button" className={p.btn} onClick={() => setSelected(null)}>Cerrar</button>
            </header>
            <div className={p.modalBody}>
              {selected.shift.closingNotes && <p className={p.notice} style={{ marginBottom: "1rem" }}>Notas del cierre: {selected.shift.closingNotes}</p>}
              {selected.shift.cashCounted !== null && (
                <p className={p.notice} style={{ marginBottom: "1rem" }}>
                  Efectivo contado al cerrar (turno anterior a la separación de caja): {formatMoney(selected.shift.cashCounted)}
                </p>
              )}
              <SummaryView summary={selected.summary} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Resumen del turno ────────────────────────

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
          title="Por operador"
          rows={summary.byWaiter.map(row => ({ label: row.name, count: row.count, amount: row.amount }))}
          head={["Operador", "Pedidos", "Total"]}
        />
        <MiniTable
          title="Por tipo de pedido"
          rows={(summary.byServiceType ?? []).map(row => ({ label: SERVICE_LABEL[row.serviceType], count: row.count, amount: row.amount }))}
          head={["Tipo", "Pedidos", "Total"]}
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
