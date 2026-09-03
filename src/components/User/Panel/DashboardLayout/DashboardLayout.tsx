import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/useAuth";
import { useTheme } from "../../../../hooks/useTheme";
import { usePlans } from "../../../../hooks/usePlans";
import { isSubscriptionExpired, PLAN_LABEL } from "../../../../lib/plans";
import BrandMark from "../../../Common/BrandMark";
import s from "./DashboardLayout.module.css";

const NAV_ITEMS = [
  { path: "/dashboard",    label: "Dashboard",      short: "Inicio",  icon: <HomeIcon /> },
  { path: "/menu/editor",  label: "Editor de menú", short: "Menú",    icon: <DocIcon /> },
  { path: "/user/editor",  label: "Mi negocio",     short: "Negocio", icon: <StoreIcon /> },
  { path: "/estadisticas", label: "Estadísticas",   short: "Stats",   icon: <ChartIcon /> },
];

export default function DashboardLayout() {
  const catalog = usePlans();
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileMoreActionRef = useRef<HTMLButtonElement>(null);

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
    ? new Date(downgradeDate).toLocaleDateString("es-AR")
    : "";

  return (
    <div className={s.layoutRoot}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className={s.sidebar} aria-label="Navegación principal">

        <div className={s.logoSq} role="img" aria-label="MenuDigital">
          <BrandMark className={s.brandMarkImage} />
        </div>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
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
          className={`${s.sideBtn} ${s.sideLogout}`}
          onClick={toggleTheme}
          aria-label={themeLabel}
          data-tooltip={themeLabel}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          className={s.sideBtn}
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          data-tooltip="Salir"
        >
          <LogoutIcon />
        </button>
      </aside>

      {/* ── Contenido de la página activa ────────────────────────────────── */}
      <div className={`${s.content} admin-layout-content`}>
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
          <aside className={`${s.freeBanner} ${subscriptionExpired ? s.freeBannerAfterExpiry : ""}`} aria-label="Publicidad de MenuDigital">
            <BrandMark className={s.freeBannerLogo} />
            <div className={s.freeBannerCopy}>
              <span className={s.freeBannerBrand}>Menú Digital</span>
              <span className={s.freeBannerBadge}>Tu menú digital</span>
              <span className={s.freeBannerText}>
                Tu carta online, siempre lista para vender.
              </span>
            </div>
          </aside>
        )}
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="admin-mobile-dock" aria-label="Navegación principal">
        {NAV_ITEMS.map(item => {
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
          onClick={() => setMobileMoreOpen(open => !open)}
          aria-label="Más opciones"
          aria-expanded={mobileMoreOpen}
          aria-controls="user-mobile-more-menu"
        >
          <span className="admin-mobile-dock__icon"><MoreIcon /></span>
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
          <div id="user-mobile-more-menu" className="admin-mobile-more" role="group" aria-label="Más opciones">
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
              <LogoutIcon />
              Cerrar sesión
            </button>
          </div>
        </>
      )}

    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

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

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
