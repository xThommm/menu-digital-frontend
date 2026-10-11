import type { CSSProperties } from "react";
import { useOwnerAlerts } from "./useOwnerAlerts";
import type { OwnerAlertKind } from "./OwnerAlertsContext";
import { playAlert, unlockAudio } from "../orders/lib/beep";
import p from "../orders/components/panel/panel.module.css";

type Feature = "orders" | "reservations";

const COPY: Record<Feature, { what: string; sound: OwnerAlertKind }> = {
  orders: { what: "Cuando llega un pedido o se abre una mesa", sound: "order" },
  reservations: { what: "Cuando entra una reserva desde la web", sound: "reservation" },
};

// Avisos del panel en ESTE dispositivo. Son propios del panel (no push): con
// el panel abierto suenan y aparecen en cualquier pantalla, aunque la pestaña
// esté en segundo plano. El sonido es uno solo para todo el panel.
export default function OwnerAlertsCard({ feature, style }: { feature: Feature; style?: CSSProperties }) {
  const { soundOn, setSoundOn } = useOwnerAlerts();
  const copy = COPY[feature];

  const test = () => { void unlockAudio().then(() => playAlert(copy.sound)); };

  return (
    <section className={p.card} style={style}>
      <h2 className={p.cardTitle}>Avisos en el panel</h2>
      <p className={p.cardDesc}>
        {copy.what}, el panel muestra un aviso en cualquier pantalla. Dejá el panel abierto en la computadora o el
        celular del local (puede quedar en otra pestaña).
      </p>

      <div className={p.switchRow}>
        <div className={p.switchText}>
          <span className={p.switchTitle}>Sonido en este dispositivo</span>
          <span className={p.switchHint}>
            Si el navegador lo pide, tocá una vez la página para habilitar el sonido.
          </span>
        </div>
        <input
          type="checkbox"
          className={p.switch}
          checked={soundOn}
          onChange={e => setSoundOn(e.target.checked)}
          aria-label="Sonido de los avisos en este dispositivo"
        />
      </div>

      <button type="button" className={`${p.btn} ${p.small}`} onClick={test} style={{ marginTop: "0.75rem" }}>
        Probar sonido
      </button>
    </section>
  );
}
