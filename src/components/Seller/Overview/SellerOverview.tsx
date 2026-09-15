import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/useAuth";
import { getSellerOverview, type SellerOverviewEntry } from "../../../api/sellers";
import { listAdminSellers } from "../../../api/adminSellers";
import { useCrmClients } from "../../../hooks/useCrmClients";
import { useCrmAlerts } from "../../../hooks/useCrmAlerts";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import { formatDateAR } from "../../../lib/dates";
import { STAGE_META, STAGE_ORDER, timeAgo } from "../Crm/crmHelpers";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import Spinner from "../../Common/Spinner";
import {
  Users,
  TrendingUp,
  Award,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import type { CrmClient, CrmStage } from "../../../types";
import s from "../sellerPanel.module.css";
import d from "./SellerOverview.module.css";

const tierLabel = (entry: SellerOverviewEntry) =>
  `${entry.currentCycle.tier.label} (${Math.round(entry.currentCycle.tier.rate * 100)}%)`;

// Donut de la cartera CRM propia por etapa. Mismo criterio que el donut de
// planes de CEODashboard.tsx: conic-gradient a mano, sin librería de
// gráficos — acá coloreado con STAGE_META en vez de --admin-plan-*.
function buildStageDonutGradient(counts: Record<CrmStage, number>, total: number) {
  if (!total) return "conic-gradient(var(--admin-bg-elevated) 0deg 360deg)";
  let start = 0;
  const stops = STAGE_ORDER.map((stage) => {
    const share = (counts[stage] ?? 0) / total;
    const end = start + share * 360;
    const stop = `${STAGE_META[stage].color} ${start}deg ${end}deg`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

// Donut de "clientes del equipo por plan" para la vista admin — solo
// básico/pro (un vendedor no cobra comisión de cuentas free).
function buildTeamPlanDonutGradient(basicCount: number, proCount: number) {
  const total = basicCount + proCount;
  if (!total) return "conic-gradient(var(--admin-bg-elevated) 0deg 360deg)";
  const basicShare = (basicCount / total) * 360;
  return `conic-gradient(var(--admin-plan-basic) 0deg ${basicShare}deg, var(--admin-plan-pro) ${basicShare}deg 360deg)`;
}

export default function SellerOverview() {
  const { user } = useAuth();
  return user?.role === "admin" ? <SellerOverviewAdmin /> : <SellerOverviewSelf />;
}

// ══════════════════════════════════════════════════════════════════
// Vista del propio vendedor: KPIs de comisión + alertas y pipeline de su
// cartera CRM (leads/clientes que tiene atribuidos).
// ══════════════════════════════════════════════════════════════════
function SellerOverviewSelf() {
  const { user } = useAuth();

  const overview = useQuery({
    queryKey: ["seller-overview", user?.id],
    queryFn: () => getSellerOverview(),
    staleTime: 15_000,
  });
  const { clients, attentionSummary, loading: crmLoading } = useCrmClients();
  const { newAssignments } = useCrmAlerts();

  const self = overview.data?.sellers[0];

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, 0])) as Record<CrmStage, number>;
    clients.forEach((client) => { counts[client.stage] += 1; });
    return counts;
  }, [clients]);
  const totalClients = clients.length;
  const conversionRate = totalClients ? Math.round((stageCounts.activo / totalClients) * 100) : 0;

  const recentAssignments = useMemo(
    () => clients
      .filter((client): client is CrmClient & { assignedSellerAt: string } => !!client.assignedSellerAt)
      .sort((left, right) => new Date(right.assignedSellerAt).getTime() - new Date(left.assignedSellerAt).getTime())
      .slice(0, 5),
    [clients],
  );

  const today = formatDateAR(new Date(), {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (overview.isPending) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando panel…" />
      </div>
    );
  }

  if (overview.isError || !self) {
    return (
      <main className={s.page}>
        <div className={s.inner}>
          <div className={s.error} role="alert">
            {overview.isError ? "No se pudo cargar tu panel." : "Sin datos todavía."}
          </div>
        </div>
      </main>
    );
  }

  const basicCount = self.currentCycle.basic.count;
  const proCount = self.currentCycle.pro.count;
  const planTotal = basicCount + proCount;

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={d.hero}>
          <div>
            <p className={s.eyebrow}>Panel de vendedor</p>
            <h1>Panel general</h1>
            <p className={d.heroCopy}>Hola, {user?.name || "vendedor"}. Así viene tu cartera este período.</p>
          </div>
          <time className={d.today}>{today}</time>
        </header>

        <section className={d.kpiGrid} aria-label="Indicadores principales">
          <KpiCard
            icon={<Users size={16} />}
            label="Clientes vendidos totales"
            value={self.clientsSoldTotal.toLocaleString("es-AR")}
            detail="Histórico"
          />
          <KpiCard
            icon={<TrendingUp size={16} />}
            label="Clientes del período"
            value={self.currentCycle.total.count.toLocaleString("es-AR")}
            detail={`Ciclo ${formatDateAR(self.cycle.start)} al ${formatDateAR(self.cycle.end)}`}
            tone="success"
          />
          <KpiCard
            icon={<Award size={16} />}
            label="Nivel de comisión"
            value={tierLabel(self)}
            detail={`${self.currentCycle.points.toLocaleString("es-AR")} puntos este período`}
          />
          <KpiCard
            icon={<DollarSign size={16} />}
            label="Comisión del período"
            value={formatPaymentAmount(self.currentCycle.total.commission)}
            detail="Este ciclo"
            tone="gold"
          />
        </section>

        {crmLoading ? (
          <div className={d.panel}><Spinner label="Cargando cartera" /></div>
        ) : (
          <>
            <section className={d.panel} aria-label="Alertas de tu cartera">
              <PanelHeader eyebrow="Tu cartera" title="Alertas" action="Ir al CRM" to="/sellers/crm" />
              <div className={d.alertsGrid}>
                <AlertCard label="Nuevas asignaciones" value={newAssignments} tone="gold" to="/sellers/crm" />
                <AlertCard
                  label="Seguimientos vencidos"
                  value={attentionSummary.overdueFollowUps}
                  tone="danger"
                  to="/sellers/crm?attention=follow_up_overdue"
                />
                <AlertCard
                  label="Pagos con incidencia"
                  value={attentionSummary.paymentIssues}
                  tone="danger"
                  to="/sellers/crm?attention=payment_issue"
                />
                <AlertCard
                  label="Onboarding incompleto"
                  value={attentionSummary.incompleteOnboarding}
                  to="/sellers/crm?attention=onboarding_incomplete"
                />
              </div>
            </section>

            <section className={d.secondaryGrid}>
              <article className={d.panel}>
                <PanelHeader eyebrow="Pipeline" title="Cartera por etapa" />
                <div className={d.stageBreakdown}>
                  <div
                    className={d.donutChart}
                    style={{ background: buildStageDonutGradient(stageCounts, totalClients) }}
                    aria-hidden="true"
                  >
                    <div className={d.donutHole}>
                      <strong>{totalClients}</strong>
                      <span>Clientes</span>
                    </div>
                  </div>
                  <ul className={d.legend}>
                    {STAGE_ORDER.map((stage) => {
                      const count = stageCounts[stage];
                      const percent = totalClients ? Math.round((count / totalClients) * 100) : 0;
                      return (
                        <li className={d.legendRow} key={stage}>
                          <span className={d.legendDot} style={{ background: STAGE_META[stage].color }} />
                          <span className={d.legendLabel}>{STAGE_META[stage].label}</span>
                          <span className={d.legendValue}>{count} · {percent}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className={d.panelFoot}>
                  {totalClients ? `${conversionRate}% de tu cartera está activa.` : "Todavía no tenés clientes en tu cartera."}
                </p>
              </article>

              <article className={d.panel}>
                <PanelHeader eyebrow="Este período" title="Clientes por plan" />
                {planTotal === 0 ? (
                  <p className={s.emptyState}>Sin clientes vendidos este período.</p>
                ) : (
                  <>
                    <div className={s.barLegend}>
                      <span><span className={`${s.legendDot} ${s.legendDotBasic}`} />Básico</span>
                      <span><span className={`${s.legendDot} ${s.legendDotPro}`} />Pro</span>
                    </div>
                    <div className={s.barList}>
                      <div className={s.barRow}>
                        <span className={s.barRowName}>Este período</span>
                        <div className={s.barTrack}>
                          {basicCount > 0 && (
                            <div className={s.barSegmentBasic} style={{ width: `${(basicCount / planTotal) * 100}%` }} />
                          )}
                          {proCount > 0 && (
                            <div className={s.barSegmentPro} style={{ width: `${(proCount / planTotal) * 100}%` }} />
                          )}
                        </div>
                        <span className={s.barValue}>{formatPaymentAmount(self.currentCycle.total.commission)}</span>
                      </div>
                    </div>
                  </>
                )}
                <p className={d.panelFoot}>
                  {basicCount.toLocaleString("es-AR")} clientes en Básico · {proCount.toLocaleString("es-AR")} en Pro
                </p>
              </article>
            </section>

            <section className={d.panel} aria-label="Últimas asignaciones">
              <PanelHeader eyebrow="Actividad" title="Últimas asignaciones" action="Ver todo" to="/sellers/crm" />
              {recentAssignments.length > 0 ? (
                <ul className={d.recentList}>
                  {recentAssignments.map((client) => (
                    <li key={client._id}>
                      <Link className={d.recentRow} to={`/sellers/crm?client=${client._id}`}>
                        <span className={d.recentAvatar} aria-hidden="true">
                          {(client.businessName || client.username).charAt(0).toUpperCase()}
                        </span>
                        <span className={d.recentIdentity}>
                          <strong>{client.businessName || "Sin nombre comercial"}</strong>
                          <small>@{client.username}</small>
                        </span>
                        <time>{timeAgo(client.assignedSellerAt)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.emptyState}>Todavía no tenés asignaciones.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// ══════════════════════════════════════════════════════════════════
// Vista admin: agrega un resumen de equipo (KPIs + donut) arriba de la
// tabla comparativa por vendedor, que se mantiene igual.
// ══════════════════════════════════════════════════════════════════
function SellerOverviewAdmin() {
  const { user } = useAuth();
  const [sellerID, setSellerID] = useState("");

  // Sin filtro (el caso por defecto) es también la data que necesita el
  // resumen de equipo — se pide UNA sola vez y se reusa para ambos, en vez
  // de duplicar el mismo fetch sin filtrar en dos queries separadas.
  const teamOverview = useQuery({
    queryKey: ["seller-overview", user?.id, "all"],
    queryFn: () => getSellerOverview(),
    staleTime: 15_000,
  });
  // Solo se dispara cuando el admin filtra por un vendedor puntual — la
  // tabla necesita esa sola fila, que teamOverview no tiene.
  const filteredOverview = useQuery({
    queryKey: ["seller-overview", user?.id, sellerID],
    queryFn: () => getSellerOverview(sellerID),
    enabled: !!sellerID,
    staleTime: 15_000,
  });
  const overview = sellerID ? filteredOverview : teamOverview;

  // Solo para armar el <select> del filtro admin — la lista completa de
  // vendedores, no la vista de comisiones. Misma queryKey que AdminSellers
  // (includeInactive=false) para compartir la caché en vez de re-fetchear.
  const sellersList = useQuery({
    queryKey: ["admin-sellers", false],
    queryFn: () => listAdminSellers(false),
    staleTime: 60_000,
  });

  const rows = overview.data?.sellers ?? [];

  // El resumen de equipo se calcula sobre TODOS los vendedores, sin el
  // filtro de sellerID de la tabla — filtrar a un vendedor puntual no
  // debería achicar el resumen agregado.
  const teamSellers = teamOverview.data?.sellers ?? [];
  const activeSellers = teamSellers.filter((seller) => seller.active).length;
  const teamClientsThisCycle = teamSellers.reduce((sum, seller) => sum + seller.currentCycle.total.count, 0);
  const teamCommissionThisCycle = teamSellers.reduce((sum, seller) => sum + seller.currentCycle.total.commission, 0);
  const teamBasicCount = teamSellers.reduce((sum, seller) => sum + seller.currentCycle.basic.count, 0);
  const teamProCount = teamSellers.reduce((sum, seller) => sum + seller.currentCycle.pro.count, 0);
  const teamPlanTotal = teamBasicCount + teamProCount;

  const columns = useMemo<DataTableColumn<SellerOverviewEntry>[]>(() => {
    const base: DataTableColumn<SellerOverviewEntry>[] = [
      {
        id: "name",
        header: "Vendedor",
        width: "220px",
        filter: { value: sellerID, onChange: setSellerID, options: (sellersList.data ?? []).filter(seller => !seller.influencer).map(seller => ({ value: seller._id, label: seller.name })) },
        sortValue: (r) => r.name,
        render: (r) => (
          <span className={s.barRowName} title={r.name}>
            {r.name} <code>{r.code}</code>
          </span>
        ),
      },
      {
        id: "clientsTotal",
        header: "Clientes totales",
        align: "right",
        sortValue: (r) => r.clientsSoldTotal,
        render: (r) => r.clientsSoldTotal.toLocaleString("es-AR"),
      },
      {
        id: "clientsCycle",
        header: "Clientes del período",
        align: "right",
        sortValue: (r) => r.currentCycle.total.count,
        render: (r) => r.currentCycle.total.count.toLocaleString("es-AR"),
      },
      {
        id: "points",
        header: "Puntos",
        align: "right",
        sortValue: (r) => r.currentCycle.points,
        render: (r) => r.currentCycle.points.toLocaleString("es-AR"),
      },
      {
        id: "tier",
        header: "Nivel",
        filter: { accessor: tierLabel },
        sortValue: (r) => r.currentCycle.tier.rate,
        render: (r) => <span className={s.tierBadge}>{tierLabel(r)}</span>,
      },
      {
        id: "commission",
        header: "Comisión del período",
        align: "right",
        sortValue: (r) => r.currentCycle.total.commission,
        render: (r) => formatPaymentAmount(r.currentCycle.total.commission),
      },
      {
        id: "revenue",
        header: "Facturación del período",
        align: "right",
        sortValue: (r) => r.currentCycle.total.revenue ?? 0,
        render: (r) => formatPaymentAmount(r.currentCycle.total.revenue ?? 0),
      },
    ];

    return base;
  }, [sellerID, sellersList.data]);

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Panel de vendedor</p>
          <h1>Panel general</h1>
          <p>Clientes vendidos y comisiones de todo el equipo, por ciclo mensual de cada vendedor.</p>
        </header>

        <section className={d.kpiGrid} aria-label="Indicadores del equipo">
          <KpiCard
            icon={<Users size={16} />}
            label="Vendedores activos"
            value={teamOverview.isPending ? "—" : activeSellers.toLocaleString("es-AR")}
            detail={`${teamSellers.length} en total`}
          />
          <KpiCard
            icon={<TrendingUp size={16} />}
            label="Clientes del período"
            value={teamOverview.isPending ? "—" : teamClientsThisCycle.toLocaleString("es-AR")}
            detail="Todo el equipo"
            tone="success"
          />
          <KpiCard
            icon={<DollarSign size={16} />}
            label="Comisión del período"
            value={teamOverview.isPending ? "—" : formatPaymentAmount(teamCommissionThisCycle)}
            detail="Todo el equipo"
            tone="gold"
          />
        </section>

        <section className={d.panel} aria-label="Clientes del equipo por plan">
          <PanelHeader eyebrow="Este período" title="Clientes del equipo por plan" />
          {teamOverview.isPending ? (
            <Spinner label="Cargando" />
          ) : teamPlanTotal === 0 ? (
            <p className={s.emptyState}>Sin clientes vendidos este período.</p>
          ) : (
            <div className={d.stageBreakdown}>
              <div
                className={d.donutChart}
                style={{ background: buildTeamPlanDonutGradient(teamBasicCount, teamProCount) }}
                aria-hidden="true"
              >
                <div className={d.donutHole}>
                  <strong>{teamPlanTotal}</strong>
                  <span>Clientes</span>
                </div>
              </div>
              <ul className={d.legend}>
                <li className={d.legendRow}>
                  <span className={d.legendDot} style={{ background: "var(--admin-plan-basic)" }} />
                  <span className={d.legendLabel}>Básico</span>
                  <span className={d.legendValue}>
                    {teamBasicCount} · {Math.round((teamBasicCount / teamPlanTotal) * 100)}%
                  </span>
                </li>
                <li className={d.legendRow}>
                  <span className={d.legendDot} style={{ background: "var(--admin-plan-pro)" }} />
                  <span className={d.legendLabel}>Pro</span>
                  <span className={d.legendValue}>
                    {teamProCount} · {Math.round((teamProCount / teamPlanTotal) * 100)}%
                  </span>
                </li>
              </ul>
            </div>
          )}
        </section>

        <section className={s.section}>
          <DataTable<SellerOverviewEntry>
            caption="Panel general de vendedores"
            rows={rows}
            columns={columns}
            getRowId={(r) => r.sellerID}
            minWidth={1100}
            activeFilterCount={sellerID ? 1 : 0}
            onClearFilters={() => setSellerID("")}
            defaultSort={{ columnId: "commission", direction: "desc" }}
            countLabel={(visible, total) => `${visible} de ${total} vendedores`}
            loading={overview.isPending}
            error={overview.isError ? "No se pudo cargar el panel." : null}
            onRetry={() => void overview.refetch()}
            retrying={overview.isFetching}
            emptyMessage={<p className={s.emptyState}>Todavía no hay vendedores.</p>}
            noResultsMessage="Sin resultados."
          />
        </section>
      </div>
    </main>
  );
}

// ── Componentes de presentación ──────────────────────────────────────────

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "success" | "gold";
}

function KpiCard({ icon, label, value, detail, tone = "neutral" }: KpiCardProps) {
  return (
    <article className={`${d.kpiCard} ${tone !== "neutral" ? d[`kpi_${tone}`] : ""}`}>
      <div className={d.kpiHeader}>
        <span>{label}</span>
        <span className={d.kpiIcon}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function PanelHeader({ eyebrow, title, action, to }: {
  eyebrow: string;
  title: string;
  action?: string;
  to?: string;
}) {
  return (
    <header className={d.panelHeader}>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action && to && <Link to={to}>{action}<ArrowRight /></Link>}
    </header>
  );
}

function AlertCard({ label, value, to, tone = "neutral" }: {
  label: string;
  value: number;
  to: string;
  tone?: "neutral" | "gold" | "danger";
}) {
  const content = (
    <>
      <strong>{value.toLocaleString("es-AR")}</strong>
      <span>{label}</span>
    </>
  );
  if (value === 0) {
    return <div className={`${d.alertCard} ${d.alert_zero}`}>{content}</div>;
  }
  return (
    <Link className={`${d.alertCard} ${tone !== "neutral" ? d[`alert_${tone}`] : ""}`} to={to}>
      {content}
    </Link>
  );
}
