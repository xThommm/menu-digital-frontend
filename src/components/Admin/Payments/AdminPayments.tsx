import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAdminPayments } from "../../../api/adminPayments";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { extractServerMessage } from "../../../lib/apiErrors";
import {
  ENTITLEMENT_LABEL,
  OPERATION_LABEL,
  PAYMENT_STATUS_LABEL,
  formatPaymentAmount,
  formatPaymentDate,
  humanizePaymentCode,
} from "../../../lib/adminPayments";
import type {
  AdminPayment,
  AdminPaymentEntitlement,
  AdminPaymentOperation,
  AdminPaymentsResponse,
} from "../../../types";
import s from "./AdminPayments.module.css";

const paymentTone = (status: string | null) => {
  if (status === "approved") return s.toneSuccess;
  if (["pending", "authorized", "in_process", "in_mediation"].includes(status || "")) return s.toneWarning;
  if (["rejected", "cancelled", "refunded", "charged_back"].includes(status || "")) return s.toneDanger;
  return s.toneNeutral;
};

const entitlementTone = (status: AdminPaymentEntitlement) => {
  if (status === "applied") return s.toneSuccess;
  if (status === "pending") return s.toneWarning;
  return s.toneDanger;
};

export default function AdminPayments() {
  const [urlParams, setUrlParams] = useSearchParams();
  const clientID = urlParams.get("userID") || undefined;
  const [data, setData] = useState<AdminPaymentsResponse | null>(null);
  const [loadedQueryKey, setLoadedQueryKey] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [entitlement, setEntitlement] = useState<AdminPaymentEntitlement | "all">("all");
  const [operation, setOperation] = useState<AdminPaymentOperation | "all">("all");
  const [page, setPage] = useState(1);
  const [expandedID, setExpandedID] = useState<string | null>(null);
  const queryKey = JSON.stringify([page, search, status, entitlement, operation, clientID || ""]);
  const loading = loadedQueryKey !== queryKey;

  useEffect(() => {
    let cancelled = false;

    listAdminPayments({ page, limit: 25, search, status, entitlement, operation, userID: clientID })
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setData(null);
          setError(extractServerMessage(err, "No se pudo cargar el historial de pagos."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedQueryKey(queryKey);
      });

    return () => { cancelled = true; };
  }, [clientID, entitlement, operation, page, queryKey, search, setError, status]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  };

  const clearClientFilter = () => {
    const next = new URLSearchParams(urlParams);
    next.delete("userID");
    setUrlParams(next, { replace: true });
    setPage(1);
  };

  const payments = data?.payments || [];
  const summary = data?.summary;
  const pagination = data?.pagination;
  const selectedCustomer = payments.find((payment) => payment.customer)?.customer;

  return (
    <div className={s.wrap}>
      <header className={s.topBar}>
        <div className={s.topBarInner}>
          <div>
            <p className={s.eyebrow}>Operación financiera</p>
            <h1 className={s.title}>Pagos</h1>
          </div>
          {pagination && <span className={s.countBadge}>{pagination.total} registros</span>}
        </div>
      </header>

      <main className={s.content}>
        {clientID && (
          <div className={s.clientFilterBanner}>
            <span>
              Historial de {selectedCustomer?.businessName || selectedCustomer?.username || "este cliente"}
            </span>
            <button type="button" onClick={clearClientFilter}>Ver todos los pagos</button>
          </div>
        )}

        {summary && (
          <section className={s.kpiGrid} aria-label="Resumen de pagos">
            <Kpi label="Importe acreditado" value={formatPaymentAmount(summary.appliedAmount, summary.currency)} accent="gold" />
            <Kpi label="Aprobados" value={summary.approved} accent="green" />
            <Kpi label="Pendientes" value={summary.pending} />
            <Kpi label="Requieren atención" value={summary.attention} accent={summary.attention ? "red" : undefined} />
          </section>
        )}

        <section className={s.filters} aria-label="Filtros de pagos">
          <form className={s.searchForm} onSubmit={submitSearch}>
            <input
              className={s.searchInput}
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Cliente, negocio, pago o preferencia…"
              aria-label="Buscar pagos"
            />
            <button type="submit" className={s.searchButton}>Buscar</button>
          </form>

          <select
            className={s.select}
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            aria-label="Filtrar por estado de Mercado Pago"
          >
            <option value="all">Todos los estados MP</option>
            <option value="approved">Aprobados</option>
            <option value="pending">Pendientes</option>
            <option value="authorized">Autorizados</option>
            <option value="in_process">En proceso</option>
            <option value="in_mediation">En mediación</option>
            <option value="rejected">Rechazados</option>
            <option value="cancelled">Cancelados</option>
            <option value="refunded">Reembolsados</option>
            <option value="charged_back">Contracargos</option>
          </select>

          <select
            className={s.select}
            value={entitlement}
            onChange={(event) => {
              setEntitlement(event.target.value as AdminPaymentEntitlement | "all");
              setPage(1);
            }}
            aria-label="Filtrar por acreditación del plan"
          >
            <option value="all">Todas las acreditaciones</option>
            <option value="applied">Plan acreditado</option>
            <option value="pending">Acreditación pendiente</option>
            <option value="not_applied">Plan no acreditado</option>
          </select>

          <select
            className={s.select}
            value={operation}
            onChange={(event) => {
              setOperation(event.target.value as AdminPaymentOperation | "all");
              setPage(1);
            }}
            aria-label="Filtrar por tipo de operación"
          >
            <option value="all">Todas las operaciones</option>
            <option value="registration">Altas</option>
            <option value="upgrade">Upgrades</option>
            <option value="renewal">Renovaciones</option>
            <option value="unknown">Sin identificar</option>
          </select>
        </section>

        {error && <div className={s.errorBanner}>{error}</div>}

        <section className={s.paymentPanel} aria-busy={loading}>
          <div className={s.tableHeader} aria-hidden>
            <span>Cliente</span><span>Operación</span><span>Importe</span>
            <span>Estado MP</span><span>Acreditación</span><span>Fecha</span><span />
          </div>

          {loading && !data ? (
            <div className={s.loadingState}><div className="pageLoaderRing" /></div>
          ) : payments.length === 0 ? (
            <p className={s.emptyState}>No hay pagos que coincidan con estos filtros.</p>
          ) : (
            <div className={s.paymentList}>
              {payments.map((payment) => {
                const expanded = expandedID === payment.id;
                return (
                  <article className={s.paymentRow} key={payment.id || payment.paymentID}>
                    <div className={s.paymentMain}>
                      <div className={s.customerCell} data-label="Cliente">
                        {payment.customer?.id ? (
                          <Link to={`/admin/crm?client=${payment.customer.id}`} className={s.customerLink}>
                            {payment.customer.businessName || `@${payment.customer.username}`}
                          </Link>
                        ) : (
                          <span>{payment.customer?.businessName || payment.customer?.username || "Sin asociar"}</span>
                        )}
                        {payment.customer?.businessName && payment.customer.username && (
                          <small>@{payment.customer.username}</small>
                        )}
                      </div>
                      <span data-label="Operación">{OPERATION_LABEL[payment.operation]}</span>
                      <strong data-label="Importe">{formatPaymentAmount(payment.amount, payment.currency || "ARS")}</strong>
                      <span data-label="Estado MP" className={`${s.statusPill} ${paymentTone(payment.status)}`}>
                        {PAYMENT_STATUS_LABEL[payment.status || ""] || payment.status || "Sin estado"}
                      </span>
                      <span data-label="Acreditación" className={`${s.statusPill} ${entitlementTone(payment.entitlementStatus)}`}>
                        {ENTITLEMENT_LABEL[payment.entitlementStatus]}
                      </span>
                      <span data-label="Fecha" className={s.dateCell}>
                        {formatPaymentDate(payment.paymentCreatedAt || payment.createdAt)}
                      </span>
                      <button
                        type="button"
                        className={s.expandButton}
                        onClick={() => setExpandedID(expanded ? null : payment.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Ocultar" : "Ver"} detalles del pago ${payment.paymentID}`}
                      >
                        {expanded ? "−" : "+"}
                      </button>
                    </div>

                    {expanded && <PaymentDetails payment={payment} />}
                  </article>
                );
              })}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <nav className={s.pagination} aria-label="Paginación de pagos">
              <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page <= 1 || loading}>
                Anterior
              </button>
              <span>Página {pagination.page} de {pagination.pages}</span>
              <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= pagination.pages || loading}>
                Siguiente
              </button>
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: "gold" | "green" | "red" }) {
  return (
    <div className={`${s.kpi} ${accent ? s[`kpi_${accent}`] : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PaymentDetails({ payment }: { payment: AdminPayment }) {
  return (
    <div className={s.paymentDetails}>
      <Detail label="ID de pago" value={payment.paymentID} />
      <Detail label="Ambiente MP" value={payment.liveMode === false ? "Prueba" : payment.liveMode === true ? "Producción" : "—"} />
      <Detail label="Preferencia" value={payment.preferenceId || "—"} />
      <Detail label="Plan / período" value={`${payment.planId || "—"}${payment.months ? ` · ${payment.months} mes(es)` : ""}`} />
      <Detail label="Detalle MP" value={humanizePaymentCode(payment.statusDetail)} />
      <Detail label="Motivo acreditación" value={humanizePaymentCode(payment.entitlementReason)} />
      <Detail label="Validación checkout" value={`${payment.checkoutValidation}${payment.checkoutValidationReason ? ` · ${humanizePaymentCode(payment.checkoutValidationReason)}` : ""}`} />
      <Detail label="Estado checkout" value={payment.checkout?.status || "—"} />
      <Detail label="Último webhook" value={formatPaymentDate(payment.lastWebhookAt)} />
      <Detail label="Aprobado por MP" value={formatPaymentDate(payment.paymentApprovedAt)} />
      <Detail label="Vencimiento aplicado" value={formatPaymentDate(payment.subscriptionExpiresAtAfter)} />
      {payment.refundedAmount ? (
        <Detail label="Importe reembolsado" value={formatPaymentAmount(payment.refundedAmount, payment.currency || "ARS")} />
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
