import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listAdminSellers, type SellerSummary } from "../../../api/adminSellers";
import { formatPaymentAmount, formatPaymentDay } from "../../../lib/adminPayments";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import Spinner from "../../Common/Spinner";
import s from "./SellerMetricsPanel.module.css";

// Comparación entre vendedores. La pantalla de gestión (AdminSellers) responde
// "quién es cada uno y cómo lo edito"; esta responde "cómo viene el equipo",
// que es una pregunta distinta y por eso vive en su propia ruta.
const money = (value: number | undefined) =>
  typeof value === "number" ? formatPaymentAmount(value, "ARS") : "—";

// Porcentaje de clientes atribuidos que efectivamente pagaron alguna vez.
// Es la métrica que separa vender de fichar: dos vendedores con las mismas
// altas pueden tener conversiones muy distintas.
function conversion(seller: SellerSummary): number | null {
  const total = seller.metrics?.clientsTotal ?? 0;
  const paying = seller.metrics?.payingClients;
  if (typeof paying !== "number" || total === 0) return null;
  return Math.round((paying / total) * 100);
}

export default function SellerMetricsPanel() {
  const sellers = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: ({ signal }) => listAdminSellers(signal),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const list = sellers.data ?? [];
    return [...list].sort(
      (a, b) => (b.metrics?.revenueTotal ?? 0) - (a.metrics?.revenueTotal ?? 0),
    );
  }, [sellers.data]);

  const totals = useMemo(
    () =>
      (sellers.data ?? []).reduce(
        (acc, seller) => {
          const m = seller.metrics;
          return {
            revenueTotal: acc.revenueTotal + (m?.revenueTotal ?? 0),
            revenue30d: acc.revenue30d + (m?.revenue30d ?? 0),
            clients: acc.clients + (m?.clientsTotal ?? 0),
            renewals: acc.renewals + (m?.renewals ?? 0),
          };
        },
        { revenueTotal: 0, revenue30d: 0, clients: 0, renewals: 0 },
      ),
    [sellers.data],
  );

  // La barra de cada fila se mide contra el que más facturó, no contra el
  // total: con muchos vendedores todas las barras contra el total quedarían
  // invisibles.
  const topRevenue = rows[0]?.metrics?.revenueTotal ?? 0;

  // El "#" es el puesto por facturación y no se mueve al reordenar la tabla:
  // si fuera la posición de la fila, ordenar por conversión mostraría un
  // ranking de facturación que no es tal.
  const rankById = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((seller, index) => map.set(seller._id, index + 1));
    return map;
  }, [rows]);

  const columns = useMemo<DataTableColumn<SellerSummary>[]>(() => [
    {
      id: "rank",
      header: "#",
      width: "46px",
      render: (seller) => <span className={s.rankCol}>{rankById.get(seller._id)}</span>,
    },
    {
      id: "seller",
      header: "Vendedor",
      width: "190px",
      sortValue: (seller) => seller.name,
      render: (seller) => (
        <div className={s.sellerCell}>
          <strong>{seller.name}</strong>
          <span>{seller.code}</span>
        </div>
      ),
    },
    {
      id: "revenue",
      header: "Facturación atribuida",
      width: "230px",
      initialDirection: "desc",
      sortValue: (seller) => seller.metrics?.revenueTotal,
      render: (seller) => {
        const revenue = seller.metrics?.revenueTotal ?? 0;
        const share = topRevenue > 0 ? Math.round((revenue / topRevenue) * 100) : 0;
        return (
          <div className={s.revenueCell}>
            <span className={s.revenueValue}>{money(seller.metrics?.revenueTotal)}</span>
            <span className={s.bar} aria-hidden>
              <span className={s.barFill} style={{ width: `${share}%` }} />
            </span>
          </div>
        );
      },
    },
    {
      id: "revenue30d",
      header: "30 días",
      align: "right",
      width: "130px",
      initialDirection: "desc",
      sortValue: (seller) => seller.metrics?.revenue30d,
      render: (seller) => money(seller.metrics?.revenue30d),
    },
    {
      id: "clients",
      header: "Clientes",
      align: "right",
      width: "100px",
      initialDirection: "desc",
      sortValue: (seller) => seller.metrics?.clientsTotal ?? 0,
      render: (seller) => (seller.metrics?.clientsTotal ?? 0).toLocaleString("es-AR"),
    },
    {
      id: "conversion",
      header: "Conversión",
      align: "right",
      width: "110px",
      initialDirection: "desc",
      sortValue: (seller) => conversion(seller),
      render: (seller) => {
        const conv = conversion(seller);
        return conv === null ? "—" : `${conv}%`;
      },
    },
    {
      id: "renewals",
      header: "Renovaciones",
      align: "right",
      width: "120px",
      initialDirection: "desc",
      sortValue: (seller) => seller.metrics?.renewals ?? 0,
      render: (seller) => (seller.metrics?.renewals ?? 0).toLocaleString("es-AR"),
    },
    {
      id: "lastClient",
      header: "Última alta",
      width: "130px",
      initialDirection: "desc",
      // Se ordena por la fecha real, no por el texto ya formateado.
      sortValue: (seller) => Date.parse(seller.metrics?.lastClientAt ?? "") || null,
      render: (seller) => (
        <span className={s.dateCell}>{formatPaymentDay(seller.metrics?.lastClientAt ?? null)}</span>
      ),
    },
  ], [rankById, topRevenue]);

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Administración de MenuDigital</p>
          <h1>Métricas de vendedores</h1>
          <p>Comparación del equipo por facturación atribuida, cartera y renovaciones.</p>
          <div className={s.headerLinks}>
            <Link to="/admin/sellers">← Volver a vendedores</Link>
            <Link to="/admin/sellers/comisiones">Calculadora de comisiones</Link>
          </div>
        </header>

        {sellers.isPending ? (
          <div className={s.loading}><Spinner size={28} label="Cargando métricas" /></div>
        ) : sellers.isError ? (
          <div className={s.error} role="alert">
            <p>No se pudieron cargar las métricas de vendedores.</p>
            <button
              className={s.secondaryButton}
              type="button"
              onClick={() => void sellers.refetch()}
              disabled={sellers.isFetching}
            >
              {sellers.isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className={s.empty} role="status">
            Todavía no hay vendedores cargados.
          </div>
        ) : (
          <>
            <section className={s.totals} aria-label="Totales del equipo">
              <article>
                <span>Facturado total</span>
                <strong>{money(totals.revenueTotal)}</strong>
              </article>
              <article>
                <span>Facturado 30 días</span>
                <strong>{money(totals.revenue30d)}</strong>
              </article>
              <article>
                <span>Clientes atribuidos</span>
                <strong>{totals.clients.toLocaleString("es-AR")}</strong>
              </article>
              <article>
                <span>Renovaciones</span>
                <strong>{totals.renewals.toLocaleString("es-AR")}</strong>
              </article>
            </section>

            <DataTable<SellerSummary>
              caption="Ranking de vendedores por facturación"
              rows={rows}
              columns={columns}
              getRowId={(seller) => seller._id}
              defaultSort={{ columnId: "revenue", direction: "desc" }}
              layout="fixed"
              minWidth={1050}
              rowClassName={() => s.tableRow}
            />

            <p className={s.footnote}>
              La facturación cuenta pagos aprobados y acreditados de los clientes
              atribuidos a cada vendedor, neta de reembolsos. "Conversión" es el
              porcentaje de sus clientes que pagó alguna vez. No estima comisiones.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
