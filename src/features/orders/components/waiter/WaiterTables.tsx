import { useCallback, useMemo, useState } from "react";
import { getWaiterTables, waiterGroupApi } from "../../api/publicOrdersApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorMessage } from "../../lib/errors";
import type { FloorTable } from "../../lib/floor";
import type { GroupSession, OccupiedTable, TableSession } from "../../types";
import { OpenGroupForm } from "../shared/GroupPanel";
import TableFloor from "../shared/TableFloor";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// Salón del operador: todas las mesas del local con su estado. Al tocar una
// libre, una suya o una sin operador se abre la pantalla de esa mesa (cargar
// productos y su cuenta); las de otros operadores se ven ocupadas, sin su
// cuenta, y al tocarlas avisa quién las atiende.

const POLL_MS = 15_000;

interface Props {
  token: string;
  waiterId: number;
  tableCount: number;
  hidePrices?: boolean;
  // Unidades cargadas y sin enviar, por mesa.
  drafts: Map<number, number>;
  notice?: string | null;
  onAuthError: (err: unknown) => boolean;
  onOpenTable: (tableNumber: number) => void;
  onCountChange: (count: number) => void;
}

export default function WaiterTables({ token, waiterId, tableCount, hidePrices = false, drafts, notice: initialNotice = null, onAuthError, onOpenTable, onCountChange }: Props) {
  const [sessions, setSessions] = useState<TableSession[] | null>(null);
  const [occupied, setOccupied] = useState<OccupiedTable[]>([]);
  const [groups, setGroups] = useState<GroupSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [now, setNow] = useState(() => Date.now());
  const groupApi = useMemo(() => waiterGroupApi(token), [token]);

  const load = useCallback(async () => {
    try {
      const [result, openGroups] = await Promise.all([
        getWaiterTables(token),
        // Con un backend anterior no hay pedidos grupales: las mesas se ven igual.
        groupApi.list().catch(() => [] as GroupSession[]),
      ]);
      setSessions(result.sessions);
      setOccupied(result.occupied ?? []);
      setGroups(openGroups);
      onCountChange(result.sessions.filter(session => session.waiterId === waiterId).length);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudieron cargar las mesas."));
    }
  }, [token, waiterId, onAuthError, onCountChange, groupApi]);

  // Las mesas se actualizan con los avisos del servidor; sin conexión en vivo, cada POLL_MS.
  useLiveRefresh({ hello: { type: "auth", role: "waiter", token }, refresh: load, offlineMs: POLL_MS });

  if (sessions === null && !error) return <p className={p.loading}>Cargando…</p>;

  const select = (table: FloorTable) => {
    if (table.kind === "other") {
      setNotice(`La mesa ${table.tableNumber} la atiende ${table.occupied.waiterName ?? "otro operador"}.`);
      return;
    }
    onOpenTable(table.tableNumber);
  };

  return (
    <section className={p.stack}>
      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}

      <TableFloor
        tableCount={tableCount}
        sessions={sessions ?? []}
        occupied={occupied}
        groups={groups}
        now={now}
        waiterId={waiterId}
        hidePrices={hidePrices}
        drafts={drafts}
        onSelect={select}
      />
      <p className={p.switchHint}>Tocá una mesa para cargarle productos o ver su cuenta.</p>

      <h2 className={s.sectionTitle}>Pedido grupal</h2>
      <p className={p.switchHint} style={{ marginTop: "-0.5rem" }}>
        Los comensales de una mesa arman el pedido entre todos, cada uno desde su celular. Abrilo acá para una mesa que todavía no pidió nada.
      </p>
      <OpenGroupForm api={groupApi} onOpened={load} onAuthError={onAuthError} />
    </section>
  );
}
