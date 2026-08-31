import { useMemo, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import { getPlanFeatureLabels, PLAN_ORDER } from "../../lib/plans";
import type { Subscription, BooleanPlanFeature } from "../../types";
import { usePlans } from "../../hooks/usePlans";
import Spinner from "./Spinner";
import styles from "./UpgradeModal.module.css";

function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

interface UpgradeModalProps {
  currentPlan: Subscription;
  minPlan: "basic" | "pro";
  title: string;
  description: string;
  allowCurrentPlan?: boolean;
  requiredFeature?: BooleanPlanFeature;
  requiredTemplateId?: number;
  minimumItems?: number;
  onClose: () => void;
}

export default function UpgradeModal({
  currentPlan,
  minPlan,
  title,
  description,
  allowCurrentPlan = false,
  requiredFeature, requiredTemplateId, minimumItems,
  onClose,
}: UpgradeModalProps) {
  const { token } = useAuth();
  const catalog = usePlans();
  const availablePlans = useMemo(
    () => (catalog.isError ? [] : catalog.data ?? []).filter(plan => plan.name !== "free"
      && PLAN_ORDER.indexOf(plan.name) >= PLAN_ORDER.indexOf(minPlan)
      && PLAN_ORDER.indexOf(plan.name) >= PLAN_ORDER.indexOf(currentPlan)
      && (allowCurrentPlan || plan.name !== currentPlan)
      && (!requiredFeature || plan.features[requiredFeature])
      && (requiredTemplateId === undefined || plan.features.templateIds.includes(requiredTemplateId))
      && (minimumItems === undefined || plan.features.item_limit === null || plan.features.item_limit >= minimumItems)),
    [catalog.data, catalog.isError, allowCurrentPlan, currentPlan, minPlan, requiredFeature, requiredTemplateId, minimumItems]
  );
  const [planId, setPlanId] = useState<Subscription>(minPlan);
  const selected = availablePlans.find(plan => plan.name === planId) ?? availablePlans[0];
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useFeedbackMessage("error");

  const option = selected?.billingOptions.find(item => item.months === months);
  const total = option?.total;
  const savings = option?.savings ?? 0;
  const ready = !!selected && !!option && !catalog.isFetching && !catalog.isError;

  const handlePay = async () => {
    if (!token || submitting || !ready || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/payments/crear-preferencia", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: selected.name, months, planVersion: selected.version }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        if (data.code === "PLAN_PRICE_CHANGED") await catalog.refetch();
        throw new Error(data.error || data.message || "No se pudo iniciar el pago.");
      }
      window.location.assign(data.init_point);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !submitting && onClose()} role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className={styles.modal} onClick={event => event.stopPropagation()}>
        <p className={styles.eyebrow}>{selected?.name === currentPlan ? "Renovar plan" : "Mejorar plan"}</p>
        <h2 id="upgrade-title" className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>

        {catalog.isPending && <Spinner label="Cargando planes" />}
        {catalog.isError && <div className={styles.error} role="alert"><p>No se pudieron consultar los planes.</p><button className={styles.cancel} type="button" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>Reintentar</button></div>}
        {!catalog.isPending && !catalog.isError && availablePlans.length === 0 && <p className={styles.error}>No hay un plan disponible que incluya esta función o amplíe tu límite.</p>}
        {availablePlans.length > 0 && (
          <div className={styles.section}>
            <span className={styles.label}>Elegí el plan</span>
            <div className={styles.options}>
              {availablePlans.map(plan => (
                <button key={plan.name} type="button" className={`${styles.option} ${selected?.name === plan.name ? styles.selected : ""}`} onClick={() => setPlanId(plan.name)} disabled={submitting} aria-pressed={selected?.name === plan.name}>
                  <strong>{plan.label}</strong>
                  <span>{formatPrice(plan.effectivePrice)}/mes</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <span className={styles.label}>¿Por cuánto tiempo?</span>
          <div className={styles.months}>
            {selected?.billingOptions.map(item => (
              <button key={item.months} type="button" className={`${styles.month} ${months === item.months ? styles.selected : ""}`} onClick={() => setMonths(item.months)} disabled={submitting} aria-pressed={months === item.months}>
                {item.months} {item.months === 1 ? "mes" : "meses"}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.total}>
          <span>Total a pagar</span>
          <strong>{total === undefined ? "—" : formatPrice(total)}</strong>
          {savings > 0 && <small>Ahorrás {formatPrice(savings)}</small>}
        </div>

        {selected && <ul className={styles.benefits}>{getPlanFeatureLabels(selected.features).map(label => <li key={label}>{label}</li>)}</ul>}
        <p className={styles.validity}>
          {selected?.name === currentPlan
            ? "Los meses se suman a la vigencia actual cuando MercadoPago aprueba el pago."
            : "La vigencia comienza cuando MercadoPago aprueba el pago."}
        </p>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button className={styles.cancel} type="button" onClick={onClose} disabled={submitting}>Cerrar</button>
          <button className={styles.pay} type="button" onClick={handlePay} disabled={submitting || !ready}>
            {submitting ? <><Spinner size={14} /> Redirigiendo...</> : ready ? `Pagar ${formatPrice(total!)}` : "Esperando catálogo"}
          </button>
        </div>
      </div>
    </div>
  );
}
