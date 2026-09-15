import { useQuery } from "@tanstack/react-query";
import { getInfluencerOverview, type InfluencerLead } from "../../../api/sellers";
import { useAuth } from "../../../context/useAuth";
import { useNotifications } from "../../../context/useNotifications";
import { extractServerMessage } from "../../../lib/apiErrors";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import { formatDateAR } from "../../../lib/dates";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import s from "../sellerPanel.module.css";

const columns: DataTableColumn<InfluencerLead>[] = [
  {
    id: "business", header: "Local", width: "250px",
    sortValue: (lead) => lead.businessName || lead.username,
    render: (lead) => lead.businessName || `@${lead.username}`,
  },
  {
    id: "createdAt", header: "Registro",
    sortValue: (lead) => Date.parse(lead.createdAt) || null,
    render: (lead) => formatDateAR(lead.createdAt),
  },
  {
    id: "status", header: "Estado",
    sortValue: (lead) => lead.status,
    filter: {
      accessor: (lead) => lead.status,
      options: [{ value: "pending", label: "Sin convertir" }, { value: "converted", label: "Convertido" }],
    },
    render: (lead) => lead.status === "converted" ? "Convertido" : "Sin convertir",
  },
  {
    id: "convertedAt", header: "Conversión",
    sortValue: (lead) => lead.convertedAt ? Date.parse(lead.convertedAt) : null,
    render: (lead) => formatDateAR(lead.convertedAt, { fallback: "Pendiente" }),
  },
  {
    id: "commission", header: "Comisión", align: "right",
    sortValue: (lead) => lead.commission,
    render: (lead) => formatPaymentAmount(lead.commission),
  },
];

export default function InfluencerOverview() {
  const { user } = useAuth();
  const notifications = useNotifications();
  const overview = useQuery({
    queryKey: ["influencer-overview", user?.id],
    queryFn: ({ signal }) => getInfluencerOverview(signal),
    staleTime: 15_000,
    gcTime: 0,
  });
  const data = overview.data;

  const copyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.profile.code);
      notifications.success("Código de referido copiado.");
    } catch {
      notifications.error("No se pudo copiar el código.");
    }
  };

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Panel de influencer</p>
          <h1>Mis referidos</h1>
          <p>Seguí los locales que llegaron con tu código, los convertidos y tus comisiones.</p>
        </header>

        {data && !overview.isError && (
          <section className={s.section} aria-label="Resumen de referidos">
            <div className={s.toolbar}>
              <span>Tu código: <strong>{data.profile.code}</strong></span>
              <button className={s.secondaryButton} type="button" onClick={() => void copyCode()}>Copiar código</button>
            </div>
            <div className={s.statGrid}>
              <div className={s.stat}><strong>{data.totals.leads.toLocaleString("es-AR")}</strong><span>Locales referidos</span></div>
              <div className={s.stat}><strong>{data.totals.conversions.toLocaleString("es-AR")}</strong><span>Leads convertidos</span></div>
              <div className={s.stat}><strong>{formatPaymentAmount(data.totals.commission)}</strong><span>Comisiones generadas</span></div>
            </div>
          </section>
        )}

        <section className={s.section}>
          <DataTable<InfluencerLead>
            caption="Locales referidos y comisiones"
            rows={data?.leads ?? []}
            columns={columns}
            getRowId={(lead) => lead._id}
            minWidth={760}
            defaultSort={{ columnId: "createdAt", direction: "desc" }}
            search={{ accessor: (lead) => `${lead.businessName} ${lead.username} ${lead.slug}`, placeholder: "Buscar local" }}
            countLabel={(visible, total) => `${visible} de ${total} referidos`}
            loading={overview.isPending}
            error={overview.isError ? extractServerMessage(overview.error, "No se pudieron cargar tus referidos.") : null}
            onRetry={() => void overview.refetch()}
            retrying={overview.isFetching}
            emptyMessage="Todavía no hay locales registrados con tu código."
            noResultsMessage="No hay referidos que coincidan con la búsqueda."
          />
        </section>
      </div>
    </main>
  );
}
