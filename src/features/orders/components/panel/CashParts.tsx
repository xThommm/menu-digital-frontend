import { useState } from "react";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { formatMoney } from "../../lib/format";
import type { CashierValue } from "../../lib/cash";
import type { CashSummary } from "../../types";
import p from "./panel.module.css";

// Piezas que comparten la caja, el turno y sus historiales.

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={p.stat}>
      <div className={p.statLabel}>{label}</div>
      <div className={p.statValue}>{value}</div>
      {hint && <div className={p.statLabel} style={{ marginTop: "0.25rem" }}>{hint}</div>}
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className={p.pager}>
      <button type="button" className={`${p.btn} ${p.small}`} disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span>Página {page} de {pages}</span>
      <button type="button" className={`${p.btn} ${p.small}`} disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
    </div>
  );
}

// Fila de las tablas del resumen: una etiqueta, una cantidad y un monto.
export interface SummaryRow {
  label: string;
  count: number;
  amount: number;
}

// Tablas chicas del resumen: están completas (no paginan), así que se pueden
// ordenar. Sin barra de herramientas: no tienen filtros ni anchos ajustables.
export function MiniTable({ title, head, rows }: { title: string; head: [string, string, string]; rows: SummaryRow[] }) {
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

// Resultado de una caja: las ventas por un lado y el efectivo del cajón por
// otro. Todas las cifras vienen calculadas del servidor.
export function CashSummaryView({ summary, openingAmount }: { summary: CashSummary; openingAmount: number }) {
  return (
    <div className={p.stack} style={{ gap: "0.75rem" }}>
      <div className={p.stats}>
        <Stat label="Vendido" value={formatMoney(summary.salesAmount)} hint={`${summary.salesCount} pedido(s)`} />
        <Stat label="Devoluciones" value={formatMoney(summary.returnedAmount)} hint={`${summary.returnedCount} pedido(s)`} />
        <Stat label="Neto" value={formatMoney(summary.netAmount)} />
        <Stat label="Anulaciones" value={formatMoney(summary.cancelledAmount)} hint={`${summary.cancelledCount} pedido(s)`} />
        {summary.discountsAmount > 0 && <Stat label="Descuentos" value={formatMoney(summary.discountsAmount)} />}
        {summary.onlineAmount !== 0 && <Stat label="Cobrado online" value={formatMoney(summary.onlineAmount)} hint="No pasa por la caja" />}
      </div>
      <div className={p.stats}>
        <Stat label="Fondo inicial" value={formatMoney(openingAmount)} />
        <Stat label="Ventas en efectivo" value={formatMoney(summary.cashSalesAmount)} hint="Lo que no se cobró con otro medio" />
        <Stat label="Ingresos" value={formatMoney(summary.incomeAmount)} />
        <Stat label="Egresos" value={formatMoney(summary.expenseAmount)} />
        <Stat label="Retiros" value={formatMoney(summary.withdrawalAmount)} />
        <Stat label="Esperado en caja" value={formatMoney(summary.expectedCash)} />
      </div>
    </div>
  );
}

// ── Cajero ───────────────────────────────────
// Un operador del local (así los reportes por cajero no dependen de cómo se
// tipeó el nombre) o, si no es un operador, un nombre a mano.

const OTHER = "other";

export function CashierField({ cashiers, value, onChange }: {
  cashiers: { id: number; name: string }[];
  value: CashierValue;
  onChange: (value: CashierValue) => void;
}) {
  const [manual, setManual] = useState(value.id === null && value.name !== "");
  const selected = value.id !== null ? String(value.id) : manual ? OTHER : "";

  if (cashiers.length === 0) {
    return (
      <label className={p.field}>
        <span className={p.label}>Cajero (opcional)</span>
        <input className={p.input} value={value.name} maxLength={60} onChange={e => onChange({ id: null, name: e.target.value })} placeholder="Nombre de quien está en la caja" />
      </label>
    );
  }
  return (
    <>
      <label className={p.field}>
        <span className={p.label}>Cajero (opcional)</span>
        <select
          className={p.select}
          value={selected}
          onChange={e => {
            const next = e.target.value;
            setManual(next === OTHER);
            const cashier = cashiers.find(option => String(option.id) === next);
            onChange(cashier ? { id: cashier.id, name: cashier.name } : { id: null, name: "" });
          }}
        >
          <option value="">Sin indicar</option>
          {cashiers.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          <option value={OTHER}>Otra persona…</option>
        </select>
      </label>
      {manual && (
        <label className={p.field}>
          <span className={p.label}>Nombre</span>
          <input className={p.input} value={value.name} maxLength={60} autoFocus onChange={e => onChange({ id: null, name: e.target.value })} />
        </label>
      )}
    </>
  );
}
