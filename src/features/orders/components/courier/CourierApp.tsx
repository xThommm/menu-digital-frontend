import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Bike, History, LogOut, PackageCheck, PackageSearch, ScanLine, Truck, WifiOff } from "lucide-react";
import {
  claimCourierOrder, deliverCourierOrder, getCourierHistory, getCourierPanel, getCourierSession, logoutCourier,
  pairCourierDevice, pickupCourierOrder, setCourierAvailability,
} from "../../api/publicOrdersApi";
import { useLiveRefresh } from "../../hooks/useLiveRefresh";
import { clearCourierSession, readCourierSession, saveCourierSession } from "../../lib/courierSession";
import { errorMessage, errorStatus } from "../../lib/errors";
import { durationLabel } from "../../lib/format";
import type { CourierOrder, CourierPanel, CourierSessionInfo } from "../../types";
import CourierOrderCard from "./CourierOrderCard";
import p from "../panel/panel.module.css";
import s from "./CourierApp.module.css";

// App del repartidor: panel optimizado para el celular. Se entra escaneando el
// QR de vinculación que muestra el local (/<slug>/repartidor?code=…): el
// dispositivo queda habilitado con un token en localStorage, sin usuario ni
// contraseña. Muestra los pedidos por retirar, los que van en camino, los
// disponibles para tomar (si el local asigna en modo abierto) y el historial.
//
// El panel sale SIEMPRE de la API; el WebSocket solo avisa cuándo volver a
// pedirla. Al reconectar se vuelve a consultar, y hay una consulta periódica de
// respaldo por si el socket no abre.

type Phase =
  | { kind: "loading" }
  | { kind: "locked"; message: string }
  | { kind: "ready"; token: string; info: CourierSessionInfo };

type Tab = "assigned" | "transit" | "open" | "history";

const POLL_MS = 20_000;

const readCode = () => {
  const code = new URLSearchParams(window.location.search).get("code");
  return code && /^[A-Za-z0-9_-]{16,64}$/.test(code) ? code : null;
};

// El código del QR es de un solo uso: si el efecto se repite (StrictMode,
// remount) se reusa el mismo canje en vez de gastar el código dos veces.
const pairings = new Map<string, ReturnType<typeof pairCourierDevice>>();
const pairOnce = (code: string) => {
  if (!pairings.has(code)) pairings.set(code, pairCourierDevice(code));
  return pairings.get(code)!;
};

const stripCode = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code")) return;
  params.delete("code");
  const search = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
};

export default function CourierApp() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [code] = useState(readCode);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // Se incrementa al vincular con el código tipeado para volver a arrancar la sesión.
  const [attempt, setAttempt] = useState(0);

  const lock = useCallback((message: string) => {
    clearCourierSession(slug);
    setPhase({ kind: "locked", message });
  }, [slug]);

  useEffect(() => {
    stripCode();
    const controller = new AbortController();
    const start = async () => {
      try {
        if (code) {
          const paired = await pairOnce(code);
          saveCourierSession(paired.business.slug || slug, { token: paired.token, courierName: paired.courier.name });
        }
        const stored = readCourierSession(slug);
        if (!stored) {
          setPhase({ kind: "locked", message: "Escaneá tu QR de acceso desde la sección Delivery del local o ingresá el código." });
          return;
        }
        const info = await getCourierSession(stored.token, controller.signal);
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
  }, [code, slug, lock, attempt]);

  // Alternativa al QR (cámara que no anda): código corto que el local muestra junto al QR.
  const pairWithTypedCode = async (typed: string) => {
    const paired = await pairCourierDevice(typed);
    const businessSlug = paired.business.slug || slug;
    saveCourierSession(businessSlug, { token: paired.token, courierName: paired.courier.name });
    if (businessSlug !== slug) {
      window.location.replace(`/${businessSlug}/repartidor`);
      return;
    }
    setPhase({ kind: "loading" });
    setAttempt(value => value + 1);
  };

  if (phase.kind === "loading") return <Shell><p className={p.loading}>Cargando…</p></Shell>;

  if (phase.kind === "locked") {
    return (
      <Shell>
        <div className={s.locked}>
          <span className={s.lockedIcon}><ScanLine size={32} aria-hidden /></span>
          <h1 className={p.title}>App del repartidor</h1>
          <p className={p.subtitle}>{phase.message}</p>
          <TypedCodeForm onSubmit={pairWithTypedCode} />
        </div>
      </Shell>
    );
  }

  return <CourierWorkspace token={phase.token} info={phase.info} onLocked={lock} />;
}

function TypedCodeForm({ onSubmit }: { onSubmit: (code: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = value.replace(/[\s-]/g, "").length === 8;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (err) {
      setError(errorMessage(err, "No pudimos vincular el dispositivo. Revisá el código."));
      setBusy(false);
    }
  };

  return (
    <form className={s.typedForm} onSubmit={submit}>
      <span className={p.label}>¿No podés escanear el QR? Ingresá el código que te muestra el local</span>
      <input
        className={`${p.input} ${s.codeInput}`}
        value={value}
        maxLength={9}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="ABCD-EFGH"
        aria-label="Código de vinculación de 8 caracteres"
        onChange={event => setValue(event.target.value.toUpperCase())}
      />
      {error && <p className={p.error} role="alert" style={{ margin: 0, padding: "0.6rem 0.85rem", borderRadius: 14 }}>{error}</p>}
      <button type="submit" className={`${p.btnPrimary} ${s.bigBtn}`} disabled={!ready || busy}>
        {busy ? "Vinculando…" : "Vincular este celular"}
      </button>
    </form>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className={`${p.page} ${s.shell}`}>{children}</div>;
}

function CourierWorkspace({ token, info, onLocked }: {
  token: string;
  info: CourierSessionInfo;
  onLocked: (message: string) => void;
}) {
  const [panel, setPanel] = useState<CourierPanel | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>("assigned");
  const [history, setHistory] = useState<{ deliveries: CourierOrder[]; total: number; page: number; pageSize: number } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string; orderId?: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  const refreshing = useRef<Promise<void> | null>(null);

  const handleAuthError = useCallback((err: unknown) => {
    const status = errorStatus(err);
    if (status === 401 || status === 403) {
      onLocked(errorMessage(err, "Tu acceso ya no es válido. Escaneá un QR nuevo."));
      return true;
    }
    return false;
  }, [onLocked]);

  // Varias señales a la vez (aviso del socket + temporizador) comparten una sola consulta.
  const refresh = useCallback((): Promise<void> => {
    if (refreshing.current) return refreshing.current;
    const run = (async () => {
      try {
        const next = await getCourierPanel(token);
        setPanel(next);
        setOffline(false);
        setNow(Date.now());
      } catch (err) {
        if (!handleAuthError(err)) setOffline(true);
      } finally {
        refreshing.current = null;
      }
    })();
    refreshing.current = run;
    return run;
  }, [token, handleAuthError]);

  // Pedidos al día con los avisos del servidor; sin conexión en vivo, cada POLL_MS.
  const connected = useLiveRefresh({ hello: { type: "auth", role: "courier", token }, refresh, offlineMs: POLL_MS });

  // Los minutos que se muestran se mantienen al día.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    const controller = new AbortController();
    getCourierHistory(token, historyPage, controller.signal)
      .then(setHistory)
      .catch(err => { if (!controller.signal.aborted) handleAuthError(err); });
    return () => controller.abort();
  }, [tab, token, historyPage, handleAuthError]);

  // Una acción a la vez: un doble toque no repite la operación (el backend además es idempotente).
  const act = async (order: CourierOrder, action: () => Promise<string>, failure: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(order.id);
    setNotice(null);
    try {
      const text = await action();
      setNotice({ tone: "ok", text, orderId: order.id });
    } catch (err) {
      if (!handleAuthError(err)) {
        const status = errorStatus(err);
        // Sin respuesta del servidor no sabemos si la acción llegó: se avisa y se reconsulta.
        setNotice({ tone: "error", text: status === undefined || status === 0 ? `${failure} Revisá tu conexión y verificá el estado del pedido.` : errorMessage(err, failure), orderId: order.id });
      }
    } finally {
      await refresh();
      inFlight.current = false;
      setBusyId(null);
    }
  };

  const pickup = (order: CourierOrder) => act(order, async () => {
    const { repeated } = await pickupCourierOrder(token, order.id);
    setTab("transit");
    return repeated ? `El pedido #${order.number} ya estaba retirado.` : `Retiraste el pedido #${order.number}. El cliente ya puede ver su código.`;
  }, "No se pudo retirar el pedido.");

  const claim = (order: CourierOrder) => act(order, async () => {
    await claimCourierOrder(token, order.id);
    setTab("assigned");
    return `Tomaste el pedido #${order.number}.`;
  }, "No se pudo tomar el pedido.");

  const deliver = (order: CourierOrder, code: string) => act(order, async () => {
    const result = await deliverCourierOrder(token, order.id, code);
    return result.repeated ? `El pedido #${order.number} ya figuraba entregado.` : `¡Entrega confirmada! Pedido #${order.number}.`;
  }, "No se pudo confirmar la entrega.");

  const toggleAvailable = async () => {
    if (!panel) return;
    const next = !panel.available;
    setPanel({ ...panel, available: next });
    try {
      await setCourierAvailability(token, next);
      await refresh();
    } catch (err) {
      if (!handleAuthError(err)) setNotice({ tone: "error", text: errorMessage(err, "No se pudo cambiar tu disponibilidad.") });
      await refresh();
    }
  };

  const logout = async () => {
    try { await logoutCourier(token); } catch { /* igual se cierra en este dispositivo */ }
    onLocked("Cerraste sesión. Para volver, escaneá tu QR desde el local.");
  };

  const counts = {
    assigned: panel?.assigned.length ?? 0,
    transit: panel?.inTransit.length ?? 0,
    open: panel?.openCount ?? 0,
  };
  const showOpen = panel?.enabled === true && panel.assignMode === "open";
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "assigned", label: "Por retirar", icon: <PackageSearch size={16} aria-hidden />, count: counts.assigned },
    { id: "transit", label: "En camino", icon: <Truck size={16} aria-hidden />, count: counts.transit },
    ...(showOpen ? [{ id: "open" as const, label: "Disponibles", icon: <PackageCheck size={16} aria-hidden />, count: counts.open }] : []),
    { id: "history", label: "Historial", icon: <History size={16} aria-hidden /> },
  ];
  const activeTab = tabs.some(item => item.id === tab) ? tab : "assigned";

  const list = (orders: CourierOrder[], empty: string, mode: "mine" | "open") => (
    orders.length === 0
      ? <p className={s.empty}>{empty}</p>
      : orders.map(order => (
        <CourierOrderCard
          key={order.id}
          order={order}
          mode={mode}
          now={now}
          busy={busyId === order.id}
          disabled={busyId !== null}
          notice={notice?.orderId === order.id ? notice : null}
          onPickup={pickup}
          onClaim={claim}
          onDeliver={deliver}
        />
      ))
  );

  return (
    <div className={`${p.page} ${s.shell}`}>
      <header className={s.top}>
        <div className={p.titleBlock}>
          <span className={s.business}>{info.business.name}</span>
          <h1 className={p.title}>Hola, {info.courier.name}</h1>
          {info.sessionStartedAt && <span className={p.subtitle}>Conectado desde hace {durationLabel(info.sessionStartedAt)}</span>}
        </div>
        <button type="button" className={p.iconBtn} onClick={logout} aria-label="Cerrar sesión en este dispositivo">
          <LogOut size={18} aria-hidden />
        </button>
      </header>

      {offline && (
        <p className={s.offline} role="status">
          <WifiOff size={16} aria-hidden /> Sin conexión con el servidor. Reintentando… {panel && "Lo que ves puede estar desactualizado."}
        </p>
      )}

      <section className={`${s.availability} ${panel?.available ? s.availabilityOn : ""}`} aria-label="Disponibilidad">
        <span className={s.availIcon}><Bike size={22} aria-hidden /></span>
        <div className={s.availText}>
          <strong>{panel?.available ? "Estás disponible" : "No estás disponible"}</strong>
          <span>
            {showOpen
              ? "Disponible para ver y tomar los pedidos de la lista compartida."
              : "Disponible para que el local te asigne pedidos."}
            {connected ? "" : " · Actualizando cada 20 s."}
          </span>
        </div>
        <input
          type="checkbox"
          className={p.switch}
          checked={panel?.available === true}
          disabled={!panel}
          onChange={toggleAvailable}
          aria-label={panel?.available ? "Marcarme como no disponible" : "Marcarme como disponible"}
        />
      </section>

      {panel && !panel.enabled && (
        <p className={p.notice} role="status" style={{ padding: "0.75rem 1rem", borderRadius: 16 }}>
          El local desactivó el reparto por ahora. Podés terminar las entregas que ya retiraste.
        </p>
      )}

      <div className={p.segmented} role="tablist" aria-label="Mis entregas" style={{ alignSelf: "stretch" }}>
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            className={`${p.segment} ${activeTab === item.id ? p.segmentActive : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.icon} {item.label}{item.count ? ` (${item.count})` : ""}
          </button>
        ))}
      </div>

      {!panel && !offline && <p className={p.loading}>Cargando tus pedidos…</p>}

      {panel && activeTab === "assigned" && list(panel.assigned, "No tenés pedidos por retirar.", "mine")}
      {panel && activeTab === "transit" && list(panel.inTransit, "No tenés entregas en camino.", "mine")}
      {panel && activeTab === "open" && (
        panel.available
          ? list(panel.open, "No hay pedidos disponibles ahora.", "open")
          : <p className={s.empty}>Marcate como disponible para ver los pedidos que podés tomar{counts.open > 0 ? ` (hay ${counts.open})` : ""}.</p>
      )}

      {activeTab === "history" && (
        <>
          {!history && <p className={p.loading}>Cargando…</p>}
          {history && history.deliveries.length === 0 && <p className={s.empty}>Todavía no completaste entregas.</p>}
          {history?.deliveries.map(order => (
            <CourierOrderCard
              key={order.id}
              order={order}
              mode="history"
              now={now}
              busy={false}
              disabled
              notice={null}
              onPickup={pickup}
              onClaim={claim}
              onDeliver={deliver}
            />
          ))}
          {history && history.total > history.pageSize && (
            <div className={p.pager}>
              <button type="button" className={`${p.btn} ${p.small}`} disabled={historyPage <= 1} onClick={() => setHistoryPage(prev => prev - 1)}>Anterior</button>
              <span>Página {historyPage} de {Math.max(1, Math.ceil(history.total / history.pageSize))}</span>
              <button type="button" className={`${p.btn} ${p.small}`} disabled={historyPage >= Math.ceil(history.total / history.pageSize)} onClick={() => setHistoryPage(prev => prev + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
