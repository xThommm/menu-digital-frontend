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
  contactInfo: { mail: string; businessName: string; number: number };
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

function GiftIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8" />
      <path d="M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8" />
    </svg>
  );
}

function FeatureCheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const MONTH_OPTION_COPY: Record<
  1 | 3 | 6 | 12,
  { title: string; subtitle: string }
> = {
  1: {
    title: "1 mes",
    subtitle: "Ideal para probar",
  },
  3: {
    title: "3 meses",
    subtitle: "Prueba extendida",
  },
  6: {
    title: "6 meses",
    subtitle: "Medio año al precio de hoy · 1 mes de regalo",
  },
  12: {
    title: "12 meses",
    subtitle: "Un año al precio actual · 3 meses de regalo",
  },
};

export default function RegisterPlansPage() {
  const navigate = useNavigate();
  const catalog = usePlans();
  const { login } = useAuth();
  const { success: notifySuccess } = useNotifications();
  const paymentStatus = new URLSearchParams(window.location.search).get(
    "payment",
  );
  const [sellerCodeInput, setSellerCodeInput] = useState("");
  const [appliedSellerCode, setAppliedSellerCode] = useState<string | null>(
    null,
  );
  const [sellerCodeError, setSellerCodeError] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);

  // Inicialización lazy: sin setState dentro de useEffect
  const [pending] = useState<PendingRegister | null>(readPending);
  const [hasStoredRegistrationToken] = useState(() =>
    Boolean(localStorage.getItem("pendingRegistrationToken")),
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
        { replace: true },
      );
    } else if (paymentStatus === "pending" && pending.registrationToken) {
      // Compatibilidad con preferencias creadas antes de que el back_url de
      // pagos pendientes apuntara directamente a /register/success.
      navigate("/register/success?payment=pending", { replace: true });
    }
  }, [
    hasStoredRegistrationToken,
    paymentStatus,
    pending,
    navigate,
    selectedPlan,
  ]);

  const selected = catalog.data?.find((plan) => plan.name === selectedPlan);
  const proPlan = catalog.data?.find((plan) => plan.name === "pro");

  // Un código de promoción válido ya no da un precio con descuento acá — da
  // acceso a la prueba gratis del plan Pro (ver handleStartTrial), que
  // reemplaza el pago inmediato. El precio de pago sigue siendo siempre el
  // de lista.
  const monthly = selected?.price ?? 0;
  const multiplier = selected?.periodMultipliers?.[months as 1 | 3 | 6 | 12];
  const totalPrice =
    selected && multiplier != null
      ? Math.round(monthly * multiplier)
      : undefined;

  // Costo si pagaras cada mes suelto al mismo precio mensual actual
  const fullMonthsTotal =
    selected && totalPrice != null ? monthly * months : undefined;

  // Ahorro por el multiplicador (3 / 6 / 12 meses)
  const periodSavings =
    fullMonthsTotal != null && totalPrice != null
      ? fullMonthsTotal - totalPrice
      : 0;

  const ready =
  !!selected
  && !catalog.isError
  && !catalog.isFetching
  && (
    selectedPlan === "free"
    || (totalPrice != null && totalPrice > 0)
  );

  const applySellerCode = async () => {
    const code = sellerCodeInput.trim().toUpperCase();
    setSellerCodeError("");
    if (!code) {
      setSellerCodeError("Ingresá un código.");
      return;
    }
    if (!/^[A-Z]{3}-\d{3}$/.test(code)) {
      setSellerCodeError("Formato inválido. Ejemplo: ABC-123");
      return;
    }
    setValidatingCode(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/payments/validate-seller-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedSellerCode(null);
        setSellerCodeError(data.message || "Código no encontrado");
        return;
      }
      setAppliedSellerCode(data.code);
      setSellerCodeInput(data.code);
    } catch {
      setAppliedSellerCode(null);
      setSellerCodeError("No se pudo validar el código. Intentá de nuevo.");
    } finally {
      setValidatingCode(false);
    }
  };

  const clearSellerCode = () => {
    setAppliedSellerCode(null);
    setSellerCodeInput("");
    setSellerCodeError("");
  };

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
          },
        );
        const data = await res.json().catch(() => ({}));
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
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "PLAN_PRICE_CHANGED") await catalog.refetch();
        throw new Error(
          data.error || data.message || "Error al iniciar el pago",
        );
      }

      if (!data.registrationToken) {
        throw new Error("No se pudo preparar la activación de la cuenta");
      }

      // No borramos sessionStorage: si falla el pago y vuelve, puede reintentar
      sessionStorage.setItem(
        "pendingRegister",
        JSON.stringify({
          ...pending,
          registrationToken: data.registrationToken,
        }),
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

  // Con un código de promoción válido, la única acción disponible es empezar
  // la prueba gratis (reemplaza pagar de una) — crea el User definitivo sin
  // pasar por Mercado Pago, siempre en plan Pro sin importar la card elegida.
  const handleStartTrial = async () => {
    if (!pending || !appliedSellerCode || isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/users/register-trial`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: pending.username,
            password: pending.password,
            acceptedTerms: pending.acceptedTerms,
            contactInfo: pending.contactInfo,
            sellerCode: appliedSellerCode,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "No se pudo activar la prueba gratuita");
      }

      sessionStorage.removeItem("pendingRegister");
      localStorage.removeItem("pendingRegistrationToken");
      await login(pending.username, pending.password);
      notifySuccess("¡Cuenta creada! Tenés 7 días de Pro gratis.");
      navigate("/dashboard", { replace: true });
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
        {catalog.isError && (
          <div className={styles.errorBanner} role="alert">
            <p>No se pudieron cargar los planes. Intentá nuevamente.</p>
            <button
              type="button"
              onClick={() => void catalog.refetch()}
              disabled={catalog.isFetching}
            >
              Reintentar
            </button>
          </div>
        )}
        {!appliedSellerCode && (
          <div className={styles.plansGrid}>
            {!catalog.isError &&
              catalog.data?.map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  className={`${styles.planCard} ${
                    selectedPlan === plan.name ? styles.planSelected : ""
                  } ${plan.name === "basic" ? styles.planHighlight : ""}`}
                  onClick={() => setSelectedPlan(plan.name)}
                  disabled={isSubmitting}
                  aria-pressed={selectedPlan === plan.name}
                >
                  {plan.name === "basic" && (
                    <span className={styles.badge}>Recomendado</span>
                  )}
                  {selectedPlan === plan.name && (
                    <span className={styles.selectionMark} aria-hidden>
                      ✓
                    </span>
                  )}
                  <div className={styles.planName}>{plan.label}</div>
                  <div className={styles.planPrice}>
                    {plan.price === 0 ? (
                      "Gratis"
                    ) : (
                      <>
                        {formatPrice(plan.price)}
                        <span>/mes</span>
                      </>
                    )}
                  </div>
                  <p className={styles.planDesc}>{plan.description}</p>
                  <ul className={styles.features}>
                    {getPlanFeatureLabels(plan.features).map((f) => (
                      <li key={f}>
                        <span aria-hidden>→</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
          </div>
        )}

        <div className={styles.sellerSection}>
          <label className={styles.sellerLabel} htmlFor="seller-code">
            Código de promoción
            <span className={styles.sellerOptional}>opcional</span>
          </label>
            <div className={styles.sellerRow}>
              <input
                id="seller-code"
                className={styles.sellerInput}
                value={sellerCodeInput}
                maxLength={7}
                autoComplete="off"
                spellCheck={false}
                disabled={
                  isSubmitting || validatingCode || Boolean(appliedSellerCode)
                }
                placeholder="ABC-123"
                onChange={(e) => {
                  setSellerCodeInput(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9-]/g, "")
                      .slice(0, 7),
                  );
                  setSellerCodeError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!appliedSellerCode) void applySellerCode();
                  }
                }}
              />
              {appliedSellerCode ? (
                <button
                  type="button"
                  className={styles.sellerClearBtn}
                  onClick={clearSellerCode}
                  disabled={isSubmitting}
                >
                  Quitar
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.sellerApplyBtn}
                  onClick={() => void applySellerCode()}
                  disabled={
                    isSubmitting || validatingCode || !sellerCodeInput.trim()
                  }
                >
                  {validatingCode ? "Validando…" : "Aplicar código"}
                </button>
              )}
            </div>
            {appliedSellerCode && (
              <div className={styles.trialPromo} role="status">
                <div className={styles.trialPromoHeader}>
                  <span className={styles.trialPromoIcon}>
                    <GiftIcon />
                  </span>
                  <div>
                    <p className={styles.trialPromoEyebrow}>
                      Código {appliedSellerCode} aplicado
                    </p>
                    <h2 className={styles.trialPromoTitle}>
                      7 días de Pro, totalmente gratis
                    </h2>
                  </div>
                </div>
                <p className={styles.trialPromoDesc}>
                  Sin pagar nada ahora. Durante una semana vas a tener acceso
                  a todo esto:
                </p>
                {proPlan && (
                  <ul className={styles.trialPromoFeatures}>
                    {getPlanFeatureLabels(proPlan.features).map((f) => (
                      <li key={f}>
                        <FeatureCheckIcon />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {sellerCodeError && (
              <p className={styles.sellerError} role="alert">
                {sellerCodeError}
              </p>
            )}
            {!appliedSellerCode && !sellerCodeError && (
              <p className={styles.sellerHint}>
                ¿Tenés un código de promoción? Activalo para empezar una
                prueba gratis del plan Pro por 7 días.
              </p>
            )}
        </div>

        {!appliedSellerCode && selectedPlan !== "free" && ready && (
          <div className={styles.monthsSection}>
            <label className={styles.monthsLabel}>¿Por cuánto tiempo?</label>
            <div className={styles.monthsGrid}>
              {([1, 3, 6, 12] as const).map((m) => {
                const copy = MONTH_OPTION_COPY[m];
                const optionMultiplier = selected?.periodMultipliers?.[m];
                const optionTotal =
                  selected && optionMultiplier != null
                    ? Math.round(monthly * optionMultiplier)
                    : null;
                const optionPeriodSave =
                  optionTotal != null ? monthly * m - optionTotal : 0;

                return (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.monthBtn} ${
                      months === m ? styles.monthSelected : ""
                    }`}
                    onClick={() => setMonths(m)}
                    disabled={isSubmitting}
                    aria-pressed={months === m}
                  >
                    <span className={styles.monthTitle}>{copy.title}</span>
                    <span className={styles.monthSubtitle}>
                      {copy.subtitle}
                    </span>
                    {optionPeriodSave > 0 && (
                      <span className={styles.monthSave}>
                        Ahorrás {formatPrice(optionPeriodSave)} vs mes a mes
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className={styles.total}>
              <span className={styles.totalLabel}>Total a pagar</span>
              <strong>{formatPrice(totalPrice!)}</strong>
            </div>

            {periodSavings > 0 && (
              <ul className={styles.savingsList}>
                {periodSavings > 0 && (
                  <li>
                    Por pagar {months} {months === 1 ? "mes" : "meses"}: ahorrás{" "}
                    {formatPrice(periodSavings)} frente a {months} pagos
                    mensuales
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {appliedSellerCode ? (
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleStartTrial}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Activando..." : "Empezar prueba gratis de 7 días"}
          </button>
        ) : (
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleContinue}
            disabled={isSubmitting || !ready}
          >
            {isSubmitting
              ? "Procesando..."
              : !ready
                ? "Esperando catálogo…"
                : selectedPlan === "free"
                  ? "Crear cuenta gratis"
                  : `Pagar ${formatPrice(totalPrice!)} y crear cuenta`}
          </button>
        )}

        {!appliedSellerCode && selectedPlan !== "free" && ready && (
          <p className={styles.secure}>
            Pago seguro · Tus datos están protegidos
          </p>
        )}

        <div className={styles.back}>
          <Link to={`/register?plan=${selectedPlan}`}>
            ← Volver al formulario
          </Link>
        </div>
      </div>
    </div>
  );
}
