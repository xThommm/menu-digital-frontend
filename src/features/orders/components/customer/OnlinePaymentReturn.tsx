import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useCart } from "../../../../context/useCart";
import { useOrderTracking } from "../../hooks/useOrderTracking";
import { saveTrackedOrder } from "../../lib/orderTracking";
import { TrackingModal } from "./OrderTracking";

// Pantalla a la que vuelve el cliente desde Mercado Pago (?pago=<ref>). El
// resultado se pregunta SIEMPRE al servidor: la URL de retorno sola no prueba
// que se haya pagado. Una vez pagado, la misma pantalla sigue el pedido
// (confirmación, preparación, listo) y el navegador lo recuerda para poder
// volver a verlo (ver TrackedOrderBanner).

const REF_RE = /^[0-9a-f]{48}$/;

export default function OnlinePaymentReturn({ slug }: { slug: string }) {
  const [params, setParams] = useSearchParams();
  const ref = params.get("pago");
  const valid = ref !== null && REF_RE.test(ref);
  const { clearCart } = useCart();
  const state = useOrderTracking(slug, valid ? ref : null);
  const handled = useRef(false);

  // Pagado: el carrito ya se convirtió en pedido (se vacía una sola vez) y
  // queda guardado para seguirlo después.
  const approved = state.status !== null && ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(state.status.status);
  useEffect(() => {
    if (!approved || !valid || !ref || handled.current) return;
    handled.current = true;
    clearCart();
    saveTrackedOrder(slug, ref);
  }, [approved, valid, ref, slug, clearCart]);

  if (!valid) return null;

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("pago");
    setParams(next, { replace: true });
  };

  return <TrackingModal state={state} onClose={close} />;
}
