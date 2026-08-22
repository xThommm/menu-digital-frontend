import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import type { AuthResponse } from "../../types";
import styles from "./RegisterSuccess.module.css";

interface PendingRegister {
  registrationToken?: string;
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
  const [registrationToken] = useState(readRegistrationToken);
  const [retryKey, setRetryKey] = useState(0);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const hasActivationData = Boolean(registrationToken);
  const [error, setError] = useState(() => hasActivationData
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

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/payments/registro/estado`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registrationToken }),
          }
        );
        const data = await response.json() as {
          status?: "pending" | "completed" | "failed";
          paymentStatus?: string | null;
          paymentStatusDetail?: string | null;
          auth?: AuthResponse;
          message?: string;
        };

        if (!response.ok) {
          setError(data.message || "No pudimos verificar la activación");
          return;
        }
        if (data.status === "failed") {
          localStorage.removeItem("pendingRegistrationToken");
          setError("No pudimos completar la creación de la cuenta. Contactanos para revisar el pago.");
          return;
        }
        if (data.paymentStatus === "rejected" || data.paymentStatus === "cancelled") {
          setPaymentFailed(true);
          setError(
            data.paymentStatus === "rejected"
              ? "Mercado Pago rechazó el pago. Podés volver a intentarlo sin crear otra cuenta."
              : "El pago fue cancelado. Podés volver a intentarlo sin crear otra cuenta."
          );
          return;
        }
        if (data.status === "completed") {
          if (!data.auth) {
            throw new Error("La cuenta se activó pero no pudimos iniciar la sesión.");
          }
          completeLogin(data.auth);
          if (cancelled) return;
          sessionStorage.removeItem("pendingRegister");
          localStorage.removeItem("pendingRegistrationToken");
          navigate("/dashboard", { replace: true });
          return;
        }

        attempts += 1;
        if (attempts >= 120) {
          setError("La acreditación sigue pendiente. Podés volver a verificar sin repetir el pago.");
          return;
        }
        timer = setTimeout(checkStatus, 5000);
      } catch (err) {
        attempts += 1;
        if (cancelled) return;
        if (attempts >= 120) {
          setError(err instanceof Error ? err.message : "No pudimos activar la cuenta");
          return;
        }
        timer = setTimeout(checkStatus, 5000);
      }
    };

    void checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [completeLogin, navigate, registrationToken, retryKey]);

  return (
    <div className="auth-page-shell">
      <div className={`auth-surface ${styles.card}`} aria-live="polite">
        <span className={styles.eyebrow}>Menú Digital · Activación</span>
        <div className={`${styles.icon} ${error ? styles.iconError : styles.iconPending}`}>
          {error ? "!" : "✓"}
        </div>
        <h1>{error ? "Estamos verificando tu cuenta" : "¡Pago recibido!"}</h1>
        <p>
          {error || "Estamos activando tu cuenta. Al terminar vas a ingresar automáticamente al panel."}
        </p>
        {error && paymentFailed && (
          <Link to="/register/plans?payment=failure" className={styles.btn}>
            Volver a intentar el pago
          </Link>
        )}
        {error && registrationToken && !paymentFailed && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setError("");
              setPaymentFailed(false);
              setRetryKey(key => key + 1);
            }}
          >
            Volver a verificar
          </button>
        )}
        {error && !registrationToken && (
          <Link to="/login" className={styles.btn}>
            Ir a iniciar sesión
          </Link>
        )}
      </div>
    </div>
  );
}
