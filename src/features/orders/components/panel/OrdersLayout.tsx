import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList, History, LayoutGrid, Settings, Users, Wallet } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import { isSubscriptionExpired } from "../../../../lib/plans";
import BrandMark from "../../../../components/Common/BrandMark";
// Mismo sidebar que el panel principal (DashboardLayout): se reusan sus estilos.
import s from "../../../../components/User/Panel/DashboardLayout/DashboardLayout.module.css";
import p from "./panel.module.css";

// Sección "Gestión de pedidos" del panel del dueño, con su propia barra
// lateral. Exclusiva del plan Pro (el backend también lo exige).

const NAV_ITEMS = [
  { path: "/pedidos", label: "Panel de pedidos", short: "Pedidos", icon: <ClipboardList size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/mesas", label: "Mesas", short: "Mesas", icon: <LayoutGrid size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/historial", label: "Historial", short: "Historial", icon: <History size={20} strokeWidth={1.5} aria-hidden /> },
  // "Equipo" en el dock del celular: "Operadores" no entra en la celda.
  { path: "/pedidos/operadores", label: "Operadores", short: "Equipo", icon: <Users size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/caja", label: "Caja y turnos", short: "Caja", icon: <Wallet size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/configuracion", label: "Configuración de pedidos", short: "Config", icon: <Settings size={20} strokeWidth={1.5} aria-hidden /> },
];

export default function OrdersLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const expired = user ? isSubscriptionExpired(user.subscription, user.subscriptionExpiresAt, user.subscriptionStatus) : true;
  const isPro = !expired && user?.subscription === "pro";

  return (
    <div className={s.layoutRoot}>
      <aside className={s.sidebar} aria-label="Gestión de pedidos">
        <button
          type="button"
          className={s.logoSq}
          onClick={() => navigate("/dashboard")}
          aria-label="Volver al panel"
          style={{ border: "none", background: "none", padding: 0 }}
        >
          <BrandMark className={s.brandMarkImage} />
        </button>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                className={`${s.sideBtn} ${active ? s.sideBtnActive : ""}`}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                data-tooltip={item.label}
              >
                {item.icon}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          className={`${s.sideBtn} ${s.sideLogout}`}
          onClick={() => navigate("/dashboard")}
          aria-label="Volver al panel"
          data-tooltip="Volver al panel"
        >
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden />
        </button>
      </aside>

      <div className={`${s.content} admin-layout-content`}>
        {isPro ? <Outlet /> : <ProLock onBack={() => navigate("/dashboard")} />}
      </div>

      <nav className="admin-mobile-dock md-surface" aria-label="Gestión de pedidos">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              type="button"
              key={item.path}
              className={`admin-mobile-dock__button ${active ? "admin-mobile-dock__button--active md-button" : ""}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="admin-mobile-dock__icon">{item.icon}</span>
              {item.short}
            </button>
          );
        })}
        <button
          type="button"
          className="admin-mobile-dock__button"
          onClick={() => navigate("/dashboard")}
          aria-label="Volver al panel"
        >
          <span className="admin-mobile-dock__icon"><ArrowLeft size={20} strokeWidth={1.5} aria-hidden /></span>
          Volver
        </button>
      </nav>
    </div>
  );
}

function ProLock({ onBack }: { onBack: () => void }) {
  return (
    <div className={p.page}>
      <div className={p.card} style={{ maxWidth: 480, margin: "3rem auto", textAlign: "center" }}>
        <h1 className={p.title}>Gestión de pedidos</h1>
        <p className={p.subtitle} style={{ margin: "0.75rem 0 1.25rem", lineHeight: 1.55 }}>
          Recibí pedidos desde las mesas, organizá a tu equipo y cerrá la caja de cada turno.
          Esta función está disponible en el plan Pro.
        </p>
        <button type="button" className={p.btnPrimary} onClick={onBack}>Ver planes en el panel</button>
      </div>
    </div>
  );
}
