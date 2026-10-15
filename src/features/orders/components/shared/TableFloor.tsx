import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { durationLabel, formatMoney } from "../../lib/format";
import { buildFloor, filterFloor, isMine, type FloorFilter, type FloorTable } from "../../lib/floor";
import type { GroupSession, OccupiedTable, TableSession } from "../../types";
import p from "../panel/panel.module.css";
import s from "./TableFloor.module.css";

// Salón: todas las mesas del local (de la 1 a la cantidad configurada) en una
// grilla, cada una con su estado de un vistazo. La usan la app del operador y
// la página Mesas del panel; qué pasa al tocar una mesa lo decide quien la usa.

interface Props {
  tableCount: number;
  sessions: TableSession[];
  occupied?: OccupiedTable[];
  groups: GroupSession[];
  now: number;
  // Operador que mira el salón (en el panel no hay): suma el filtro "Mías".
  waiterId?: number;
  hidePrices?: boolean;
  onSelect: (table: FloorTable) => void;
}

export default function TableFloor({ tableCount, sessions, occupied = [], groups, now, waiterId, hidePrices = false, onSelect }: Props) {
  const [filter, setFilter] = useState<FloorFilter>("all");
  const tables = buildFloor(tableCount, sessions, occupied, groups);
  const busy = tables.filter(table => table.kind !== "free").length;
  const mine = tables.filter(table => isMine(table, waiterId)).length;

  const visible = filterFloor(tables, filter, waiterId);

  const filters: { id: FloorFilter; label: string }[] = [
    { id: "all", label: `Todas · ${tables.length}` },
    ...(waiterId !== undefined ? [{ id: "mine" as const, label: `Mías · ${mine}` }] : []),
    { id: "busy", label: `Ocupadas · ${busy}` },
    { id: "free", label: `Libres · ${tables.length - busy}` },
  ];

  if (tables.length === 0) {
    return <p className={p.empty}>El local no tiene mesas configuradas. Se cargan en Pedidos → Configuración.</p>;
  }

  return (
    <div className={s.floor}>
      <div className={`${p.segmented} ${s.filters}`} role="radiogroup" aria-label="Qué mesas mostrar">
        {filters.map(option => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={filter === option.id}
            className={`${p.segment} ${filter === option.id ? p.segmentActive : ""}`}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={p.empty}>{filter === "mine" ? "No tenés mesas abiertas." : filter === "free" ? "No hay mesas libres." : "No hay mesas ocupadas."}</p>
      ) : (
        <ul className={s.grid} aria-label="Mesas del salón">
          {visible.map(table => (
            <li key={table.tableNumber}>
              <TableTile table={table} now={now} mine={isMine(table, waiterId)} hidePrices={hidePrices} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TableTile({ table, now, mine, hidePrices, onSelect }: {
  table: FloorTable;
  now: number;
  mine: boolean;
  hidePrices: boolean;
  onSelect: (table: FloorTable) => void;
}) {
  let state: string;
  let status: string;
  let detail: React.ReactNode = null;
  let label: string;

  if (table.kind === "free") {
    state = s.free;
    status = table.group ? "Pedido grupal" : "Libre";
    label = `Mesa ${table.tableNumber}, ${status.toLowerCase()}`;
  } else if (table.kind === "other") {
    state = s.other;
    status = table.occupied.waiterName ?? "Otro operador";
    detail = <span className={s.meta}>{durationLabel(table.occupied.openedAt, null, now)}</span>;
    label = `Mesa ${table.tableNumber}, la atiende ${status}`;
  } else {
    const { session } = table;
    const paid = session.paidAmount ?? 0;
    const paidShare = session.totalAmount > 0 ? Math.min(1, paid / session.totalAmount) : 0;
    state = session.waiterId === null ? s.unassigned : mine ? s.mine : s.open;
    status = session.waiterName ?? "Sin operador";
    label = `Mesa ${table.tableNumber}, ${status}${hidePrices ? "" : `, ${formatMoney(session.totalAmount)}`}`
      + (session.activeOrders > 0 ? `, ${session.activeOrders} sin entregar` : "");
    detail = (
      <>
        {!hidePrices && <span className={s.total}>{formatMoney(session.totalAmount)}</span>}
        <span className={s.meta}>
          {durationLabel(session.openedAt, null, now)}
          {session.guests !== null && (
            <span className={s.guests}><Users size={12} aria-hidden />{session.guests}</span>
          )}
        </span>
        {session.activeOrders > 0 && <span className={s.pending}>{session.activeOrders} sin entregar</span>}
        {paid > 0 && (
          <span className={s.paidBar} title={`Cobrado ${formatMoney(paid)}`}>
            <span style={{ width: `${Math.round(paidShare * 100)}%` }} />
          </span>
        )}
      </>
    );
  }

  return (
    <button type="button" className={`${s.tile} ${state}`} aria-label={label} onClick={() => onSelect(table)}>
      <span className={s.number}>{table.tableNumber}</span>
      <span className={s.status}>{status}</span>
      {detail}
    </button>
  );
}

// Hoja con el detalle de la mesa tocada (hoja inferior en el celular, diálogo desde tablet).
export function FloorSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={p.modal} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>{title}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={`${p.modalBody} ${p.stack}`}>{children}</div>
      </div>
    </div>
  );
}
