import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { addCashMovement, closeCash, exportCashSession, updateCash } from "../../api/ordersApi";
import { useContextMenu } from "../../../contextMenu/hooks/useContextMenu";
import { cashCloseFileName, downloadBlob } from "../../lib/download";
import { printCashClose } from "../../lib/print/cashClose";
import { buildOpenCashMenu } from "./cashMenu";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney } from "../../lib/format";
import { cashierPayload, parseAmount, type CashierValue } from "../../lib/cash";
import { uuid } from "../../lib/storage";
import type { CashMovementType, CashMovementTypeOption, CashSession } from "../../types";
import CashLedgerTable from "./CashLedgerTable";
import { CashierField, CashSummaryView, MiniTable } from "./CashParts";
import p from "./panel.module.css";

// ── Caja abierta ─────────────────────────────

type Panel = "movement" | "ledger" | "close" | null;

const OPEN_CASH_MENU = buildOpenCashMenu();

export default function CashSessionCard({ session, cashiers, movementTypes, onChanged, onError }: {
  session: CashSession;
  cashiers: { id: number; name: string }[];
  movementTypes: CashMovementTypeOption[];
  onChanged: (message: string | null) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState(false);
  const [cashier, setCashier] = useState<CashierValue>({ id: session.cashierId, name: session.cashierName ?? "" });
  const [opening, setOpening] = useState(String(session.openingAmount || ""));
  const [busy, setBusy] = useState(false);
  // El libro vuelve a consultar cuando se carga un movimiento desde el formulario.
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const summary = session.summary;
  const openCashMenu = useContextMenu(OPEN_CASH_MENU);
  const startEditing = () => {
    setCashier({ id: session.cashierId, name: session.cashierName ?? "" });
    setOpening(String(session.openingAmount || ""));
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    onError(null);
    try {
      await updateCash(session.id, { ...cashierPayload(cashier), openingAmount: parseAmount(opening) ?? 0 });
      setEditing(false);
      setLedgerVersion(v => v + 1);
      await onChanged(null);
    } catch (err) {
      onError(errorMessage(err, "No se pudo guardar la caja."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (next: Exclude<Panel, null>) => setPanel(current => (current === next ? null : next));
  const nonCashRows = (summary?.paymentsBreakdown ?? []).map(row => ({ label: row.method, count: row.count, amount: row.amount }));

  return (
    <div
      className={p.stack}
      style={{ padding: "1rem", borderRadius: 24, background: "var(--tone-high)" }}
      onContextMenu={event => openCashMenu(event, {
        session,
        actions: {
          editCashier: startEditing,
          showPanel: setPanel,
          exportExcel: async () => downloadBlob(await exportCashSession(session.id), cashCloseFileName(session.registerName, session.openedAt)),
          print: () => printCashClose(session),
        },
      })}
    >
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
            onClick={startEditing}
          >
            <Pencil size={14} aria-hidden /> Cajero y fondo
          </button>
        )}
      </div>

      {editing && (
        <div className={p.row}>
          <CashierField cashiers={cashiers} value={cashier} onChange={setCashier} />
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

      {summary && <CashSummaryView summary={summary} openingAmount={session.openingAmount} />}

      <div className={p.headerActions}>
        <button type="button" className={panel === "movement" ? p.btnPrimary : p.btn} aria-expanded={panel === "movement"} onClick={() => toggle("movement")}>
          Ingreso, egreso o retiro
        </button>
        <button type="button" className={panel === "ledger" ? p.btnPrimary : p.btn} aria-expanded={panel === "ledger"} onClick={() => toggle("ledger")}>
          Ver movimientos
        </button>
        <button type="button" className={panel === "close" ? p.btnPrimary : p.btn} aria-expanded={panel === "close"} onClick={() => toggle("close")}>
          Cerrar caja
        </button>
      </div>

      {panel === "movement" && (
        <MovementForm
          sessionId={session.id}
          movementTypes={movementTypes}
          onSaved={async message => {
            setLedgerVersion(v => v + 1);
            await onChanged(message);
          }}
          onError={onError}
        />
      )}

      {panel === "ledger" && (
        <>
          {nonCashRows.length > 0 && <MiniTable title="Cobros anotados por medio" head={["Medio", "Cobros", "Total"]} rows={nonCashRows} />}
          <CashLedgerTable sessionId={session.id} version={ledgerVersion} onChanged={() => { void onChanged(null); }} onError={onError} />
        </>
      )}

      {panel === "close" && <CloseForm session={session} onClosed={onChanged} onError={onError} />}
    </div>
  );
}

// ── Movimiento ───────────────────────────────

function MovementForm({ sessionId, movementTypes, onSaved, onError }: {
  sessionId: number;
  movementTypes: CashMovementTypeOption[];
  onSaved: (message: string) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [type, setType] = useState<CashMovementType>("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  // Mismo id mientras se reintenta el mismo movimiento: no se carga dos veces.
  const request = useRef<string | null>(null);
  const current = movementTypes.find(option => option.key === type) ?? movementTypes[0];
  const categories = current?.categories ?? [];
  const selectedCategory = categories.some(option => option.key === category) ? category : categories[0]?.key ?? "other";
  const value = parseAmount(amount);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current || value === null || !(value > 0)) return;
    setBusy(true);
    onError(null);
    request.current ??= uuid();
    try {
      await addCashMovement(sessionId, {
        type: current.key, category: selectedCategory, amount: value, notes: notes.trim() || undefined, idempotencyKey: request.current,
      });
      request.current = null;
      setAmount("");
      setNotes("");
      await onSaved(`${current.label} de ${formatMoney(value)} registrado.`);
    } catch (err) {
      onError(errorMessage(err, "No se pudo registrar el movimiento."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={p.stack} onSubmit={submit} style={{ gap: "0.75rem" }}>
      <div className={p.segmented} role="tablist" aria-label="Tipo de movimiento">
        {movementTypes.map(option => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={option.key === type}
            className={`${p.segment} ${option.key === type ? p.segmentActive : ""}`}
            onClick={() => { setType(option.key); request.current = null; }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className={p.row}>
        <label className={p.field}>
          <span className={p.label}>Concepto</span>
          <select className={p.select} value={selectedCategory} onChange={e => { setCategory(e.target.value); request.current = null; }}>
            {categories.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label className={p.field}>
          <span className={p.label}>Importe</span>
          <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" required value={amount} onChange={e => { setAmount(e.target.value); request.current = null; }} />
        </label>
        <label className={p.field} style={{ flex: "2 1 240px" }}>
          <span className={p.label}>Detalle (opcional)</span>
          <input className={p.input} value={notes} maxLength={200} onChange={e => setNotes(e.target.value)} placeholder="Ej: verdulería, adelanto a Juan…" />
        </label>
        <div className={p.headerActions}>
          <button type="submit" className={p.btnPrimary} disabled={busy || value === null || !(value > 0)}>
            {busy ? "Guardando…" : `Registrar ${current?.label.toLowerCase() ?? ""}`}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Cierre con arqueo ────────────────────────

function CloseForm({ session, onClosed, onError }: {
  session: CashSession;
  onClosed: (message: string | null) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [cash, setCash] = useState("");
  const [withdrawn, setWithdrawn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const summary = session.summary;
  const counted = parseAmount(cash);
  const taken = parseAmount(withdrawn) ?? 0;
  const validCount = counted !== null && Number.isFinite(counted) && counted >= 0;
  const validWithdrawal = validCount && taken >= 0 && taken <= counted;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validCount || !validWithdrawal) return;
    setBusy(true);
    onError(null);
    try {
      const closed = await closeCash(session.id, { cashCounted: counted, cashWithdrawn: taken, notes: notes.trim() || undefined });
      const parts = [
        `${closed.registerName} cerrada: ${formatMoney(closed.summary?.netAmount ?? 0)} netos en ${closed.summary?.salesCount ?? 0} pedido(s)`,
        `diferencia ${formatMoney(closed.difference ?? 0)}`,
        `quedan ${formatMoney(closed.cashLeft ?? 0)} en la caja`,
      ];
      await onClosed(`${parts.join(" · ")}.`);
    } catch (err) {
      onError(errorMessage(err, "No se pudo cerrar la caja."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={p.stack} onSubmit={submit} style={{ gap: "0.75rem" }}>
      {summary && summary.pendingCount > 0 && (
        <p className={p.notice}>
          Hay {summary.pendingCount} pedido(s) en curso: quedan en este cierre. Si después se anula alguno, se descuenta en la caja que esté abierta.
        </p>
      )}
      <div className={p.row}>
        <label className={p.field}>
          <span className={p.label}>Efectivo contado</span>
          <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" required value={cash} onChange={e => setCash(e.target.value)} />
        </label>
        <label className={p.field}>
          <span className={p.label}>Retiro al cerrar (opcional)</span>
          <input className={p.input} type="number" min={0} step="0.01" inputMode="decimal" value={withdrawn} onChange={e => setWithdrawn(e.target.value)} />
        </label>
        <label className={p.field} style={{ flex: "2 1 240px" }}>
          <span className={p.label}>Notas del cierre (opcional)</span>
          <input className={p.input} value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} placeholder="Ej: faltante por vuelto…" />
        </label>
      </div>
      {summary && validCount && (
        <p className={validWithdrawal ? p.notice : p.error}>
          {validWithdrawal
            ? `Esperado: ${formatMoney(summary.expectedCash)} · Contado: ${formatMoney(counted)} · Diferencia: ${formatMoney(counted - summary.expectedCash)} · Queda en la caja para la próxima apertura: ${formatMoney(counted - taken)}`
            : "No se puede retirar más de lo que hay en la caja."}
        </p>
      )}
      <div className={p.headerActions}>
        <button type="submit" className={p.btnPrimary} disabled={busy || !validWithdrawal}>{busy ? "Cerrando…" : "Cerrar caja"}</button>
      </div>
    </form>
  );
}
