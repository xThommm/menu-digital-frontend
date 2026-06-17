import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "../../api/Auth/AuthContext";
import styles from "./Register.module.css";

export default function RegisterPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [username, setUsername] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!username || !businessName || !email || !password || !confirmPassword) {
      setError("Por favor completá todos los campos.");
      return;
    }
    if (!acceptedTerms) {
      setError("Debes aceptar los términos y condiciones.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      // ✅ URL absoluta usando variable de entorno
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          acceptedTerms,
          acceptedTermsVersion: "1.0",
          acceptedTermsAt: new Date(),
          contactInfo: { mail: email, businessName },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al registrarse");

      // Auto-login con las mismas credenciales
      await login(username, password);

      // Ir al dashboard
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.lp}>
      <div className={styles.card}>

        {/* Botón volver al inicio */}
        <Link to="/" className={styles.backBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Volver al inicio
        </Link>

        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoMark}>
            <div className={styles.logoSq}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h1v6a3 3 0 0 0 6 0V2h1" />
                <path d="M8 2v6" />
                <path d="M15 2c0 4 3 5 3 9a3 3 0 0 1-6 0c0-4 3-5 3-9z" />
                <path d="M8 22v-4" /><path d="M15 22v-4" /><path d="M5 22h14" />
              </svg>
            </div>
            <div className={styles.brandName}>Menu<span>Digital</span></div>
          </div>
          <p>Crear cuenta</p>
        </div>

        <div className={styles.divider} />

        <form onSubmit={handleSubmit} noValidate>

          {/* Username */}
          <div className={styles.field}>
            <label htmlFor="username">Usuario</label>
            <div className={styles.fieldWrap}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <input
                id="username"
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Nombre del negocio */}
          <div className={styles.field}>
            <label htmlFor="businessName">Nombre del negocio</label>
            <div className={styles.fieldWrap}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <input
                id="businessName"
                type="text"
                placeholder="Ej: Rotisería Las Palmas"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                autoComplete="organization"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label htmlFor="email">Correo electrónico</label>
            <div className={styles.fieldWrap}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label htmlFor="password">Contraseña</label>
            <div className={styles.fieldWrap}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className={styles.togglePw}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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
          </div>

          {/* Confirm Password */}
          <div className={styles.field}>
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <div className={styles.fieldWrap}>
              <svg className={styles.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className={styles.togglePw}
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirm ? (
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

          <div className={styles.termsContainer}>
  <label className={styles.termsLabel}>
    <input
      type="checkbox"
      checked={acceptedTerms}
      onChange={(e) => setAcceptedTerms(e.target.checked)}
      disabled={isSubmitting}
    />

    <span className={styles.customCheckbox}>
      <svg viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>

    <span className={styles.termsText}>
      Acepto los{" "}
      <Link to="/terminos" target="_blank">
        Términos y Condiciones
      </Link>
    </span>
  </label>
</div>

<button
  type="submit"
  className={styles.submitBtn}
  disabled={isSubmitting || isLoading || !acceptedTerms}
>

          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
</button>
        </form>

        <div className={styles.loginLink}>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login">Iniciá sesión</Link>
        </div>

        <div className={styles.footer}>menudigital.app &nbsp;·&nbsp; v1.0</div>
      </div>
    </div>
  );
}