import type { CSSProperties } from "react";
import { useOwnerAlerts } from "./useOwnerAlerts";
import p from "../orders/components/panel/panel.module.css";

// Configuración de los avisos en ESTE dispositivo: sonido con el panel
// abierto y push (notificación del sistema) con el panel cerrado.
export default function OwnerAlertsCard({ style }: { style?: CSSProperties }) {
  const { soundOn, setSoundOn, push } = useOwnerAlerts();
  const pushReady = push.status === "ready";

  return (
    <section className={p.card} style={style}>
      <h2 className={p.cardTitle}>Avisos en este dispositivo</h2>
      <p className={p.cardDesc}>
        Cuando llega un pedido, se abre una mesa o entra una reserva desde la web. Se configura en cada
        dispositivo (computadora del mostrador, tu celular…).
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
              : push.help ?? (push.active
                ? "Activadas: te llegan como notificación del sistema, con el panel cerrado o el celular bloqueado."
                : "Recibí los avisos como notificación del sistema aunque no tengas el panel abierto.")}
          </span>
        </div>
        <input
          type="checkbox"
          className={p.switch}
          checked={push.active}
          disabled={!pushReady || push.busy}
          onChange={() => void push.toggle()}
          aria-label="Notificaciones con el panel cerrado"
        />
      </div>

      {push.active && (
        <button type="button" className={`${p.btn} ${p.small}`} onClick={() => void push.sendTest()} style={{ marginTop: "0.75rem" }}>
          Enviar aviso de prueba
        </button>
      )}
    </section>
  );
}
