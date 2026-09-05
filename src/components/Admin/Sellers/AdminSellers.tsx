import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { formatPaymentAmount, formatPaymentDate, formatPaymentDay } from "../../../lib/adminPayments";
import { PLAN_LABEL } from "../../../lib/plans";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import Spinner from "../../Common/Spinner";
import s from "./AdminSellers.module.css";

const ADMIN_SELLERS_QUERY_KEY = ["admin-sellers"] as const;
const sellerDetailQueryKey = (sellerID: string) => ["admin-seller", sellerID] as const;


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
  revenueTotal: 0,
  revenue30d: 0,
  payments: 0,
  renewals: 0,
  payingClients: 0,
});

// Un backend viejo no manda las métricas de plata. En ese caso mostramos un
// guion en vez de "$ 0,00", que se leería como "no vendió nada".
const formatSellerRevenue = (value: number | undefined) =>
  typeof value === "number" ? formatPaymentAmount(value, "ARS") : "—";

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
  const [creating, setCreating] = useState(false);
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

  // Columnas de la tabla. El orden ahora se hace clickeando el encabezado
  // (lo resuelve DataTable), así que el select "Ordenar por" ya no hace falta.
  const columns = useMemo<DataTableColumn<SellerSummary>[]>(() => [
    {
      id: "seller",
      header: "Vendedor",
      width: "210px",
      sortValue: (seller) => seller.name,
      render: (seller) => (
        <span className={s.rowName}>
          <strong>{seller.name}</strong>
          <span>DNI {seller.dni}</span>
        </span>
      ),
    },
    {
      id: "code",
      header: "Código",
      width: "120px",
      sortValue: (seller) => seller.code,
      render: (seller) => <code className={s.codeCell}>{seller.code}</code>,
    },
    {
      id: "clients",
      header: "Clientes",
      align: "right",
      width: "110px",
      sortValue: (seller) => seller.metrics?.clientsTotal ?? 0,
      render: (seller) => (seller.metrics?.clientsTotal ?? 0).toLocaleString("es-AR"),
    },
    {
      id: "paid",
      header: "Pagos vigentes",
      align: "right",
      width: "110px",
      sortValue: (seller) => seller.metrics?.paidCurrent ?? 0,
      render: (seller) => (seller.metrics?.paidCurrent ?? 0).toLocaleString("es-AR"),
    },
    {
      id: "revenue30d",
      header: "Facturado 30 d",
      align: "right",
      width: "140px",
      sortValue: (seller) => seller.metrics?.revenue30d,
      render: (seller) => formatSellerRevenue(seller.metrics?.revenue30d),
    },
    {
      id: "revenueTotal",
      header: "Facturado total",
      align: "right",
      width: "140px",
      sortValue: (seller) => seller.metrics?.revenueTotal,
      render: (seller) => formatSellerRevenue(seller.metrics?.revenueTotal),
    },
    {
      id: "lastClient",
      header: "Última alta",
      width: "130px",
      // Se ordena por la fecha real, no por el texto ya formateado.
      sortValue: (seller) => Date.parse(seller.metrics?.lastClientAt ?? "") || null,
      render: (seller) => (
        <span className={s.dateCell}>{formatPaymentDay(seller.metrics?.lastClientAt ?? null)}</span>
      ),
    },
  ], []);

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


        <DataTable<SellerSummary>
          caption="Listado de vendedores"
          rows={sellers.data ?? []}
          columns={columns}
          getRowId={(seller) => seller._id}
          minWidth={1000}
          defaultSort={{ columnId: "clients", direction: "desc" }}
          search={{
            accessor: (seller) => `${seller.name} ${seller.code} ${seller.dni}`,
            placeholder: "Nombre, código o DNI",
          }}
          countLabel={(visible, total) => `${visible} de ${total} vendedores`}
          loading={sellers.isPending}
          error={sellers.isError ? "No se pudieron cargar los vendedores." : null}
          onRetry={() => void sellers.refetch()}
          retrying={sellers.isFetching}
          emptyMessage={
            // El botón de alta vive en la barra, que no se muestra sin
            // vendedores: sin este, no habría forma de crear el primero.
            <div className={s.emptyState}>
              <p>Todavía no hay vendedores.</p>
              <button
                className={s.primaryButton}
                type="button"
                onClick={() => setCreating(true)}
              >
                Crear el primero
              </button>
            </div>
          }
          noResultsMessage="No hay vendedores que coincidan con la búsqueda."
          actions={
            <>
              <Link className={s.metricsLink} to="/admin/sellers/metricas">
                Panel de métricas
              </Link>
              <Link className={s.metricsLink} to="/admin/sellers/comisiones">
                Comisiones
              </Link>
              <button
                className={s.newSellerButton}
                type="button"
                onClick={() => setCreating(true)}
              >
                + Nuevo vendedor
              </button>
            </>
          }
          expandable={{
            label: (seller) => `Ver detalle de ${seller.name}`,
            renderPanel: (seller) => (
              <SellerPanel seller={seller} onUpdated={replaceSeller} />
            ),
          }}
        />

        {creating && (
          <CreateSellerModal
            onCreated={prependSeller}
            onClose={() => setCreating(false)}
          />
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

function CreateSellerModal({
  onCreated,
  onClose,
}: {
  onCreated: (seller: Seller) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Foco en el primer campo al abrir y cierre con Escape, igual que el drawer
  // del CRM. No se cierra mientras se está guardando para no dejar al usuario
  // sin saber si el alta salió.
  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      onCreated(created);
      onClose();
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
    // En un modal y no en la página: dar de alta un vendedor es una acción
    // ocasional que estaba ocupando espacio fijo arriba de la tabla, que es
    // lo que se viene a mirar todos los días.
    <div
      className={s.modalOverlay}
      onClick={() => { if (!saving) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-create-title"
    >
      <form
        className={s.modal}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        noValidate
      >
        <h2 id="seller-create-title" className={s.modalTitle}>Nuevo vendedor</h2>
        <p className={s.modalHint}>
          Nombre y DNI deben ser únicos. El código (ej. ABC-123) lo genera el backend.
        </p>

        <div className={s.modalFields}>
          <label htmlFor="seller-create-name">
            Nombre
            <input
              id="seller-create-name"
              ref={firstFieldRef}
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

        <div className={s.modalActions}>
          <button
            className={s.secondaryButton}
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className={s.primaryButton}
            type="submit"
            disabled={saving || invalid}
          >
            {saving && <Spinner />} {saving ? "Creando…" : "Crear vendedor"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Contenido del panel desplegable. La fila y el despliegue los maneja
// DataTable; acá queda solo el detalle del vendedor. El componente se monta
// recién al abrir, así que la consulta del detalle ya no necesita `enabled`.
function SellerPanel({
  seller,
  onUpdated,
}: {
  seller: SellerSummary;
  onUpdated: (seller: Seller) => void;
}) {
  const metrics = seller.metrics ?? emptySellerMetrics();

  const [editing, setEditing] = useState(false);
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
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const dirty = name !== seller.name || dni !== seller.dni;

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
    <>
      <div className={s.panelActions}>
                <button className={s.secondaryButton} type="button" onClick={() => void copyCode()}>
                  Copiar código
                </button>
                {!editing && (
                  <button
                    className={s.secondaryButton}
                    type="button"
                    onClick={() => setEditing(true)}
                  >
                    Editar datos
                  </button>
                )}
                <Link className={s.panelMetricsLink} to="/admin/sellers/metricas">
                  Ver métricas comparadas →
                </Link>
              </div>

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
                <SellerMetric label="Pagaron alguna vez" value={metrics.payingClients ?? 0} />
                <SellerMetric label="Planes pagos vigentes" value={metrics.paidCurrent} />
                <SellerMetric label="Altas últimos 30 días" value={metrics.newClients30d} />
                <SellerMetric label="Renovaciones" value={metrics.renewals ?? 0} />
                <SellerMetric label="Facturado total" value={formatSellerRevenue(metrics.revenueTotal)} />
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

              <section className={s.clientsPanel} aria-label={`Clientes de ${seller.name}`}>
                <p className={s.panelSectionTitle}>
                  Clientes atribuidos ({metrics.clientsTotal})
                </p>
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
    </>
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
