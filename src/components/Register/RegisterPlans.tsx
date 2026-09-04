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

  // Precios: lista por defecto; promo solo si hay código de vendedor aplicado.
  const listMonthly = selected?.price ?? 0;
  const promoMonthly = selected
    ? (selected.discountPrice ?? selected.price)
    : 0;
  const usePromo = Boolean(appliedSellerCode);
  const monthly = usePromo ? promoMonthly : listMonthly;
  const multiplier = selected?.periodMultipliers?.[months as 1 | 3 | 6 | 12];
  const totalPrice =
    selected && multiplier != null
      ? Math.round(monthly * multiplier)
      : undefined;
  const listTotal =
    selected && multiplier != null
      ? Math.round(listMonthly * multiplier)
      : undefined;
  const savings =
    usePromo && listTotal != null && totalPrice != null
      ? listTotal - totalPrice
      : 0;

  // Costo si pagaras cada mes suelto al mismo precio mensual actual
  const fullMonthsTotal =
    selected && totalPrice != null ? monthly * months : undefined;

  // Ahorro solo por el multiplicador (3 / 6 / 12 meses)
  const periodSavings =
    fullMonthsTotal != null && totalPrice != null
      ? fullMonthsTotal - totalPrice
      : 0;

  // Ahorro extra por código de vendedor (ya lo tenías como `savings`)
  const sellerSavings = savings;

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
            ...(appliedSellerCode ? { sellerCode: appliedSellerCode } : {}),
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
                      {formatPrice(
                        appliedSellerCode
                          ? (plan.discountPrice ?? plan.price)
                          : plan.price,
                      )}
                      <span>/mes</span>
                      {appliedSellerCode && plan.discountPrice !== null && (
                        <>
                          <br />
                          <span>Antes {formatPrice(plan.price)}</span>
                        </>
                      )}
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

        {selectedPlan !== "free" && (
          <div className={styles.sellerSection}>
            <label className={styles.sellerLabel} htmlFor="seller-code">
              Código de descuento
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
              <p className={styles.sellerSuccess} role="status">
                Código {appliedSellerCode} aplicado · {selected?.discountPrice != null
                  ? "precio con vendedor y 7 días de regalo"
                  : "7 días de regalo"}
              </p>
            )}
            {sellerCodeError && (
              <p className={styles.sellerError} role="alert">
                {sellerCodeError}
              </p>
            )}
            {!appliedSellerCode && !sellerCodeError && (
              <p className={styles.sellerHint}>
                Si tenés un código, aplicálo antes de pagar para ver el precio
                final.
              </p>
            )}
          </div>
        )}

        {selectedPlan !== "free" && ready && (
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

            {(periodSavings > 0 || sellerSavings > 0) && (
              <ul className={styles.savingsList}>
                
                {sellerSavings > 0 && (
                  <li>
                    Por código de descuento: ahorrás {formatPrice(sellerSavings)}{" "}
                    
                  </li>
                )}
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

        {selectedPlan !== "free" && ready && (
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
