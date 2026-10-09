import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useOrderTracking, type OrderTrackingState } from "../../hooks/useOrderTracking";
import {
  estimateSentence, estimateWindow, forgetTrackedOrder, isTrackingActive, readTrackedOrder, TRACKING_STEPS, trackingView,
} from "../../lib/orderTracking";
import s from "./OnlineCheckout.module.css";

// Seguimiento del pedido que el cliente pagó online: estado actual, etapas y
// el tiempo estimado que cargó el local ("Tu pedido estará listo entre 10 y 25
// minutos"). Se abre al volver de Mercado Pago o desde el aviso que queda en
// la carta mientras el pedido sigue en marcha.

interface ModalProps {
  state: OrderTrackingState;
  onClose: () => void;
}

export function TrackingModal({ state, onClose }: ModalProps) {
  const { status, gaveUp } = state;
  const view = trackingView(status, gaveUp);
  const approved = status !== null && ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(status.status);
  const steps = status?.serviceType ? TRACKING_STEPS[status.serviceType] : null;

  // La frase del tiempo estimado se muestra hasta que el pedido está listo.
  const waitingFood = approved && (status.orderStatus === null || status.orderStatus === "pending" || status.orderStatus === "confirmed");
  const sentence = waitingFood ? estimateSentence(status.estimate) : null;
  const windowText = waitingFood && status.estimate && status.orderStatus === "confirmed" && status.confirmedAt
    ? estimateWindow(status.estimate, status.confirmedAt)
    : null;

  return (
    <div className={s.returnOverlay} role="dialog" aria-modal="true" aria-label="Seguimiento de tu pedido" onClick={onClose}>
      <div className={s.returnCard} onClick={event => event.stopPropagation()}>
        {approved && status.orderNumber ? <span className={s.returnNumber}>#{status.orderNumber}</span> : null}
        <h2 className={s.returnTitle}>{view.title}</h2>
        <p className={s.returnText}>{view.text}</p>

        {sentence && (
          <p className={s.eta}>
            {sentence}
            {windowText && <span className={s.etaWindow}>Aproximadamente entre las {windowText}</span>}
          </p>
        )}

        {approved && steps && view.step >= 0 && (
          <ol className={s.steps} aria-label="Etapas del pedido">
            {steps.map((label, index) => (
              <li
                key={label}
                className={`${s.stepItem} ${index < view.step ? s.stepDone : ""} ${index === view.step ? s.stepCurrent : ""}`}
                aria-current={index === view.step ? "step" : undefined}
              >
                {label}
              </li>
            ))}
          </ol>
        )}

        <button type="button" className={s.mpBtn} style={{ alignSelf: "stretch", marginTop: "0.6rem" }} onClick={onClose}>
          {approved ? "Listo" : "Cerrar"}
        </button>
      </div>
    </div>
  );
}

// Aviso flotante para volver al pedido en curso (por ejemplo, tras cerrar la
// pestaña). Desaparece solo cuando el pedido se entrega o se cancela.
export function TrackedOrderBanner({ slug }: { slug: string }) {
  const [reference, setReference] = useState<string | null>(() => readTrackedOrder(slug));
  const [open, setOpen] = useState(false);
  const state = useOrderTracking(slug, reference);
  const { status, missing } = state;
  // Con la pantalla de retorno abierta (?pago=) el aviso sobra.
  const [params] = useSearchParams();

  const finished = missing || (status !== null && !isTrackingActive(status));
  useEffect(() => {
    if (!finished) return;
    forgetTrackedOrder(slug);
    const timer = setTimeout(() => { setOpen(false); setReference(null); }, 0);
    return () => clearTimeout(timer);
  }, [finished, slug]);

  if (params.has("pago") || !reference || !status || finished || status.status === "PENDING") return null;

  const view = trackingView(status, false);
  return (
    <>
      <button type="button" className={s.trackPill} onClick={() => setOpen(true)}>
        <strong>Tu pedido{status.orderNumber ? ` #${status.orderNumber}` : ""}</strong>
        <span>{view.title}</span>
      </button>
      {open && <TrackingModal state={state} onClose={() => setOpen(false)} />}
    </>
  );
}
