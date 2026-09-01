import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import {
  createAdminSeller,
  getAdminSeller,
  listAdminSellers,
  updateAdminSeller,
  type Seller,
  type SellerClient,
  type SellerDetail,
  type SellerMetrics,
  type SellerSummary,
} from "../../../api/adminSellers";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { useNotifications } from "../../../context/useNotifications";
import { formatPaymentDate } from "../../../lib/adminPayments";
import { PLAN_LABEL } from "../../../lib/plans";
import Spinner from "../../Common/Spinner";
import s from "./AdminSellers.module.css";

const ADMIN_SELLERS_QUERY_KEY = ["admin-sellers"] as const;
const sellerDetailQueryKey = (sellerID: string) => ["admin-seller", sellerID] as const;

type SellerSort = "clients" | "recent" | "name";

const emptySellerMetrics = (): SellerMetrics => ({
  clientsTotal: 0,
  activeAccounts: 0,
  paidCurrent: 0,
  newClients30d: 0,
  expiring30d: 0,
  expired: 0,
  withMenu: 0,
  plans: { basic: 0, pro: 0 },
  lastClientAt: null,
});

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-AR");
}

function normalizeText(value: string) {
  return value.trim();
}

function normalizeDni(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function isValidDni(value: string) {
  return /^\d{8,8}$/.test(value);
}

export default function AdminSellers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SellerSort>("clients");
  const sellers = useQuery({
    queryKey: ADMIN_SELLERS_QUERY_KEY,
    queryFn: ({ signal }) => listAdminSellers(signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    gcTime: 0,
  });

  const replaceSeller = (updated: Seller) => {
    queryClient.setQueryData<SellerSummary[]>(ADMIN_SELLERS_QUERY_KEY, (current) =>
      current?.map((item) =>
        item._id === updated._id ? { ...item, ...updated } : item,
      ),
    );
    queryClient.setQueryData<SellerDetail>(sellerDetailQueryKey(updated._id), (current) =>
      current ? { ...current, ...updated } : current,
    );
  };

  const prependSeller = (created: Seller) => {
    const summary: SellerSummary = { ...created, metrics: emptySellerMetrics() };
    queryClient.setQueryData<SellerSummary[]>(ADMIN_SELLERS_QUERY_KEY, (current) =>
      current ? [summary, ...current] : [summary],
    );
  };

  const overview = useMemo(
  () =>
    (sellers.data || []).reduce(
      (total, seller) => {
        const m = seller.metrics ?? emptySellerMetrics();
        return {
          clients: total.clients + m.clientsTotal,
          paidCurrent: total.paidCurrent + m.paidCurrent,
          newClients30d: total.newClients30d + m.newClients30d,
          expiring30d: total.expiring30d + m.expiring30d,
        };
      },
      { clients: 0, paidCurrent: 0, newClients30d: 0, expiring30d: 0 },
    ),
  [sellers.data],
);

  const visibleSellers = useMemo(() => {
    const term = normalizeSearch(search);
    const filtered = (sellers.data || []).filter((seller) =>
      normalizeSearch(`${seller.name} ${seller.code} ${seller.dni}`).includes(term),
    );

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "es-AR");
      if (sort === "recent") {
        const lastClientAtA = Date.parse(a.metrics?.lastClientAt || "") || 0;
        const lastClientAtB = Date.parse(b.metrics?.lastClientAt || "") || 0;
        return lastClientAtB - lastClientAtA;
      }
      return (
  (b.metrics?.clientsTotal ?? 0) - (a.metrics?.clientsTotal ?? 0) ||
  a.name.localeCompare(b.name, "es-AR")
        );
    });
  }, [search, sellers.data, sort]);

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Administración de MenuDigital</p>
          <h1>Vendedores</h1>
          <p>
            Rendimiento comercial, clientes atribuidos y gestión de códigos.
          </p>
        </header>

        <aside className={s.notice}>
          <strong>Nombre y DNI deben ser únicos.</strong>
          <p>
            El código (ej. ABC-123) lo genera el backend. Las métricas cuentan
            usuarios atribuidos y muestran su situación actual; no estiman comisiones.
          </p>
        </aside>

        {sellers.data && (
          <section className={s.overview} aria-label="Resumen de vendedores">
            <SummaryMetric label="Vendedores" value={sellers.data.length} />
            <SummaryMetric label="Clientes vendidos" value={overview.clients} />
            <SummaryMetric label="Planes pagos vigentes" value={overview.paidCurrent} />
            <SummaryMetric label="Altas en 30 días" value={overview.newClients30d} />
          </section>
        )}

        <CreateSellerForm onCreated={prependSeller} />

        {sellers.isPending ? (
          <div className={s.loading}>
            <Spinner size={28} label="Cargando vendedores" />
          </div>
        ) : sellers.isError ? (
          <div className={s.error} role="alert">
            <p>No se pudieron cargar los vendedores.</p>
            <button
              className={s.secondaryButton}
              onClick={() => void sellers.refetch()}
              disabled={sellers.isFetching}
            >
              {sellers.isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        ) : sellers.data.length === 0 ? (
          <div className={s.empty} role="status">
            Todavía no hay vendedores. Creá el primero arriba.
          </div>
        ) : (
          <>
            <section className={s.toolbar} aria-label="Filtrar vendedores">
              <label>
                Buscar
                <input
                  type="search"
                  value={search}
                  placeholder="Nombre, código o DNI"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label>
                Ordenar por
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SellerSort)}
                >
                  <option value="clients">Más clientes</option>
                  <option value="recent">Alta más reciente</option>
                  <option value="name">Nombre</option>
                </select>
              </label>
              <p aria-live="polite">
                {visibleSellers.length} de {sellers.data.length} vendedores
              </p>
            </section>

            {visibleSellers.length === 0 ? (
              <div className={s.empty} role="status">
                No hay vendedores que coincidan con la búsqueda.
              </div>
            ) : (
              <section className={s.list} aria-label="Listado de vendedores">
                {visibleSellers.map((seller) => (
                  <SellerCard
                    key={seller._id}
                    seller={seller}
                    onUpdated={replaceSeller}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className={s.summaryMetric}>
      <strong>{value.toLocaleString("es-AR")}</strong>
      <span>{label}</span>
    </article>
  );
}

function CreateSellerForm({
  onCreated,
}: {
  onCreated: (seller: Seller) => void;
}) {
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();

  const invalid =
    !normalizeText(name) || !isValidDni(dni) || !normalizeDni(dni);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const created = await createAdminSeller({
        name: normalizeText(name),
        dni: normalizeDni(dni),
      });
      notifications.success(
        `Vendedor ${created.name} creado · código ${created.code}`,
      );
      setName("");
      setDni("");
      onCreated(created);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const message = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(message || "Ya existe un vendedor con ese nombre o DNI.");
      } else {
        const serverMessage = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(
          serverMessage || "No se pudo crear el vendedor. Intentá de nuevo.",
        );
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <form className={s.createForm} onSubmit={submit} noValidate>
      <h2 className={s.sectionTitle}>Nuevo vendedor</h2>
      <div className={s.fields}>
        <label htmlFor="seller-create-name">
          Nombre
          <input
            id="seller-create-name"
            value={name}
            maxLength={80}
            disabled={saving}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
        </label>
        <label htmlFor="seller-create-dni">
          DNI
          <input
            id="seller-create-dni"
            value={dni}
            maxLength={20}
            disabled={saving}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => {
              setDni(normalizeDni(event.target.value));
              setError("");
            }}
          />
        </label>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <button
          className={s.primaryButton}
          type="submit"
          disabled={saving || invalid}
        >
          {saving && <Spinner />} {saving ? "Creando…" : "Crear vendedor"}
        </button>
      </div>
    </form>
  );
}

function SellerCard({
  seller,
  onUpdated,
}: {
  seller: SellerSummary;
  onUpdated: (seller: Seller) => void;
}) {

  const metrics = seller.metrics ?? emptySellerMetrics();

  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(seller.name);
  const [dni, setDni] = useState(seller.dni);
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();
  const invalid = !normalizeText(name) || !isValidDni(dni);
  const details = useQuery({
    queryKey: sellerDetailQueryKey(seller._id),
    queryFn: ({ signal }) => getAdminSeller(seller._id, signal),
    enabled: expanded,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const dirty = name !== seller.name || dni !== seller.dni;
  const clientsPanelID = `seller-${seller._id}-clients`;

  const reset = () => {
    setName(seller.name);
    setDni(seller.dni);
    setError("");
    setEditing(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !dirty || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminSeller(seller._id, {
        name: normalizeText(name),
        dni: normalizeDni(dni),
      });
      notifications.success(`Vendedor ${updated.name} actualizado.`);
      onUpdated(updated);
      setEditing(false);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const message = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(message || "Ya existe un vendedor con ese nombre o DNI.");
      } else {
        const serverMessage = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(serverMessage || "No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(seller.code);
      notifications.success(`Código ${seller.code} copiado.`);
    } catch {
      notifications.error("No se pudo copiar el código.");
    }
  };

  return (
    <article className={s.card} aria-labelledby={`seller-${seller._id}-title`}>
      <header className={s.cardHeader}>
        <div>
          <p className={s.eyebrow}>Código</p>
          <h2 id={`seller-${seller._id}-title`} className={s.code}>
            {seller.code}
          </h2>
        </div>
        <div className={s.cardHeaderActions}>
          <button className={s.secondaryButton} type="button" onClick={() => void copyCode()}>
            Copiar código
          </button>
          {!editing && (
            <button
              className={s.secondaryButton}
              type="button"
              onClick={() => setEditing(true)}
            >
              Editar
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <form className={s.editForm} onSubmit={submit} noValidate>
          <div className={s.fields}>
            <label htmlFor={`seller-${seller._id}-name`}>
              Nombre
              <input
                id={`seller-${seller._id}-name`}
                value={name}
                maxLength={80}
                disabled={saving}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
              />
            </label>
            <label htmlFor={`seller-${seller._id}-dni`}>
              DNI
              <input
                id={`seller-${seller._id}-dni`}
                value={dni}
                maxLength={20}
                disabled={saving}
                inputMode="numeric"
                onChange={(event) => {
                  setDni(normalizeDni(event.target.value));
                  setError("");
                }}
              />
            </label>
          </div>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <div className={s.actions}>
            <button
              className={s.primaryButton}
              type="submit"
              disabled={saving || !dirty || invalid}
            >
              {saving && <Spinner />} {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              className={s.secondaryButton}
              type="button"
              onClick={reset}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <dl className={s.meta}>
          <div>
            <dt>Nombre</dt>
            <dd>{seller.name}</dd>
          </div>
          <div>
            <dt>DNI</dt>
            <dd>{seller.dni}</dd>
          </div>
          <div>
            <dt>Vendedor desde</dt>
            <dd>{formatPaymentDate(seller.createdAt)}</dd>
          </div>
        </dl>
      )}

      <section className={s.metrics} aria-label={`Métricas de ${seller.name}`}>
  <SellerMetric label="Clientes vendidos" value={metrics.clientsTotal} />
  <SellerMetric label="Planes pagos vigentes" value={metrics.paidCurrent} />
  <SellerMetric label="Altas últimos 30 días" value={metrics.newClients30d} />
  <SellerMetric
    label="Última alta"
    value={formatPaymentDate(metrics.lastClientAt)}
  />
</section>

<div className={s.operationalSummary}>
  <span>Basic: <strong>{metrics.plans.basic}</strong></span>
  <span>Pro: <strong>{metrics.plans.pro}</strong></span>
  <span>Cuentas activas: <strong>{metrics.activeAccounts}</strong></span>
  <span>Con menú: <strong>{metrics.withMenu}</strong></span>
  <span className={metrics.expiring30d > 0 ? s.attention : undefined}>
    Vencen en 30 días: <strong>{metrics.expiring30d}</strong>
  </span>
  <span className={metrics.expired > 0 ? s.attention : undefined}>
    Vencidos: <strong>{metrics.expired}</strong>
  </span>
</div>

<button
  className={s.detailsButton}
  type="button"
  aria-expanded={expanded}
  aria-controls={clientsPanelID}
  onClick={() => setExpanded((current) => !current)}
>
  {expanded ? "Ocultar clientes" : `Ver clientes (${metrics.clientsTotal})`}
</button>

      {expanded && (
        <section id={clientsPanelID} className={s.clientsPanel} aria-label={`Clientes de ${seller.name}`}>
          {details.isPending ? (
            <div className={s.detailsLoading}>
              <Spinner size={24} label="Cargando clientes" />
            </div>
          ) : details.isError ? (
            <div className={s.inlineError} role="alert">
              <p>No se pudo cargar el detalle de clientes.</p>
              <button
                className={s.secondaryButton}
                type="button"
                onClick={() => void details.refetch()}
                disabled={details.isFetching}
              >
                {details.isFetching ? "Reintentando…" : "Reintentar"}
              </button>
            </div>
          ) : details.data.clients.length === 0 ? (
            <p className={s.clientsEmpty}>Este vendedor todavía no tiene clientes atribuidos.</p>
          ) : (
            <div className={s.clientList}>
              {details.data.clients.map((client) => (
                <SellerClientRow key={client._id} client={client} />
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function SellerMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={s.metric}>
      <strong>{typeof value === "number" ? value.toLocaleString("es-AR") : value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SellerClientRow({ client }: { client: SellerClient }) {
  const expired = client.subscription !== "free" && client.effectiveSubscription === "free";
  const planLabel = expired
    ? `${PLAN_LABEL[client.subscription]} vencido`
    : PLAN_LABEL[client.effectiveSubscription];
  const expiryLabel = client.subscriptionExpiresAt
    ? formatPaymentDate(client.subscriptionExpiresAt)
    : client.effectiveSubscription === "free"
      ? "Sin vencimiento"
      : "Vigencia legacy";

  return (
    <article className={s.clientRow}>
      <header className={s.clientHeader}>
        <div>
          <strong>{client.businessName || client.username}</strong>
          <span>@{client.username}</span>
        </div>
        <div className={s.clientBadges}>
          <span className={`${s.statusBadge} ${client.active ? s.statusOk : s.statusMuted}`}>
            {client.active ? "Cuenta activa" : "Cuenta inactiva"}
          </span>
          <span className={`${s.statusBadge} ${expired ? s.statusWarning : s.statusPlan}`}>
            {planLabel}
          </span>
        </div>
      </header>

      <dl className={s.clientMeta}>
        <div>
          <dt>Alta</dt>
          <dd>{formatPaymentDate(client.createdAt)}</dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>{expiryLabel}</dd>
        </div>
        <div>
          <dt>Menú creado</dt>
          <dd>{client.menu ? "Sí" : "No"}</dd>
        </div>
      </dl>

      <div className={s.clientActions}>
        <Link to={`/admin/crm?client=${client._id}`}>Abrir ficha CRM</Link>
        <Link to={`/admin/payments?userID=${client._id}`}>Ver pagos</Link>
      </div>
    </article>
  );
}
