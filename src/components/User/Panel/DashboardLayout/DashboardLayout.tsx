import { useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../context/useAuth";
import s from "./DashboardLayout.module.css";

const NAV_ITEMS = [
  { path: "/dashboard",    label: "Dashboard",      short: "Inicio",  icon: <HomeIcon /> },
  { path: "/menu/editor",  label: "Editor de menú", short: "Menú",    icon: <DocIcon /> },
  { path: "/user/editor",  label: "Mi negocio",     short: "Negocio", icon: <StoreIcon /> },
  { path: "/estadisticas", label: "Estadísticas",   short: "Stats",   icon: <ChartIcon /> },
];

export default function DashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <div className={s.layoutRoot}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className={s.sidebar} aria-label="Navegación principal">

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
      <nav className={s.bottomNav} aria-label="Navegación principal">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`${s.bottomNavBtn} ${active ? s.bottomNavBtnActive : ""}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className={s.bottomNavIcon}>{item.icon}</span>
              {item.short}
            </button>
          );
        })}
        <button className={s.bottomNavBtn} onClick={handleLogout} aria-label="Cerrar sesión">
          <span className={s.bottomNavIcon}><LogoutIcon /></span>
          Salir
        </button>
      </nav>

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
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}