import type { CSSProperties } from "react";
import { useOwnerAlerts } from "./useOwnerAlerts";
import type { OwnerPushFeature } from "./OwnerAlertsContext";
import p from "../orders/components/panel/panel.module.css";

const COPY: Record<OwnerPushFeature, { what: string; label: string }> = {
  orders: { what: "Cuando llega un pedido o se abre una mesa.", label: "pedidos y mesas" },
  reservations: { what: "Cuando entra una reserva desde la web.", label: "reservas" },
};

// Configuración de los avisos en ESTE dispositivo: sonido con el panel
// abierto (compartido por todo el panel) y push del feature de esta pantalla,
// que viene desactivada hasta que el dueño la activa.
export default function OwnerAlertsCard({ feature, style }: { feature: OwnerPushFeature; style?: CSSProperties }) {
  const { soundOn, setSoundOn, push } = useOwnerAlerts();
  const pushReady = push.status === "ready";
  const active = push.features.includes(feature);
  const copy = COPY[feature];

  return (
    <section className={p.card} style={style}>
      <h2 className={p.cardTitle}>Avisos en este dispositivo</h2>
      <p className={p.cardDesc}>
        {copy.what} Se configura en cada dispositivo (computadora del mostrador, tu celular…).
      </p>

      <div className={p.switchRow}>
        <div className={p.switchText}>
          <span className={p.switchTitle}>Sonido con el panel abierto</span>
          <span className={p.switchHint}>
            Suena en cualquier pantalla del panel, aunque esté en otra pestaña. Si el navegador lo pide, tocá una vez la página
            para habilitar el sonido.
          </span>
        </div>
        <input
          type="checkbox"
          className={p.switch}
          checked={soundOn}
          onChange={e => setSoundOn(e.target.checked)}
          aria-label="Sonido con el panel abierto"
        />
      </div>

      <div className={p.switchRow}>
        <div className={p.switchText}>
          <span className={p.switchTitle}>Notificaciones con el panel cerrado</span>
          <span className={p.switchHint}>
            {push.status === "loading"
              ? "Consultando…"
              : push.help ?? (active
                ? `Activadas: los avisos de ${copy.label} te llegan como notificación del sistema, con el panel cerrado o el celular bloqueado.`
                : `Desactivadas. Activalas para recibir los avisos de ${copy.label} aunque no tengas el panel abierto.`)}
          </span>
        </div>
        <input
          type="checkbox"
          className={p.switch}
          checked={active}
          disabled={!pushReady || push.busy}
          onChange={() => void push.toggle(feature)}
          aria-label="Notificaciones con el panel cerrado"
        />
      </div>

      {active && (
        <button type="button" className={`${p.btn} ${p.small}`} onClick={() => void push.sendTest()} style={{ marginTop: "0.75rem" }}>
          Enviar aviso de prueba
        </button>
      )}
    </section>
  );
}
