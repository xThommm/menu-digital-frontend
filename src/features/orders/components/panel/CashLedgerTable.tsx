import { useEffect, useState } from "react";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { useDialogs } from "../../../../context/useDialogs";
import { getCashLedger, voidCashMovement } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { formatDateTime, formatMoney } from "../../lib/format";
import type { CashLedger, CashLedgerEntry, CashLedgerType } from "../../types";
import { Pager } from "./CashParts";
import p from "./panel.module.css";

// Libro de una caja: la apertura, los cobros anotados, las devoluciones, los
// ingresos, egresos y retiros, y el cierre. El servidor arma cada línea,
// filtra, pagina y suma: acá solo se muestra.

const TYPE_OPTIONS: { value: CashLedgerType; label: string }[] = [
  { value: "payment", label: "Cobros" },
  { value: "income", label: "Ingresos" },
  { value: "expense", label: "Egresos" },
  { value: "withdrawal", label: "Retiros" },
  { value: "return", label: "Devoluciones" },
  { value: "fund_adjustment", label: "Cambios de fondo" },
];

const SIGN = { in: "+ ", out: "− ", none: "" } as const;

export default function CashLedgerTable({ sessionId, version = 0, onChanged, onError }: {
  sessionId: number;
  // Cambia cuando la caja cambió por otro lado (un movimiento nuevo): vuelve a consultar.
  version?: number;
  // Se anuló un movimiento: la pantalla refresca el resultado de la caja.
  onChanged?: () => void;
  onError: (message: string | null) => void;
}) {
  const dialogs = useDialogs();
  const [type, setType] = useState<CashLedgerType | "">("");
  const [cashOnly, setCashOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CashLedger | null>(null);
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCashLedger(sessionId, { type: type || undefined, cashOnly, page })
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) onError(errorMessage(err, "No se pudieron cargar los movimientos.")); });
    return () => { cancelled = true; };
  }, [sessionId, type, cashOnly, page, version, localVersion, onError]);

  const voidEntry = async (entry: CashLedgerEntry) => {
    if (entry.movementId === null) return;
    if (!(await dialogs.confirm({
      title: `¿Anular "${entry.label}" por ${formatMoney(entry.amount)}?`,
      message: "Queda en el libro como anulado.",
      confirmLabel: "Anular",
      danger: true,
    }))) return;
    onError(null);
    try {
      await voidCashMovement(entry.movementId);
      setLocalVersion(v => v + 1);
      onChanged?.();
    } catch (err) {
      onError(errorMessage(err, "No se pudo anular el movimiento."));
    }
  };

  const columns: DataTableColumn<CashLedgerEntry>[] = [
    { id: "at", header: "Fecha", width: "150px", render: entry => formatDateTime(entry.at) },
    {
      id: "label", header: "Movimiento", width: "220px",
      render: entry => (
        <span style={entry.voided ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{entry.label}</span>
      ),
    },
    {
      id: "detail", header: "Detalle",
      render: entry => (entry.voided
        ? `Anulado${entry.voidReason ? `: ${entry.voidReason}` : ""}`
        : [entry.detail, entry.cash ? null : "No pasa por la caja"].filter(Boolean).join(" · ") || "—"),
    },
    { id: "actor", header: "Quién", width: "120px", render: entry => entry.actorName ?? "—" },
    {
      id: "amount", header: "Importe", width: "130px", align: "right",
      render: entry => (
        <span style={entry.voided ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
          {SIGN[entry.direction]}{formatMoney(entry.amount)}
        </span>
      ),
    },
    {
      id: "actions", header: "", headerLabel: "Acciones", width: "100px", resizable: false,
      render: entry => entry.movementId !== null && (
        <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => voidEntry(entry)}>Anular</button>
      ),
    },
  ];

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const resetPage = () => setPage(1);

  return (
    <DataTable<CashLedgerEntry>
      caption="Movimientos de la caja"
      rows={data?.entries ?? []}
      columns={columns}
      getRowId={entry => entry.key}
      minWidth={860}
      loading={!data}
      emptyMessage="No hay movimientos con ese filtro."
      filters={(
        <>
          <label>
            Tipo
            <select value={type} onChange={event => { setType(event.target.value as CashLedgerType | ""); resetPage(); }}>
              <option value="">Todos</option>
              {TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={cashOnly} onChange={event => { setCashOnly(event.target.checked); resetPage(); }} />
            {" "}Solo efectivo
          </label>
        </>
      )}
      activeFilterCount={(type ? 1 : 0) + (cashOnly ? 1 : 0)}
      onClearFilters={() => { setType(""); setCashOnly(false); resetPage(); }}
      countLabel={() => (data
        ? `${data.total} ${data.total === 1 ? "movimiento" : "movimientos"} · Entró ${formatMoney(data.totals.in)} · Salió ${formatMoney(data.totals.out)}`
        : "")}
      footer={<Pager page={page} pages={pages} onPage={setPage} />}
    />
  );
}
