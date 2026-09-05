import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { useTheme } from "../../../hooks/useTheme";
import { getCrmOverdueCount } from "../../../api/crm";
import BrandMark from "../../Common/BrandMark";
import s from "./AdminLayout.module.css";
import { DollarSign, LayoutPanelLeft, LogOut, MoreHorizontal, PlayingCards, Speech, Users } from "lucide-react";

// const NAV_ITEMS = [
//   { path: "/admin",          label: "Panel", short: "Panel", icon: <GridIcon /> },
//   { path: "/admin/crm",      label: "CRM",   short: "CRM",   icon: <UsersIcon /> },
//   { path: "/admin/payments", label: "Pagos", short: "Pagos", icon: <PaymentsIcon /> },
//   { path: "/admin/plans", label: "Planes", short: "Planes", icon: <PlanIcon /> },
//   { path: "/admin/sellers",  label: "Vendedores", short: "Vend.",  icon: <SellerIcon /> },
// ];


const NAV_ITEMS = [
  { path: "/admin",          label: "Panel",      short: "Panel",  icon: <LayoutPanelLeft size={20} strokeWidth={1.5} /> },
  { path: "/admin/crm",      label: "CRM",        short: "CRM",    icon: <Users size={20} strokeWidth={1.5} /> },
  { path: "/admin/payments", label: "Pagos",      short: "Pagos",  icon: <DollarSign size={20} strokeWidth={1.5} /> },
  { path: "/admin/plans",    label: "Planes",     short: "Planes", icon: <PlayingCards size={20} strokeWidth={1.5} /> },
  { path: "/admin/sellers",  label: "Vendedores", short: "Vend.",  icon: <Speech size={20} strokeWidth={1.5} /> },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileMoreActionRef = useRef<HTMLButtonElement>(null);

  // Badge de alerta en el ítem "CRM": cuántos clientes tienen un seguimiento
  // vencido. Se pide una vez al montar el layout (vive todo el panel admin,
  // no solo /admin/crm) y se refresca cada vez que se vuelve a esa ruta,
  // para que el número baje apenas se resuelve un seguimiento desde el CRM.
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCrmOverdueCount()
      .then((count) => { if (!cancelled) setOverdueCount(count); })
      // Badge secundario, no amerita un banner de error — pero se loguea para
      // no perder por completo la falla (antes el catch quedaba mudo).
      .catch((err) => { if (!cancelled) console.error("No se pudo cargar el contador de seguimientos vencidos:", err); });
    return () => { cancelled = true; };
  }, [location.pathname]);

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

  return (
    <div className={`${s.layoutRoot} admin-panel-graphite`}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className={s.sidebar} aria-label="Navegación del panel CEO">

        <div className={s.logoSq} role="img" aria-label="MenuDigital">
          <BrandMark className={s.brandMarkImage} />
        </div>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            const showBadge = item.path === "/admin/crm" && overdueCount > 0;
            return (
              <button
                key={item.path}
                className={`${s.sideBtn} ${active ? s.sideBtnActive : ""}`}
                onClick={() => navigate(item.path)}
                aria-label={showBadge ? `${item.label} (${overdueCount} seguimientos vencidos)` : item.label}
                aria-current={active ? "page" : undefined}
                data-tooltip={showBadge ? `${item.label} · ${overdueCount} vencidos` : item.label}
              >
                {item.icon}
                {showBadge && <span className={s.navBadge}>{overdueCount > 9 ? "9+" : overdueCount}</span>}
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
          <LogOut size={20} strokeWidth={1.5} />
        </button>
      </aside>

      {/* ── Contenido de la página activa ────────────────────────────────── */}
      <div className={`${s.content} admin-layout-content`}>
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="admin-mobile-dock" aria-label="Navegación del panel CEO">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path;
          const showBadge = item.path === "/admin/crm" && overdueCount > 0;
          return (
            <button
              type="button"
              key={item.path}
              className={`admin-mobile-dock__button ${active ? "admin-mobile-dock__button--active" : ""}`}
              onClick={() => {
                setMobileMoreOpen(false);
                navigate(item.path);
              }}
              aria-label={showBadge ? `${item.label} (${overdueCount} seguimientos vencidos)` : item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="admin-mobile-dock__icon">
                {item.icon}
                {showBadge && <span className={s.navBadge}>{overdueCount > 9 ? "9+" : overdueCount}</span>}
              </span>
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
          aria-controls="admin-mobile-more-menu"
        >
          <span className="admin-mobile-dock__icon"><MoreHorizontal size={20} strokeWidth={1.5} /></span>
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
          <div id="admin-mobile-more-menu" className="admin-mobile-more" role="group" aria-label="Más opciones">
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
