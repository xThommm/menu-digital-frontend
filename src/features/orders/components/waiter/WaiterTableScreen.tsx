import { useCallback, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { getWaiterTables, sendWaiterOrder, waiterBillApi, waiterGroupApi } from "../../api/publicOrdersApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorMessage } from "../../lib/errors";
import { durationLabel, formatMoney, placeLabel } from "../../lib/format";
import { addPicked, emptyDraft, repeatCandidates, type PickedProduct, type TableDraft } from "../../lib/quickPick";
import { emptyService, toServiceInput } from "../../lib/service";
import { uuid } from "../../lib/storage";
import { lineKey, toOrderLines, unitsCount, unitsTotal, type UnitLine } from "../../lib/units";
import type { GroupSession, OccupiedTable, TableSession } from "../../types";
import type { PublicMenuPayload } from "../../../../types";
import GroupPanel from "../shared/GroupPanel";
import QuickPicker from "../shared/QuickPicker";
import { FloorSheet } from "../shared/TableFloor";
import UnitLinesEditor from "../shared/UnitLinesEditor";
import WaiterTableCard from "./WaiterTableCard";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// Pantalla de una mesa en el tomador del operador. "Cargar": la carta como
// botones grandes (y "Otra vuelta" con lo que ya pidió la mesa); lo cargado
// queda en una barra abajo para revisarlo o mandarlo con un toque. "Cuenta":
// lo consumido, comensales, dividir y cobrar, pedido grupal y cierre.
// Lo cargado y sin enviar vive en el dispositivo por mesa (TableDraft, lo
// guarda WaiterApp): se puede salir al salón y volver sin perderlo.

const POLL_MS = 15_000;

type Tab = "load" | "bill";

interface Props {
  slug: string;
  token: string;
  tableNumber: number;
  menu: PublicMenuPayload | null;
  menuError: string | null;
  draft: TableDraft;
  onDraftChange: (draft: TableDraft) => void;
  onAuthError: (err: unknown) => boolean;
  // Pedido enviado o mesa cerrada: vuelve al salón con este aviso.
  onDone: (message: string) => void;
  // Para el encabezado de la cuenta impresa.
  businessName?: string | null;
}

export default function WaiterTableScreen({ slug, token, tableNumber, menu, menuError, draft, onDraftChange, onAuthError, onDone, businessName = null }: Props) {
  const [session, setSession] = useState<TableSession | null>(null);
  const [occupiedBy, setOccupiedBy] = useState<OccupiedTable | null>(null);
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("load");
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Mismo contenido = mismo id de envío: un doble toque o un reintento no duplica el pedido.
  const request = useRef<{ key: string; id: string } | null>(null);
  const billApi = useMemo(() => waiterBillApi(token), [token]);
  const groupApi = useMemo(() => waiterGroupApi(token), [token]);
  const hidePrices = menu?.user.menuDisplay?.hidePrices === true;

  const load = useCallback(async () => {
    try {
      const [result, groups] = await Promise.all([
        getWaiterTables(token),
        groupApi.list().catch(() => [] as GroupSession[]),
      ]);
      setSession(result.sessions.find(s2 => s2.tableNumber === tableNumber) ?? null);
      setOccupiedBy((result.occupied ?? []).find(table => table.tableNumber === tableNumber) ?? null);
      setGroup(groups.find(g => g.tableNumber === tableNumber) ?? null);
      setNow(Date.now());
      setLoaded(true);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudo cargar la mesa."));
    }
  }, [token, tableNumber, groupApi, onAuthError]);

  useLiveRefresh({ hello: { type: "auth", role: "waiter", token }, refresh: load, offlineMs: POLL_MS });

  const { lines, notes } = draft;
  const counts = useMemo(() => new Map(lines.map(line => [lineKey(line.itemId, line.option), line.quantity])), [lines]);
  const repeat = useMemo(
    () => (menu && session?.orders ? repeatCandidates(session.orders, menu.menu, hidePrices) : []),
    [menu, session, hidePrices]
  );

  const add = (product: PickedProduct) => onDraftChange({ ...draft, lines: addPicked(lines, product) });
  const setLines = (next: UnitLine[]) => {
    onDraftChange({ ...draft, lines: next });
    if (next.length === 0) setReviewing(false);
  };

  const send = async () => {
    if (lines.length === 0) return;
    const payload = {
      ...toServiceInput({ ...emptyService("table"), table: String(tableNumber) }),
      items: toOrderLines(lines),
      notes: notes.trim() || undefined,
    };
    const key = JSON.stringify(payload);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    setSending(true);
    setError(null);
    try {
      const { order } = await sendWaiterOrder(token, { ...payload, clientRequestId: request.current.id });
      request.current = null;
      onDraftChange(emptyDraft());
      onDone(`Pedido #${order.number} enviado · ${order.tableNumber ? placeLabel(order) : `Mesa ${tableNumber}`}.`);
    } catch (err) {
      if (!onAuthError(err)) setError(errorMessage(err, "No se pudo enviar el pedido. Probá de nuevo."));
    } finally {
      setSending(false);
    }
  };

  const count = unitsCount(lines);
  const total = session?.totalAmount ?? 0;

  return (
    <section className={`${p.stack} ${s.tableScreen}`} aria-label={`Mesa ${tableNumber}`}>
      <div className={s.tableSummary}>
        {!loaded ? (
          <span className={p.tableMeta}>Cargando…</span>
        ) : session ? (
          <>
            <span className={p.tableMeta}>
              {session.waiterName ?? "Sin operador"} · {durationLabel(session.openedAt, null, now)}
              {session.guests !== null && ` · ${session.guests} comensales`}
              {session.activeOrders > 0 && ` · ${session.activeOrders} sin entregar`}
            </span>
            {!hidePrices && <span className={p.tableTotal}>{formatMoney(total)}</span>}
          </>
        ) : occupiedBy ? (
          <span className={p.tableMeta}>La atiende {occupiedBy.waiterName ?? "otro operador"}: lo que cargues se suma a su mesa.</span>
        ) : (
          <span className={p.tableMeta}>Mesa libre: se abre con el primer pedido.</span>
        )}
      </div>

      <div className={p.segmented} role="tablist" aria-label="Qué hacer en la mesa">
        <button type="button" role="tab" aria-selected={tab === "load"} className={`${p.segment} ${tab === "load" ? p.segmentActive : ""}`} onClick={() => setTab("load")}>
          Cargar{count > 0 && ` · ${count}`}
        </button>
        <button type="button" role="tab" aria-selected={tab === "bill"} className={`${p.segment} ${tab === "bill" ? p.segmentActive : ""}`} onClick={() => setTab("bill")}>
          Cuenta{session && !hidePrices && ` · ${formatMoney(total)}`}
        </button>
      </div>

      {error && <p className={p.error} role="alert">{error}</p>}
      {notice && <p className={p.success} role="status">{notice}</p>}

      {tab === "load" && (
        <>
          {menuError && <p className={p.error}>{menuError}</p>}
          {!menu && !menuError && <p className={p.loading}>Cargando carta…</p>}
          {menu && <QuickPicker menu={menu.menu} hidePrices={hidePrices} counts={counts} repeat={repeat} onPick={add} />}
        </>
      )}

      {tab === "bill" && (
        session ? (
          <WaiterTableCard
            key={session.id}
            session={session}
            group={group}
            now={now}
            slug={slug}
            token={token}
            billApi={billApi}
            groupApi={groupApi}
            onAuthError={onAuthError}
            onNewOrder={() => setTab("load")}
            onClosed={closed => onDone(`Mesa ${closed.tableNumber} cerrada · ${formatMoney(closed.totalAmount)}.`)}
            onReload={load}
            onNotice={setNotice}
            onUpdated={setSession}
            businessName={businessName}
          />
        ) : (
          <div className={p.stack}>
            <p className={p.switchHint}>Todavía no pidió nada.</p>
            <GroupPanel api={groupApi} slug={slug} tableNumber={tableNumber} group={group} onChanged={load} onAuthError={onAuthError} onNotice={setNotice} />
          </div>
        )
      )}

      {count > 0 && (
        <div className={s.sendBar}>
          <button type="button" className={s.sendReview} onClick={() => setReviewing(true)} aria-label={`Revisar el pedido: ${count} productos`}>
            <span className={s.cartCount}>{count}</span>
            Revisar
          </button>
          <button type="button" className={s.sendBtn} disabled={sending} onClick={send}>
            <Send size={16} aria-hidden />
            {sending ? "Enviando…" : "Enviar"}
            {!hidePrices && <span className={s.cartTotal}>{formatMoney(unitsTotal(lines))}</span>}
          </button>
        </div>
      )}

      {reviewing && (
        <FloorSheet title={`Pedido · Mesa ${tableNumber}`} onClose={() => setReviewing(false)}>
          <UnitLinesEditor lines={lines} onChange={setLines} hidePrices={hidePrices} />
          <label className={p.field}>
            <span className={p.label}>Nota del pedido (opcional)</span>
            <input
              className={p.input}
              value={notes}
              maxLength={200}
              onChange={event => onDraftChange({ ...draft, notes: event.target.value })}
              placeholder="Ej: la bebida primero"
            />
          </label>
          {error && <p className={p.error} role="alert">{error}</p>}
          <button type="button" className={p.btnPrimary} disabled={sending} onClick={send}>
            <Send size={16} aria-hidden /> {sending ? "Enviando…" : `Enviar a mesa ${tableNumber}`}
          </button>
        </FloorSheet>
      )}
    </section>
  );
}
