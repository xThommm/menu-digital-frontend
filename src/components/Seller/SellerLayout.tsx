import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { usePanelPreferences } from "../../hooks/usePanelPreferences";
import PanelAppearanceDialog from "../User/Panel/PanelAppearance/PanelAppearanceDialog";
import { useCrmAlerts } from "../../hooks/useCrmAlerts";
import BrandMark from "../Common/BrandMark";
import BrandWordmark from "../Common/BrandWordmark";
import AdminLayout from "../Admin/Panel/AdminLayout";
import s from "./SellerLayout.module.css";
import {
  Calculator,
  LayoutPanelLeft,
  LogOut,
  MoreHorizontal,
  Palette,
  PanelLeft,
  Settings,
  Users,
} from "lucide-react";

// Preferencia de sidebar colapsada (separada de la del admin)
const SIDEBAR_COLLAPSED_KEY = "seller-sidebar-collapsed";

// Mismo orden y nombres que el submenú "Vendedores" del panel CEO
// (SELLERS_SUB_ITEMS en AdminLayout.tsx), sin Ranking: es exclusivo admin.
const SELLER_NAV_ITEMS = [
  { path: "/sellers", label: "Panel general", short: "Panel", icon: <LayoutPanelLeft size={20} strokeWidth={1.5} /> },
  { path: "/sellers/simulacion", label: "Simulación de ventas", short: "Simular", icon: <Calculator size={20} strokeWidth={1.5} /> },
  { path: "/sellers/crm", label: "CRM", short: "CRM", icon: <Users size={20} strokeWidth={1.5} /> },
  { path: "/sellers/configuracion", label: "Configuración", short: "Config.", icon: <Settings size={20} strokeWidth={1.5} /> },
];

const INFLUENCER_NAV_ITEMS = [
  { path: "/sellers/influencer", label: "Mis referidos", short: "Referidos", icon: <Users size={20} strokeWidth={1.5} /> },
];

// El admin también entra a /sellers/* (CRM, ranking, simulación), pero lo ve
// dentro de su propio layout: no cambia de barra al pasar del panel CEO acá.
export default function SellerLayout() {
  const { user } = useAuth();
  return user?.role === "admin" ? <AdminLayout /> : <SellerPanelLayout />;
}

function SellerPanelLayout() {
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { preferences, setAccent, setFontSize, reset: resetPreferences } = usePanelPreferences();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const closeAppearance = useCallback(() => setAppearanceOpen(false), []);
  const navigate = useNavigate();
  const location = useLocation();
  const isInfluencer = user?.role === "seller" && user.influencer === true;
  const NAV_ITEMS = isInfluencer ? INFLUENCER_NAV_ITEMS : SELLER_NAV_ITEMS;
  // Badge del ítem "CRM": seguimientos vencidos + leads nuevos asignados
  // (0 para un influencer, que ni siquiera ve ese ítem).
  const { overdueFollowUps, newAssignments } = useCrmAlerts();
  const crmAlertCount = overdueFollowUps + newAssignments;

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileMoreActionRef = useRef<HTMLButtonElement>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileMoreOpen) return;

    firstMobileMoreActionRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMoreOpen(false);
        mobileMoreButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMoreOpen]);

  const handleLogout = useCallback(() => {
    setMobileMoreOpen(false);
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const goToOwnPanel = useCallback(() => {
    navigate(isInfluencer ? "/sellers/influencer" : "/sellers");
  }, [navigate, isInfluencer]);

  return (
    <div className={`${s.layoutRoot} seller-panel`} data-theme-area="panel">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside
        id="seller-sidebar"
        className={`${s.sidebar} ${sidebarCollapsed ? s.sidebarCollapsed : ""}`}
        aria-label={isInfluencer ? "Navegación del panel de influencer" : "Navegación del panel de vendedor"}
        inert={sidebarCollapsed}
      >
        <button type="button" className={s.brand} onClick={goToOwnPanel} aria-label="Ir al panel general">
          <div className={s.logoSq} role="img" aria-label="menudigital">
            <BrandMark inline className={s.brandMarkImage} />
          </div>
          <div className={s.brandText}>
            <span className={s.brandName}>
              <BrandWordmark />
            </span>
            <span className={s.brandSubtitle}>{user?.name}</span>
          </div>
        </button>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`${s.navItem} ${active ? s.navItemActive : ""}`}
                onClick={() => navigate(item.path)}
                aria-label={item.path === "/sellers/crm" && crmAlertCount > 0
                  ? `${item.label} (${crmAlertCount} alertas)`
                  : item.label}
                aria-current={active ? "page" : undefined}
              >
                <span className={s.navIcon}>{item.icon}</span>
                <span className={s.navLabel}>{item.label}</span>
                {item.path === "/sellers/crm" && crmAlertCount > 0 && (
                  <span className={s.navBadge}>{crmAlertCount > 99 ? "99+" : crmAlertCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={s.sideFooter}>
          <button
            className={s.navItem}
            onClick={() => setAppearanceOpen(true)}
            aria-haspopup="dialog"
          >
            <span className={s.navIcon}><Palette size={20} strokeWidth={1.5} aria-hidden /></span>
            <span className={s.navLabel}>Apariencia</span>
          </button>

          <button
            className={`${s.navItem} ${s.navItemDanger}`}
            onClick={handleLogout}
            aria-label="Cerrar sesión"
          >
            <span className={s.navIcon}>
              <LogOut size={20} strokeWidth={1.5} />
            </span>
            <span className={s.navLabel}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Toggle de sidebar — mismo estilo y comportamiento que AdminLayout.tsx
          (botón fijo fuera del <aside>, salta a la esquina superior
          izquierda cuando la sidebar está colapsada). */}
      <button
        type="button"
        className={`${s.sidebarToggle} ${sidebarCollapsed ? s.sidebarToggleCollapsed : ""}`}
        onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        aria-expanded={!sidebarCollapsed}
        aria-controls="seller-sidebar"
        aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
        title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
      >
        <PanelLeft size={18} strokeWidth={1.75} />
      </button>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      {/* admin-layout-content: mismo dock móvil compartido que el panel CEO y
          el de usuario — sin esta clase, el padding-bottom que le reserva
          espacio al dock fijo nunca se aplica acá, y el menú tapa lo último
          de cada página en mobile. */}
      <div className={`${s.content} admin-layout-content ${sidebarCollapsed ? s.contentExpanded : ""}`}>
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="admin-mobile-dock md-surface" aria-label={isInfluencer ? "Navegación del panel de influencer" : "Navegación del panel de vendedor"}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              type="button"
              key={item.path}
              className={`admin-mobile-dock__button ${active ? "admin-mobile-dock__button--active md-button" : ""}`}
              onClick={() => {
                setMobileMoreOpen(false);
                navigate(item.path);
              }}
              aria-label={item.path === "/sellers/crm" && crmAlertCount > 0
                ? `${item.label} (${crmAlertCount} alertas)`
                : item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="admin-mobile-dock__icon">
                {item.icon}
                {item.path === "/sellers/crm" && crmAlertCount > 0 && (
                  <span className={s.navBadgeDot}>{crmAlertCount > 9 ? "9+" : crmAlertCount}</span>
                )}
              </span>
              {item.short}
            </button>
          );
        })}

        <button
          ref={mobileMoreButtonRef}
          type="button"
          className={`admin-mobile-dock__button ${mobileMoreOpen ? "admin-mobile-dock__button--active md-button" : ""}`}
          onClick={() => setMobileMoreOpen((open) => !open)}
          aria-label="Más opciones"
          aria-expanded={mobileMoreOpen}
          aria-controls="seller-mobile-more-menu"
        >
          <span className="admin-mobile-dock__icon">
            <MoreHorizontal size={20} strokeWidth={1.5} />
          </span>
          Más
        </button>
      </nav>

      {mobileMoreOpen && (
        <>
          <button
            type="button"
            className="admin-mobile-more-scrim"
            onClick={() => {
              setMobileMoreOpen(false);
              mobileMoreButtonRef.current?.focus();
            }}
            tabIndex={-1}
            aria-label="Cerrar menú de opciones"
          />
          <div
            id="seller-mobile-more-menu"
            className="admin-mobile-more md-surface"
            role="group"
            aria-label="Más opciones"
          >
            <button
              ref={firstMobileMoreActionRef}
              type="button"
              className="admin-mobile-more__item"
              aria-haspopup="dialog"
              onClick={() => {
                setMobileMoreOpen(false);
                setAppearanceOpen(true);
              }}
            >
              <Palette />
              Apariencia
            </button>
            <button
              type="button"
              className="admin-mobile-more__item admin-mobile-more__item--danger"
              onClick={handleLogout}
            >
              <LogOut />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

      {appearanceOpen && (
        <PanelAppearanceDialog
          theme={theme}
          preferences={preferences}
          onTheme={setTheme}
          onAccent={setAccent}
          onFontSize={setFontSize}
          onReset={resetPreferences}
          onClose={closeAppearance}
        />
      )}
    </div>
  );
}
