import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";
import s from "./UserDashboard.module.css";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface DashData {
  businessName: string;
  slug: string;
  hasDelivery: boolean;
  template: number;
  itemCount: number;
  categoryCount: number;
}

// ── Hook: luz que sigue al cursor en las cards ────────────────────────────────

function useSpotlight(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [ref]);
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserDashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [data, setData]     = useState<DashData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/users/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) return;
        const json = await res.json();
        setData({
          businessName:  json.contactInfo?.businessName ?? "",
          slug:          json.slug ?? "",
          hasDelivery:   json.hasDelivery ?? false,
          template:      json.template ?? 1,
          itemCount:     json.itemCount ?? 0,
          categoryCount: json.categoryCount ?? 0,
        });
      } catch {
        // El dashboard sigue mostrándose aunque fallen los stats
      }
    };
    load();
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const publicUrl = data?.slug
    ? `${window.location.origin}/${data.slug}`
    : null;

  const handleCopy = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback silencioso */ }
  }, [publicUrl]);

  const handleOpen = useCallback(() => {
    if (!publicUrl) return;
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }, [publicUrl]);

  const displayName = data?.businessName || user?.name || "Mi negocio";

  return (
    <div className={s.dash}>

      {/* ── Top bar ── */}
      <header className={s.topBar}>
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
          </span>
        </div>

        <button className={s.logoutBtn} onClick={handleLogout} aria-label="Cerrar sesión">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Salir
        </button>
      </header>

      {/* ── Bienvenida ── */}
      <div className={s.welcome}>
        <p className={s.welcomeEyebrow}>Bienvenido de vuelta</p>
        <h1 className={s.welcomeTitle}>{displayName}</h1>
      </div>

      {/* ── Tarjeta storefront ── */}
      <div className={s.storefrontCard}>
        <div className={s.storefrontTop}>
          <div className={s.storefrontIcon} aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span className={s.storefrontLabel}>Tu carta en línea</span>
        </div>

        <div className={s.urlRow}>
          <span className={s.urlText}>
            {publicUrl
              ? publicUrl.replace(/^https?:\/\//, "")
              : <span className={s.urlPlaceholder}>Configurá tu negocio para obtener tu link</span>
            }
          </span>
        </div>

        {publicUrl && (
          <div className={s.storefrontActions}>
            <button
              className={`${s.actionBtn} ${copied ? s.actionBtnSuccess : ""}`}
              onClick={handleCopy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "¡Copiado!" : "Copiar link"}
            </button>
            <button className={`${s.actionBtn} ${s.actionBtnOutline}`} onClick={handleOpen}>
              <ExternalIcon />
              Ver página
            </button>
          </div>
        )}

        {data && (
          <div className={s.statsPills}>
            <StatPill icon={<MenuIcon />} value={data.itemCount}
              label={data.itemCount === 1 ? "producto" : "productos"} />
            <StatPill icon={<GridIcon />} value={data.categoryCount}
              label={data.categoryCount === 1 ? "categoría" : "categorías"} />
            <span className={`${s.deliveryPill} ${data.hasDelivery ? s.deliveryOn : s.deliveryOff}`}>
              <span className={s.deliveryDot} />
              {data.hasDelivery ? "Delivery activo" : "Sin delivery"}
            </span>
          </div>
        )}
      </div>

      {/* ── Cards de navegación ── */}
      <div className={s.cards}>
        <SpotlightCard
          onClick={() => navigate("/menu/editor")}
          icon={<DocIcon />}
          title="Editor de menú"
          desc="Platos, precios, categorías y disponibilidad."
          primary
        />
        <SpotlightCard
          onClick={() => navigate("/user/editor")}
          icon={<StoreIcon />}
          title="Mi negocio"
          desc="Datos de contacto, fotos y apariencia."
        />
      </div>

    </div>
  );
}

// ── SpotlightCard — card con luz que sigue al cursor ─────────────────────────

interface NavCardProps {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
}

function SpotlightCard({ onClick, icon, title, desc, primary }: NavCardProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useSpotlight(ref as React.RefObject<HTMLElement>);

  return (
    <button
      ref={ref}
      className={`${s.navCard} ${primary ? s.navCardPrimary : ""}`}
      onClick={onClick}
    >
      <div className={`${s.cardIcon} ${primary ? s.cardIconPrimary : ""}`}>
        {icon}
      </div>
      <div className={s.cardBody}>
        <p className={s.cardTitle}>{title}</p>
        <p className={s.cardDesc}>{desc}</p>
      </div>
      <svg className={s.cardArrow} width="17" height="17" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className={s.statPill}>
      <span className={s.statPillIcon}>{icon}</span>
      <strong>{value}</strong> {label}
    </span>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}