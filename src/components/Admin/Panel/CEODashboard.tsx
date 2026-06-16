import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../api/Auth/AuthContext";
import s from "./CEODashboard.module.css";
import type { User } from "../../../types/index";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Stats {
  usuarios: {
    total: number;
    activos: number;
    inactivos: number;
    conMenuPublicado: number;
    sinMenuPublicado: number;
  };
  menus: {
    total: number;
    secciones: number;
    categorias: number;
  };
  items: {
    total: number;
    disponibles: number;
    ocultos: number;
  };
  recientes: {
    _id: string;
    username: string;
    slug: string;
    active: boolean;
    menu: boolean;
    createdAt: string;
  }[];
}

interface ClientUser {
  _id: string;
  username: string;
  slug: string;
  active: boolean;
  menu: boolean;
  hasDelivery: boolean;
  subscription: "none" | "monthly" | "semestral" | "annual";
  contactInfo: { businessName: string };
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUBSCRIPTION_LABEL: Record<string, string> = {
  none:      "Sin plan",
  monthly:   "Mensual",
  semestral: "Semestral",
  annual:    "Anual",
};

const SUBSCRIPTION_COLOR: Record<string, string> = {
  none:      "#3d3a33",
  monthly:   "#4c7a2e",
  semestral: "#2e5c7a",
  annual:    "#7a4c2e",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months}m`;
  return `hace ${Math.floor(months / 12)}a`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CEODashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats]     = useState<Stats | null>(null);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");

  // Carga stats y lista de clientes en paralelo
  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    const load = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch("/admin/stats",    { headers }),
          fetch("/admin/allUsers", { headers }),
        ]);
        if (!statsRes.ok || !usersRes.ok) throw new Error("Error al cargar datos");
        const [statsData, usersData] = await Promise.all([
          statsRes.json(),
          usersRes.json(),
        ]);
        setStats(statsData);
        setClients(usersData.filter((u: User) => !u.admin));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(message);    
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleToggleActive = useCallback(async (clientId: string, current: boolean) => {
    try {
      const res = await fetch(`/admin/users/${clientId}/active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !current }),
      });
      if (!res.ok) throw new Error();
      setClients(prev =>
        prev.map(c => c._id === clientId ? { ...c, active: !current } : c)
      );
    } catch {
      // silencioso
    }
  }, [token]);

  const subBreakdown = clients.reduce((acc, c) => {
    acc[c.subscription] = (acc[c.subscription] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const newThisMonth = clients.filter(c => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const withDelivery = clients.filter(c => c.hasDelivery).length;

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      c.username.toLowerCase().includes(q) ||
      c.contactInfo?.businessName?.toLowerCase().includes(q) ||
      c.slug?.toLowerCase().includes(q)
    );
  });

  const todayStr = (() => {
    const d = new Date().toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    return d.charAt(0).toUpperCase() + d.slice(1);
  })();

  if (loading) {
    return (
      <div className={s.pageCenter}>
        <div className={s.loaderRing} />
      </div>
    );
  }

  return (
    <div className={s.dash}>

      {/* ── Top bar — ocupa todo el ancho ── */}
      <header className={s.topBar}>
        <div className={s.topBarInner}>
          <div className={s.logoMark}>
            <div className={s.logoSq}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#0c0b09" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h1v6a3 3 0 0 0 6 0V2h1" />
                <path d="M8 2v6" />
                <path d="M15 2c0 4 3 5 3 9a3 3 0 0 1-6 0c0-4 3-5 3-9z" />
                <path d="M8 22v-4" /><path d="M15 22v-4" /><path d="M5 22h14" />
              </svg>
            </div>
            <span className={s.brandName}>
              Menu<span className={s.brandAccent}>Digital</span>
              <span className={s.ceoTag}>CEO</span>
            </span>
          </div>

          <div className={s.topBarRight}>
            {/* Pill live con fecha */}
            <div className={s.livePill}>
              <span className={s.liveDot} />
              {todayStr}
            </div>

            <button className={s.logoutBtn} onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Contenido centrado con máximo ancho ── */}
      <div className={s.dashInner}>

        {/* ── Bienvenida ── */}
        <div className={s.welcome}>
          <div className={s.welcomeLeft}>
            <p className={s.welcomeEyebrow}>Panel interno</p>
            <h1 className={s.welcomeTitle}>Hola, {user?.name ?? "Admin"}</h1>
            <p className={s.welcomeSub}>{todayStr}</p>
          </div>
        </div>

        {error && <div className={s.errorBanner}>{error}</div>}

        {/* ── KPI Grid principal ── */}
        {stats && (
          <div className={s.kpiGrid}>
            <KpiCard label="Clientes totales"    value={stats.usuarios.total}            icon={<UsersIcon />}    />
            <KpiCard label="Activos"             value={stats.usuarios.activos}          icon={<ActiveIcon />}   accent="green" />
            <KpiCard label="Inactivos"           value={stats.usuarios.inactivos}        icon={<InactiveIcon />} accent="red"   />
            <KpiCard label="Nuevos este mes"     value={newThisMonth}                    icon={<NewIcon />}      accent="gold"  />

            <div className={s.kpiDivider} />

            <KpiCard label="Con menú publicado"  value={stats.usuarios.conMenuPublicado} icon={<MenuIcon />}     />
            <KpiCard label="Con delivery"        value={withDelivery}                    icon={<DeliveryIcon />} />
            <KpiCard label="Total productos"     value={stats.items.total}               icon={<ItemIcon />}     />
            <KpiCard label="Categorías creadas"  value={stats.menus.categorias}          icon={<GridIcon />}     />
          </div>
        )}

        {/* ── Suscripciones breakdown ── */}
        <div className={s.sectionTitle}>Suscripciones</div>
        <div className={s.subGrid}>
          {(["none", "monthly", "semestral", "annual"] as const).map(key => (
            <div key={key} className={s.subCard}>
              <div className={s.subDot} style={{ background: SUBSCRIPTION_COLOR[key] }} />
              <div className={s.subInfo}>
                <span className={s.subLabel}>{SUBSCRIPTION_LABEL[key]}</span>
                <span className={s.subCount}>{subBreakdown[key] ?? 0}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Clientes recientes ── */}
        {stats && stats.recientes.length > 0 && (
          <>
            <div className={s.sectionTitle}>Últimos registros</div>
            <div className={s.recentList}>
              {stats.recientes.map(u => (
                <div key={u._id} className={s.recentRow}>
                  <div className={s.recentAvatar}>
                    {(u.username?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className={s.recentInfo}>
                    <span className={s.recentName}>{u.username}</span>
                    <span className={s.recentMeta}>
                      {u.slug ?? "sin slug"} · {u.menu ? "con menú" : "sin menú"}
                    </span>
                  </div>
                  <div className={s.recentRight}>
                    <span className={`${s.statusPill} ${u.active ? s.pillOn : s.pillOff}`}>
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                    <span className={s.recentDate}>{timeAgo(u.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Tabla de todos los clientes ── */}
        <div className={s.sectionHeader}>
          <div className={s.sectionTitle} style={{ margin: 0 }}>Todos los clientes</div>
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              placeholder="Buscar por nombre, negocio o slug…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={s.clientTable}>
          <div className={`${s.clientRow} ${s.clientRowHeader}`}>
            <span>Negocio / usuario</span>
            <span>Slug</span>
            <span>Plan</span>
            <span>Estado</span>
            <span>Registro</span>
            <span>Acción</span>
          </div>

          {filtered.length === 0 && (
            <div className={s.emptyHint}>
              {search ? "Sin resultados para esa búsqueda." : "No hay clientes aún."}
            </div>
          )}

          {filtered.map(c => (
            <div key={c._id} className={s.clientRow}>
              <div className={s.clientName}>
                <span className={s.clientBusiness}>
                  {c.contactInfo?.businessName || "—"}
                </span>
                <span className={s.clientUsername}>{c.username}</span>
              </div>
              <span className={s.clientSlug}>{c.slug ?? "—"}</span>
              <span className={s.clientSub} style={{ color: SUBSCRIPTION_COLOR[c.subscription] }}>
                {SUBSCRIPTION_LABEL[c.subscription]}
              </span>
              <span className={`${s.statusPill} ${c.active ? s.pillOn : s.pillOff}`}>
                {c.active ? "Activo" : "Inactivo"}
              </span>
              <span className={s.clientDate}>{timeAgo(c.createdAt)}</span>
              <button
                className={`${s.toggleActiveBtn} ${c.active ? s.toggleDeactivate : s.toggleActivate}`}
                onClick={() => handleToggleActive(c._id, c.active)}
              >
                {c.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>

      </div>{/* /dashInner */}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "green" | "red" | "gold";
}

function KpiCard({ label, value, icon, accent }: KpiCardProps) {
  const accentColor = accent === "green" ? "#4caf82"
    : accent === "red"  ? "#c97070"
    : accent === "gold" ? "#c9a84c"
    : "#a09070";

  return (
    <div className={s.kpiCard}>
      <div className={s.kpiIcon} style={{ color: accentColor }}>{icon}</div>
      <div className={s.kpiValue} style={{ color: accentColor }}>{value}</div>
      <div className={s.kpiLabel}>{label}</div>
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function UsersIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function ActiveIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
function InactiveIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}
function NewIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function MenuIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function DeliveryIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
}
function ItemIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function GridIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function SearchIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}