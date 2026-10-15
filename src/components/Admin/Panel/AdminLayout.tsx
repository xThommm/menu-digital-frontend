import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { useTheme } from "../../../hooks/useTheme";
import { usePanelPreferences } from "../../../hooks/usePanelPreferences";
import PanelAppearanceDialog from "../../User/Panel/PanelAppearance/PanelAppearanceDialog";
import { useAdminPush, useAdminPushBootstrap } from "../../../hooks/useAdminPush";
import { useAdminNotifications } from "../../../hooks/useAdminNotifications";
import BrandMark from "../../Common/BrandMark";
import BrandWordmark from "../../Common/BrandWordmark";
import s from "./AdminLayout.module.css";
import { Bell, BellOff, BellRing, ChevronDown,PanelLeft , DollarSign, Inbox, LayoutPanelLeft, LogOut, MoreHorizontal, Palette, PlayingCards, Speech } from "lucide-react";
import { OPEN_PANEL_APPEARANCE_EVENT } from "../../../features/contextMenu/globalMenu";
import { useContextMenu } from "../../../features/contextMenu/hooks/useContextMenu";
import { buildAdminSidebarMenu } from "./adminSidebarMenu";

const SIDEBAR_MENU = buildAdminSidebarMenu();

// Preferencia del CEO de ocultar la sidebar (desktop). Persistida para que no
// tenga que volver a colapsarla en cada visita al panel.
const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

// Accesos directos a las secciones del panel de vendedor (/sellers/*), para
// no tener que pasar primero por el ABM y clickear de nuevo desde ahí. Esas
// pantallas viven en /sellers, pero el admin las ve dentro de ESTE layout
// (SellerLayout le delega): no cambia de barra al entrar.
const SELLERS_SUB_ITEMS = [
  { path: "/sellers", label: "Panel general" },
  { path: "/sellers/simulacion", label: "Simulación de ventas" },
  { path: "/sellers/crm", label: "CRM" },
  { path: "/sellers/ranking", label: "Ranking" },
  { path: "/sellers/configuracion", label: "Configuración" },
];

// Bandeja de notificaciones: el único ítem con badge (no leídas).
const NOTIFICATIONS_PATH = "/admin/notifications";

// Manifest del panel: permite instalarlo en la pantalla de inicio, que es el
// único modo en que iPhone y iPad entregan notificaciones push. Se enlaza
// solo dentro del panel para que las cartas públicas no ofrezcan instalarse.
const MANIFEST_URL = "/admin.webmanifest";

const SELLERS_PATH = "/admin/sellers";
const isSellersArea = (pathname: string) => pathname === SELLERS_PATH || pathname.startsWith("/sellers");

// El CRM se mudó al panel de vendedores (/sellers/crm, alcanzable por admin
// también) — ya no vive en este layout.
const NAV_ITEMS = [
  { path: "/admin",          label: "Panel",      short: "Panel",  icon: <LayoutPanelLeft size={20} strokeWidth={1.5} /> },
  { path: "/admin/payments", label: "Pagos",      short: "Pagos",  icon: <DollarSign size={20} strokeWidth={1.5} /> },
  { path: "/admin/plans",    label: "Planes",     short: "Planes", icon: <PlayingCards size={20} strokeWidth={1.5} /> },
  { path: SELLERS_PATH,     label: "Vendedores", short: "Vend.",  icon: <Speech size={20} strokeWidth={1.5} />, subItems: SELLERS_SUB_ITEMS },
  { path: NOTIFICATIONS_PATH, label: "Notificaciones", short: "Avisos", icon: <Inbox size={20} strokeWidth={1.5} /> },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { preferences, setAccent, setFontSize, reset: resetPreferences } = usePanelPreferences();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const closeAppearance = useCallback(() => setAppearanceOpen(false), []);
  // "Apariencia del panel…" del menú contextual global.
  useEffect(() => {
    const open = () => setAppearanceOpen(true);
    window.addEventListener(OPEN_PANEL_APPEARANCE_EVENT, open);
    return () => window.removeEventListener(OPEN_PANEL_APPEARANCE_EVENT, open);
  }, []);
  useAdminPushBootstrap();
  const push = useAdminPush();
  const openSidebarMenu = useContextMenu(SIDEBAR_MENU);
  const { unreadCount } = useAdminNotifications();
  const badgeFor = (path: string) => (path === NOTIFICATIONS_PATH ? unreadCount : 0);
  const navAriaLabel = (item: { path: string; label: string }) => (
    badgeFor(item.path) > 0 ? `${item.label} (${badgeFor(item.path)} sin leer)` : item.label
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileMoreActionRef = useRef<HTMLButtonElement>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  );

  // Desplegable de accesos a /sellers/* dentro del ítem "Vendedores". Se
  // abre solo al entrar a esa zona, para que se vea dónde está parado.
  const inSellersArea = isSellersArea(location.pathname);
  const [sellersSubmenuOpen, setSellersSubmenuOpen] = useState(inSellersArea);

  const [prevInSellersArea, setPrevInSellersArea] = useState(inSellersArea);
  if (inSellersArea !== prevInSellersArea) {
    setPrevInSellersArea(inSellersArea);
    if (inSellersArea) setSellersSubmenuOpen(true);
  }

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = MANIFEST_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    if (!mobileMoreOpen) return;

    (firstMobileMoreActionRef.current ?? document.querySelector<HTMLButtonElement>("#admin-mobile-more-menu button"))?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMoreOpen(false);
        mobileMoreButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMoreOpen]);

  // El logout NO da de baja las push a propósito: el admin quiere seguir
  // recibiendo avisos en este dispositivo con la sesión cerrada. Para dejar
  // de recibirlas está el botón "Desactivar notificaciones".
  const handleLogout = useCallback(() => {
    setMobileMoreOpen(false);
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <div className={`${s.layoutRoot} admin-panel-graphite`} data-theme-area="panel">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside
        id="ceo-sidebar"
        className={`${s.sidebar} ${sidebarCollapsed ? s.sidebarCollapsed : ""}`}
        aria-label="Navegación del panel CEO"
        inert={sidebarCollapsed}
        onContextMenu={(event) => openSidebarMenu(event, {
          push: {
            known: push.status !== "loading",
            available: push.available,
            active: push.active,
            busy: push.busy,
            help: push.help,
          },
          actions: {
            togglePush: () => { void push.toggle(); },
            sendTest: () => { void push.sendTest(); },
            openAppearance: () => setAppearanceOpen(true),
          },
        })}
      >

        <button type="button" className={s.brand} onClick={() => navigate("/admin")} aria-label="Ir al panel general">
          <div className={s.logoSq} role="img" aria-label="menudigital">
            <BrandMark inline className={s.brandMarkImage} />
          </div>
          <div className={s.brandText}>
            <span className={s.brandName}><BrandWordmark /></span>
            <span className={s.brandSubtitle}>Panel CEO</span>
          </div>
        </button>

        <nav className={s.sideNav}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path;
            if (!item.subItems) {
              return (
                <button
                  key={item.path}
                  className={`${s.navItem} ${active ? s.navItemActive : ""}`}
                  onClick={() => navigate(item.path)}
                  aria-label={navAriaLabel(item)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={s.navIcon}>{item.icon}</span>
                  <span className={s.navLabel}>{item.label}</span>
                  {badgeFor(item.path) > 0 && (
                    <span className={s.navBadge}>{badgeFor(item.path) > 99 ? "99+" : badgeFor(item.path)}</span>
                  )}
                </button>
              );
            }

            return (
              <div key={item.path} className={s.navGroup}>
                <div className={s.navItemRow}>
                  <button
                    className={`${s.navItem} ${s.navItemGrow} ${active ? s.navItemActive : ""}`}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className={s.navIcon}>{item.icon}</span>
                    <span className={s.navLabel}>{item.label}</span>
                  </button>
                  <button
                    type="button"
                    className={s.navSubToggle}
                    onClick={() => setSellersSubmenuOpen(open => !open)}
                    aria-expanded={sellersSubmenuOpen}
                    aria-controls="admin-sellers-submenu"
                    aria-label={sellersSubmenuOpen ? "Ocultar accesos al panel de vendedores" : "Mostrar accesos al panel de vendedores"}
                  >
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={sellersSubmenuOpen ? s.navSubToggleIconOpen : undefined}
                    />
                  </button>
                </div>
                {sellersSubmenuOpen && (
                  <div id="admin-sellers-submenu" className={s.navSubList}>
                    {item.subItems.map(sub => {
                      const subActive = location.pathname === sub.path;
                      return (
                        <button
                          key={sub.path}
                          type="button"
                          className={`${s.navSubItem} ${subActive ? s.navSubItemActive : ""}`}
                          onClick={() => navigate(sub.path)}
                          aria-current={subActive ? "page" : undefined}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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

          {push.status !== "loading" && (
            <button
              className={s.navItem}
              onClick={push.toggle}
              disabled={push.busy}
              aria-pressed={push.active}
              aria-label={push.active ? "Desactivar notificaciones en este dispositivo" : "Activar notificaciones en este dispositivo"}
              title={push.help ?? undefined}
            >
              <span className={s.navIcon}>{push.active ? <Bell size={20} strokeWidth={1.5} /> : <BellOff size={20} strokeWidth={1.5} />}</span>
              <span className={s.navLabel}>{push.active ? "Notificaciones activas" : "Activar notificaciones"}</span>
            </button>
          )}

          {push.available && push.active && (
            <button
              className={s.navItem}
              onClick={push.sendTest}
              aria-label="Enviar notificación de prueba"
            >
              <span className={s.navIcon}><BellRing size={20} strokeWidth={1.5} /></span>
              <span className={s.navLabel}>Probar notificación</span>
            </button>
          )}

          <button
            className={`${s.navItem} ${s.navItemDanger}`}
            onClick={handleLogout}
            aria-label="Cerrar sesión"
          >
            <span className={s.navIcon}><LogOut size={20} strokeWidth={1.5} /></span>
            <span className={s.navLabel}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Botón fijo, fuera del <aside>: sigue visible/clickeable con la
          sidebar oculta — si viviera adentro desaparecería con ella y no
          habría forma de volver a mostrarla. Vive siempre en la misma
          posición top-left (estilo ChatGPT/Claude) en vez de moverse con la
          sidebar, así nunca hay que ir a buscarlo. */}
      <button
        type="button"
        className={`${s.sidebarToggle} ${sidebarCollapsed ? s.sidebarToggleCollapsed : ""}`}
        onClick={() => setSidebarCollapsed(collapsed => !collapsed)}
        aria-expanded={!sidebarCollapsed}
        aria-controls="ceo-sidebar"
        aria-label={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
        title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"}
      >
        <PanelLeft size={18} strokeWidth={1.75} />
      </button>

      {/* ── Contenido de la página activa ────────────────────────────────── */}
      <div className={`${s.content} admin-layout-content ${sidebarCollapsed ? s.contentExpanded : ""}`}>
        <Outlet />
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="admin-mobile-dock md-surface" aria-label="Navegación del panel CEO">
        {NAV_ITEMS.map(item => {
          const active = item.path === SELLERS_PATH ? inSellersArea : location.pathname === item.path;
          return (
            <button
              type="button"
              key={item.path}
              className={`admin-mobile-dock__button ${active ? "admin-mobile-dock__button--active md-button" : ""}`}
              onClick={() => {
                setMobileMoreOpen(false);
                navigate(item.path);
              }}
              aria-label={navAriaLabel(item)}
              aria-current={active ? "page" : undefined}
            >
              <span className="admin-mobile-dock__icon">
                {item.icon}
                {badgeFor(item.path) > 0 && (
                  <span className={s.navBadgeDot}>{badgeFor(item.path) > 9 ? "9+" : badgeFor(item.path)}</span>
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
          <div id="admin-mobile-more-menu" className="admin-mobile-more md-surface" role="group" aria-label="Más opciones">
            {inSellersArea && SELLERS_SUB_ITEMS.map(sub => (
              <button
                key={sub.path}
                type="button"
                className="admin-mobile-more__item"
                aria-current={location.pathname === sub.path ? "page" : undefined}
                onClick={() => {
                  setMobileMoreOpen(false);
                  navigate(sub.path);
                }}
              >
                <Speech />
                {sub.label}
              </button>
            ))}
            <button
              ref={inSellersArea ? undefined : firstMobileMoreActionRef}
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
            {push.status !== "loading" && (
              <button
                type="button"
                className="admin-mobile-more__item"
                onClick={push.toggle}
                disabled={push.busy}
                aria-pressed={push.active}
              >
                {push.active ? <Bell /> : <BellOff />}
                {push.active ? "Desactivar notificaciones" : "Activar notificaciones"}
              </button>
            )}
            {push.available && push.active && (
              <button
                type="button"
                className="admin-mobile-more__item"
                onClick={push.sendTest}
              >
                <BellRing />
                Probar notificación
              </button>
            )}
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
          className="admin-panel-graphite"
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
