import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../../api/client";
import { listAdminPayments } from "../../../api/adminPayments";
import { listCrmClients } from "../../../api/crm";
import { useAuth } from "../../../context/useAuth";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import { PLAN_LABEL, PLAN_ORDER } from "../../../lib/plans";
import type {
  AdminPaymentsResponse,
  AdminStats,
  CrmAttentionSummary,
  CrmClient,
  Subscription,
} from "../../../types";
import s from "./CEODashboard.module.css";

interface CrmDashboardData {
  clients: CrmClient[];
  attentionSummary?: CrmAttentionSummary;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.max(0, Math.floor(diff / 86_400_000));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `Hace ${years} ${years === 1 ? "año" : "años"}`;
}

export default function CEODashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [crmData, setCrmData] = useState<CrmDashboardData | null>(null);
  const [paymentsData, setPaymentsData] = useState<AdminPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      apiClient.get<AdminStats>("/admin/stats").then((response) => response.data),
      listCrmClients(),
      listAdminPayments({ page: 1, limit: 5 }),
    ]).then(([statsResult, crmResult, paymentsResult]) => {
      if (cancelled) return;

      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (crmResult.status === "fulfilled") setCrmData(crmResult.value);
      if (paymentsResult.status === "fulfilled") setPaymentsData(paymentsResult.value);

      const failedSources = [statsResult, crmResult, paymentsResult]
        .filter((result) => result.status === "rejected").length;
      if (failedSources > 0) {
        setError("Algunos indicadores no pudieron actualizarse. Los módulos siguen disponibles.");
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando dashboard…" />
      </div>
    );
  }

  const clients = crmData?.clients ?? [];
  const attention = crmData?.attentionSummary;
  const payments = paymentsData?.summary;
  const totalClients = crmData ? clients.length : null;
  const newThisMonth = clients.filter((client) => {
    const createdAt = new Date(client.createdAt);
    const now = new Date();
    return createdAt.getMonth() === now.getMonth()
      && createdAt.getFullYear() === now.getFullYear();
  }).length;
  const planBreakdown = clients.reduce<Record<Subscription, number>>((totals, client) => {
    totals[client.subscription] += 1;
    return totals;
  }, { free: 0, basic: 0, pro: 0 });
  const publishedPercent = stats && stats.usuarios.total > 0
    ? Math.round((stats.usuarios.conMenuPublicado / stats.usuarios.total) * 100)
    : 0;
  const recentClients = clients.slice(0, 5);
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={s.dashboard}>
      <main className={s.inner}>
        <header className={s.hero}>
          <div>
            <p className={s.eyebrow}>Resumen ejecutivo</p>
            <h1>Dashboard de MenuDigital</h1>
            <p className={s.heroCopy}>
              Hola, {user?.name || "Admin"}. Este es el estado general de la operación.
            </p>
          </div>
          <time className={s.today}>{today}</time>
        </header>

        {error && <div className={s.errorBanner} role="alert">{error}</div>}

        <section className={s.kpiGrid} aria-label="Indicadores principales">
          <KpiCard
            icon={<UsersIcon />}
            label="Clientes"
            value={stats ? stats.usuarios.total : "—"}
            detail={stats ? `${stats.usuarios.activos} cuentas activas` : "Dato no disponible"}
          />
          <KpiCard
            icon={<MenuIcon />}
            label="Menús publicados"
            value={stats ? stats.usuarios.conMenuPublicado : "—"}
            detail={stats ? `${publishedPercent}% de las cuentas` : "Dato no disponible"}
            tone="success"
          />
          <KpiCard
            icon={<ProductsIcon />}
            label="Productos"
            value={stats ? stats.items.total : "—"}
            detail={stats ? `${stats.items.disponibles} disponibles` : "Dato no disponible"}
          />
          <KpiCard
            icon={<PaymentsIcon />}
            label="Importe acreditado"
            value={payments ? formatPaymentAmount(payments.appliedAmount, payments.currency) : "—"}
            detail={payments ? `${payments.applied} pagos con plan aplicado` : "Dato no disponible"}
            tone="gold"
          />
        </section>

        <section className={s.shortcuts} aria-label="Accesos rápidos">
          <ModuleShortcut
            to="/admin/crm"
            icon={<UsersIcon />}
            eyebrow="Clientes 360"
            title="Gestionar CRM"
            description="Abrí fichas, onboarding, seguimientos y alertas de cada cliente."
            metric={crmData ? `${attention?.clients ?? 0} requieren atención` : "Abrir módulo"}
          />
          <ModuleShortcut
            to="/admin/payments"
            icon={<PaymentsIcon />}
            eyebrow="Cobros persistidos"
            title="Revisar pagos"
            description="Consultá estados, acreditaciones y operaciones que necesitan revisión."
            metric={payments ? `${payments.attention} requieren atención` : "Abrir módulo"}
            tone="gold"
          />
        </section>

        <section className={s.primaryGrid}>
          <article className={s.panel}>
            <PanelHeader
              eyebrow="Bandeja operativa"
              title="Atención de clientes"
              action="Ir al CRM"
              to="/admin/crm"
            />
            <div className={s.attentionList}>
              <AttentionRow label="Problemas de pago" value={attention?.paymentIssues} tone="danger" />
              <AttentionRow label="Suscripciones vencidas" value={attention?.expiredSubscriptions} tone="danger" />
              <AttentionRow label="Vencen en los próximos 30 días" value={attention?.expiringSubscriptions} tone="warning" />
              <AttentionRow label="Planes sin vencimiento registrado" value={attention?.missingExpirySubscriptions} tone="warning" />
              <AttentionRow label="Seguimientos vencidos" value={attention?.overdueFollowUps} tone="warning" />
              <AttentionRow label="Onboarding incompleto" value={attention?.incompleteOnboarding} />
            </div>
          </article>

          <article className={s.panel}>
            <PanelHeader
              eyebrow="Estado financiero"
              title="Pagos"
              action="Ver historial"
              to="/admin/payments"
            />
            <div className={s.paymentHero}>
              <span>Importe con plan acreditado</span>
              <strong>{payments ? formatPaymentAmount(payments.appliedAmount, payments.currency) : "—"}</strong>
              <small>{payments ? `${payments.total} registros en el historial local` : "Datos no disponibles"}</small>
            </div>
            <div className={s.paymentStats}>
              <SmallStat label="Aprobados" value={payments?.approved} tone="success" />
              <SmallStat label="Pendientes" value={payments?.pending} tone="warning" />
              <SmallStat label="Fallidos" value={payments?.failed} tone="danger" />
              <SmallStat label="A revisar" value={payments?.attention} tone="danger" />
            </div>
          </article>
        </section>

        <section className={s.secondaryGrid}>
          <article className={s.panel}>
            <PanelHeader eyebrow="Cartera" title="Clientes por plan" />
            <div className={s.planList}>
              {PLAN_ORDER.map((plan) => {
                const count = planBreakdown[plan];
                const percent = totalClients ? Math.round((count / totalClients) * 100) : 0;
                return (
                  <div className={s.planRow} key={plan}>
                    <div className={s.planRowHeader}>
                      <span className={`${s.planPill} ${s[`plan_${plan}`]}`}>{PLAN_LABEL[plan]}</span>
                      <span>{crmData ? `${count} · ${percent}%` : "—"}</span>
                    </div>
                    <div className={s.planTrack} aria-hidden="true">
                      <span className={`${s.planFill} ${s[`planFill_${plan}`]}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className={s.panelFoot}>
              {crmData ? `${newThisMonth} altas durante el mes actual` : "Cartera no disponible"}
            </p>
          </article>

          <article className={s.panel}>
            <PanelHeader eyebrow="Contenido" title="Estado de la plataforma" />
            <div className={s.contentGrid}>
              <ContentStat label="Menús" value={stats?.menus.total} />
              <ContentStat label="Secciones" value={stats?.menus.secciones} />
              <ContentStat label="Categorías" value={stats?.menus.categorias} />
              <ContentStat label="Sin menú publicado" value={stats?.usuarios.sinMenuPublicado} tone="warning" />
            </div>
          </article>
        </section>

        <section className={`${s.panel} ${s.recentPanel}`}>
          <PanelHeader eyebrow="Actividad reciente" title="Últimos clientes registrados" action="Ver todos" to="/admin/crm" />
          {recentClients.length > 0 ? (
            <div className={s.recentList}>
              {recentClients.map((client) => (
                <Link className={s.recentRow} to={`/admin/crm?client=${client._id}`} key={client._id}>
                  <span className={s.avatar} aria-hidden="true">
                    {(client.businessName || client.username).charAt(0).toUpperCase()}
                  </span>
                  <span className={s.clientIdentity}>
                    <strong>{client.businessName || "Sin nombre comercial"}</strong>
                    <small>@{client.username} · {client.slug || "sin slug"}</small>
                  </span>
                  <span className={`${s.planPill} ${s[`plan_${client.subscription}`]}`}>
                    {PLAN_LABEL[client.subscription]}
                  </span>
                  <span className={`${s.accountStatus} ${client.active ? s.accountActive : s.accountInactive}`}>
                    {client.active ? "Activo" : "Inactivo"}
                  </span>
                  <time>{timeAgo(client.createdAt)}</time>
                  <ArrowIcon />
                </Link>
              ))}
            </div>
          ) : (
            <p className={s.emptyState}>
              {crmData ? "Todavía no hay clientes registrados." : "No se pudo cargar la actividad reciente."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "success" | "gold";
}

function KpiCard({ icon, label, value, detail, tone = "neutral" }: KpiCardProps) {
  return (
    <article className={`${s.kpiCard} ${s[`kpi_${tone}`]}`}>
      <div className={s.kpiHeader}>
        <span>{label}</span>
        <span className={s.kpiIcon}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

interface ModuleShortcutProps {
  to: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  tone?: "neutral" | "gold";
}

function ModuleShortcut({ to, icon, eyebrow, title, description, metric, tone = "neutral" }: ModuleShortcutProps) {
  return (
    <Link className={`${s.moduleShortcut} ${s[`shortcut_${tone}`]}`} to={to}>
      <span className={s.shortcutIcon}>{icon}</span>
      <span className={s.shortcutBody}>
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className={s.shortcutMetric}>{metric}</span>
      <span className={s.shortcutArrow}><ArrowIcon /></span>
    </Link>
  );
}

function PanelHeader({ eyebrow, title, action, to }: {
  eyebrow: string;
  title: string;
  action?: string;
  to?: string;
}) {
  return (
    <header className={s.panelHeader}>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action && to && <Link to={to}>{action}<ArrowIcon /></Link>}
    </header>
  );
}

function AttentionRow({ label, value, tone = "neutral" }: {
  label: string;
  value?: number;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <div className={s.attentionRow}>
      <span className={`${s.attentionDot} ${s[`dot_${value ? tone : "neutral"}`]}`} />
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function SmallStat({ label, value, tone = "neutral" }: {
  label: string;
  value?: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <div className={`${s.smallStat} ${s[`smallStat_${tone}`]}`}>
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
    </div>
  );
}

function ContentStat({ label, value, tone = "neutral" }: {
  label: string;
  value?: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className={`${s.contentStat} ${s[`contentStat_${tone}`]}`}>
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
    </div>
  );
}

function UsersIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>;
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h7M8 11h5"/></svg>;
}

function ProductsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/><circle cx="2" cy="7" r=".5"/><circle cx="2" cy="12" r=".5"/><circle cx="2" cy="17" r=".5"/></svg>;
}

function PaymentsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>;
}
