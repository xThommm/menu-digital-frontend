import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCart } from "../../../../context/useCart";
import { getOnlineCheckoutStatus } from "../../api/publicOrdersApi";
import type { OnlineCheckoutStatus } from "../../types";
import s from "./OnlineCheckout.module.css";

// Pantalla a la que vuelve el cliente desde Mercado Pago (?pago=<ref>). El
// resultado se pregunta SIEMPRE al servidor: la URL de retorno sola no prueba
// que se haya pagado. Mientras el pago se confirma se vuelve a consultar.

const POLL_MS = 3000;
const MAX_POLLS = 20;
const REF_RE = /^[0-9a-f]{48}$/;

export default function OnlinePaymentReturn({ slug }: { slug: string }) {
  const [params, setParams] = useSearchParams();
  const ref = params.get("pago");
  const valid = ref !== null && REF_RE.test(ref);
  const { clearCart } = useCart();
  const [status, setStatus] = useState<OnlineCheckoutStatus | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const cleared = useRef(false);

  useEffect(() => {
    if (!valid || !ref) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const retry = () => {
      polls += 1;
      if (polls >= MAX_POLLS) setGaveUp(true);
      else timer = setTimeout(check, POLL_MS);
    };

    const check = async () => {
      try {
        const result = await getOnlineCheckoutStatus(slug, ref);
        if (cancelled) return;
        setStatus(result);
        if (result.status === "PENDING" && !result.expired) retry();
      } catch {
        if (!cancelled) retry();
      }
    };
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [valid, ref, slug]);

  // Pagado: el carrito ya se convirtió en pedido, se vacía (una sola vez).
  const approved = status?.status === "APPROVED" || status?.status === "PARTIALLY_REFUNDED" || status?.status === "REFUNDED";
  useEffect(() => {
    if (approved && !cleared.current) {
      cleared.current = true;
      clearCart();
    }
  }, [approved, clearCart]);

  if (!valid) return null;

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("pago");
    setParams(next, { replace: true });
  };

  let title = "Estamos confirmando tu pago";
  let text = "Esto puede tardar unos segundos. No cierres esta pantalla.";
  if (approved) {
    title = "¡Pago aprobado!";
    text = status?.orderNumber
      ? "Tu pedido ya le llegó al local. Te van a contactar al teléfono que dejaste si necesitan algo."
      : "Tu pago está acreditado. En un momento el pedido aparece en el local.";
  } else if (status?.status === "REJECTED") {
    title = "El pago no se completó";
    text = "No se realizó ningún cobro. Tu carrito sigue armado: podés intentar de nuevo o pedir por WhatsApp.";
  } else if (status?.expired) {
    title = "El pago venció";
    text = "No se realizó ningún cobro. Tu carrito sigue armado: podés intentar de nuevo.";
  } else if (gaveUp) {
    title = "Todavía no recibimos la confirmación";
    text = "Si ya pagaste, el pedido le llegará al local apenas Mercado Pago lo confirme. Si no, podés volver a intentar.";
  }

  return (
    <div className={s.returnOverlay} role="dialog" aria-modal="true" aria-label="Resultado del pago" onClick={close}>
      <div className={s.returnCard} onClick={event => event.stopPropagation()}>
        {approved && status?.orderNumber ? <span className={s.returnNumber}>#{status.orderNumber}</span> : null}
        <h2 className={s.returnTitle}>{title}</h2>
        <p className={s.returnText}>{text}</p>
        <button type="button" className={s.mpBtn} style={{ alignSelf: "stretch", marginTop: "0.6rem" }} onClick={close}>
          {approved ? "Listo" : "Cerrar"}
        </button>
      </div>
    </div>
  );
}
