import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../../../context/useAuth";
import { useFeedbackMessage } from "../../../../hooks/useFeedbackMessage";
import { LANDING_VISIBILITY_KEYS, resolveLandingVisibility } from "../../../../lib/landingVisibility";
import type { LandingVisibility, LandingVisibilityKey } from "../../../../types/index";
import Spinner from "../../../Common/Spinner";
import styles from "./SettingsPanel.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsValues {
  autoGenerateCodes: boolean;
  disableMenuDelete: boolean;
  landingVisibility: LandingVisibility;
}

// "loading": consultando si ya existe contraseña del panel.
// "create": primera vez — hay que establecerla.
// "enter": ya existe — hay que ingresarla.
// "unlocked": contraseña verificada, muestra los toggles.
type GateStatus = "loading" | "create" | "enter" | "unlocked";

const EMPTY_SETTINGS: SettingsValues = {
  autoGenerateCodes: false,
  disableMenuDelete: false,
  landingVisibility: resolveLandingVisibility(),
};

// Textos de los toggles de "Datos visibles en tu página". El orden lo da
// LANDING_VISIBILITY_KEYS.
const LANDING_VISIBILITY_COPY: Record<LandingVisibilityKey, { label: string; desc: string }> = {
  phone: {
    label: "Teléfono",
    desc: "En la sección de contacto, con las opciones de llamar o escribir por WhatsApp.",
  },
  whatsappReserve: {
    label: "Botón «Reservar por WhatsApp»",
    desc: "El botón que aparece junto a «Ver menú». Usa tu número de teléfono.",
  },
  mail: {
    label: "Email",
    desc: "Tu email de contacto, para que te escriban.",
  },
  address: {
    label: "Dirección",
    desc: "El acceso «Cómo llegar», que abre tu ubicación en Google Maps.",
  },
  schedule: {
    label: "Horarios",
    desc: "Los horarios de atención y el aviso de «Abierto ahora» o «Cerrado ahora».",
  },
  instagram: {
    label: "Instagram",
    desc: "El enlace a tu perfil de Instagram.",
  },
  facebook: {
    label: "Facebook",
    desc: "El enlace a tu página de Facebook.",
  },
};

// Todas las respuestas de /me/settings traen los toggles con la misma forma.
function toSettings(data: Partial<SettingsValues>): SettingsValues {
  return {
    autoGenerateCodes: !!data.autoGenerateCodes,
    disableMenuDelete: !!data.disableMenuDelete,
    landingVisibility: resolveLandingVisibility(data.landingVisibility),
  };
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.on : ""}`}
      onClick={onChange}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function SettingsPanel() {
  const { user, token, logout } = useAuth();

  const [gate, setGate] = useState<GateStatus>("loading");
  const [settings, setSettings] = useState<SettingsValues>(EMPTY_SETTINGS);

  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [gateError, setGateError] = useFeedbackMessage("error");
  const [gateSubmitting, setGateSubmitting] = useState(false);

  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [toggleError, setToggleError] = useFeedbackMessage("error");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useFeedbackMessage("error");
  const [changePasswordSuccess, setChangePasswordSuccess] = useFeedbackMessage("success");

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const handleExpiredSession = useCallback(() => {
    logout();
    window.location.href = "/login";
  }, [logout]);

  // Auto-clear banners
  useEffect(() => {
    if (!changePasswordSuccess) return;
    const t = setTimeout(() => setChangePasswordSuccess(""), 3500);
    return () => clearTimeout(t);
  }, [changePasswordSuccess, setChangePasswordSuccess]);

  // ── Carga inicial: ¿ya existe contraseña del panel? ──────────────────────
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/users/me/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { handleExpiredSession(); return; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "No se pudo cargar la configuración.");
        setGate(data.hasPassword ? "enter" : "create");
      } catch (err) {
        setGateError(err instanceof Error ? err.message : "No se pudo cargar la configuración.");
      }
    };
    loadStatus();
  }, [token, handleExpiredSession, setGateError]);

  // ── Crear/ingresar la contraseña del panel ───────────────────────────────
  const submitGate = async (e: FormEvent) => {
    e.preventDefault();
    if (gateSubmitting || gate === "loading" || gate === "unlocked") return;

    if (gate === "create") {
      if (passwordInput.length < 8) { setGateError("La contraseña debe tener al menos 8 caracteres."); return; }
      if (passwordInput !== confirmInput) { setGateError("Las contraseñas no coinciden."); return; }
    } else if (!passwordInput) {
      setGateError("Ingresá la contraseña.");
      return;
    }

    setGateSubmitting(true);
    setGateError("");
    try {
      const res = await fetch("/api/users/me/settings/verify-password", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.status === 401) { handleExpiredSession(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo verificar la contraseña.");
      setSettings(toSettings(data));
      setGate("unlocked");
      setPasswordInput("");
      setConfirmInput("");
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "No se pudo verificar la contraseña.");
    } finally {
      setGateSubmitting(false);
    }
  };

  // ── Toggles (optimistas, con reversión si falla el PATCH) ────────────────
  // `optimistic` es el estado con el cambio ya aplicado y `body` el PATCH
  // parcial que lo guarda. Revertir al snapshot completo es seguro porque
  // todos los toggles quedan deshabilitados mientras uno se guarda.
  const saveToggle = useCallback(async (
    savingKey: string,
    optimistic: SettingsValues,
    body: Record<string, unknown>,
  ) => {
    const previous = settings;
    setSettings(optimistic);
    setSavingToggle(savingKey);
    setToggleError("");
    try {
      const res = await fetch("/api/users/me/settings", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (res.status === 401) { handleExpiredSession(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar el cambio.");
      setSettings(toSettings(data));
    } catch (err) {
      setSettings(previous);
      setToggleError(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
    } finally {
      setSavingToggle(null);
    }
  }, [settings, authHeaders, handleExpiredSession, setToggleError]);

  const toggleSetting = (key: "autoGenerateCodes" | "disableMenuDelete") => {
    const value = !settings[key];
    saveToggle(key, { ...settings, [key]: value }, { [key]: value });
  };

  const toggleLandingVisibility = (key: LandingVisibilityKey) => {
    const value = !settings.landingVisibility[key];
    saveToggle(
      `landingVisibility.${key}`,
      { ...settings, landingVisibility: { ...settings.landingVisibility, [key]: value } },
      { landingVisibility: { [key]: value } },
    );
  };

  // ── Cambiar la contraseña del panel ───────────────────────────────────────
  const invalidPasswordChange =
    !currentPassword || newPassword.length < 8 || newPassword !== confirmNewPassword;

  const submitPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (changingPassword || invalidPasswordChange) return;
    setChangingPassword(true);
    setChangePasswordError("");
    try {
      const res = await fetch("/api/users/me/settings/password", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 401) { handleExpiredSession(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo cambiar la contraseña.");
      setChangePasswordSuccess("Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setChangePasswordError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.sp}>
      <header className={styles.topBar}>
        <span className={styles.topTitle}>Configuración</span>
        <div style={{ width: 32 }} aria-hidden="true" />
      </header>

      <div className={styles.content}>
        {gate === "loading" && (
          <div className={styles.gateLoading}>
            <Spinner size={22} label="Cargando..." />
          </div>
        )}

        {(gate === "create" || gate === "enter") && (
          <div className={styles.gateCard}>
            <div className={styles.gateIcon}><LockIcon /></div>
            {gate === "create" ? (
              <>
                <p className={styles.gateTitle}>Creá una contraseña de configuración</p>
                <p className={styles.gateDesc}>
                  Vas a necesitarla cada vez que quieras entrar acá — sirve para que estos ajustes
                  no los cambie cualquiera que use el login del local.
                </p>
              </>
            ) : (
              <>
                <p className={styles.gateTitle}>Ingresá la contraseña de configuración</p>
                <p className={styles.gateDesc}>Es distinta a la contraseña de tu cuenta.</p>
              </>
            )}

            <form onSubmit={submitGate} className={styles.gateForm} noValidate>
              <input
                type="password"
                placeholder={gate === "create" ? "Nueva contraseña" : "Contraseña"}
                value={passwordInput}
                disabled={gateSubmitting}
                autoComplete={gate === "create" ? "new-password" : "current-password"}
                autoFocus
                onChange={e => { setPasswordInput(e.target.value); setGateError(""); }}
              />
              {gate === "create" && (
                <input
                  type="password"
                  placeholder="Repetir contraseña"
                  value={confirmInput}
                  disabled={gateSubmitting}
                  autoComplete="new-password"
                  onChange={e => { setConfirmInput(e.target.value); setGateError(""); }}
                />
              )}

              {gateError && <p className={styles.gateError} role="alert">{gateError}</p>}

              <button className={styles.saveBtn} type="submit" disabled={gateSubmitting}>
                {gateSubmitting
                  ? <><Spinner size={16} /> {gate === "create" ? "Creando..." : "Verificando..."}</>
                  : gate === "create" ? "Crear y entrar" : "Entrar"}
              </button>
            </form>
          </div>
        )}

        {gate === "unlocked" && (
          <>
            {toggleError && (
              <div className={styles.errorBanner} role="alert" aria-live="assertive">{toggleError}</div>
            )}

            <div className={styles.toggleGroup}>
              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Generar códigos automáticamente</p>
                  <p className={styles.toggleDesc}>
                    Cuando no indiques un código a mano para un producto, categoría o sección, se
                    genera uno solo.
                  </p>
                </div>
                <Toggle
                  checked={settings.autoGenerateCodes}
                  onChange={() => toggleSetting("autoGenerateCodes")}
                  disabled={savingToggle !== null}
                  label="Generar códigos automáticamente"
                />
              </div>
              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Deshabilitar eliminar en el editor de menú</p>
                  <p className={styles.toggleDesc}>
                    No va a ser posible eliminar productos, categorías ni secciones desde el editor
                    de menú.
                  </p>
                </div>
                <Toggle
                  checked={settings.disableMenuDelete}
                  onChange={() => toggleSetting("disableMenuDelete")}
                  disabled={savingToggle !== null}
                  label="Deshabilitar eliminar en el editor de menú"
                />
              </div>
            </div>

            <section className={styles.visibilitySection} aria-labelledby="landing-visibility-title">
              <div className={styles.sectionHead}>
                <div>
                  <h2 id="landing-visibility-title" className={styles.sectionTitle}>
                    Datos visibles en tu página
                  </h2>
                  <p className={styles.sectionDesc}>
                    Elegí qué datos ven tus clientes en la página de tu local. Ocultar uno no lo
                    borra: lo seguís teniendo cargado en Mi negocio.
                  </p>
                </div>
                {user?.slug && (
                  <a
                    className={styles.sectionLink}
                    href={`/${user.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver mi página <ExternalIcon />
                  </a>
                )}
              </div>

              <div className={styles.toggleGroup}>
                {LANDING_VISIBILITY_KEYS.map(key => (
                  <div className={styles.toggleRow} key={key}>
                    <div>
                      <p className={styles.toggleLabel}>{LANDING_VISIBILITY_COPY[key].label}</p>
                      <p className={styles.toggleDesc}>{LANDING_VISIBILITY_COPY[key].desc}</p>
                    </div>
                    <Toggle
                      checked={settings.landingVisibility[key]}
                      onChange={() => toggleLandingVisibility(key)}
                      disabled={savingToggle !== null}
                      label={`Mostrar en tu página: ${LANDING_VISIBILITY_COPY[key].label}`}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.passwordSection}>
              <h2 className={styles.sectionTitle}>Cambiar contraseña de configuración</h2>
              <form onSubmit={submitPasswordChange} className={styles.gateForm} noValidate>
                <input
                  type="password"
                  placeholder="Contraseña actual"
                  value={currentPassword}
                  disabled={changingPassword}
                  autoComplete="current-password"
                  onChange={e => { setCurrentPassword(e.target.value); setChangePasswordError(""); }}
                />
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  value={newPassword}
                  disabled={changingPassword}
                  autoComplete="new-password"
                  onChange={e => { setNewPassword(e.target.value); setChangePasswordError(""); }}
                />
                <input
                  type="password"
                  placeholder="Repetir nueva contraseña"
                  value={confirmNewPassword}
                  disabled={changingPassword}
                  autoComplete="new-password"
                  onChange={e => { setConfirmNewPassword(e.target.value); setChangePasswordError(""); }}
                />

                {changePasswordError && <p className={styles.gateError} role="alert">{changePasswordError}</p>}
                {changePasswordSuccess && <p className={styles.gateSuccess} role="status">{changePasswordSuccess}</p>}

                <button className={styles.saveBtn} type="submit" disabled={changingPassword || invalidPasswordChange}>
                  {changingPassword ? <><Spinner size={16} /> Guardando...</> : "Cambiar contraseña"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
