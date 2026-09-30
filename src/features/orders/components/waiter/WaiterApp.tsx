import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ClipboardList, LogOut, ScanLine, Send, X } from "lucide-react";
import {
  fetchMenuForOrdering, getWaiterOrders, getWaiterSession, logoutWaiter, pairWaiterDevice, sendWaiterOrder,
} from "../../api/publicOrdersApi";
import { errorMessage, errorStatus } from "../../lib/errors";
import { elapsedLabel, formatMoney, STATUS_LABEL } from "../../lib/format";
import { uuid } from "../../lib/storage";
import { lineKey, toOrderLines, unitsCount, unitsTotal, type UnitLine } from "../../lib/units";
import { clearWaiterSession, readWaiterSession, saveWaiterSession } from "../../lib/waiterSession";
import type { Order, WaiterSessionInfo } from "../../types";
import type { PublicMenuPayload } from "../../../../types";
import ProductPicker, { type PickedProduct } from "../shared/ProductPicker";
import UnitLinesEditor from "../shared/UnitLinesEditor";
import p from "../panel/panel.module.css";
import s from "./WaiterApp.module.css";

// Tomador de pedidos: interfaz simple para el celular o la tablet del mozo.
// Se entra escaneando el QR del mozo que muestra el panel (/<slug>/mozo?code=…);
// el dispositivo queda habilitado con un token en localStorage, así no hace
// falta la sesión del dueño en cada dispositivo.

type Phase =
  | { kind: "loading" }
  | { kind: "locked"; message: string }
  | { kind: "ready"; token: string; info: WaiterSessionInfo };

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
  const [tab, setTab] = useState<"new" | "mine">("new");
  const [menu, setMenu] = useState<PublicMenuPayload | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [lines, setLines] = useState<UnitLine[]>([]);
  const [table, setTable] = useState("");
  const [notes, setNotes] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
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

  const loadOrders = useCallback(async () => {
    try {
      setOrders((await getWaiterOrders(token)).orders);
    } catch (err) {
      handleAuthError(err);
    }
  }, [token, handleAuthError]);

  useEffect(() => {
    if (tab !== "mine") return;
    const first = setTimeout(loadOrders, 0);
    const timer = setInterval(loadOrders, 15_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [tab, loadOrders]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const addProduct = (product: PickedProduct) => {
    setLines(prev => {
      const key = lineKey(product.itemId, product.option);
      const existing = prev.find(line => lineKey(line.itemId, line.option) === key);
      if (existing) return prev.map(line => (line === existing ? { ...line, quantity: Math.min(20, line.quantity + 1) } : line));
      return [...prev, { ...product, quantity: 1, unitNotes: [] }];
    });
    setToast(`+1 ${product.title}${product.option ? ` · ${product.option}` : ""}`);
  };

  const send = async () => {
    if (!table || lines.length === 0) return;
    const items = toOrderLines(lines);
    const key = JSON.stringify([table, items, notes]);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    setSending(true);
    setError(null);
    try {
      const { order } = await sendWaiterOrder(token, {
        tableNumber: Number(table),
        items,
        notes: notes.trim() || undefined,
        clientRequestId: request.current.id,
      });
      setLines([]);
      setNotes("");
      setTable("");
      setSheetOpen(false);
      request.current = null;
      setToast(`Pedido #${order.number} enviado a la mesa ${order.tableNumber}.`);
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

  return (
    <div className={`${p.page} ${s.shell}`}>
      <header className={s.top}>
        <div className={p.titleBlock}>
          <span className={s.business}>{info.business.name}</span>
          <h1 className={p.title}>Hola, {info.waiter.name}</h1>
        </div>
        <button type="button" className={p.iconBtn} onClick={logout} aria-label="Cerrar sesión en este dispositivo">
          <LogOut size={18} aria-hidden />
        </button>
      </header>

      <div className={`${p.segmented} ${s.tabs}`} role="tablist">
        <button type="button" role="tab" aria-selected={tab === "new"} className={`${p.segment} ${tab === "new" ? p.segmentActive : ""}`} onClick={() => setTab("new")}>
          Nuevo pedido
        </button>
        <button type="button" role="tab" aria-selected={tab === "mine"} className={`${p.segment} ${tab === "mine" ? p.segmentActive : ""}`} onClick={() => setTab("mine")}>
          <ClipboardList size={14} aria-hidden /> Mis pedidos
        </button>
      </div>

      {tab === "new" && (
        <>
          {menuError && <p className={p.error}>{menuError}</p>}
          {!menu && !menuError && <p className={p.loading}>Cargando carta…</p>}
          {menu && <ProductPicker menu={menu.menu} hidePrices={hidePrices} onPick={addProduct} />}

          {lines.length > 0 && (
            <button type="button" className={s.cartBar} onClick={() => setSheetOpen(true)}>
              <span className={s.cartCount}>{unitsCount(lines)}</span>
              <span>Revisar y enviar</span>
              {!hidePrices && <span className={s.cartTotal}>{formatMoney(unitsTotal(lines))}</span>}
            </button>
          )}
        </>
      )}

      {tab === "mine" && (
        <section className={p.stack}>
          {orders === null && <p className={p.loading}>Cargando…</p>}
          {orders?.length === 0 && <p className={p.empty}>Todavía no tomaste pedidos en este turno.</p>}
          {orders?.map(order => (
            <article key={order.id} className={p.card}>
              <div className={s.orderHead}>
                <div className={s.orderId}>
                  <span className={s.orderNumber}>#{order.number}</span>
                  <span className={s.orderTable}>{order.tableNumber ? `Mesa ${order.tableNumber}` : "Sin mesa"}</span>
                </div>
                <span className={`${p.status} ${p[`status_${order.status}`]}`}>{STATUS_LABEL[order.status]}</span>
              </div>
              <ul className={s.orderLines}>
                {order.items.map(item => (
                  <li key={item.id} className={s.orderLine}>
                    <span className={s.orderQty}>{item.quantity}×</span>
                    <span className={s.orderText}>
                      <span>{item.title}{item.option && <em> · {item.option}</em>}</span>
                      {item.notes && <span className={s.orderNotes}>{item.notes}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <span className={s.orderTime}>{elapsedLabel(order.createdAt)}</span>
            </article>
          ))}
        </section>
      )}

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
              <label className={p.field}>
                <span className={p.label}>Mesa</span>
                <select className={p.select} value={table} onChange={event => setTable(event.target.value)} required>
                  <option value="">Elegí la mesa</option>
                  {Array.from({ length: tableCount }, (_, index) => (
                    <option key={index + 1} value={index + 1}>Mesa {index + 1}</option>
                  ))}
                </select>
              </label>
              <UnitLinesEditor lines={lines} onChange={next => { setLines(next); if (next.length === 0) setSheetOpen(false); }} hidePrices={hidePrices} />
              <label className={p.field}>
                <span className={p.label}>Nota del pedido (opcional)</span>
                <input className={p.input} value={notes} maxLength={200} onChange={event => setNotes(event.target.value)} placeholder="Ej: la bebida primero" />
              </label>
              {error && <p className={p.error} role="alert">{error}</p>}
            </div>
            <footer className={p.modalFooter}>
              <button type="button" className={p.btnPrimary} style={{ flex: 1 }} disabled={sending || !table || lines.length === 0} onClick={send}>
                <Send size={16} aria-hidden /> {sending ? "Enviando…" : table ? `Enviar a mesa ${table}` : "Elegí la mesa"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
