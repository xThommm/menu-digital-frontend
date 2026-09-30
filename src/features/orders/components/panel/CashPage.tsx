import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import {
  closeCash, closeShift, createCashRegister, getCashSession, getShiftSummary, listCashRegisters, listClosedCash,
  listOpenCash, listShifts, openCash, openShift, updateCash,
} from "../../api/ordersApi";
import { errorCode, errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney, SERVICE_LABEL, SOURCE_LABEL } from "../../lib/format";
import type { CashRegister, CashSession, CashSummary, Shift, ShiftSummary } from "../../types";
import p from "./panel.module.css";

// Caja y turnos, por separado:
// - Turno: período de trabajo (resumen de ventas y operación). Se abre solo
//   con el primer pedido y se cierra a mano, sin tocar la caja.
// - Caja: el dinero. Cada caja se abre con su cajero y su fondo, y al
//   cerrarla se congela su resultado (ventas, anulaciones, devoluciones,
//   efectivo, diferencia). Se puede cerrar una caja y abrir otra con otro
//   cajero sin cerrar el turno, o tener más de una caja abierta.

const toNumber = (value: string) => (value === "" ? null : Number(value));

export default function CashPage() {
  const [shiftData, setShiftData] = useState<{ shift: Shift | null; summary: ShiftSummary | null } | null>(null);
  const [openSessions, setOpenSessions] = useState<CashSession[] | null>(null);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<"cash" | "shifts">("cash");
  const [historyVersion, setHistoryVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const [shift, cash, regs] = await Promise.all([getShiftSummary("current"), listOpenCash(), listCashRegisters()]);
      setShiftData(shift);
      setOpenSessions(cash);
      setRegisters(regs);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar la caja."));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const afterChange = async (message: string | null) => {
    setNotice(message);
    await load();
    setHistoryVersion(v => v + 1);
  };

  const loaded = shiftData !== null && openSessions !== null;
  const openRegisterIds = new Set((openSessions ?? []).map(session => session.registerId));
  const closedRegisters = registers.filter(register => register.active && !openRegisterIds.has(register.id));

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
                Cada pedido queda en la caja abierta al cargarlo. Si no hay ninguna, se abre sola la principal (después podés poner el cajero y el fondo).
              </p>
            </div>
            {openSessions.length === 0 && <p className={p.notice}>No hay ninguna caja abierta.</p>}
            {openSessions.map(session => (
              <OpenCashCard
                key={session.id}
                session={session}
                onChanged={afterChange}
                onError={setError}
              />
            ))}
            {closedRegisters.length > 0 && (
              <OpenCashForm registers={closedRegisters} onOpened={afterChange} onError={setError} />
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

// ── Caja abierta ─────────────────────────────

function OpenCashCard({ session, onChanged, onError }: {
  session: CashSession;
  onChanged: (message: string | null) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cashier, setCashier] = useState(session.cashierName ?? "");
  const [opening, setOpening] = useState(String(session.openingAmount || ""));
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const summary = session.summary;
  const counted = toNumber(cash);

  const saveEdit = async () => {
    setBusy(true);
    onError(null);
    try {
      await updateCash(session.id, { cashierName: cashier.trim(), openingAmount: toNumber(opening) });
      setEditing(false);
      await onChanged(null);
    } catch (err) {
      onError(errorMessage(err, "No se pudo guardar la caja."));
    } finally {
      setBusy(false);
    }
  };

  const close = async (event: React.FormEvent) => {
    event.preventDefault();
    if (summary && summary.pendingCount > 0
      && !window.confirm(`Hay ${summary.pendingCount} pedido(s) de esta caja sin entregar. ¿Cerrar la caja igual?`)) return;
    setBusy(true);
    onError(null);
    try {
      const closed = await closeCash(session.id, { cashCounted: counted, notes: notes.trim() || undefined });
      const s = closed.summary;
      await onChanged(
        `${closed.registerName} cerrada: ${formatMoney(s?.netAmount ?? 0)} netos en ${s?.salesCount ?? 0} pedido(s)` +
        (closed.difference === null ? "." : ` · diferencia ${formatMoney(closed.difference)}.`)
      );
    } catch (err) {
      onError(errorMessage(err, "No se pudo cerrar la caja."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={p.stack} style={{ padding: "1rem", borderRadius: 24, background: "var(--tone-high)" }}>
      <div className={p.header} style={{ margin: 0 }}>
        <div className={p.titleBlock}>
          <span className={p.switchTitle}>{session.registerName}</span>
          <span className={p.switchHint}>
            Abierta el {formatDateTime(session.openedAt)} · Cajero: {session.cashierName ?? "sin indicar"} · Fondo inicial: {formatMoney(session.openingAmount)}
          </span>
        </div>
        {!editing && (
          <button
            type="button"
            className={`${p.btnGhost} ${p.small}`}
            onClick={() => {
              setCashier(session.cashierName ?? "");
              setOpening(String(session.openingAmount || ""));
              setEditing(true);
            }}
          >
            <Pencil size={14} aria-hidden /> Cajero y fondo
          </button>
        )}
      </div>

      {editing && (
        <div className={p.row}>
          <label className={p.field}>
            <span className={p.label}>Cajero</span>
            <input className={p.input} value={cashier} maxLength={60} onChange={e => setCashier(e.target.value)} placeholder="Nombre de quien está en la caja" />
          </label>
          <label className={p.field}>
            <span className={p.label}>Fondo inicial</span>
            <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} />
          </label>
          <div className={p.headerActions}>
            <button type="button" className={`${p.btnPrimary} ${p.small}`} disabled={busy} onClick={saveEdit}>Guardar</button>
            <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {summary && <CashSummaryView summary={summary} />}

      <form className={p.stack} onSubmit={close}>
        <div className={p.row}>
          <label className={p.field}>
            <span className={p.label}>Efectivo contado (opcional)</span>
            <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" value={cash} onChange={e => setCash(e.target.value)} />
          </label>
          <label className={p.field} style={{ flex: "2 1 240px" }}>
            <span className={p.label}>Notas del cierre (opcional)</span>
            <input className={p.input} value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} placeholder="Ej: faltante por vuelto, pago con transferencia…" />
          </label>
        </div>
        {summary && counted !== null && Number.isFinite(counted) && (
          <p className={p.notice}>
            Esperado en caja: {formatMoney(summary.expectedCash)} · Contado: {formatMoney(counted)} ·
            Diferencia: {formatMoney(counted - summary.expectedCash)}
            {summary.paymentsBreakdown.length === 0 && " (sin cobros registrados, se espera todo lo vendido neto más el fondo)"}
          </p>
        )}
        <div className={p.headerActions}>
          <button type="submit" className={p.btnPrimary} disabled={busy}>{busy ? "Cerrando…" : "Cerrar caja"}</button>
        </div>
      </form>
    </div>
  );
}

function OpenCashForm({ registers, onOpened, onError }: {
  registers: CashRegister[];
  onOpened: (message: string | null) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [registerId, setRegisterId] = useState(String(registers[0]?.id ?? ""));
  const [cashier, setCashier] = useState("");
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = registers.some(register => String(register.id) === registerId) ? registerId : String(registers[0]?.id ?? "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const session = await openCash({
        registerId: Number(selected),
        cashierName: cashier.trim() || undefined,
        openingAmount: toNumber(opening),
      });
      setCashier("");
      setOpening("");
      await onOpened(`${session.registerName} abierta.`);
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
            <select className={p.select} value={selected} onChange={e => setRegisterId(e.target.value)}>
              {registers.map(register => <option key={register.id} value={register.id}>{register.name}</option>)}
            </select>
          </label>
        )}
        <label className={p.field}>
          <span className={p.label}>Cajero (opcional)</span>
          <input className={p.input} value={cashier} maxLength={60} onChange={e => setCashier(e.target.value)} />
        </label>
        <label className={p.field}>
          <span className={p.label}>Fondo inicial (opcional)</span>
          <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} />
        </label>
        <div className={p.headerActions}>
          <button type="submit" className={p.btn} disabled={busy || !selected}>
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

function CashSummaryView({ summary }: { summary: CashSummary }) {
  return (
    <div className={p.stats}>
      <Stat label="Vendido" value={formatMoney(summary.salesAmount)} hint={`${summary.salesCount} pedido(s)`} />
      <Stat label="Devoluciones" value={formatMoney(summary.returnedAmount)} hint={`${summary.returnedCount} pedido(s)`} />
      <Stat label="Neto" value={formatMoney(summary.netAmount)} />
      <Stat label="Anulaciones" value={formatMoney(summary.cancelledAmount)} hint={`${summary.cancelledCount} pedido(s)`} />
      <Stat label="Descuentos" value={formatMoney(summary.discountsAmount)} />
      <Stat label="Esperado en caja" value={formatMoney(summary.expectedCash)} />
    </div>
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

// ── Historial ────────────────────────────────

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className={p.pager}>
      <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span>Página {page} de {pages}</span>
      <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
    </div>
  );
}

function ClosedCashTable({ version, onError }: { version: number; onError: (message: string | null) => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ sessions: CashSession[]; total: number; pageSize: number } | null>(null);
  const [selected, setSelected] = useState<CashSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    listClosedCash(page)
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) onError(errorMessage(err, "No se pudieron cargar las cajas cerradas.")); });
    return () => { cancelled = true; };
  }, [page, version, onError]);

  const show = async (session: CashSession) => {
    try {
      setSelected(await getCashSession(session.id));
    } catch (err) {
      onError(errorMessage(err, "No se pudo cargar la caja."));
    }
  };

  const columns: DataTableColumn<CashSession>[] = [
    { id: "register", header: "Caja", width: "140px", render: s => s.registerName },
    { id: "cashier", header: "Cajero", width: "130px", render: s => s.cashierName ?? "—" },
    { id: "opened", header: "Apertura", width: "160px", render: s => formatDateTime(s.openedAt) },
    { id: "closed", header: "Cierre", width: "160px", render: s => (s.closedAt ? formatDateTime(s.closedAt) : "—") },
    { id: "net", header: "Neto", width: "120px", align: "right", render: s => formatMoney(s.summary?.netAmount ?? 0) },
    { id: "cash", header: "Contado", width: "120px", align: "right", render: s => (s.cashCounted === null ? "—" : formatMoney(s.cashCounted)) },
    { id: "diff", header: "Diferencia", width: "120px", align: "right", render: s => (s.difference === null ? "—" : formatMoney(s.difference)) },
    {
      id: "actions", header: "", headerLabel: "Acciones", width: "120px", resizable: false,
      render: s => <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => show(s)}>Detalle</button>,
    },
  ];

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      {/* Viene paginado del servidor: sin orden por columna (ver OrdersHistory). */}
      <DataTable<CashSession>
        caption="Cajas cerradas"
        rows={data?.sessions ?? []}
        columns={columns}
        getRowId={s => String(s.id)}
        minWidth={1000}
        loading={!data}
        emptyMessage="Todavía no se cerró ninguna caja."
        footer={<Pager page={page} pages={pages} onPage={setPage} />}
      />
      {selected && (
        <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Cierre de ${selected.registerName}`} onClick={() => setSelected(null)}>
          <div className={p.modal} onClick={event => event.stopPropagation()}>
            <header className={p.modalHeader}>
              <h2 className={p.modalTitle}>{selected.registerName}</h2>
              <button type="button" className={p.btn} onClick={() => setSelected(null)}>Cerrar</button>
            </header>
            <div className={`${p.modalBody} ${p.stack}`}>
              <p className={p.switchHint}>
                {formatDateTime(selected.openedAt)} → {selected.closedAt ? formatDateTime(selected.closedAt) : "abierta"} ·
                Cajero: {selected.cashierName ?? "sin indicar"} · Fondo inicial: {formatMoney(selected.openingAmount)}
              </p>
              {selected.summary && <CashSummaryView summary={selected.summary} />}
              <div className={p.stats}>
                <Stat label="Pedidos (todos)" value={String(selected.summary?.ordersCount ?? 0)} />
                <Stat label="Efectivo contado" value={selected.cashCounted === null ? "—" : formatMoney(selected.cashCounted)} />
                <Stat label="Diferencia" value={selected.difference === null ? "—" : formatMoney(selected.difference)} />
              </div>
              {(selected.summary?.paymentsBreakdown.length ?? 0) > 0 && (
                <MiniTable
                  title="Medios de pago"
                  head={["Medio", "Cobros", "Total"]}
                  rows={selected.summary!.paymentsBreakdown.map(row => ({ label: row.method, count: row.count, amount: row.amount }))}
                />
              )}
              {selected.closingNotes && <p className={p.notice}>Notas del cierre: {selected.closingNotes}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

// ── Piezas del resumen ───────────────────────

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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={p.stat}>
      <div className={p.statLabel}>{label}</div>
      <div className={p.statValue}>{value}</div>
      {hint && <div className={p.statLabel} style={{ marginTop: "0.25rem" }}>{hint}</div>}
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
