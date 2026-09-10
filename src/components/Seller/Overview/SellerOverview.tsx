import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/useAuth";
import { getSellerOverview, type SellerOverviewEntry } from "../../../api/sellers";
import { listAdminSellers } from "../../../api/adminSellers";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import Spinner from "../../Common/Spinner";
import s from "../sellerPanel.module.css";

const tierLabel = (entry: SellerOverviewEntry) =>
  `${entry.currentCycle.tier.label} (${Math.round(entry.currentCycle.tier.rate * 100)}%)`;

export default function SellerOverview() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [sellerID, setSellerID] = useState("");

  const overview = useQuery({
    queryKey: ["seller-overview", sellerID],
    queryFn: () => getSellerOverview(sellerID || undefined),
    staleTime: 15_000,
  });

  // Solo para armar el <select> del filtro admin — la lista completa de
  // vendedores, no la vista de comisiones. Misma queryKey que AdminSellers
  // (includeInactive=false) para compartir la caché en vez de re-fetchear.
  const sellersList = useQuery({
    queryKey: ["admin-sellers", false],
    queryFn: () => listAdminSellers(false),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const rows = overview.data?.sellers ?? [];
  const self = !isAdmin ? rows[0] : null;

  const columns = useMemo<DataTableColumn<SellerOverviewEntry>[]>(() => {
    const base: DataTableColumn<SellerOverviewEntry>[] = [
      {
        id: "name",
        header: "Vendedor",
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
    ];

    if (isAdmin) {
      base.push({
        id: "revenue",
        header: "Facturación del período",
        align: "right",
        sortValue: (r) => r.currentCycle.total.revenue ?? 0,
        render: (r) => formatPaymentAmount(r.currentCycle.total.revenue ?? 0),
      });
    }

    return base;
  }, [isAdmin]);

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Panel de vendedor</p>
          <h1>Panel general</h1>
          <p>
            {isAdmin
              ? "Clientes vendidos y comisiones de todo el equipo, por ciclo mensual de cada vendedor."
              : "Tus clientes vendidos y tu comisión del ciclo actual."}
          </p>
        </header>

        {isAdmin && (
          <section className={s.section}>
            <div className={s.toolbar}>
              <label className={s.selectField} htmlFor="overview-seller-filter">
                Vendedor
                <select
                  id="overview-seller-filter"
                  value={sellerID}
                  onChange={(event) => setSellerID(event.target.value)}
                >
                  <option value="">Todos</option>
                  {(sellersList.data ?? []).map((seller) => (
                    <option key={seller._id} value={seller._id}>{seller.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <DataTable<SellerOverviewEntry>
              caption="Panel general de vendedores"
              rows={rows}
              columns={columns}
              getRowId={(r) => r.sellerID}
              minWidth={900}
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
        )}

        {!isAdmin && (
          <section className={s.section}>
            {overview.isPending ? (
              <div className={s.card}><Spinner label="Cargando" /></div>
            ) : overview.isError ? (
              <div className={s.error} role="alert">No se pudo cargar tu panel.</div>
            ) : self ? (
              <>
                <div className={s.statGrid}>
                  <div className={s.stat}>
                    <strong>{self.clientsSoldTotal.toLocaleString("es-AR")}</strong>
                    <span>Clientes vendidos totales</span>
                  </div>
                  <div className={s.stat}>
                    <strong>{self.currentCycle.total.count.toLocaleString("es-AR")}</strong>
                    <span>Clientes vendidos este período</span>
                  </div>
                  <div className={s.stat}>
                    <strong>{self.currentCycle.points.toLocaleString("es-AR")}</strong>
                    <span>Puntos acumulados este período</span>
                  </div>
                  <div className={s.stat}>
                    <strong>{tierLabel(self)}</strong>
                    <span>Nivel de comisión alcanzado</span>
                  </div>
                  <div className={s.stat}>
                    <strong>{formatPaymentAmount(self.currentCycle.total.commission)}</strong>
                    <span>Comisión de este período</span>
                  </div>
                </div>
                <p className={s.hint}>
                  Ciclo actual: {new Date(self.cycle.start).toLocaleDateString("es-AR")} al{" "}
                  {new Date(self.cycle.end).toLocaleDateString("es-AR")}.
                </p>
              </>
            ) : (
              <p className={s.emptyState}>Sin datos todavía.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
