import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useTheme } from "../../hooks/useTheme";
import BrandMark from "../Common/BrandMark";
import s from "./SellerLayout.module.css";
import { ChevronLeft, ChevronRight, LayoutPanelLeft, LogOut, MoreHorizontal } from "lucide-react";

// Preferencia de sidebar colapsada (separada de la del admin)
const SIDEBAR_COLLAPSED_KEY = "seller-sidebar-collapsed";

const NAV_ITEMS = [
  {
    path: "/sellers",
    label: "Panel",
    short: "Panel",
    icon: <LayoutPanelLeft size={20} strokeWidth={1.5} />,
  },
];

export default function SellerLayout() {
  const { logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

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

  const themeLabel = theme === "dark" ? "Activar tema claro" : "Activar tema oscuro";

  return (
    <div className={`${s.layoutRoot} seller-panel`}>
      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside
        id="seller-sidebar"
        className={`${s.sidebar} ${sidebarCollapsed ? s.sidebarCollapsed : ""}`}
        aria-label="Navegación del panel de vendedor"
        inert={sidebarCollapsed}
      >
        <div className={s.brand}>
          <div className={s.logoSq} role="img" aria-label="MenuDigital">
            <BrandMark className={s.brandMarkImage} />
          </div>
          <div className={s.brandText}>
            <span className={s.brandName}>
              Menu<span>Digital</span>
            </span>
            <span className={s.brandSubtitle}>Panel Vendedor</span>
          </div>
        </div>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`${s.navItem} ${active ? s.navItemActive : ""}`}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <span className={s.navIcon}>{item.icon}</span>
                <span className={s.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={s.sideFooter}>
          <button
            className={s.navItem}
            onClick={toggleTheme}
            aria-label={themeLabel}
          >
            <span className={s.navIcon}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </span>
            <span className={s.navLabel}>
              {theme === "dark" ? "Tema claro" : "Tema oscuro"}
            </span>
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

      {/* Toggle de sidebar */}
      <button
        type="button"
        className={`${s.sidebarToggle} ${sidebarCollapsed ? s.sidebarToggleCollapsed : ""}`}
        onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        aria-expanded={!sidebarCollapsed}
        aria-controls="seller-sidebar"
        aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
        title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
      >
        {sidebarCollapsed ? (
          <ChevronRight size={14} strokeWidth={2} />
        ) : (
          <ChevronLeft size={14} strokeWidth={2} />
        )}
      </button>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      <div className={`${s.content} ${sidebarCollapsed ? s.contentExpanded : ""}`}>
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="admin-mobile-dock" aria-label="Navegación del panel de vendedor">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              type="button"
              key={item.path}
              className={`admin-mobile-dock__button ${active ? "admin-mobile-dock__button--active" : ""}`}
              onClick={() => {
                setMobileMoreOpen(false);
                navigate(item.path);
              }}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="admin-mobile-dock__icon">{item.icon}</span>
              {item.short}
            </button>
          );
        })}

        <button
          ref={mobileMoreButtonRef}
          type="button"
          className={`admin-mobile-dock__button ${mobileMoreOpen ? "admin-mobile-dock__button--active" : ""}`}
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
            className="admin-mobile-more"
            role="group"
            aria-label="Más opciones"
          >
            <button
              ref={firstMobileMoreActionRef}
              type="button"
              className="admin-mobile-more__item"
              onClick={() => {
                toggleTheme();
                setMobileMoreOpen(false);
                mobileMoreButtonRef.current?.focus();
              }}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
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
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}