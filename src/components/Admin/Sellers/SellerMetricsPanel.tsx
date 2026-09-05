import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listAdminSellers, type SellerSummary } from "../../../api/adminSellers";
import { formatPaymentAmount, formatPaymentDay } from "../../../lib/adminPayments";
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

            <div className={s.tableWrap}>
              <table className={s.table}>
                <caption className={s.srOnly}>Ranking de vendedores por facturación</caption>
                <thead>
                  <tr>
                    <th scope="col" className={s.rankCol}>#</th>
                    <th scope="col">Vendedor</th>
                    <th scope="col">Facturación atribuida</th>
                    <th scope="col" className={s.numeric}>30 días</th>
                    <th scope="col" className={s.numeric}>Clientes</th>
                    <th scope="col" className={s.numeric}>Conversión</th>
                    <th scope="col" className={s.numeric}>Renovaciones</th>
                    <th scope="col">Última alta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((seller, index) => {
                    const metrics = seller.metrics;
                    const revenue = metrics?.revenueTotal ?? 0;
                    const share = topRevenue > 0 ? Math.round((revenue / topRevenue) * 100) : 0;
                    const conv = conversion(seller);

                    return (
                      <tr key={seller._id}>
                        <td className={s.rankCol}>{index + 1}</td>
                        <td>
                          <div className={s.sellerCell}>
                            <strong>{seller.name}</strong>
                            <span>{seller.code}</span>
                          </div>
                        </td>
                        <td>
                          <div className={s.revenueCell}>
                            <span className={s.revenueValue}>{money(metrics?.revenueTotal)}</span>
                            <span className={s.bar} aria-hidden>
                              <span className={s.barFill} style={{ width: `${share}%` }} />
                            </span>
                          </div>
                        </td>
                        <td className={s.numeric}>{money(metrics?.revenue30d)}</td>
                        <td className={s.numeric}>
                          {(metrics?.clientsTotal ?? 0).toLocaleString("es-AR")}
                        </td>
                        <td className={s.numeric}>
                          {conv === null ? "—" : `${conv}%`}
                        </td>
                        <td className={s.numeric}>
                          {(metrics?.renewals ?? 0).toLocaleString("es-AR")}
                        </td>
                        <td className={s.dateCell}>
                          {formatPaymentDay(metrics?.lastClientAt ?? null)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
