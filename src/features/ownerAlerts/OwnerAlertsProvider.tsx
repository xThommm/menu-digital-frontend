import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { isSubscriptionExpired } from "../../lib/plans";
import { isAudioLocked, onAudioStateChange, playAlert, unlockAudio } from "../orders/lib/beep";
import { readJson, writeJson } from "../orders/lib/storage";
import { ownerHello } from "../orders/hooks/useLiveRefresh";
import { useOrdersSocket } from "../orders/hooks/useOrdersSocket";
import { useReservationSocket } from "../reservations/hooks/useReservationSocket";
import { OwnerAlertsContext, type OwnerAlert, type OwnerAlertsValue } from "./OwnerAlertsContext";
import s from "./OwnerAlerts.module.css";

// Avisos propios del panel del dueño, en TODAS sus pantallas (no solo en
// Pedidos o Reservas): cuando llega un pedido del comensal, se abre una mesa o
// entra una reserva desde la web, suena y aparece una tarjeta con el detalle,
// que queda hasta que la cierran. No son push: quien trabaja en el local tiene
// el panel abierto (aunque sea en otra pestaña).
//
// - Escucha los WebSocket de pedidos y de reservas: el servidor manda el
//   aviso ya armado (`alert`).
// - Las pantallas de Pedidos y Reservas también avisan lo nuevo que ven al
//   consultar (por si el socket estaba caído): el mismo hecho suena una vez.

const SOUND_KEY = "md:orders:sound";
// Un hecho ya avisado no se repite durante este tiempo.
const DEDUPE_MS = 30 * 60_000;
const MAX_CARDS = 4;

interface Card extends OwnerAlert {
  id: number;
}

const isSafePath = (path: unknown): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//");

const audioLockedSnapshot = () => isAudioLocked();

export default function OwnerAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const dismiss = useCallback((id: number) => {
    setCards(prev => prev.filter(card => card.id !== id));
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
    // Quedan hasta que las cierran; si se juntan muchas, se va la más vieja.
    setCards(prev => [...prev.slice(-(MAX_CARDS - 1)), { ...alert, id }]);
  }, []);

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

  // ── Audio bloqueado por el navegador (nadie tocó la página todavía) ──
  const audioLocked = useSyncExternalStore(onAudioStateChange, audioLockedSnapshot, () => false);

  const value = useMemo<OwnerAlertsValue>(() => ({ soundOn, setSoundOn, announce }), [announce, setSoundOn, soundOn]);

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
