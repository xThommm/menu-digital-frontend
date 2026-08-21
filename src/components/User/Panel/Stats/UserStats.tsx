import { useEffect, useState } from "react";
import { useAuth } from "../../../../context/useAuth";
import type { StatsData, ItemStatsData } from "../../../../types";
import UpgradeModal from "../../../Common/UpgradeModal";
import s from "./UserStats.module.css";

// Pega a /me/stats y devuelve el resultado ya interpretado. Es pura (no toca
// estado de React ni el DOM), así se puede reusar desde la carga inicial y
// desde el refresh automático sin duplicar el fetch y sin volverse una
// dependencia de efectos. Los efectos hacen el setState después del await.
type StatsResult =
  | { kind: "locked" }               // 403 — el plan del usuario no incluye stats
  | { kind: "data"; data: StatsData } // 200 — datos ok
  | { kind: "none" };                // otro estado — no tocamos nada

async function requestStats(token: string): Promise<StatsResult> {
  const res = await fetch("/api/users/me/stats", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) return { kind: "locked" };
  if (res.ok) return { kind: "data", data: await res.json() };
  return { kind: "none" };
}

// Mismo patrón que requestStats, para el endpoint de "platos más vistos"
// (mismo gate de plan — si /me/stats no está bloqueado, este tampoco).
type ItemStatsResult =
  | { kind: "data"; data: ItemStatsData }
  | { kind: "none" };

async function requestItemStats(token: string): Promise<ItemStatsResult> {
  const res = await fetch("/api/users/me/item-stats", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) return { kind: "data", data: await res.json() };
  return { kind: "none" };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserStats() {
  const { token, user, isLoading: authLoading } = useAuth();

  const [stats, setStats]         = useState<StatsData | null>(null);
  const [itemStats, setItemStats] = useState<ItemStatsData | null>(null);
  const [locked, setLocked]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Carga inicial: el spinner arranca en true (useState) y se apaga cuando la
  // primera request termina. El setState ocurre después del await (no synchrono
  // dentro del efecto), por eso no dispara renders en cascada.
  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;
    const run = async () => {
      try {
        const r = await requestStats(token);
        if (cancelled) return;
        if (r.kind === "locked") { setLocked(true); return; }
        if (r.kind === "data") setStats(r.data);
        // Mismo gate de plan que /me/stats — si esa no está bloqueada, esta
        // tampoco. Se pide después (no en paralelo) para no duplicar el
        // manejo del 403 en dos lugares.
        const ir = await requestItemStats(token);
        if (!cancelled && ir.kind === "data") setItemStats(ir.data);
      } catch {
        // El panel sigue mostrándose aunque falle la carga de estadísticas
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [authLoading, token]);

  // "Tiempo real": las visitas se registran en el backend en el momento
  // (upsert por cada vista de la carta), así que refrescando periódicamente
  // traemos el conteo al día sin recargar la página. Para no gastar red al
  // pedo, solo hacemos polling mientras la pestaña está visible, y además
  // refrescamos apenas el usuario vuelve a la pestaña (visibilitychange).
  useEffect(() => {
    if (authLoading || !token || locked) return;
    const REFRESH_MS = 45_000;
    let intervalId: number | undefined;

    const refresh = async () => {
      try {
        const r = await requestStats(token);
        if (r.kind === "locked") setLocked(true);
        else if (r.kind === "data") setStats(r.data);
      } catch {
        // silencioso: es un refresh de fondo, no molestamos al usuario
      }
    };
    const stopPolling = () => {
      if (intervalId !== undefined) { window.clearInterval(intervalId); intervalId = undefined; }
    };
    const startPolling = () => {
      stopPolling();
      intervalId = window.setInterval(refresh, REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh(); // refresco inmediato al volver a la pestaña
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authLoading, token, locked]);

  if (loading) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando estadísticas..." />
      </div>
    );
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
              Con el plan Pro ($59.999) desbloqueás estadísticas de visitas.
            </p>
            <button className={s.lockBtn} onClick={() => setUpgradeOpen(true)} type="button">
              Mejorar a Pro
            </button>
          </div>
          {upgradeOpen && (
            <UpgradeModal
              currentPlan={user?.subscription ?? "free"}
              minPlan="pro"
              title="Desbloqueá las estadísticas"
              description="Con el plan Pro accedés a las visitas de tu carta y a los productos más vistos."
              onClose={() => setUpgradeOpen(false)}
            />
          )}
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

        {itemStats && itemStats.topItems.length > 0 && (
          <div className={s.chartCard}>
            <p className={s.chartLabel}>Productos más vistos (últimos {itemStats.windowDays} días)</p>
            <ol className={s.topItemsList}>
              {itemStats.topItems.map((it, i) => {
                const maxViews = itemStats.topItems[0].totalViews;
                return (
                  <li key={it.itemID} className={s.topItemRow}>
                    <span className={s.topItemRank}>{i + 1}</span>
                    <span className={s.topItemName}>{it.title}</span>
                    <div className={s.topItemBarWrap}>
                      <div
                        className={s.topItemBar}
                        style={{ width: `${Math.max((it.totalViews / maxViews) * 100, 6)}%` }}
                      />
                    </div>
                    <span className={s.topItemCount}>{it.totalViews}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
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
