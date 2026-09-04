import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import type { AuthResponse } from "../../types";
import styles from "./RegisterSuccess.module.css";

interface PendingRegister {
  registrationToken?: string;
}

type TerminalAction = "support" | "expired" | null;

function clearPendingRegistration() {
  sessionStorage.removeItem("pendingRegister");
  localStorage.removeItem("pendingRegistrationToken");
}

function readRegistrationToken(): string | null {
  try {
    const raw = sessionStorage.getItem("pendingRegister");
    const pending = raw ? JSON.parse(raw) as PendingRegister : null;
    return pending?.registrationToken
      ?? localStorage.getItem("pendingRegistrationToken");
  } catch {
    return localStorage.getItem("pendingRegistrationToken");
  }
}

export default function RegisterSuccessPage() {
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const { success: notifySuccess } = useNotifications();
  const [registrationToken] = useState(readRegistrationToken);
  const [retryKey, setRetryKey] = useState(0);
  const [paymentRetryTarget, setPaymentRetryTarget] = useState<string | null>(null);
  const [terminalAction, setTerminalAction] = useState<TerminalAction>(null);
  const [isPaymentPending, setIsPaymentPending] = useState(
    () => new URLSearchParams(window.location.search).get("payment") === "pending"
  );
  const hasActivationData = Boolean(registrationToken);
  const [error, setError] = useFeedbackMessage("error", () => hasActivationData
    ? ""
    : "No encontramos los datos para activar tu cuenta. Iniciá sesión cuando el pago se acredite."
  );

  useEffect(() => {
    if (registrationToken) {
      localStorage.setItem("pendingRegistrationToken", registrationToken);
    }
  }, [registrationToken]);

  useEffect(() => {
    if (!registrationToken) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    function scheduleRetry(message: string) {
      attempts += 1;
      if (cancelled) return;
      if (attempts >= 120) {
        setError(message);
        return;
      }
      timer = setTimeout(checkStatus, 5000);
    }

    async function checkStatus() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/payments/registro/estado`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registrationToken }),
          }
        );
        let data: {
          status?: "pending" | "completed" | "failed";
          paymentStatus?: string | null;
          paymentStatusDetail?: string | null;
          auth?: AuthResponse;
          message?: string;
        };
        try {
          data = await response.json();
        } catch {
          // Body no-JSON (ej. 502/504 con HTML): mismo mensaje fijo que ya se
          // usa para reintentos por caída del servidor, en vez de dejar que
          // el texto crudo del parser llegue a scheduleRetry/setError.
          scheduleRetry("No pudimos verificar la activación. Volvé a intentarlo.");
          return;
        }
        if (cancelled) return;

        if (!response.ok) {
          if (
            response.status >= 500
            || response.status === 408
            || response.status === 429
          ) {
            scheduleRetry("No pudimos verificar la activación. Volvé a intentarlo.");
            return;
          }

          clearPendingRegistration();
          setIsPaymentPending(false);
          setPaymentRetryTarget(null);
          if (response.status === 400 || response.status === 404) {
            setTerminalAction("expired");
            setError(
              "El enlace de activación venció o ya no está disponible. Si tu cuenta fue creada, podés iniciar sesión."
            );
          } else {
            setTerminalAction("support");
            setError(data.message || "No pudimos verificar la cuenta. Contactanos para revisarla.");
          }
          return;
        }
        if (data.status === "failed") {
          clearPendingRegistration();
          setIsPaymentPending(false);
          setPaymentRetryTarget(null);
          setTerminalAction("support");
          setError("No pudimos completar la creación de la cuenta. Contactanos para revisar el pago.");
          return;
        }
        if (data.paymentStatus === "rejected" || data.paymentStatus === "cancelled") {
          const canReuseRegistration = Boolean(
            sessionStorage.getItem("pendingRegister")
          );
          if (!canReuseRegistration) {
            localStorage.removeItem("pendingRegistrationToken");
          }
          setIsPaymentPending(false);
          setTerminalAction(null);
          setPaymentRetryTarget(
            canReuseRegistration
              ? "/register/plans?payment=failure"
              : "/register"
          );
          setError(
            data.paymentStatus === "rejected"
              ? canReuseRegistration
                ? "Mercado Pago rechazó el pago. Podés volver a intentarlo sin crear otra cuenta."
                : "Mercado Pago rechazó el pago. Volvé a ingresar tus datos para reanudar el registro."
              : canReuseRegistration
                ? "El pago fue cancelado. Podés volver a intentarlo sin crear otra cuenta."
                : "El pago fue cancelado. Volvé a ingresar tus datos para reanudar el registro."
          );
          return;
        }
        if (data.status === "completed") {
          if (!data.auth) {
            throw new Error("La cuenta se activó pero no pudimos iniciar la sesión.");
          }
          completeLogin(data.auth);
          clearPendingRegistration();
          notifySuccess("Cuenta activada correctamente.");
          navigate("/dashboard", { replace: true });
          return;
        }

        setIsPaymentPending(
          data.status === "pending"
          || data.paymentStatus === "pending"
          || data.paymentStatus === "in_process"
          || data.paymentStatus === "authorized"
        );
        scheduleRetry("La acreditación sigue pendiente. Podés volver a verificar sin repetir el pago.");
      } catch (err) {
        scheduleRetry(
          err instanceof Error ? err.message : "No pudimos activar la cuenta"
        );
      }
    }

    void checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [completeLogin, navigate, notifySuccess, registrationToken, retryKey, setError]);

  const heading = error
    ? "No pudimos activar tu cuenta"
    : isPaymentPending
      ? "Pago pendiente"
      : "¡Pago recibido!";
  const description = error
    || (isPaymentPending
      ? "Mercado Pago todavía está procesando el pago. No vuelvas a pagar: cuando se acredite, tu cuenta se activará automáticamente."
      : "Estamos activando tu cuenta. Al terminar vas a ingresar automáticamente al panel.");

  return (
    <div className="auth-page-shell">
      <div className={`auth-surface ${styles.card}`} aria-live="polite">
        <span className={styles.eyebrow}>Menú Digital · Activación</span>
        <div className={`${styles.icon} ${error ? styles.iconError : styles.iconPending}`}>
          {error ? "!" : isPaymentPending ? "…" : "✓"}
        </div>
        <h1>{heading}</h1>
        <p>{description}</p>
        {error && paymentRetryTarget && (
          <Link to={paymentRetryTarget} className={styles.btn}>
            Volver a intentar el pago
          </Link>
        )}
        {error && terminalAction === "support" && (
          <div className={styles.actions}>
            <Link to="/contacto" className={styles.btn}>
              Contactar soporte
            </Link>
            <Link to="/login" className={`${styles.btn} ${styles.btnSecondary}`}>
              Ir a iniciar sesión
            </Link>
          </div>
        )}
        {error && terminalAction === "expired" && (
          <div className={styles.actions}>
            <Link to="/login" className={styles.btn}>
              Ir a iniciar sesión
            </Link>
            <Link to="/register" className={`${styles.btn} ${styles.btnSecondary}`}>
              Empezar otro registro
            </Link>
          </div>
        )}
        {error && registrationToken && !paymentRetryTarget && !terminalAction && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setError("");
              setPaymentRetryTarget(null);
              setTerminalAction(null);
              setRetryKey(key => key + 1);
            }}
          >
            Volver a verificar
          </button>
        )}
        {error && !registrationToken && !terminalAction && (
          <Link to="/login" className={styles.btn}>
            Ir a iniciar sesión
          </Link>
        )}
      </div>
    </div>
  );
}
