import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/useAuth";
import { useTheme } from "../../../../hooks/useTheme";
import { usePlans } from "../../../../hooks/usePlans";
import { isSubscriptionExpired, PLAN_LABEL } from "../../../../lib/plans";
import { formatDateAR } from "../../../../lib/dates";
import { OWNER_SIDEBAR_COLLAPSED_KEY } from "../../../../lib/ownerSidebar";
import { MobileDockProvider } from "../../../../context/MobileDockProvider";
import { useMobileDock } from "../../../../context/useMobileDock";
import BrandMark from "../../../Common/BrandMark";
import BrandWordmark from "../../../Common/BrandWordmark";
import s from "./DashboardLayout.module.css";
import { ArrowUpRight, ChartColumn, ClipboardList, FileText, House, LogOut, MoreHorizontal, PanelLeft, Settings, Store } from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard",      label: "Inicio",         short: "Inicio",  icon: <House size={20} strokeWidth={1.5} /> },
  { path: "/menu/editor",    label: "Editor de menú", short: "Menú",    icon: <FileText size={20} strokeWidth={1.5} /> },
  { path: "/user/editor",    label: "Mi negocio",     short: "Negocio", icon: <Store size={20} strokeWidth={1.5} /> },
  { path: "/estadisticas",   label: "Estadísticas",   short: "Stats",   icon: <ChartColumn size={20} strokeWidth={1.5} /> },
  { path: "/configuracion",  label: "Configuración",  short: "Config",  icon: <Settings size={20} strokeWidth={1.5} /> },
];

// Pantallas de trabajo que necesitan el ancho: ahí la barra queda como riel
// de íconos (ver .sidebarCompact en DashboardLayout.module.css).
const COMPACT_SIDEBAR_PATHS = ["/menu/editor"];

// Acceso a Gestión de pedidos (sección aparte con su propia barra, ver
// src/features/orders). En el celular va en "Más" para no sumar un botón al dock.
const ORDERS_PATH = "/pedidos";
const ORDERS_LABEL = "Gestión de pedidos";

export default function DashboardLayout() {
  // El Provider tiene que envolver también al propio dock (no solo al
  // Outlet): una vista hija full-screen como el Gestor de imágenes pide
  // ocultarlo vía contexto, así que DashboardLayoutInner necesita estar
  // DENTRO del Provider para poder leer ese estado con useMobileDock().
  return (
    <MobileDockProvider>
      <DashboardLayoutInner />
    </MobileDockProvider>
  );
}

function DashboardLayoutInner() {
  const catalog = usePlans();
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { hidden: mobileDockHidden } = useMobileDock();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileMoreActionRef = useRef<HTMLButtonElement>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(OWNER_SIDEBAR_COLLAPSED_KEY) === "true"
  );

  useEffect(() => {
    localStorage.setItem(OWNER_SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const sidebarCompact = !sidebarCollapsed && COMPACT_SIDEBAR_PATHS.includes(location.pathname);
  const sidebarStateClass = sidebarCollapsed ? s.sidebarCollapsed : sidebarCompact ? s.sidebarCompact : "";
  const contentStateClass = sidebarCollapsed ? s.contentExpanded : sidebarCompact ? s.contentCompact : "";

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

  // Etiqueta del toggle: describe la ACCIÓN (a qué tema cambia), no el estado
  // actual — más claro para lectores de pantalla.
  const themeLabel = theme === "dark" ? "Activar tema claro" : "Activar tema oscuro";
  const subscriptionExpired = user
    ? isSubscriptionExpired(user.subscription, user.subscriptionExpiresAt, user.subscriptionStatus)
    : false;
  const effectiveSubscription = subscriptionExpired ? "free" : user?.subscription;
  const previousPlanLabel = user?.previousSubscription
    ? PLAN_LABEL[user.previousSubscription]
    : null;
  const previousPlanText = previousPlanLabel ? `plan ${previousPlanLabel}` : "plan pago";
  const downgradeDate = user?.downgradedAt || user?.subscriptionExpiresAt;
  const downgradeDateLabel = downgradeDate && Number.isFinite(new Date(downgradeDate).getTime())
    ? formatDateAR(downgradeDate)
    : "";

  return (
    <div className={s.layoutRoot}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside
        id="owner-sidebar"
        className={`${s.sidebar} ${sidebarStateClass}`}
        aria-label="Navegación principal"
        inert={sidebarCollapsed}
      >
        <button type="button" className={s.brand} onClick={() => navigate("/dashboard")} aria-label="Ir al inicio">
          <div className={s.logoSq} role="img" aria-label="menudigital">
            <BrandMark inline className={s.brandMarkImage} />
          </div>
          <div className={s.brandText}>
            <span className={s.brandName}><BrandWordmark /></span>
            <span className={s.brandSubtitle}>{user?.name}</span>
          </div>
        </button>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                className={`${s.navItem} ${active ? s.navItemActive : ""}`}
                onClick={() => navigate(item.path)}
                aria-current={active ? "page" : undefined}
                data-tooltip={item.label}
              >
                <span className={s.navIcon}>{item.icon}</span>
                <span className={s.navLabel}>{item.label}</span>
              </button>
            );
          })}

          {/* Gestión de pedidos es otra sección, con su propia barra. */}
          <div className={s.navSection}>
            <span className={s.navSectionLabel}>Secciones</span>
            <button type="button" className={s.navItem} onClick={() => navigate(ORDERS_PATH)} data-tooltip={ORDERS_LABEL}>
              <span className={s.navIcon}><ClipboardList size={20} strokeWidth={1.5} /></span>
              <span className={s.navLabel}>{ORDERS_LABEL}</span>
              <span className={s.navTrailing}><ArrowUpRight size={16} strokeWidth={1.5} aria-hidden /></span>
            </button>
          </div>
        </nav>

        <div className={s.sideFooter}>
          <button type="button" className={s.navItem} onClick={toggleTheme} aria-label={themeLabel} data-tooltip={themeLabel}>
            <span className={s.navIcon}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</span>
            <span className={s.navLabel}>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</span>
          </button>
          <button type="button" className={`${s.navItem} ${s.navItemDanger}`} onClick={handleLogout} data-tooltip="Cerrar sesión">
            <span className={s.navIcon}><LogOut size={20} strokeWidth={1.5} /></span>
            <span className={s.navLabel}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Toggle fijo fuera del <aside>, igual que en AdminLayout.tsx. En el
          riel compacto no entra (y no hay nada que ocultar). */}
      {!sidebarCompact && <button
        type="button"
        className={`${s.sidebarToggle} ${sidebarCollapsed ? s.sidebarToggleCollapsed : ""}`}
        onClick={() => setSidebarCollapsed(collapsed => !collapsed)}
        aria-expanded={!sidebarCollapsed}
        aria-controls="owner-sidebar"
        aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
        title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
      >
        <PanelLeft size={18} strokeWidth={1.75} />
      </button>}

      {/* ── Contenido de la página activa ──────────────────────────────────
          admin-layout-content reserva espacio abajo para no quedar tapado
          por el dock (ver globals.css) — con el dock oculto ese espacio
          reservado sobra, así que se saca con el modificador --no-dock. */}
      <div className={`${s.content} admin-layout-content ${contentStateClass} ${mobileDockHidden ? "admin-layout-content--no-dock" : ""}`}>
        {subscriptionExpired && (
          <aside className={s.expiryBanner} role="status" aria-live="polite">
            <div className={s.expiryBannerCopy}>
              <strong>Tu {previousPlanText} venció{downgradeDateLabel ? ` el ${downgradeDateLabel}` : ""}.</strong>
              <span>Tu cuenta pasó a Gratis y las funciones incluidas en {previousPlanText} quedaron deshabilitadas.</span>
            </div>
            <button type="button" className={s.expiryBannerAction} onClick={() => navigate("/dashboard")}>
              Renovar plan
            </button>
          </aside>
        )}
        {!catalog.isError && catalog.data?.find(plan => plan.name === effectiveSubscription)?.features.sin_publicidad === false && (
          <aside className={`${s.freeBanner} ${subscriptionExpired ? s.freeBannerAfterExpiry : ""}`} aria-label="Publicidad de menudigital">
            <div className={s.freeBannerCopy}>
              <span className={`${s.freeBannerBrand} md-lockup`}>
                <BrandMark className={s.freeBannerLogo} />
                <BrandWordmark />
              </span>
              <span className={s.freeBannerBadge}>Tu menú digital</span>
              <span className={s.freeBannerText}>
                Tu carta online, siempre lista para vender.
              </span>
            </div>
          </aside>
        )}
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ─────────────────────────────────────────────
          Oculto mientras una vista hija full-screen lo pide vía contexto
          (ej. el Gestor de imágenes: ya tiene su propio botón de "volver"
          arriba a la izquierda, y el dock solo tapa contenido ahí). */}
      {!mobileDockHidden && (
        <nav className="admin-mobile-dock md-surface" aria-label="Navegación principal">
          {NAV_ITEMS.map(item => {
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
            className={`admin-mobile-dock__button ${mobileMoreOpen ? "admin-mobile-dock__button--active md-button" : ""}`}
            onClick={() => setMobileMoreOpen(open => !open)}
            aria-label="Más opciones"
            aria-expanded={mobileMoreOpen}
            aria-controls="user-mobile-more-menu"
          >
            <span className="admin-mobile-dock__icon"><MoreHorizontal size={20} strokeWidth={1.5} /></span>
            Más
          </button>
        </nav>
      )}

      {!mobileDockHidden && mobileMoreOpen && (
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
          <div id="user-mobile-more-menu" className="admin-mobile-more md-surface" role="group" aria-label="Más opciones">
            <button
              ref={firstMobileMoreActionRef}
              type="button"
              className="admin-mobile-more__item"
              onClick={() => {
                setMobileMoreOpen(false);
                navigate(ORDERS_PATH);
              }}
            >
              <ClipboardList />
              {ORDERS_LABEL}
            </button>
            <button
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








// Sol = "pasar a claro" (se muestra cuando el tema actual es oscuro).
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

// Luna = "pasar a oscuro" (se muestra cuando el tema actual es claro).
function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

