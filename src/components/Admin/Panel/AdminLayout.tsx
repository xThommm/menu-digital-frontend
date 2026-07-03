import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { useTheme } from "../../../hooks/useTheme";
import { getCrmOverdueCount } from "../../../api/crm";
import s from "./AdminLayout.module.css";

const NAV_ITEMS = [
  { path: "/admin",     label: "Panel", short: "Panel", icon: <GridIcon /> },
  { path: "/admin/crm", label: "CRM",   short: "CRM",   icon: <UsersIcon /> },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Badge de alerta en el ítem "CRM": cuántos clientes tienen un seguimiento
  // vencido. Se pide una vez al montar el layout (vive todo el panel admin,
  // no solo /admin/crm) y se refresca cada vez que se vuelve a esa ruta,
  // para que el número baje apenas se resuelve un seguimiento desde el CRM.
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCrmOverdueCount()
      .then((count) => { if (!cancelled) setOverdueCount(count); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  // Etiqueta del toggle: describe la ACCIÓN (a qué tema cambia), no el estado
  // actual — más claro para lectores de pantalla.
  const themeLabel = theme === "dark" ? "Activar tema claro" : "Activar tema oscuro";

  return (
    <div className={s.layoutRoot}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className={s.sidebar} aria-label="Navegación del panel CEO">

        <div className={s.logoSq} role="img" aria-label="MenuDigital">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#0c0b09" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2h1v6a3 3 0 0 0 6 0V2h1" />
            <path d="M8 2v6" />
            <path d="M15 2c0 4 3 5 3 9a3 3 0 0 1-6 0c0-4 3-5 3-9z" />
            <path d="M8 22v-4" /><path d="M15 22v-4" /><path d="M5 22h14" />
          </svg>
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
          <LogoutIcon />
        </button>
      </aside>

      {/* ── Contenido de la página activa ────────────────────────────────── */}
      <div className={s.content}>
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className={s.bottomNav} aria-label="Navegación del panel CEO">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path;
          const showBadge = item.path === "/admin/crm" && overdueCount > 0;
          return (
            <button
              key={item.path}
              className={`${s.bottomNavBtn} ${active ? s.bottomNavBtnActive : ""}`}
              onClick={() => navigate(item.path)}
              aria-label={showBadge ? `${item.label} (${overdueCount} seguimientos vencidos)` : item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className={s.bottomNavIcon}>
                {item.icon}
                {showBadge && <span className={s.navBadge}>{overdueCount > 9 ? "9+" : overdueCount}</span>}
              </span>
              {item.short}
            </button>
          );
        })}
        <button className={s.bottomNavBtn} onClick={toggleTheme} aria-label={themeLabel}>
          <span className={s.bottomNavIcon}>{theme === "dark" ? <SunIcon /> : <MoonIcon />}</span>
          Tema
        </button>
        <button className={s.bottomNavBtn} onClick={handleLogout} aria-label="Cerrar sesión">
          <span className={s.bottomNavIcon}><LogoutIcon /></span>
          Salir
        </button>
      </nav>

    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
