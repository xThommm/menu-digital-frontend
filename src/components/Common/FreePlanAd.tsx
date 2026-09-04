import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import BrandMark from "./BrandMark";

// Sticky en top:0, igual que el header propio de UserMenu (.mpSticky) — sin
// coordinación, ambos terminan en el mismo lugar y el banner (z-index más
// alto) tapa el header entero al scrollear. En vez de hardcodear su altura
// (cambia entre mobile/desktop, ver el media query de .t-free-plan-ad), la
// medimos acá y la publicamos como variable CSS global: cualquier sticky
// que la necesite hace `top: var(--free-ad-h, 0px)` sin acoplarse a este
// componente. Se resetea a 0px al desmontar (plan pago, sin_publicidad).
const AD_HEIGHT_VAR = "--free-ad-h";

export default function FreePlanAd() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    // No usar entries[0].contentRect: excluye padding y borde, y el resto
    // de la página necesita el alto visual completo (border-box) del
    // banner para saber cuánto lugar dejarle arriba. getBoundingClientRect
    // ya da eso — el ResizeObserver solo dispara el recálculo.
    const ro = new ResizeObserver(() => {
      root.setProperty(AD_HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.setProperty(AD_HEIGHT_VAR, "0px");
    };
  }, []);

  return (
    <aside ref={ref} className="t-free-plan-ad" aria-label="Publicidad de Menú Digital">
      <div className="t-free-plan-ad-content">
        <BrandMark className="t-free-plan-ad-logo" />

        <div className="t-free-plan-ad-copy">
          <div className="t-free-plan-ad-top">
            <span className="t-free-plan-ad-brand">Menú Digital</span>
            <span className="t-free-plan-ad-badge">Gratis</span>
          </div>

          <strong className="t-free-plan-ad-title">
            ¿Querés una carta digital como esta?
          </strong>

          <span className="t-free-plan-ad-text">
            Creala en minutos y compartila con tus clientes.
          </span>
        </div>
      </div>

      <Link className="t-free-plan-ad-link" to="/">
        Crear mi menú gratis
        <span className="t-free-plan-ad-arrow" aria-hidden>→</span>
      </Link>
    </aside>
  );
}