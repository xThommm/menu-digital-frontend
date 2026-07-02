import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../../context/useAuth";
import s from "./UserStats.module.css";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface DayCount {
  date: string; // "YYYY-MM-DD"
  count: number;
}

interface StatsData {
  totalViews: number;
  last30Days: DayCount[];
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserStats() {
  const { token, isLoading: authLoading } = useAuth();

  const [stats, setStats]     = useState<StatsData | null>(null);
  const [locked, setLocked]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/users/me/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 403) {
          setLocked(true);
        } else if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // El panel sigue mostrándose aunque falle la carga de estadísticas
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token, authLoading]);

  // Dispara el pago del plan Semestral (mismo patrón que MenuEditor/UserEditor).
  // Al volver de MercadoPago, el webhook ya actualizó la suscripción y esta
  // página vuelve a pedir /me/stats, que esta vez responderá 200.
  const handleUpgrade = useCallback(async () => {
    if (!token || upgrading) return;
    setUpgrading(true);
    try {
      const res = await fetch("/api/payments/crear-preferencia", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "semestral" }),
      });
      if (!res.ok) throw new Error();
      const { init_point } = await res.json();
      window.location.href = init_point;
    } catch {
      setUpgrading(false);
    }
  }, [token, upgrading]);

  if (loading) {
    return <div className={s.root}><main className={s.main} /></div>;
  }

  if (locked) {
    return (
      <div className={s.root}>
        <main className={s.main}>
          <div className={s.welcome}>
            <p className={s.welcomeEyebrow}>Estadísticas</p>
            <h1 className={s.welcomeTitle}>Visitas a tu carta</h1>
          </div>

          <div className={s.lockCard}>
            <div className={s.lockIcon}><LockIcon /></div>
            <p className={s.lockTitle}>Disponible desde el plan Pro</p>
            <p className={s.lockDesc}>
              Mirá cuántas veces escanearon el QR de tu carta y seguí la tendencia día a día.
              Con el plan Pro ($29.999) desbloqueás estadísticas de visitas.
            </p>
            <button className={s.lockBtn} onClick={handleUpgrade} disabled={upgrading} type="button">
              {upgrading ? "Redirigiendo..." : "Mejorar a Pro"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const days = stats?.last30Days ?? [];
  const maxCount = Math.max(1, ...days.map(d => d.count));
  const todayCount = days[days.length - 1]?.count ?? 0;
  const last7 = days.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const hasAnyView = (stats?.totalViews ?? 0) > 0;

  return (
    <div className={s.root}>
      <main className={s.main}>
        <div className={s.welcome}>
          <p className={s.welcomeEyebrow}>Estadísticas</p>
          <h1 className={s.welcomeTitle}>Visitas a tu carta</h1>
        </div>

        <div className={s.summaryRow}>
          <SummaryCard label="Últimos 30 días" value={stats?.totalViews ?? 0} />
          <SummaryCard label="Últimos 7 días" value={last7} />
          <SummaryCard label="Hoy" value={todayCount} />
        </div>

        <div className={s.chartCard}>
          <p className={s.chartLabel}>Visitas por día</p>

          {!hasAnyView && (
            <p className={s.emptyHint}>
              Todavía no tenés visitas registradas. Compartí el link de tu carta o pegá el QR en tus mesas para empezar a ver datos acá.
            </p>
          )}

          <div className={s.chart}>
            {days.map(d => (
              <div
                key={d.date}
                className={s.barWrap}
                title={`${formatDay(d.date)}: ${d.count} visita${d.count === 1 ? "" : "s"}`}
              >
                <div
                  className={`${s.bar} ${d.count === 0 ? s.barEmpty : ""}`}
                  style={{ height: `${d.count > 0 ? Math.max((d.count / maxCount) * 100, 6) : 3}%` }}
                />
              </div>
            ))}
          </div>

          <div className={s.chartAxis}>
            <span>{formatDay(days[0]?.date)}</span>
            <span>{formatDay(days[days.length - 1]?.date)}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Parseamos "YYYY-MM-DD" como fecha local (no UTC) para que no se corra un
// día en husos horarios negativos como el de Argentina (UTC-3).
function formatDay(dateStr?: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={s.summaryCard}>
      <p className={s.summaryValue}>{value}</p>
      <p className={s.summaryLabel}>{label}</p>
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
