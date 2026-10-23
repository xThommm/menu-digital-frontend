import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, ChevronRight, History, LayoutGrid, LogOut, Plus, ScanLine, Send, X,
} from "lucide-react";
import {
  fetchMenuForOrdering, getWaiterSession, getWaiterTables, logoutWaiter, pairWaiterDevice, sendWaiterOrder,
} from "../../api/publicOrdersApi";
import { errorMessage, errorStatus } from "../../lib/errors";
import { durationLabel, formatMoney, placeLabel } from "../../lib/format";
import { emptyService, serviceReady, toServiceInput, type ServiceDraft } from "../../lib/service";
import { uuid } from "../../lib/storage";
import { addPicked, emptyDraft, type PickedProduct, type TableDraft } from "../../lib/quickPick";
import { readDrafts, saveDrafts, type StoredDrafts } from "../../lib/waiterDrafts";
import { lineKey, toOrderLines, unitsCount, unitsTotal, type UnitLine } from "../../lib/units";
import { clearWaiterSession, readWaiterSession, saveWaiterSession } from "../../lib/waiterSession";
import type { WaiterSessionInfo } from "../../types";
import type { PublicMenuPayload } from "../../../../types";
import QuickPicker from "../shared/QuickPicker";
import ServiceFields from "../shared/ServiceFields";
import UnitLinesEditor from "../shared/UnitLinesEditor";
import WaiterHistory from "./WaiterHistory";
import WaiterTableScreen from "./WaiterTableScreen";
import WaiterTables from "./WaiterTables";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// Tomador de pedidos del operador: interfaz simple para el celular o la
// tablet. Se entra escaneando el QR del operador que muestra el panel
// (/<slug>/operador?code=…; /<slug>/mozo sigue andando); el dispositivo
// queda habilitado con un token en localStorage, así no hace falta la
// sesión del dueño en cada dispositivo.
//
// No es solo para tomar pedidos: al entrar muestra tres accesos grandes,
// "Nuevo pedido", "Salón" (todas las mesas con su estado; cada una abre su
// pantalla para cargarle productos y manejar su cuenta) e "Historial".

type Phase =
  | { kind: "loading" }
  | { kind: "locked"; message: string }
  | { kind: "ready"; token: string; info: WaiterSessionInfo };

type View = "home" | "new" | "tables" | "table" | "history";

// Cada vista es una entrada del historial del navegador: el "atrás" del
// celular vuelve a la vista anterior en vez de salir de la app.
interface NavState { waiterView: View; table: number | null }

const VIEWS: View[] = ["home", "new", "tables", "table", "history"];
const navState = (state: unknown): NavState | null => {
  if (!state || typeof state !== "object") return null;
  const { waiterView, table } = state as Partial<NavState>;
  return waiterView && VIEWS.includes(waiterView) ? { waiterView, table: typeof table === "number" ? table : null } : null;
};

const VIEW_TITLE: Record<Exclude<View, "home" | "table">, string> = {
  new: "Nuevo pedido",
  tables: "Salón",
  history: "Historial",
};

const readCode = () => {
  const code = new URLSearchParams(window.location.search).get("code");
  return code && /^[A-Za-z0-9_-]{16,64}$/.test(code) ? code : null;
};

// El código del QR es de un solo uso: si el efecto se repite (StrictMode,
// remount) se reusa el mismo canje en vez de gastar el código dos veces.
const pairings = new Map<string, ReturnType<typeof pairWaiterDevice>>();
const pairOnce = (code: string) => {
  if (!pairings.has(code)) pairings.set(code, pairWaiterDevice(code));
  return pairings.get(code)!;
};

const stripCode = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code")) return;
  params.delete("code");
  const search = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
};

export default function WaiterApp() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [code] = useState(readCode);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const lock = useCallback((message: string) => {
    clearWaiterSession(slug);
    setPhase({ kind: "locked", message });
  }, [slug]);

  useEffect(() => {
    stripCode();
    const controller = new AbortController();
    const start = async () => {
      try {
        if (code) {
          const paired = await pairOnce(code);
          saveWaiterSession(paired.business.slug || slug, { token: paired.token, waiterName: paired.waiter.name });
        }
        const stored = readWaiterSession(slug);
        if (!stored) {
          setPhase({ kind: "locked", message: "Escaneá tu QR de acceso desde el panel de pedidos del local." });
          return;
        }
        const info = await getWaiterSession(stored.token, controller.signal);
        setPhase({ kind: "ready", token: stored.token, info });
      } catch (err) {
        if (controller.signal.aborted) return;
        const status = errorStatus(err);
        if (status === 401 || status === 403) lock(errorMessage(err, "Tu acceso ya no es válido. Escaneá un QR nuevo."));
        else setPhase({ kind: "locked", message: errorMessage(err, "No pudimos conectarnos. Revisá la conexión y recargá.") });
      }
    };
    start();
    return () => controller.abort();
  }, [code, slug, lock]);

  if (phase.kind === "loading") return <Shell><p className={p.loading}>Cargando…</p></Shell>;

  if (phase.kind === "locked") {
    return (
      <Shell>
        <div className={s.locked}>
          <span className={s.lockedIcon}><ScanLine size={32} aria-hidden /></span>
          <h1 className={p.title}>Tomador de pedidos</h1>
          <p className={p.subtitle}>{phase.message}</p>
        </div>
      </Shell>
    );
  }

  return <WaiterWorkspace slug={slug} token={phase.token} info={phase.info} onLocked={lock} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className={`${p.page} ${s.shell}`}>{children}</div>;
}

function WaiterWorkspace({ slug, token, info, onLocked }: {
  slug: string;
  token: string;
  info: WaiterSessionInfo;
  onLocked: (message: string) => void;
}) {
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState<PublicMenuPayload | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [lines, setLines] = useState<UnitLine[]>([]);
  const [service, setService] = useState<ServiceDraft>(() => emptyService("table"));
  const [notes, setNotes] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openTables, setOpenTables] = useState<number | null>(null);
  // Mesa abierta en la vista "table" y lo cargado sin enviar en cada mesa.
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<StoredDrafts>(() => readDrafts(slug));
  const [floorNotice, setFloorNotice] = useState<string | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const hidePrices = menu?.user.menuDisplay?.hidePrices === true;

  useEffect(() => {
    const controller = new AbortController();
    fetchMenuForOrdering(slug, controller.signal)
      .then(setMenu)
      .catch(err => { if (!controller.signal.aborted) setMenuError(errorMessage(err, "No se pudo cargar la carta.")); });
    return () => controller.abort();
  }, [slug]);

  const handleAuthError = useCallback((err: unknown) => {
    const status = errorStatus(err);
    if (status === 401 || status === 403) {
      onLocked(errorMessage(err, "Tu acceso ya no es válido. Escaneá un QR nuevo."));
      return true;
    }
    return false;
  }, [onLocked]);

  // En el inicio, cuántas mesas abiertas atiende (para el acceso "Salón").
  useEffect(() => {
    if (view !== "home") return;
    const controller = new AbortController();
    getWaiterTables(token, controller.signal)
      .then(({ sessions }) => setOpenTables(sessions.filter(session => session.waiterId === info.waiter.id).length))
      .catch(err => { if (!controller.signal.aborted) handleAuthError(err); });
    return () => controller.abort();
  }, [view, token, info.waiter.id, handleAuthError]);

  // La entrada actual del historial es el inicio; cada vista nueva suma una.
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, waiterView: "home", table: null } satisfies NavState, "");
    const onPop = (event: PopStateEvent) => {
      const nav = navState(event.state);
      if (!nav) return;
      if (nav.table !== null) setTableNumber(nav.table);
      setView(nav.waiterView);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => saveDrafts(slug, drafts), [slug, drafts]);

  const go = (next: View, table: number | null = null) => {
    window.history.pushState({ ...window.history.state, waiterView: next, table } satisfies NavState, "");
    if (table !== null) setTableNumber(table);
    setView(next);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const addProduct = (product: PickedProduct) => {
    setLines(prev => addPicked(prev, product));
    setToast(`+1 ${product.title}${product.option ? ` · ${product.option}` : ""}`);
  };

  const openTable = (table: number) => {
    setFloorNotice(null);
    go("table", table);
  };

  // La flecha hace lo mismo que el "atrás" del celular: desde la mesa vuelve
  // al salón; desde el resto, al inicio.
  const goBack = () => window.history.back();

  const setDraft = (table: number, draft: TableDraft) =>
    setDrafts(prev => {
      const next = { ...prev };
      if (draft.lines.length === 0 && !draft.notes) delete next[table];
      else next[table] = { ...draft, savedAt: Date.now() };
      return next;
    });

  const draftCounts = new Map(Object.entries(drafts).map(([table, draft]) => [Number(table), unitsCount(draft.lines)]));

  const send = async () => {
    if (!serviceReady(service) || lines.length === 0) return;
    const items = toOrderLines(lines);
    const payload = { ...toServiceInput(service), items, notes: notes.trim() || undefined };
    const key = JSON.stringify(payload);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    setSending(true);
    setError(null);
    try {
      const { order } = await sendWaiterOrder(token, { ...payload, clientRequestId: request.current.id });
      setLines([]);
      setNotes("");
      setService(emptyService("table"));
      setSheetOpen(false);
      request.current = null;
      setToast(`Pedido #${order.number} enviado · ${placeLabel(order)}.`);
    } catch (err) {
      if (!handleAuthError(err)) setError(errorMessage(err, "No se pudo enviar el pedido. Probá de nuevo."));
    } finally {
      setSending(false);
    }
  };

  const logout = async () => {
    try { await logoutWaiter(token); } catch { /* igual se cierra en este dispositivo */ }
    onLocked("Cerraste sesión. Para volver, escaneá tu QR desde el panel.");
  };

  const tableCount = info.tableCount ?? 0;
  const sendLabel = sending
    ? "Enviando…"
    : service.serviceType === "table"
      ? service.table ? `Enviar a mesa ${service.table}` : "Elegí la mesa"
      : "Enviar pedido";

  return (
    <div className={`${p.page} ${s.shell}`}>
      <header className={s.top}>
        {view === "home" ? (
          <div className={p.titleBlock}>
            <span className={s.business}>{info.business.name}</span>
            <h1 className={p.title}>Hola, {info.waiter.name}</h1>
            {info.sessionStartedAt && (
              <span className={p.subtitle}>Conectado desde hace {durationLabel(info.sessionStartedAt)}</span>
            )}
          </div>
        ) : (
          <div className={s.viewTitle}>
            <button type="button" className={p.iconBtn} onClick={goBack} aria-label={view === "table" ? "Volver al salón" : "Volver al inicio"}>
              <ArrowLeft size={20} aria-hidden />
            </button>
            <h1 className={p.title}>{view === "table" ? `Mesa ${tableNumber}` : VIEW_TITLE[view]}</h1>
          </div>
        )}
        <button type="button" className={p.iconBtn} onClick={logout} aria-label="Cerrar sesión en este dispositivo">
          <LogOut size={18} aria-hidden />
        </button>
      </header>

      {view === "home" && (
        <nav className={s.homeGrid} aria-label="Inicio">
          <button type="button" className={`${s.homeBtn} ${s.homeBtnPrimary}`} onClick={() => go("new")}>
            <span className={s.homeIcon}><Plus size={26} aria-hidden /></span>
            <span className={s.homeText}>
              <span className={s.homeLabel}>Nuevo pedido</span>
              <span className={s.homeHint}>Pedidos de mesa</span>
            </span>
            {lines.length > 0 && <span className={s.homeBadge}>{unitsCount(lines)}</span>}
            <ChevronRight size={20} aria-hidden className={s.homeChevron} />
          </button>
          <button type="button" className={s.homeBtn} onClick={() => go("tables")}>
            <span className={s.homeIcon}><LayoutGrid size={26} aria-hidden /></span>
            <span className={s.homeText}>
              <span className={s.homeLabel}>Salón</span>
              <span className={s.homeHint}>Todas las mesas: cuáles están libres, la cuenta y los cobros de las tuyas</span>
            </span>
            {openTables !== null && openTables > 0 && <span className={s.homeBadge}>{openTables}</span>}
            <ChevronRight size={20} aria-hidden className={s.homeChevron} />
          </button>
          <button type="button" className={s.homeBtn} onClick={() => go("history")}>
            <span className={s.homeIcon}><History size={26} aria-hidden /></span>
            <span className={s.homeText}>
              <span className={s.homeLabel}>Historial</span>
              <span className={s.homeHint}>Mesas cerradas y pedidos del turno</span>
            </span>
            <ChevronRight size={20} aria-hidden className={s.homeChevron} />
          </button>
        </nav>
      )}

      {view === "new" && (
        <>
          {menuError && <p className={p.error}>{menuError}</p>}
          {!menu && !menuError && <p className={p.loading}>Cargando carta…</p>}
          {menu && <QuickPicker menu={menu.menu} hidePrices={hidePrices} counts={new Map(lines.map(line => [lineKey(line.itemId, line.option), line.quantity]))} onPick={addProduct} />}

          {lines.length > 0 && (
            <button type="button" className={s.cartBar} onClick={() => setSheetOpen(true)}>
              <span className={s.cartCount}>{unitsCount(lines)}</span>
              <span>Revisar y enviar</span>
              {!hidePrices && <span className={s.cartTotal}>{formatMoney(unitsTotal(lines))}</span>}
            </button>
          )}
        </>
      )}

      {view === "tables" && (
        <WaiterTables
          token={token}
          waiterId={info.waiter.id}
          tableCount={tableCount}
          hidePrices={hidePrices}
          drafts={draftCounts}
          notice={floorNotice}
          onAuthError={handleAuthError}
          onOpenTable={openTable}
          onCountChange={setOpenTables}
        />
      )}

      {view === "table" && tableNumber !== null && (
        <WaiterTableScreen
          key={tableNumber}
          slug={info.business.slug || slug}
          businessName={info.business.name || null}
          token={token}
          tableNumber={tableNumber}
          menu={menu}
          menuError={menuError}
          draft={drafts[tableNumber] ?? emptyDraft()}
          onDraftChange={draft => setDraft(tableNumber, draft)}
          onAuthError={handleAuthError}
          onDone={message => {
            setFloorNotice(message);
            // La mesa se abrió desde el salón: volver es la entrada anterior.
            window.history.back();
          }}
        />
      )}

      {view === "history" && <WaiterHistory token={token} onAuthError={handleAuthError} />}

      {toast && (
        <div className={s.toast} role="status">
          <CheckCircle2 size={18} aria-hidden />
          <span>{toast}</span>
        </div>
      )}

      {sheetOpen && (
        <div className={p.overlay} role="dialog" aria-modal="true" aria-label="Enviar pedido" onClick={() => setSheetOpen(false)}>
          <div className={p.modal} onClick={event => event.stopPropagation()}>
            <header className={p.modalHeader}>
              <h2 className={p.modalTitle}>Pedido</h2>
              <button type="button" className={p.iconBtn} onClick={() => setSheetOpen(false)} aria-label="Cerrar"><X size={18} aria-hidden /></button>
            </header>
            <div className={`${p.modalBody} ${p.stack}`}>
              <ServiceFields value={service} onChange={setService} tableCount={tableCount} allowed={["table"]} />
              <UnitLinesEditor lines={lines} onChange={next => { setLines(next); if (next.length === 0) setSheetOpen(false); }} hidePrices={hidePrices} />
              <label className={p.field}>
                <span className={p.label}>Nota del pedido (opcional)</span>
                <input className={p.input} value={notes} maxLength={200} onChange={event => setNotes(event.target.value)} placeholder="Ej: la bebida primero" />
              </label>
              {error && <p className={p.error} role="alert">{error}</p>}
            </div>
            <footer className={p.modalFooter}>
              <button type="button" className={p.btnPrimary} style={{ flex: 1 }} disabled={sending || !serviceReady(service) || lines.length === 0} onClick={send}>
                <Send size={16} aria-hidden /> {sendLabel}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
