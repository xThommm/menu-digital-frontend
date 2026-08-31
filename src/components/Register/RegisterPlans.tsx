import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import { usePlans } from "../../hooks/usePlans";
import { getPlanFeatureLabels } from "../../lib/plans";
import Spinner from "../Common/Spinner";
import styles from "./RegisterPlans.module.css";

type PlanId = "free" | "basic" | "pro";

interface PendingRegister {
  username: string;
  password: string;
  acceptedTerms: boolean;
  contactInfo: { mail: string; businessName: string };
  registrationToken?: string;
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function readPending(): PendingRegister | null {
  try {
    const raw = sessionStorage.getItem("pendingRegister");
    if (!raw) return null;
    return JSON.parse(raw) as PendingRegister;
  } catch {
    sessionStorage.removeItem("pendingRegister");
    return null;
  }
}

function readPaymentError(): string {
  const status = new URLSearchParams(window.location.search).get("payment");
  if (status === "failure") {
    return "El pago no se completó. Podés intentar de nuevo.";
  }
  if (status === "pending") {
    return "El pago quedó pendiente. Cuando se acredite, tu cuenta se activará sola.";
  }
  return "";
}

function readSelectedPlan(): PlanId {
  const plan = new URLSearchParams(window.location.search).get("plan");
  return plan === "free" || plan === "basic" || plan === "pro" ? plan : "basic";
}

export default function RegisterPlansPage() {
  const navigate = useNavigate();
  const catalog = usePlans();
  const { login } = useAuth();
  const { success: notifySuccess } = useNotifications();
  const paymentStatus = new URLSearchParams(window.location.search).get("payment");

  // Inicialización lazy: sin setState dentro de useEffect
  const [pending] = useState<PendingRegister | null>(readPending);
  const [hasStoredRegistrationToken] = useState(
    () => Boolean(localStorage.getItem("pendingRegistrationToken"))
  );
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(readSelectedPlan);
  const [months, setMonths] = useState(1);
  const [error, setError] = useFeedbackMessage("error", readPaymentError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Solo navegación si no hay datos de registro
  useEffect(() => {
    if (!pending) {
      navigate(
        hasStoredRegistrationToken
          ? "/register/success"
          : `/register?plan=${selectedPlan}`,
        { replace: true }
      );
    } else if (paymentStatus === "pending" && pending.registrationToken) {
      // Compatibilidad con preferencias creadas antes de que el back_url de
      // pagos pendientes apuntara directamente a /register/success.
      navigate("/register/success?payment=pending", { replace: true });
    }
  }, [hasStoredRegistrationToken, paymentStatus, pending, navigate, selectedPlan]);

  const selected = catalog.data?.find(plan => plan.name === selectedPlan);
  const billingOption = selected?.billingOptions.find(option => option.months === months);
  const totalPrice = billingOption?.total;
  const ready = !!selected && !!billingOption && !catalog.isError && !catalog.isFetching;

  const handleContinue = async () => {
    if (!pending || !ready || !selected || isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    try {
      if (selectedPlan === "free") {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/users/register`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: pending.username,
              password: pending.password,
              acceptedTerms: pending.acceptedTerms,
              contactInfo: pending.contactInfo,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error al registrarse");

        sessionStorage.removeItem("pendingRegister");
        localStorage.removeItem("pendingRegistrationToken");
        await login(pending.username, pending.password);
        notifySuccess("Cuenta creada correctamente.");
        navigate("/dashboard", { replace: true });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/payments/crear-preferencia-registro`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...pending,
            planId: selectedPlan,
            months,
            planVersion: selected.version,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PLAN_PRICE_CHANGED") await catalog.refetch();
        throw new Error(data.error || data.message || "Error al iniciar el pago");
      }

      if (!data.registrationToken) {
        throw new Error("No se pudo preparar la activación de la cuenta");
      }

      // No borramos sessionStorage: si falla el pago y vuelve, puede reintentar
      sessionStorage.setItem(
        "pendingRegister",
        JSON.stringify({ ...pending, registrationToken: data.registrationToken })
      );
      // Permite recuperar la activación después de una recarga o de cerrar
      // la pestaña, sin guardar la contraseña fuera de sessionStorage.
      localStorage.setItem("pendingRegistrationToken", data.registrationToken);
      window.location.assign(data.init_point);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
      setIsSubmitting(false);
    }
  };

  if (!pending) {
    return null;
  }

  return (
    <div className="auth-page-shell">
      <div className={`auth-surface ${styles.card}`}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Menú Digital · Alta de cuenta</span>
          <h1>Elegí tu plan</h1>
          <p>
            Hola <strong>{pending.contactInfo.businessName}</strong>, elegí con
            qué plan querés empezar.
          </p>
        </div>

        {catalog.isPending && <Spinner label="Cargando planes" />}
        {catalog.isError && <div className={styles.errorBanner} role="alert"><p>No se pudieron cargar los planes. Intentá nuevamente.</p><button type="button" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>Reintentar</button></div>}
        <div className={styles.plansGrid}>
          {!catalog.isError && catalog.data?.map((plan) => (
            <button
              key={plan.name}
              type="button"
              className={`${styles.planCard} ${
                selectedPlan === plan.name ? styles.planSelected : ""
              } ${(plan.name === "basic") ? styles.planHighlight : ""}`}
              onClick={() => setSelectedPlan(plan.name)}
              disabled={isSubmitting}
              aria-pressed={selectedPlan === plan.name}
            >
              {(plan.name === "basic") && (
                <span className={styles.badge}>Recomendado</span>
              )}
              {selectedPlan === plan.name && (
                <span className={styles.selectionMark} aria-hidden>✓</span>
              )}
              <div className={styles.planName}>{plan.label}</div>
              <div className={styles.planPrice}>
                {plan.price === 0 ? (
                  "Gratis"
                ) : (
                  <>
                    {formatPrice(plan.effectivePrice)}
                    <span>/mes</span>
                  </>
                )}
              </div>
              <p className={styles.planDesc}>{plan.description}</p>
              <ul className={styles.features}>
                {getPlanFeatureLabels(plan.features).map((f) => (
                  <li key={f}><span aria-hidden>→</span>{f}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {selectedPlan !== "free" && ready && (
          <div className={styles.monthsSection}>
            <label className={styles.monthsLabel}>¿Por cuánto tiempo?</label>
            <div className={styles.monthsGrid}>
              {selected?.billingOptions.map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  className={`${styles.monthBtn} ${
                    months === opt.months ? styles.monthSelected : ""
                  }`}
                  onClick={() => setMonths(opt.months)}
                  disabled={isSubmitting}
                  aria-pressed={months === opt.months}
                >
                  {opt.months} {opt.months === 1 ? "mes" : "meses"}
                </button>
              ))}
            </div>
            <div className={styles.total}>
              <span className={styles.totalLabel}>Total a pagar</span>
              <strong>{formatPrice(totalPrice!)}</strong>
              {(billingOption?.savings ?? 0) > 0 && (
                <span className={styles.savings}>
                  Ahorrás {formatPrice(billingOption!.savings)}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className={styles.submitBtn}
          onClick={handleContinue}
          disabled={isSubmitting || !ready}
        >
          {isSubmitting
            ? "Procesando..."
            : !ready ? "Esperando catálogo…"
            : selectedPlan === "free"
            ? "Crear cuenta gratis"
            : `Pagar ${formatPrice(totalPrice!)} y crear cuenta`}
        </button>

        {selectedPlan !== "free" && ready && (
          <p className={styles.secure}>Pago seguro · Tus datos están protegidos</p>
        )}

        <div className={styles.back}>
          <Link to={`/register?plan=${selectedPlan}`}>← Volver al formulario</Link>
        </div>
      </div>
    </div>
  );
}
