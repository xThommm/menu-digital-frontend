import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../../context/useAuth";
import { useNotifications } from "../../context/useNotifications";
import { useFeedbackMessage } from "../../hooks/useFeedbackMessage";
import { extractServerMessage } from "../../lib/apiErrors";
import { verifyEmail, resendVerificationCode } from "../../api/users";
import FullScreenLoader from "../Common/FullScreenLoader";
import BrandMark from "../Common/BrandMark";
import styles from "./VerifyEmail.module.css";

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmailPage() {
  const { isAuthenticated, isLoading, user, refreshUser, logout } = useAuth();
  const { success: notifySuccess } = useNotifications();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.emailVerified !== false) {
    return <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_S);
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
      notifySuccess("Te enviamos un nuevo código.");
      startCooldown();
    } catch (err: unknown) {
      const status = isAxiosError(err) ? err.response?.status : null;
      setError(
        status === 429
          ? "Esperá un momento antes de pedir otro código."
          : extractServerMessage(err, "No pudimos reenviar el código.")
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className={`${styles.lp} auth-page-shell`}>
      <div className={`${styles.card} auth-surface`}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <div className={styles.logoSq}>
              <BrandMark className={styles.brandMarkImage} />
            </div>
            <div className={styles.brandName}>
              Menu<span>Digital</span>
            </div>
          </div>
        </div>

        <div className={styles.icon} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        <h1>Verificá tu email</h1>
        <p className={styles.description}>
          Te mandamos un código de 6 dígitos {maskedEmail ? <>a <strong>{maskedEmail}</strong></> : "al email de tu cuenta"}.
          Ingresalo acá para activar tu cuenta.
        </p>

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

          {error && (
            <div className={styles.errorBanner} role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

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
              : "Reenviar código"}
        </button>

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
