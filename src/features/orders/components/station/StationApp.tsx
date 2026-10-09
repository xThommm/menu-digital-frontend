import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, BellOff, Check, ChefHat, Flame, KeyRound, LogOut, Maximize, MessageSquareText, Printer, RotateCcw, Usb,
} from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import {
  getOwnerSectorTickets, listSectors, markOwnerTicketPrinted, updateOwnerTicketStatus,
} from "../../api/ordersApi";
import {
  getStationSession, getStationTickets, logoutStation, markStationTicketPrinted, pairStation, updateStationTicketStatus,
} from "../../api/publicOrdersApi";
import { ownerHello, useLiveRefresh } from "../../hooks/useLiveRefresh";
import type { SocketHello } from "../../hooks/useOrdersSocket";
import { beep } from "../../lib/beep";
import { errorMessage, errorStatus } from "../../lib/errors";
import { elapsedLabel, formatTime, minutesSince, placeLabel } from "../../lib/format";
import { chooseEscposPrinter, escposSupported, hasEscposPrinter, printTicket } from "../../lib/print/printers";
import { ticketLayout } from "../../lib/print/ticketLayout";
import {
  clearStationSession, readStationPrefs, readStationSession, saveStationPrefs, saveStationSession, type StationPrefs,
} from "../../lib/stationSession";
import type { Sector, SectorTicketsResponse, Ticket, TicketStatus } from "../../types";
import p from "../panel/panel.module.css";
import s from "./Station.module.css";

// Pantalla de comandas de un sector (cocina, barra, postres…), pensada para
// una PC o tablet fija en el sector. Muestra solo lo que le toca preparar a
// ese sector, avisa con sonido cuando llega algo y (si el sector imprime)
// manda cada comanda nueva a la impresora.
//
// Dos formas de entrar:
// - Equipo vinculado: se tipea el código que genera el dueño en Sectores
//   (sirve en una PC, sin QR). El equipo guarda un token, no la sesión del
//   dueño.
// - El dueño con su sesión abierta: /comandas?sector=<id>, o elige el sector.

const POLL_MS = 4_000;
// A partir de estos minutos la comanda se marca como demorada.
const LATE_MINUTES = 15;

interface StationApi {
  load: (signal?: AbortSignal) => Promise<SectorTicketsResponse>;
  setStatus: (ticketId: number, status: TicketStatus) => Promise<Ticket>;
  markPrinted: (ticketId: number) => Promise<Ticket>;
  logout?: () => Promise<void>;
  // Con qué se identifica esta pantalla en el WebSocket de pedidos.
  hello: SocketHello | null;
}

type Phase =
  | { kind: "loading" }
  | { kind: "pair"; message: string | null }
  | { kind: "pick" }
  | { kind: "ready"; api: StationApi; sectorName: string; businessName: string | null; owner: boolean };

const readSectorParam = () => {
  const value = Number(new URLSearchParams(window.location.search).get("sector"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

const deviceApi = (token: string): StationApi => ({
  load: signal => getStationTickets(token, signal),
  setStatus: async (id, status) => (await updateStationTicketStatus(token, id, status)).ticket,
  markPrinted: async id => (await markStationTicketPrinted(token, id)).ticket,
  logout: () => logoutStation(token),
  hello: { type: "auth", role: "station", token },
});

const ownerApi = (sectorId: number): StationApi => ({
  load: () => getOwnerSectorTickets(sectorId),
  setStatus: (id, status) => updateOwnerTicketStatus(sectorId, id, status),
  markPrinted: id => markOwnerTicketPrinted(sectorId, id),
  hello: ownerHello(),
});

export default function StationApp() {
  const { token: ownerToken, isLoading: authLoading } = useAuth();
  const [sectorParam] = useState(readSectorParam);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const unpair = useCallback((message: string | null) => {
    clearStationSession();
    setPhase({ kind: "pair", message });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    const start = async () => {
      // El dueño eligió un sector desde el panel: su sesión alcanza.
      if (ownerToken && sectorParam) {
        setPhase({ kind: "ready", api: ownerApi(sectorParam), sectorName: "", businessName: null, owner: true });
        return;
      }
      const stored = readStationSession();
      if (stored) {
        try {
          const info = await getStationSession(stored.token, controller.signal);
          saveStationSession({ token: stored.token, sectorName: info.sector.name });
          setPhase({ kind: "ready", api: deviceApi(stored.token), sectorName: info.sector.name, businessName: info.business.name, owner: false });
        } catch (err) {
          if (controller.signal.aborted) return;
          const status = errorStatus(err);
          if (status === 401 || status === 403) unpair(errorMessage(err, "Este equipo ya no está vinculado."));
          else setPhase({ kind: "pair", message: errorMessage(err, "No pudimos conectarnos. Revisá la conexión y recargá.") });
        }
        return;
      }
      setPhase(ownerToken ? { kind: "pick" } : { kind: "pair", message: null });
    };
    start();
    return () => controller.abort();
  }, [authLoading, ownerToken, sectorParam, unpair]);

  if (phase.kind === "loading") return <Shell><p className={p.loading}>Cargando…</p></Shell>;

  if (phase.kind === "pair") {
    return (
      <PairScreen
        message={phase.message}
        onPaired={(token, info) => {
          saveStationSession({ token, sectorName: info.sector.name });
          setPhase({ kind: "ready", api: deviceApi(token), sectorName: info.sector.name, businessName: info.business.name, owner: false });
        }}
      />
    );
  }

  if (phase.kind === "pick") {
    return (
      <SectorPicker
        onPick={sector => setPhase({ kind: "ready", api: ownerApi(sector.id), sectorName: sector.name, businessName: null, owner: true })}
        onPair={() => setPhase({ kind: "pair", message: null })}
      />
    );
  }

  return (
    <StationBoard
      key={phase.sectorName}
      api={phase.api}
      initialSectorName={phase.sectorName}
      businessName={phase.businessName}
      owner={phase.owner}
      onUnpaired={unpair}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className={`${p.page} ${s.shell}`}>{children}</div>;
}

// ── Vincular el equipo ───────────────────────

function PairScreen({ message, onPaired }: {
  message: string | null;
  onPaired: (token: string, info: { sector: Sector; business: { name: string } }) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(message);
  const [sending, setSending] = useState(false);

  // Se muestra como ABCD-EFGH mientras se tipea.
  const onChange = (value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    setCode(clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const paired = await pairStation(code);
      onPaired(paired.token, paired);
    } catch (err) {
      setError(errorMessage(err, "No se pudo vincular el equipo."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Shell>
      <form className={s.pairCard} onSubmit={submit}>
        <span className={s.pairIcon}><KeyRound size={30} aria-hidden /></span>
        <h1 className={p.title}>Pantalla de comandas</h1>
        <p className={p.subtitle}>
          Pedile el código al encargado: se genera en el panel, en <strong>Gestión de pedidos › Sectores</strong>,
          con el botón “Vincular equipo”. Este equipo va a mostrar las comandas de ese sector.
        </p>
        <label className={p.field}>
          <span className="sr-only">Código de vinculación</span>
          <input
            className={`${p.input} ${s.codeInput}`}
            value={code}
            onChange={event => onChange(event.target.value)}
            placeholder="ABCD-2345"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            aria-label="Código de vinculación"
          />
        </label>
        {error && <p className={p.error} role="alert">{error}</p>}
        <button type="submit" className={p.btnPrimary} disabled={sending || code.replace("-", "").length !== 8}>
          {sending ? "Vinculando…" : "Vincular equipo"}
        </button>
        <p className={p.cardDesc}>
          ¿Sos el dueño? <Link to="/login">Entrá con tu cuenta</Link> y abrí la pantalla de cualquier sector sin código.
        </p>
      </form>
    </Shell>
  );
}

// El dueño con sesión abierta y sin sector elegido.
function SectorPicker({ onPick, onPair }: { onPick: (sector: Sector) => void; onPair: () => void }) {
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSectors()
      .then(data => { if (!cancelled) setSectors(data.sectors); })
      .catch(err => { if (!cancelled) setError(errorMessage(err, "No se pudieron cargar los sectores.")); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Shell>
      <div className={s.pairCard}>
        <span className={s.pairIcon}><ChefHat size={30} aria-hidden /></span>
        <h1 className={p.title}>¿Qué sector es este equipo?</h1>
        {error && <p className={p.error}>{error}</p>}
        {!sectors && !error && <p className={p.loading}>Cargando…</p>}
        {sectors?.length === 0 && (
          <p className={p.subtitle}>
            Todavía no creaste sectores. Crealos en <Link to="/pedidos/sectores">Gestión de pedidos › Sectores</Link>.
          </p>
        )}
        <div className={s.pickList}>
          {sectors?.map(sector => (
            <button key={sector.id} type="button" className={s.pickBtn} onClick={() => onPick(sector)}>
              {sector.name}
            </button>
          ))}
        </div>
        <p className={p.cardDesc}>
          Con tu sesión, esta pantalla usa tu cuenta. Para un equipo que queda fijo en el sector,
          mejor <button type="button" className={s.linkBtn} onClick={onPair}>vincularlo con un código</button>.
        </p>
      </div>
    </Shell>
  );
}

// ── Tablero del sector ───────────────────────

function StationBoard({ api, initialSectorName, businessName, owner, onUnpaired }: {
  api: StationApi;
  initialSectorName: string;
  businessName: string | null;
  owner: boolean;
  onUnpaired: (message: string | null) => void;
}) {
  const [data, setData] = useState<SectorTicketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [freshIds, setFreshIds] = useState<Set<number>>(() => new Set());
  const [prefs, setPrefs] = useState<StationPrefs>(readStationPrefs);
  const [printerReady, setPrinterReady] = useState<boolean | null>(null);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const known = useRef<Map<number, TicketStatus> | null>(null);
  // Comandas que este equipo ya mandó a imprimir (evita duplicar entre
  // consultas mientras el aviso de "impresa" viaja al servidor).
  const printed = useRef<Set<string>>(new Set());
  const printQueue = useRef<Promise<void>>(Promise.resolve());
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const sector = data?.sector ?? null;
  const printMode = sector?.printMode ?? "none";

  const doPrint = useCallback(async (ticket: Ticket, currentSector: Sector, { manual = false } = {}) => {
    const key = `${ticket.id}:${ticket.status === "cancelled" ? "x" : ticket.printCount}`;
    if (!manual && printed.current.has(key)) return;
    printed.current.add(key);
    try {
      // De a una: varias comandas juntas no se pisan en la impresora.
      const job = printQueue.current.then(() => printTicket(currentSector.printMode, ticketLayout(ticket), {
        paperWidth: currentSector.paperWidth,
        copies: currentSector.printCopies,
      }));
      printQueue.current = job.catch(() => {});
      await job;
      // Una anulación impresa no cuenta como impresión de la comanda.
      if (ticket.status !== "cancelled") await api.markPrinted(ticket.id);
    } catch (err) {
      printed.current.delete(key);
      setActionError(errorMessage(err, "No se pudo imprimir la comanda."));
    }
  }, [api]);

  const refresh = useCallback(async () => {
    try {
      const next = await api.load();
      const previous = known.current;
      const all = [...next.tickets, ...next.recent];
      if (previous) {
        const arrived = next.tickets.filter(ticket => !previous.has(ticket.id) || previous.get(ticket.id) === "cancelled");
        const cancelled = next.recent.filter(ticket => ticket.status === "cancelled" && previous.has(ticket.id) && previous.get(ticket.id) !== "cancelled");
        if (arrived.length > 0) setFreshIds(prev => new Set([...prev, ...arrived.map(ticket => ticket.id)]));
        if ((arrived.length > 0 || cancelled.length > 0) && prefsRef.current.sound) beep();
        // Si ya estaba impresa, la cocina tiene el papel: se imprime la anulación.
        if (prefsRef.current.autoPrint && next.sector.printMode !== "none") {
          cancelled.filter(ticket => ticket.printCount > 0).forEach(ticket => { void doPrint(ticket, next.sector); });
        }
      }
      if (prefsRef.current.autoPrint && next.sector.printMode !== "none") {
        // Solo las que nadie imprimió todavía: con dos equipos en el sector imprime el primero.
        next.tickets.filter(ticket => ticket.printedAt === null).forEach(ticket => { void doPrint(ticket, next.sector); });
      }
      known.current = new Map(all.map(ticket => [ticket.id, ticket.status]));
      setData(next);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      const status = errorStatus(err);
      if (!owner && (status === 401 || status === 403)) {
        onUnpaired(errorMessage(err, "Este equipo ya no está vinculado."));
        return;
      }
      setError(errorMessage(err, "No se pudieron actualizar las comandas. Reintentando…"));
    }
  }, [api, doPrint, owner, onUnpaired]);

  // Las comandas llegan con el aviso del servidor (también con la pestaña en segundo
  // plano, así suena e imprime igual). Sin conexión en vivo se consulta cada POLL_MS.
  useLiveRefresh({ hello: api.hello, refresh, offlineMs: POLL_MS });

  useEffect(() => {
    if (freshIds.size === 0) return;
    const timer = setTimeout(() => setFreshIds(new Set()), 20_000);
    return () => clearTimeout(timer);
  }, [freshIds]);

  useEffect(() => {
    if (printMode !== "escpos") return;
    let cancelled = false;
    hasEscposPrinter().then(ready => { if (!cancelled) setPrinterReady(ready); }).catch(() => {});
    return () => { cancelled = true; };
  }, [printMode]);

  const sectorName = sector?.name ?? initialSectorName;
  const newCount = data?.tickets.filter(ticket => ticket.status === "new").length ?? 0;
  useEffect(() => {
    const previous = document.title;
    document.title = newCount > 0 ? `(${newCount}) ${sectorName} · Comandas` : `${sectorName || "Comandas"} · Comandas`;
    return () => { document.title = previous; };
  }, [newCount, sectorName]);

  const updatePrefs = (patch: Partial<StationPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      saveStationPrefs(next);
      return next;
    });
  };

  const changeStatus = async (ticket: Ticket, status: TicketStatus) => {
    setBusyId(ticket.id);
    setActionError(null);
    try {
      const updated = await api.setStatus(ticket.id, status);
      setData(prev => prev && {
        ...prev,
        tickets: updated.status === "done"
          ? prev.tickets.filter(item => item.id !== updated.id)
          : prev.tickets.some(item => item.id === updated.id)
            ? prev.tickets.map(item => (item.id === updated.id ? updated : item))
            : [...prev.tickets, updated].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        recent: updated.status === "done"
          ? [updated, ...prev.recent.filter(item => item.id !== updated.id)]
          : prev.recent.filter(item => item.id !== updated.id),
      });
      known.current?.set(updated.id, updated.status);
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo actualizar la comanda."));
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const connectPrinter = async () => {
    setActionError(null);
    try {
      await chooseEscposPrinter();
      setPrinterReady(await hasEscposPrinter());
    } catch (err) {
      // Cerrar el selector sin elegir no es un error.
      if (err instanceof Error && err.name === "NotFoundError") return;
      setActionError(errorMessage(err, "No se pudo conectar la comandera."));
    }
  };

  const unpairDevice = async () => {
    try {
      await api.logout?.();
    } catch {
      // Aunque falle, este equipo deja de estar vinculado.
    }
    onUnpaired(null);
  };

  const columns = useMemo(() => [
    { status: "new" as const, title: "Nuevas", empty: "No hay comandas nuevas." },
    { status: "preparing" as const, title: "En preparación", empty: "Nada en preparación." },
  ], []);

  return (
    <div className={`${p.page} ${s.board}`}>
      <header className={s.header}>
        <div className={s.headTitle}>
          <span className={s.headIcon}><ChefHat size={22} aria-hidden /></span>
          <div>
            <h1 className={s.sectorName}>{sectorName || "Comandas"}</h1>
            <p className={p.subtitle}>
              {[businessName, owner ? "con la sesión del dueño" : null, data ? `actualizado ${formatTime(data.serverTime)}` : null]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className={p.headerActions}>
          <button
            type="button"
            className={p.btn}
            aria-pressed={prefs.sound}
            onClick={() => { if (!prefs.sound) beep(); updatePrefs({ sound: !prefs.sound }); }}
          >
            {prefs.sound ? <Bell size={16} aria-hidden /> : <BellOff size={16} aria-hidden />}
            {prefs.sound ? "Sonido" : "Silencio"}
          </button>
          {printMode !== "none" && (
            <button
              type="button"
              className={p.btn}
              aria-pressed={prefs.autoPrint}
              onClick={() => updatePrefs({ autoPrint: !prefs.autoPrint })}
              title={printMode === "browser"
                ? "Para que imprima sin preguntar, abrí Chrome o Edge con --kiosk-printing y la comandera como impresora predeterminada."
                : undefined}
            >
              <Printer size={16} aria-hidden /> {prefs.autoPrint ? "Imprime solo" : "Impresión manual"}
            </button>
          )}
          {printMode === "escpos" && escposSupported() && printerReady === false && (
            <button type="button" className={p.btnPrimary} onClick={connectPrinter}>
              <Usb size={16} aria-hidden /> Conectar comandera
            </button>
          )}
          <button
            type="button"
            className={p.btnGhost}
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            aria-label="Pantalla completa"
            title="Pantalla completa"
          >
            <Maximize size={16} aria-hidden />
          </button>
          {!owner && (confirmUnpair ? (
            <>
              <button type="button" className={`${p.btnDanger} ${p.small}`} onClick={unpairDevice}>Sí, desvincular</button>
              <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirmUnpair(false)}>No</button>
            </>
          ) : (
            <button type="button" className={p.btnGhost} onClick={() => setConfirmUnpair(true)} aria-label="Desvincular este equipo" title="Desvincular este equipo">
              <LogOut size={16} aria-hidden />
            </button>
          ))}
        </div>
      </header>

      {printMode === "escpos" && !escposSupported() && (
        <p className={p.notice}>Este navegador no puede usar la comandera directa. Abrí esta pantalla en Chrome o Edge de una PC.</p>
      )}
      {error && <p className={p.error} role="alert">{error}</p>}
      {actionError && <p className={p.error} role="alert">{actionError}</p>}
      {!data && !error && <p className={p.loading}>Cargando comandas…</p>}

      {data && (
        <>
          <div className={s.columns}>
            {columns.map(column => {
              const list = data.tickets.filter(ticket => ticket.status === column.status);
              return (
                <section key={column.status} className={s.column} aria-label={column.title}>
                  <h2 className={s.columnTitle}>{column.title} <span className={s.count}>{list.length}</span></h2>
                  {list.length === 0 ? (
                    <p className={s.empty}>{column.empty}</p>
                  ) : (
                    <div className={s.cards}>
                      {list.map(ticket => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          now={now}
                          fresh={freshIds.has(ticket.id)}
                          busy={busyId === ticket.id}
                          canPrint={printMode !== "none"}
                          onStatus={status => changeStatus(ticket, status)}
                          onPrint={() => sector && doPrint(ticket, sector, { manual: true })}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <section className={s.recent} aria-label="Recientes">
            <h2 className={s.columnTitle}>Listas y anuladas <span className={s.count}>{data.recent.length}</span></h2>
            {data.recent.length === 0 ? (
              <p className={s.empty}>Acá aparecen las comandas que terminaste en las últimas horas.</p>
            ) : (
              <ul className={s.recentList}>
                {data.recent.map(ticket => (
                  <li key={ticket.id} className={`${s.recentRow} ${ticket.status === "cancelled" ? s.recentCancelled : ""}`}>
                    <strong>#{ticket.order.number}</strong>
                    <span>{placeLabel(ticket.order)}</span>
                    <span className={s.recentItems}>
                      {ticket.items.map(item => `${item.quantity}× ${item.title}`).join(", ")}
                    </span>
                    <span className={s.recentState}>
                      {ticket.status === "cancelled"
                        ? "Anulada"
                        : `Lista ${ticket.doneAt ? formatTime(ticket.doneAt) : ""}`}
                    </span>
                    {ticket.status === "done" && (
                      <button
                        type="button"
                        className={`${p.btnGhost} ${p.small}`}
                        disabled={busyId === ticket.id}
                        onClick={() => changeStatus(ticket, "preparing")}
                      >
                        <RotateCcw size={14} aria-hidden /> Deshacer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TicketCard({ ticket, now, fresh, busy, canPrint, onStatus, onPrint }: {
  ticket: Ticket;
  now: number;
  fresh: boolean;
  busy: boolean;
  canPrint: boolean;
  onStatus: (status: TicketStatus) => void;
  onPrint: () => void;
}) {
  const late = minutesSince(ticket.createdAt, now) >= LATE_MINUTES;
  const { order } = ticket;
  const who = order.customerName && (order.serviceType === "takeaway" || order.serviceType === "delivery") ? order.customerName : null;

  return (
    <article
      className={`${s.ticket} ${fresh ? s.ticketFresh : ""} ${late ? s.ticketLate : ""} ${ticket.status === "preparing" ? s.ticketPreparing : ""}`}
      aria-label={`Comanda del pedido ${order.number}`}
    >
      <header className={s.ticketHead}>
        <span className={s.place}>{placeLabel(order)}</span>
        <span className={s.number}>#{order.number}</span>
      </header>
      <div className={s.ticketMeta}>
        <span>{formatTime(ticket.createdAt)} · {elapsedLabel(ticket.createdAt, now)}</span>
        {late && <span className={s.lateBadge}><Flame size={13} aria-hidden /> Demorada</span>}
        {(order.waiterName || who) && <span>{who ?? order.waiterName}</span>}
      </div>

      <ul className={s.items}>
        {ticket.items.map((item, index) => (
          <li key={index} className={s.item}>
            <span className={s.qty}>{item.quantity}</span>
            <div className={s.itemText}>
              <span className={s.itemTitle}>{item.title}{item.option && <em> · {item.option}</em>}</span>
              {item.notes && <span className={s.itemNotes}>{item.notes}</span>}
            </div>
          </li>
        ))}
        {/* Lo que el local quitó del pedido (sin stock, error): ya no se prepara. */}
        {(ticket.removedItems ?? []).map((item, index) => (
          <li key={`removed-${index}`} className={`${s.item} ${s.itemRemoved}`}>
            <span className={s.qty}>{item.quantity}</span>
            <div className={s.itemText}>
              <span className={s.itemTitle}>{item.title}{item.option && <em> · {item.option}</em>}</span>
              <span className={s.itemRemovedTag}>Quitado del pedido: no preparar</span>
            </div>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className={s.orderNotes}><MessageSquareText size={15} aria-hidden /> {order.notes}</p>
      )}

      <div className={s.actions}>
        {ticket.status === "new" && (
          <button type="button" className={`${p.btn} ${s.actionBtn}`} disabled={busy} onClick={() => onStatus("preparing")}>
            <Flame size={18} aria-hidden /> Preparando
          </button>
        )}
        <button type="button" className={`${p.btnPrimary} ${s.actionBtn}`} disabled={busy} onClick={() => onStatus("done")}>
          <Check size={18} aria-hidden /> Lista
        </button>
        {ticket.status === "preparing" && (
          <button type="button" className={`${p.btnGhost} ${p.small}`} disabled={busy} onClick={() => onStatus("new")} title="Volver a nuevas">
            <RotateCcw size={14} aria-hidden />
            <span className="sr-only">Volver a nuevas</span>
          </button>
        )}
        {canPrint && (
          <button
            type="button"
            className={`${p.btnGhost} ${p.small}`}
            onClick={onPrint}
            title={ticket.printedAt ? `Reimprimir (impresa ${ticket.printCount} ${ticket.printCount === 1 ? "vez" : "veces"})` : "Imprimir"}
          >
            <Printer size={14} aria-hidden />
            <span className="sr-only">{ticket.printedAt ? "Reimprimir" : "Imprimir"}</span>
          </button>
        )}
      </div>
    </article>
  );
}
