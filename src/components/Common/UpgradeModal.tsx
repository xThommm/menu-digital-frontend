import { useMemo, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { PLAN_LABEL, PLAN_ORDER } from "../../lib/plans";
import type { Subscription } from "../../types";
import Spinner from "./Spinner";
import styles from "./UpgradeModal.module.css";

const PAID_PLANS = {
  basic: { price: 39_999 },
  pro: { price: 59_999 },
} as const;

const MONTH_OPTIONS = [
  { months: 1, label: "1 mes", multiplier: 1 },
  { months: 3, label: "3 meses", multiplier: 2.7 },
  { months: 6, label: "6 meses", multiplier: 5 },
  { months: 12, label: "12 meses", multiplier: 9 },
] as const;

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
  onClose: () => void;
}

export default function UpgradeModal({
  currentPlan,
  minPlan,
  title,
  description,
  allowCurrentPlan = false,
  onClose,
}: UpgradeModalProps) {
  const { token } = useAuth();
  const availablePlans = useMemo(
    () => (Object.keys(PAID_PLANS) as Array<keyof typeof PAID_PLANS>).filter(
      plan => PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minPlan)
        && PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(currentPlan)
        && (allowCurrentPlan || plan !== currentPlan)
    ),
    [allowCurrentPlan, currentPlan, minPlan]
  );
  const [planId, setPlanId] = useState<keyof typeof PAID_PLANS>(availablePlans[0] ?? minPlan);
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const option = MONTH_OPTIONS.find(item => item.months === months) ?? MONTH_OPTIONS[0];
  const monthlyPrice = PAID_PLANS[planId].price;
  const total = Math.round(monthlyPrice * option.multiplier);
  const savings = monthlyPrice * months - total;

  const handlePay = async () => {
    if (!token || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/payments/crear-preferencia", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, months }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        throw new Error(data.error || "No se pudo iniciar el pago.");
      }
      window.location.href = data.init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !submitting && onClose()} role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className={styles.modal} onClick={event => event.stopPropagation()}>
        <p className={styles.eyebrow}>{planId === currentPlan ? "Renovar plan" : "Mejorar plan"}</p>
        <h2 id="upgrade-title" className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>

        {availablePlans.length > 1 && (
          <div className={styles.section}>
            <span className={styles.label}>Elegí el plan</span>
            <div className={styles.options}>
              {availablePlans.map(plan => (
                <button key={plan} type="button" className={`${styles.option} ${planId === plan ? styles.selected : ""}`} onClick={() => setPlanId(plan)} disabled={submitting} aria-pressed={planId === plan}>
                  <strong>{PLAN_LABEL[plan]}</strong>
                  <span>{formatPrice(PAID_PLANS[plan].price)}/mes</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <span className={styles.label}>¿Por cuánto tiempo?</span>
          <div className={styles.months}>
            {MONTH_OPTIONS.map(item => (
              <button key={item.months} type="button" className={`${styles.month} ${months === item.months ? styles.selected : ""}`} onClick={() => setMonths(item.months)} disabled={submitting} aria-pressed={months === item.months}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.total}>
          <span>Total a pagar</span>
          <strong>{formatPrice(total)}</strong>
          {savings > 0 && <small>Ahorrás {formatPrice(savings)}</small>}
        </div>

        <p className={styles.validity}>
          {planId === currentPlan
            ? "Los meses se suman a la vigencia actual cuando MercadoPago aprueba el pago."
            : "La vigencia comienza cuando MercadoPago aprueba el pago."}
        </p>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button className={styles.cancel} type="button" onClick={onClose} disabled={submitting}>Cerrar</button>
          <button className={styles.pay} type="button" onClick={handlePay} disabled={submitting || availablePlans.length === 0}>
            {submitting ? <><Spinner size={14} /> Redirigiendo...</> : `Pagar ${formatPrice(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
