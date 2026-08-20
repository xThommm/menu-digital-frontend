import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import styles from "./RegisterSuccess.module.css";

interface PendingRegister {
  username: string;
  password: string;
  registrationToken?: string;
}

function readPending(): PendingRegister | null {
  try {
    const raw = sessionStorage.getItem("pendingRegister");
    return raw ? JSON.parse(raw) as PendingRegister : null;
  } catch {
    return null;
  }
}

export default function RegisterSuccessPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const loginRef = useRef(login);
  const [pending] = useState<PendingRegister | null>(readPending);
  const hasActivationData = Boolean(
    pending?.username && pending.password && pending.registrationToken
  );
  const [error, setError] = useState(() => hasActivationData
    ? ""
    : "No encontramos los datos para activar tu cuenta. Iniciá sesión cuando el pago se acredite."
  );

  useEffect(() => {
    loginRef.current = login;
  }, [login]);

  useEffect(() => {
    if (!pending?.username || !pending.password || !pending.registrationToken) return;

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
            body: JSON.stringify({ registrationToken: pending.registrationToken }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "No pudimos verificar la activación");
          return;
        }
        if (data.status === "failed") {
          setError("No pudimos completar la creación de la cuenta. Contactanos para revisar el pago.");
          return;
        }
        if (data.status === "completed") {
          await loginRef.current(pending.username, pending.password);
          if (cancelled) return;
          sessionStorage.removeItem("pendingRegister");
          navigate("/dashboard", { replace: true });
          return;
        }

        attempts += 1;
        if (attempts >= 40) {
          throw new Error("La acreditación está demorando más de lo normal. Podés volver a intentar en unos minutos.");
        }
        timer = setTimeout(checkStatus, 1500);
      } catch (err) {
        attempts += 1;
        if (cancelled) return;
        if (attempts >= 40) {
          setError(err instanceof Error ? err.message : "No pudimos activar la cuenta");
          return;
        }
        timer = setTimeout(checkStatus, 1500);
      }
    };

    void checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [navigate, pending]);

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
        {error && (
          <Link to="/login" className={styles.btn}>
            Ir a iniciar sesión
          </Link>
        )}
      </div>
    </div>
  );
}
