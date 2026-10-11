import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { isSubscriptionExpired } from "../../lib/plans";
import { describeTestResult, PUSH_STATUS_HELP, type AdminPushStatus } from "../../lib/pushDevices";
import { getOwnerPushStatus, sendOwnerPushTest } from "../../api/ownerPush";
import { isAudioLocked, onAudioStateChange, playAlert, unlockAudio } from "../orders/lib/beep";
import { readJson, writeJson } from "../orders/lib/storage";
import { ownerHello } from "../orders/hooks/useLiveRefresh";
import { useOrdersSocket } from "../orders/hooks/useOrdersSocket";
import { useReservationSocket } from "../reservations/hooks/useReservationSocket";
import { OwnerAlertsContext, type OwnerAlert, type OwnerAlertsValue } from "./OwnerAlertsContext";
import s from "./OwnerAlerts.module.css";

// Avisos del panel del dueño, en TODAS sus pantallas (no solo en Pedidos o
// Reservas): cuando llega un pedido del comensal, se abre una mesa o entra
// una reserva desde la web, suena y aparece una tarjeta con el detalle.
//
// - Escucha los WebSocket de pedidos y de reservas: el servidor manda el
//   aviso ya armado (`alert`), el mismo texto que la push.
// - Las pantallas de Pedidos y Reservas también avisan lo nuevo que ven al
//   consultar (por si el socket estaba caído): el mismo hecho suena una vez.
// - Push (Firebase): con el panel cerrado o el celular bloqueado avisa el
//   sistema. Se activa por dispositivo.

const SOUND_KEY = "md:orders:sound";
// Un hecho ya avisado no se repite durante este tiempo.
const DEDUPE_MS = 30 * 60_000;
const CARD_MS = 30_000;
const MAX_CARDS = 4;

interface Card extends OwnerAlert {
  id: number;
}

const describePushError = (err: unknown): string => {
  const e = err as { code?: string; name?: string; message?: string; response?: { status?: number } };
  if (e?.response?.status) return `el servidor respondió ${e.response.status}`;
  if (e?.name === "AbortError" || e?.message?.includes("push service error")) {
    return "el navegador no tiene habilitado el servicio de push";
  }
  return e?.code || e?.message || "error desconocido";
};

const isSafePath = (path: unknown): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//");

const audioLockedSnapshot = () => isAudioLocked();

// Firebase pesa: se carga recién cuando hace falta, no con la app.
const loadPushLib = () => import("../../lib/ownerPush");

export default function OwnerAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error, info } = useNotifications();
  const expired = user ? isSubscriptionExpired(user.subscription, user.subscriptionExpiresAt, user.subscriptionStatus) : true;
  // Pedidos y reservas son del plan Pro: con otro plan no hay nada que avisar.
  const enabled = !expired && user?.subscription === "pro";

  const [soundOn, setSoundState] = useState(() => readJson(SOUND_KEY, (v): v is boolean => typeof v === "boolean") ?? true);
  const soundRef = useRef(soundOn);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  const setSoundOn = useCallback((on: boolean) => {
    setSoundState(on);
    writeJson(SOUND_KEY, on);
    if (on) void unlockAudio().then(() => playAlert("default"));
  }, []);

  // ── Tarjetas de aviso ──
  const [cards, setCards] = useState<Card[]>([]);
  const nextId = useRef(1);
  const seen = useRef(new Map<string, number>());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setCards(prev => prev.filter(card => card.id !== id));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(timer => clearTimeout(timer));
  }, []);

  const announce = useCallback((alert: OwnerAlert) => {
    const now = Date.now();
    for (const [key, at] of seen.current) if (now - at > DEDUPE_MS) seen.current.delete(key);
    const orderKey = alert.orderId != null ? `order-id:${alert.orderId}` : null;
    if (seen.current.has(alert.key) || (orderKey && seen.current.has(orderKey))) return;
    seen.current.set(alert.key, now);
    if (orderKey) seen.current.set(orderKey, now);

    if (soundRef.current) playAlert(alert.kind);

    const id = nextId.current++;
    setCards(prev => [...prev.slice(-(MAX_CARDS - 1)), { ...alert, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), CARD_MS));
  }, [dismiss]);

  // ── Tiempo real ──
  const hello = enabled ? ownerHello() : null;
  useOrdersSocket({
    enabled: enabled && !!hello,
    hello,
    onMessage: message => {
      if (message.type === "delivery" && message.alert) announce(message.alert);
    },
  });

  const token = hello && "token" in hello ? hello.token : null;
  const reservationsHello = useMemo(() => (token ? { type: "auth" as const, token } : null), [token]);
  useReservationSocket({
    enabled: enabled && !!reservationsHello,
    hello: reservationsHello,
    onMessage: message => {
      if (message.type === "reservation" && message.alert) announce(message.alert);
    },
  });

  // Click en una push con el panel abierto: el service worker pasa la ruta.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      const path = event.data?.path;
      if (event.data?.type === "owner-notification-open" && isSafePath(path)) navigate(path);
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.startMessages();
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [navigate]);

  // ── Audio bloqueado por el navegador (nadie tocó la página todavía) ──
  const audioLocked = useSyncExternalStore(onAudioStateChange, audioLockedSnapshot, () => false);

  // ── Push en este dispositivo ──
  const [pushStatus, setPushStatus] = useState<AdminPushStatus>("loading");
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async (): Promise<{ status: AdminPushStatus; active: boolean }> => {
      const lib = await loadPushLib();
      if (!lib.isPushConfigured()) return { status: "not-configured", active: false };
      const blocker = await lib.getPushBlocker();
      if (blocker !== "ready") return { status: blocker, active: false };
      const server = await getOwnerPushStatus();
      if (!server.enabled) return { status: "server-off", active: false };
      const active = lib.isOwnerPushActive();
      // Firebase rota los tokens: se vuelve a mandar el vigente.
      if (active) void lib.refreshOwnerPushToken().catch(() => undefined);
      return { status: "ready", active };
    };
    load()
      .then(next => {
        if (cancelled) return;
        setPushStatus(next.status);
        setPushActive(next.active);
      })
      .catch(() => { if (!cancelled) setPushStatus("error"); });
    return () => { cancelled = true; };
  }, [enabled, user?.id]);

  const togglePush = useCallback(async () => {
    if (pushBusy) return;
    if (pushStatus !== "ready") {
      if (pushStatus !== "loading") info(PUSH_STATUS_HELP[pushStatus]);
      return;
    }
    setPushBusy(true);
    try {
      const lib = await loadPushLib();
      if (pushActive) {
        await lib.disableOwnerPush();
        setPushActive(false);
        info("Avisos desactivados en este dispositivo");
        return;
      }
      const permission = await lib.enableOwnerPush();
      if (permission === "granted") {
        setPushActive(true);
        success("Listo: este dispositivo va a recibir los avisos aunque el panel esté cerrado");
      } else if (permission === "denied") {
        error("El navegador bloqueó las notificaciones. Habilitalas desde la configuración del sitio.");
      }
    } catch (err) {
      console.error("No se pudieron activar los avisos push:", err);
      error(`No se pudieron activar los avisos: ${describePushError(err)}`);
    } finally {
      setPushBusy(false);
    }
  }, [error, info, pushActive, pushBusy, pushStatus, success]);

  const sendTest = useCallback(async () => {
    try {
      const result = describeTestResult(await sendOwnerPushTest());
      if (result.ok) info(result.message);
      else error(result.message);
    } catch (err) {
      error(`No se pudo enviar el aviso de prueba: ${describePushError(err)}`);
    }
  }, [error, info]);

  const value = useMemo<OwnerAlertsValue>(() => ({
    soundOn,
    setSoundOn,
    announce,
    push: {
      status: pushStatus,
      active: pushActive,
      busy: pushBusy,
      help: pushStatus === "ready" || pushStatus === "loading" ? null : PUSH_STATUS_HELP[pushStatus],
      toggle: togglePush,
      sendTest,
    },
  }), [announce, pushActive, pushBusy, pushStatus, sendTest, setSoundOn, soundOn, togglePush]);

  return (
    <OwnerAlertsContext.Provider value={value}>
      {children}

      {enabled && (
        <div className={s.stack} aria-live="assertive" aria-atomic="false">
          {soundOn && audioLocked && (
            <button type="button" className={s.unlock} onClick={() => void unlockAudio()}>
              <BellRing size={16} aria-hidden />
              Tocá acá para activar el sonido de los avisos
            </button>
          )}
          {cards.map(card => (
            <div key={card.id} className={`${s.card} ${s[card.kind]}`} role="alert">
              <div className={s.text}>
                <strong className={s.title}>{card.title}</strong>
                {card.body && <span className={s.body}>{card.body}</span>}
              </div>
              <div className={s.actions}>
                {card.url && (
                  <button
                    type="button"
                    className={s.view}
                    onClick={() => { dismiss(card.id); if (isSafePath(card.url)) navigate(card.url); }}
                  >
                    Ver
                  </button>
                )}
                <button type="button" className={s.close} onClick={() => dismiss(card.id)} aria-label="Cerrar aviso">
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </OwnerAlertsContext.Provider>
  );
}
