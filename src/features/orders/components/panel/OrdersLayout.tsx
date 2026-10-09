import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChefHat, ClipboardList, MoreHorizontal, History, LayoutGrid, PanelLeft, Settings, Truck, Users, Wallet } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import { isSubscriptionExpired } from "../../../../lib/plans";
import { OWNER_SIDEBAR_COLLAPSED_KEY } from "../../../../lib/ownerSidebar";
import { useOrderSettings } from "../../hooks/usePanelData";
import { ORDERS_SETTINGS_CHANGED } from "../../lib/delivery";
import BrandMark from "../../../../components/Common/BrandMark";
import BrandWordmark from "../../../../components/Common/BrandWordmark";
// Mismo sidebar que el panel principal (DashboardLayout): se reusan sus estilos.
import s from "../../../../components/User/Panel/DashboardLayout/DashboardLayout.module.css";
import p from "./panel.module.css";

// Sección "Gestión de pedidos" del panel del dueño, con su propia barra
// lateral. Exclusiva del plan Pro (el backend también lo exige).

const BASE_NAV_ITEMS = [
  { path: "/pedidos", label: "Panel de pedidos", short: "Pedidos", icon: <ClipboardList size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/mesas", label: "Mesas", short: "Mesas", icon: <LayoutGrid size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/historial", label: "Historial", short: "Historial", icon: <History size={20} strokeWidth={1.5} aria-hidden /> },
  // "Equipo" en el dock del celular: "Operadores" no entra en la celda.
  { path: "/pedidos/operadores", label: "Operadores", short: "Equipo", icon: <Users size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/sectores", label: "Sectores y comandas", short: "Sectores", icon: <ChefHat size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/caja", label: "Caja y turnos", short: "Caja", icon: <Wallet size={20} strokeWidth={1.5} aria-hidden /> },
  { path: "/pedidos/configuracion", label: "Configuración de pedidos", short: "Config", icon: <Settings size={20} strokeWidth={1.5} aria-hidden /> },
];

// Delivery con repartidores: una sola entrada (con pestañas adentro) y solo si el local lo activó.
const DELIVERY_NAV_ITEMS = [
  { path: "/pedidos/delivery", label: "Delivery", short: "Delivery", icon: <Truck size={20} strokeWidth={1.5} aria-hidden /> },
];

// Delivery agrupa varias vistas: la entrada queda activa en todas.
const isActivePath = (pathname: string, itemPath: string) =>
  itemPath === "/pedidos/delivery" ? pathname.startsWith("/pedidos/delivery") : pathname === itemPath;

// Los primeros 4 van en el dock del celular; el resto en «Más».
const withDelivery = (enabled: boolean) => {
  if (!enabled) return BASE_NAV_ITEMS;
  const config = BASE_NAV_ITEMS[BASE_NAV_ITEMS.length - 1];
  return [...BASE_NAV_ITEMS.slice(0, -1), ...DELIVERY_NAV_ITEMS, config];
};

export default function OrdersLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const orderSettings = useOrderSettings();
  const { reload: reloadSettings } = orderSettings;
  const NAV_ITEMS = withDelivery(orderSettings.data?.settings.options.deliveryEnabled === true);
  const DOCK_ITEMS = NAV_ITEMS.slice(0, 4);
  const MORE_ITEMS = NAV_ITEMS.slice(4);
  const moreActive = MORE_ITEMS.some(item => isActivePath(location.pathname, item.path));

  // Al guardar la configuración se actualiza la barra lateral sin recargar.
  useEffect(() => {
    window.addEventListener(ORDERS_SETTINGS_CHANGED, reloadSettings);
    return () => window.removeEventListener(ORDERS_SETTINGS_CHANGED, reloadSettings);
  }, [reloadSettings]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(OWNER_SIDEBAR_COLLAPSED_KEY) === "true"
  );

  useEffect(() => {
    localStorage.setItem(OWNER_SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const expired = user ? isSubscriptionExpired(user.subscription, user.subscriptionExpiresAt, user.subscriptionStatus) : true;
  const isPro = !expired && user?.subscription === "pro";

  return (
    <div className={s.layoutRoot}>
      <aside
        id="orders-sidebar"
        className={`${s.sidebar} ${sidebarCollapsed ? s.sidebarCollapsed : ""}`}
        aria-label="Gestión de pedidos"
        inert={sidebarCollapsed}
      >
        <button type="button" className={s.brand} onClick={() => navigate("/dashboard")} aria-label="Volver al panel">
          <div className={s.logoSq} role="img" aria-label="menudigital">
            <BrandMark inline className={s.brandMarkImage} />
          </div>
          <div className={s.brandText}>
            <span className={s.brandName}><BrandWordmark /></span>
            <span className={s.brandSubtitle}>Gestión de pedidos</span>
          </div>
        </button>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => {
            const active = isActivePath(location.pathname, item.path);
            return (
              <button
                key={item.path}
                type="button"
                className={`${s.navItem} ${active ? s.navItemActive : ""}`}
                onClick={() => navigate(item.path)}
                aria-current={active ? "page" : undefined}
              >
                <span className={s.navIcon}>{item.icon}</span>
                <span className={s.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={s.sideFooter}>
          <button type="button" className={s.navItem} onClick={() => navigate("/dashboard")}>
            <span className={s.navIcon}><ArrowLeft size={20} strokeWidth={1.5} aria-hidden /></span>
            <span className={s.navLabel}>Volver al panel</span>
          </button>
        </div>
      </aside>

      {/* Toggle fijo fuera del <aside>, igual que en DashboardLayout.tsx. */}
      <button
        type="button"
        className={`${s.sidebarToggle} ${sidebarCollapsed ? s.sidebarToggleCollapsed : ""}`}
        onClick={() => setSidebarCollapsed(collapsed => !collapsed)}
        aria-expanded={!sidebarCollapsed}
        aria-controls="orders-sidebar"
        aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
        title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
      >
        <PanelLeft size={18} strokeWidth={1.75} />
      </button>

      <div className={`${s.content} admin-layout-content ${sidebarCollapsed ? s.contentExpanded : ""}`}>
        {isPro ? <Outlet /> : <ProLock onBack={() => navigate("/dashboard")} />}
      </div>

      {/* En el celular entran 4 accesos + "Más" (con 8 celdas los textos se pisaban). */}
      <nav className="admin-mobile-dock md-surface" aria-label="Gestión de pedidos">
        {DOCK_ITEMS.map(item => {
          const active = isActivePath(location.pathname, item.path);
          return (
            <button
              type="button"
              key={item.path}
              className={`admin-mobile-dock__button ${active ? "admin-mobile-dock__button--active md-button" : ""}`}
              onClick={() => { setMoreOpen(false); navigate(item.path); }}
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
          className={`admin-mobile-dock__button ${moreOpen || moreActive ? "admin-mobile-dock__button--active md-button" : ""}`}
          onClick={() => setMoreOpen(open => !open)}
          aria-label="Más opciones"
          aria-expanded={moreOpen}
          aria-controls="orders-mobile-more-menu"
        >
          <span className="admin-mobile-dock__icon"><MoreHorizontal size={20} strokeWidth={1.5} aria-hidden /></span>
          Más
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="admin-mobile-more-scrim"
            onClick={() => setMoreOpen(false)}
            tabIndex={-1}
            aria-label="Cerrar menú de opciones"
          />
          <div id="orders-mobile-more-menu" className="admin-mobile-more md-surface" role="group" aria-label="Más opciones">
            {MORE_ITEMS.map(item => (
              <button
                key={item.path}
                type="button"
                className="admin-mobile-more__item"
                aria-current={isActivePath(location.pathname, item.path) ? "page" : undefined}
                onClick={() => { setMoreOpen(false); navigate(item.path); }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="admin-mobile-more__item"
              onClick={() => { setMoreOpen(false); navigate("/dashboard"); }}
            >
              <ArrowLeft size={20} strokeWidth={1.5} aria-hidden />
              Volver al panel
            </button>
          </div>
        </>
      )}
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
