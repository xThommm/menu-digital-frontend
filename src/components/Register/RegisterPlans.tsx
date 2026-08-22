import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import styles from "./RegisterPlans.module.css";

type PlanId = "free" | "basic" | "pro";

interface PendingRegister {
  username: string;
  password: string;
  acceptedTerms: boolean;
  contactInfo: { mail: string; businessName: string };
  registrationToken?: string;
}

const PLANS: {
  id: PlanId;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    description: "Ideal para probar",
    features: [
      "Menú digital + editor",
      "QR descargable",
      "Landing page del local",
      "Mensaje para delivery/take away por WhatsApp",
      "Hasta 15 productos",
      "Incluye publicidad de Menú Digital",
    ],
  },
  {
    id: "basic",
    name: "Básico",
    price: 2000,
    description: "Para locales en crecimiento",
    features: [
      "Hasta 50 productos",
      "Modificación masiva por Excel",
      "Programación de productos",
      "Exportar menú a PDF",
      "5 diseños disponibles",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 5000,
    description: "Máximo control",
    features: [
      "Todo lo del plan Básico",
      "Productos ilimitados",
      "Métricas de visitas y productos",
      "Dominio propio",
      "15 diseños disponibles",
      "Reseñas integradas",
    ],
  },
];

const MONTH_OPTIONS = [
  { value: 1, label: "1 mes", multiplier: 1 },
  { value: 3, label: "3 meses", multiplier: 2.7 },
  { value: 6, label: "6 meses", multiplier: 5 },
  { value: 12, label: "12 meses", multiplier: 9 },
];

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

  const selected = PLANS.find((p) => p.id === selectedPlan)!;
  const multiplier =
    MONTH_OPTIONS.find((m) => m.value === months)?.multiplier ?? 1;
  const totalPrice =
    selectedPlan === "free" ? 0 : Math.round(selected.price * multiplier);

  const handleContinue = async () => {
    if (!pending) return;
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
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
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
      window.location.href = data.init_point;
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

        <div className={styles.plansGrid}>
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`${styles.planCard} ${
                selectedPlan === plan.id ? styles.planSelected : ""
              } ${plan.highlight ? styles.planHighlight : ""}`}
              onClick={() => setSelectedPlan(plan.id)}
              disabled={isSubmitting}
              aria-pressed={selectedPlan === plan.id}
            >
              {plan.highlight && (
                <span className={styles.badge}>Recomendado</span>
              )}
              {selectedPlan === plan.id && (
                <span className={styles.selectionMark} aria-hidden>✓</span>
              )}
              <div className={styles.planName}>{plan.name}</div>
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
                {plan.features.map((f) => (
                  <li key={f}><span aria-hidden>→</span>{f}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {selectedPlan !== "free" && (
          <div className={styles.monthsSection}>
            <label className={styles.monthsLabel}>¿Por cuánto tiempo?</label>
            <div className={styles.monthsGrid}>
              {MONTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.monthBtn} ${
                    months === opt.value ? styles.monthSelected : ""
                  }`}
                  onClick={() => setMonths(opt.value)}
                  disabled={isSubmitting}
                  aria-pressed={months === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className={styles.total}>
              <span className={styles.totalLabel}>Total a pagar</span>
              <strong>{formatPrice(totalPrice)}</strong>
              {months > 1 && (
                <span className={styles.savings}>
                  Ahorrás {formatPrice(selected.price * months - totalPrice)}
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
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Procesando..."
            : selectedPlan === "free"
            ? "Crear cuenta gratis"
            : `Pagar ${formatPrice(totalPrice)} y crear cuenta`}
        </button>

        {selectedPlan !== "free" && (
          <p className={styles.secure}>Pago seguro · Tus datos están protegidos</p>
        )}

        <div className={styles.back}>
          <Link to={`/register?plan=${selectedPlan}`}>← Volver al formulario</Link>
        </div>
      </div>
    </div>
  );
}
