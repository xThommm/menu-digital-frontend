import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/useAuth";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import { getPlanUpgradeLabels, PLAN_LABEL, PLAN_ORDER } from "../../lib/plans";
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
  const { token, user, logout } = useAuth();
  // Mientras la cuenta tenga sellerID (vino de un código de promoción), cada
  // pago real usa el discountPrice del plan elegido — para siempre, no solo
  // la primera vez (ver /crear-preferencia en el backend). El catálogo
  // público (usePlans) nunca trae el descuento aplicado a effectivePrice a
  // propósito, así que acá se calcula aparte para mostrar lo que
  // efectivamente se va a cobrar.
  const hasPromoDiscount = Boolean(user?.sellerID);
  const priceFor = (plan: { effectivePrice: number; discountPrice: number | null }) =>
    hasPromoDiscount && plan.discountPrice != null ? plan.discountPrice : plan.effectivePrice;
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
  // El plan anterior en la escalera (no necesariamente ofertado acá: para el
  // Básico es el Gratuito, que ni aparece en availablePlans) — sirve para no
  // repetir en la lista lo que ese plan anterior ya incluye.
  const previousPlanName = selected ? PLAN_ORDER[PLAN_ORDER.indexOf(selected.name) - 1] : undefined;
  const previousPlan = previousPlanName && !catalog.isError
    ? catalog.data?.find(plan => plan.name === previousPlanName)
    : undefined;
  const upgradeLabels = selected ? getPlanUpgradeLabels(selected.features, previousPlan?.features ?? null) : [];
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useFeedbackMessage("error");

  const option = selected?.billingOptions.find(item => item.months === months);
  // option.total/savings vienen calculados server-side siempre sobre el
  // precio regular (ver planCatalog.js) — si la cuenta tiene descuento por
  // promoción, se recalculan acá con el mismo multiplicador de período para
  // que coincidan con lo que /crear-preferencia realmente va a cobrar.
  const monthlyPrice = selected ? priceFor(selected) : undefined;
  const total = selected && option && monthlyPrice != null
    ? Math.round(monthlyPrice * option.multiplier)
    : option?.total;
  const periodSavings = total != null && monthlyPrice != null
    ? Math.round(monthlyPrice * months) - total
    : (option?.savings ?? 0);
  const promoSavings = hasPromoDiscount && selected?.discountPrice != null && option
    ? Math.round((selected.effectivePrice - selected.discountPrice) * option.multiplier)
    : 0;
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

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      let data: { init_point?: string; code?: string; error?: string; message?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("Ocurrió un error inesperado. Intentá de nuevo en unos minutos.");
      }

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

  // Portal a document.body: este modal se invoca desde puntos bien anidados
  // del árbol (dashboard, editores) y cualquiera de esos ancestros puede
  // crear su propio contexto de apilamiento (position/transform/etc.) — sin
  // portal, el z-index del overlay solo compite DENTRO de ese contexto, y el
  // dock de navegación mobile (que vive al nivel raíz del layout) terminaba
  // tapando los botones de abajo pese a tener un z-index mucho menor.
  return createPortal(
    <div className={styles.overlay} onClick={() => !submitting && onClose()} role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className={`${styles.modal} grain`} onClick={event => event.stopPropagation()}>
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
                  <span>{formatPrice(priceFor(plan))}/mes</span>
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
          {promoSavings > 0 && <small>Precio con tu código de promoción · ahorrás {formatPrice(promoSavings)}</small>}
          {periodSavings > 0 && <small>Ahorrás {formatPrice(periodSavings)} por elegir {months} {months === 1 ? "mes" : "meses"}</small>}
        </div>

        {selected && (
          <>
            {previousPlan && (
              <p className={styles.benefitsIntro}>Todo lo del plan {PLAN_LABEL[previousPlan.name]} +</p>
            )}
            <ul className={styles.benefits}>{upgradeLabels.map(label => <li key={label}>{label}</li>)}</ul>
          </>
        )}
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
    </div>,
    document.body,
  );
}
