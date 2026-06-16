import { useState, useRef, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../api/Auth/AuthContext";
import styles from "./Login.module.css";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState(
    () => localStorage.getItem("md_remembered_user") || ""
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => !!localStorage.getItem("md_remembered_user")
  );
  const [isShaking, setIsShaking] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: false, password: false });

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-focus: si ya hay usuario recordado, ir directo a contraseña
  useEffect(() => {
    if (username) {
      passwordRef.current?.focus();
    } else {
      usernameRef.current?.focus();
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleCapsLock = (e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  const clearError = (field: "username" | "password") => {
    if (fieldErrors[field]) setFieldErrors(f => ({ ...f, [field]: false }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    const newFieldErrors = { username: !trimmedUsername, password: !password };
    setFieldErrors(newFieldErrors);

    if (!trimmedUsername || !password) {
      setError("Por favor completá todos los campos.");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await login(trimmedUsername, password);

      if (rememberMe) {
        localStorage.setItem("md_remembered_user", trimmedUsername);
      } else {
        localStorage.removeItem("md_remembered_user");
      }

      navigate(loggedUser.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Usuario o contraseña incorrectos.");
      setFieldErrors({ username: false, password: true });
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.lp}>
      <div className={styles.card}>


        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <div className={styles.logoSq}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c0b09" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h1v6a3 3 0 0 0 6 0V2h1" />
                <path d="M8 2v6" />
                <path d="M15 2c0 4 3 5 3 9a3 3 0 0 1-6 0c0-4 3-5 3-9z" />
                <path d="M8 22v-4" /><path d="M15 22v-4" /><path d="M5 22h14" />
              </svg>
            </div>
            <div className={styles.brandName}>Menu<span>Digital</span></div>
          </div>
          <p>Panel de administración</p>
        </div>

        <div className={styles.divider} />

        <form
          onSubmit={handleSubmit}
          noValidate
          className={isShaking ? styles.shake : ""}
        >
          {/* Usuario */}
          <div className={styles.field}>
            <label htmlFor="username">Usuario</label>
            <div className={`${styles.fieldWrap} ${fieldErrors.username ? styles.fieldWrapError : ""}`}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <input
                ref={usernameRef}
                id="username"
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearError("username"); }}
                autoComplete="username"
                disabled={isSubmitting}
                aria-invalid={fieldErrors.username}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className={styles.field}>
            <label htmlFor="password">Contraseña</label>
            <div className={`${styles.fieldWrap} ${fieldErrors.password ? styles.fieldWrapError : ""}`}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                onKeyDown={handleCapsLock}
                onKeyUp={handleCapsLock}
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={fieldErrors.password}
              />
              <button
                type="button"
                className={styles.togglePw}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Caps lock warning */}
            {capsLock && (
              <div className={styles.capsWarning}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Bloq Mayús activado
              </div>
            )}
          </div>

          {/* Remember me + Olvidaste contraseña */}
          <div className={styles.rememberRow}>
            <label className={styles.rememberLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className={styles.rememberNative}
              />
              <span className={`${styles.rememberBox} ${rememberMe ? styles.rememberBoxChecked : ""}`}>
                {rememberMe && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0c0b09" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className={styles.rememberText}>Recordarme</span>
            </label>
            <button type="button" className={styles.forgotBtn}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={isSubmitting || isLoading}>
            <span className={styles.btnInner}>
              {isSubmitting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </span>
          </button>
        </form>

        <div className={styles.footer}>menudigital.app &nbsp;·&nbsp; v1.0</div>
        <a href="/" className={styles.homeLink}>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
  Volver al inicio
</a>
      </div>
    </div>
  );
}