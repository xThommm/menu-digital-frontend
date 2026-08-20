import { Link } from "react-router-dom";

export default function FreePlanAd() {
  return (
    <aside className="t-free-plan-ad" aria-label="Publicidad de Menú Digital">
      <div className="t-free-plan-ad-content">
        <span className="t-free-plan-ad-logo" aria-hidden>M</span>
        <div className="t-free-plan-ad-copy">
          <span className="t-free-plan-ad-brand">Menú Digital</span>
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
