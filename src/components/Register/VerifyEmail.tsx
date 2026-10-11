import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import { extractServerMessage } from "../../lib/apiErrors";
import {
  verifyEmail,
  resendVerificationCode,
  getEmailVerificationStatus,
  changeUnverifiedEmail,
  type EmailVerificationStatus,
} from "../../api/users";
import FullScreenLoader from "../Common/FullScreenLoader";
import BrandMark from "../Common/BrandMark";
import BrandWordmark from "../Common/BrandWordmark";
import { useAuthTheme } from "../../hooks/useAuthTheme";
import styles from "./VerifyEmail.module.css";

// Misma espera que aplica el backend entre reenvíos (RESEND_COOLDOWN_MS).
const RESEND_COOLDOWN_S = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerifyEmailPage() {
  // Comparte la preferencia clara/oscura con la landing y las páginas legales.
  const { theme } = useAuthTheme();
  const { isAuthenticated, isLoading, user, refreshUser, logout } = useAuth();
  const { success: notifySuccess } = useNotifications();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // null mientras carga, o si el backend todavía no tiene el endpoint de
  // estado: la pantalla sigue funcionando con el texto genérico.
  const [status, setStatus] = useState<EmailVerificationStatus | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const needsVerification = isAuthenticated && user?.emailVerified === false;

  // A qué casilla salió el código y si sigue vigente. El envío del alta es
  // best-effort en el backend, así que no se puede dar por hecho.
  const applyStatus = useCallback((data: EmailVerificationStatus) => {
    // emailVerified: se verificó desde otra pestaña o dispositivo.
    if (data.emailVerified) void refreshUser();
    else setStatus(data);
  }, [refreshUser]);

  useEffect(() => {
    if (!needsVerification) return;
    let cancelled = false;
    getEmailVerificationStatus()
      .then((data) => {
        if (!cancelled) applyStatus(data);
      })
      // Sin estado se muestra la pantalla genérica.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needsVerification, applyStatus]);

  useEffect(() => () => clearInterval(cooldownTimer.current), []);

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.emailVerified !== false) {
    return <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  const startCooldown = (seconds = RESEND_COOLDOWN_S) => {
    setCooldown(seconds);
    clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setError("Ingresá el código de 6 dígitos que te mandamos por email.");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmail(cleanCode);
      await refreshUser();
      notifySuccess("¡Email verificado! Ya podés usar tu cuenta.");
      navigate(user?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(extractServerMessage(err, "No pudimos verificar el código."));
      setCode("");
      // El código pudo haber vencido o agotado sus intentos.
      getEmailVerificationStatus().then(applyStatus).catch(() => {});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setError("");
    setIsResending(true);
    try {
      const { maskedEmail: masked } = await resendVerificationCode();
      setMaskedEmail(masked ?? null);
      setStatus((prev) => (prev ? { ...prev, codeActive: true } : prev));
      notifySuccess("Te enviamos un nuevo código.");
      startCooldown();
    } catch (err: unknown) {
      const response = isAxiosError<{ retryAfterSeconds?: number }>(err) ? err.response : undefined;
      if (response?.status === 429 && response.data?.retryAfterSeconds) {
        startCooldown(response.data.retryAfterSeconds);
      }
      setError(extractServerMessage(
        err,
        response?.status === 429
          ? "Esperá un momento antes de pedir otro código."
          : "No pudimos reenviar el código."
      ));
    } finally {
      setIsResending(false);
    }
  };

  const closeEmailEditor = () => {
    setIsEditingEmail(false);
    setNewEmail("");
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const mail = newEmail.trim();
    if (!EMAIL_PATTERN.test(mail)) {
      setError("Ingresá un email válido.");
      return;
    }

    setIsSavingEmail(true);
    try {
      const { email } = await changeUnverifiedEmail(mail);
      setStatus({ emailVerified: false, email, codeActive: true });
      setCode("");
      closeEmailEditor();
      notifySuccess("Listo, te enviamos el código al email nuevo.");
      startCooldown();
    } catch (err: unknown) {
      const response = isAxiosError<{ email?: string }>(err) ? err.response : undefined;
      // El email quedó guardado pero el mail con el código no salió.
      if (response?.status === 503 && response.data?.email) {
        setStatus({ emailVerified: false, email: response.data.email, codeActive: false });
        closeEmailEditor();
      }
      setError(extractServerMessage(err, "No pudimos cambiar el email."));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const shownEmail = status?.email ?? maskedEmail;
  const noActiveCode = status?.codeActive === false;

  return (
    <div
      className={`${styles.lp} auth-page-shell`}
      data-auth-theme={theme}
    >
      <div className={`${styles.card} auth-surface`}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <div className={styles.logoSq}>
              <BrandMark className={styles.brandMarkImage} />
            </div>
            <div className={styles.brandName}>
              <BrandWordmark />
            </div>
          </div>
        </div>

        <div className={styles.icon} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h1>{isEditingEmail ? "Corregí tu email" : "Verificá tu email"}</h1>

        {isEditingEmail ? (
          <>
            <p className={styles.description}>
              {status?.email
                ? <>Tu cuenta está registrada con <strong className={styles.email}>{status.email}</strong>. </>
                : null}
              Escribí el email correcto y te mandamos el código ahí.
            </p>

            <form onSubmit={handleEmailSubmit} noValidate>
              <div className={styles.field}>
                <input
                  id="new-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="tu@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isSavingEmail}
                  className={styles.emailInput}
                  aria-label="Email nuevo"
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <button type="submit" className={styles.submitBtn} disabled={isSavingEmail || !newEmail.trim()}>
                {isSavingEmail ? "Guardando..." : "Guardar y enviar código"}
              </button>
            </form>

            <button
              type="button"
              className={styles.resendBtn}
              onClick={() => {
                setError("");
                closeEmailEditor();
              }}
              disabled={isSavingEmail}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <p className={styles.description}>
              {noActiveCode ? (
                <>
                  Tu cuenta está registrada con{" "}
                  {shownEmail ? <strong className={styles.email}>{shownEmail}</strong> : "el email que cargaste"}.
                </>
              ) : (
                <>
                  Te mandamos un código de 6 dígitos{" "}
                  {shownEmail ? <>a <strong className={styles.email}>{shownEmail}</strong></> : "al email de tu cuenta"}.
                  {" "}Ingresalo acá para activar tu cuenta.
                </>
              )}
            </p>

            {noActiveCode && (
              <div className={styles.notice} role="status">
                No hay un código vigente: venció o no pudimos enviarlo. Pedí uno nuevo para seguir.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={isSubmitting}
                  className={styles.codeInput}
                  aria-label="Código de verificación"
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting || code.length !== 6}>
                {isSubmitting ? "Verificando..." : "Verificar"}
              </button>
            </form>

            <button
              type="button"
              className={styles.resendBtn}
              onClick={() => void handleResend()}
              disabled={isResending || cooldown > 0}
            >
              {isResending
                ? "Enviando..."
                : cooldown > 0
                  ? `Reenviar código (${cooldown}s)`
                  : noActiveCode
                    ? "Enviar un código nuevo"
                    : "Reenviar código"}
            </button>

            {/* Solo con el estado cargado: sin él no sabemos si el backend
                ya tiene la ruta para corregir el email. */}
            {status && (
              <button
                type="button"
                className={styles.editEmailBtn}
                onClick={() => {
                  setError("");
                  setIsEditingEmail(true);
                }}
              >
                ¿Te equivocaste de email? Corregilo
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className={styles.logoutLink}
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className={styles.errorBanner} role="alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </div>
  );
}
