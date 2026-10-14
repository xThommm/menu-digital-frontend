import { useEffect, useState } from "react";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { useContextMenu } from "../../../contextMenu/hooks/useContextMenu";
import { exportCashSession } from "../../api/ordersApi";
import { cashCloseFileName, downloadBlob } from "../../lib/download";
import { printCashClose } from "../../lib/print/cashClose";
import { buildClosedCashMenu } from "./cashMenu";

const CLOSED_CASH_MENU = buildClosedCashMenu();
import { listClosedCash } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney } from "../../lib/format";
import type { CashCloseResult, CashSession, ClosedCashResponse } from "../../types";
import CashLedgerTable from "./CashLedgerTable";
import { CashSummaryView, MiniTable, Pager, Stat } from "./CashParts";
import p from "./panel.module.css";

// Cajas cerradas. Los filtros, la página y los totales (de todo lo filtrado,
// no solo de la página) los resuelve el servidor.

const RESULTS: { value: CashCloseResult; label: string }[] = [
  { value: "exact", label: "Cerró justo" },
  { value: "short", label: "Faltó" },
  { value: "over", label: "Sobró" },
  { value: "uncounted", label: "Sin contar" },
];

export default function ClosedCashTable({ version, onError }: { version: number; onError: (message: string | null) => void }) {
  const [page, setPage] = useState(1);
  const [register, setRegister] = useState("");
  const [cashier, setCashier] = useState("");
  const [result, setResult] = useState<CashCloseResult | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ClosedCashResponse | null>(null);
  const [selected, setSelected] = useState<CashSession | null>(null);
  const openRowMenu = useContextMenu(CLOSED_CASH_MENU, { highlightTarget: true });

  useEffect(() => {
    let cancelled = false;
    listClosedCash({
      page,
      register: register ? Number(register) : undefined,
      cashier: cashier || undefined,
      result: result || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then(response => { if (!cancelled) setData(response); })
      .catch(err => { if (!cancelled) onError(errorMessage(err, "No se pudieron cargar las cajas cerradas.")); });
    return () => { cancelled = true; };
  }, [page, register, cashier, result, from, to, version, onError]);

  // Cambiar un filtro vuelve a la primera página.
  const filter = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(1); };
  const activeFilters = [register, cashier, result, from, to].filter(Boolean).length;
  const clear = () => { setRegister(""); setCashier(""); setResult(""); setFrom(""); setTo(""); setPage(1); };

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
      render: s => <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setSelected(s)}>Detalle</button>,
    },
  ];

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const totals = data?.totals;

  return (
    <div className={p.stack}>
      {totals && data.total > 0 && (
        <div className={p.stats}>
          <Stat label="Cierres" value={String(data.total)} hint={`${totals.exactCount} justo(s)`} />
          <Stat label="Neto vendido" value={formatMoney(totals.netAmount)} />
          <Stat label="Diferencia acumulada" value={formatMoney(totals.difference)} />
          <Stat label="Faltantes" value={formatMoney(totals.shortAmount)} hint={`${totals.shortCount} cierre(s)`} />
          <Stat label="Sobrantes" value={formatMoney(totals.overAmount)} hint={`${totals.overCount} cierre(s)`} />
          <Stat label="Egresos" value={formatMoney(totals.expenseAmount)} />
        </div>
      )}

      <DataTable<CashSession>
        caption="Cajas cerradas"
        rows={data?.sessions ?? []}
        columns={columns}
        getRowId={s => String(s.id)}
        onRowContextMenu={(event, row) => openRowMenu(event, {
          session: row,
          actions: {
            showDetail: () => setSelected(row),
            exportExcel: async () => downloadBlob(await exportCashSession(row.id), cashCloseFileName(row.registerName, row.closedAt ?? row.openedAt)),
            print: () => printCashClose(row),
          },
        })}
        minWidth={1000}
        loading={!data}
        emptyMessage={activeFilters > 0 ? "Ningún cierre cumple ese filtro." : "Todavía no se cerró ninguna caja."}
        filters={(
          <>
            {(data?.filters.registers.length ?? 0) > 1 && (
              <label>
                Caja
                <select value={register} onChange={event => filter(setRegister)(event.target.value)}>
                  <option value="">Todas</option>
                  {data!.filters.registers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </label>
            )}
            {(data?.filters.cashiers.length ?? 0) > 0 && (
              <label>
                Cajero
                <select value={cashier} onChange={event => filter(setCashier)(event.target.value)}>
                  <option value="">Todos</option>
                  {data!.filters.cashiers.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            )}
            <label>
              Resultado
              <select value={result} onChange={event => filter(setResult)(event.target.value as CashCloseResult | "")}>
                <option value="">Todos</option>
                {RESULTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Desde
              <input type="date" value={from} max={to || undefined} onChange={event => filter(setFrom)(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={to} min={from || undefined} onChange={event => filter(setTo)(event.target.value)} />
            </label>
          </>
        )}
        activeFilterCount={activeFilters}
        onClearFilters={clear}
        countLabel={() => (data ? `${data.total} ${data.total === 1 ? "cierre" : "cierres"}` : "")}
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
                Cajero: {selected.cashierName ?? "sin indicar"}
                {selected.closedByName ? ` · Cerró: ${selected.closedByName}` : ""}
              </p>
              {selected.summary && <CashSummaryView summary={selected.summary} openingAmount={selected.openingAmount} />}
              <div className={p.stats}>
                <Stat label="Efectivo contado" value={selected.cashCounted === null ? "—" : formatMoney(selected.cashCounted)} />
                <Stat label="Diferencia" value={selected.difference === null ? "—" : formatMoney(selected.difference)} />
                {selected.cashWithdrawn !== null && <Stat label="Retirado al cerrar" value={formatMoney(selected.cashWithdrawn)} />}
                {selected.cashLeft !== null && <Stat label="Quedó en la caja" value={formatMoney(selected.cashLeft)} />}
              </div>
              {(selected.summary?.paymentsBreakdown.length ?? 0) > 0 && (
                <MiniTable
                  title="Cobros anotados por medio"
                  head={["Medio", "Cobros", "Total"]}
                  rows={selected.summary!.paymentsBreakdown.map(row => ({ label: row.method, count: row.count, amount: row.amount }))}
                />
              )}
              {selected.closingNotes && <p className={p.notice}>Notas del cierre: {selected.closingNotes}</p>}
              <CashLedgerTable sessionId={selected.id} onError={onError} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
