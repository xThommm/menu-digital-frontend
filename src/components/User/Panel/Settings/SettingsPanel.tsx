import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../../../../context/useAuth";
import { useFeedbackMessage } from "../../../../hooks/useFeedbackMessage";
import { LANDING_VISIBILITY_KEYS, resolveLandingVisibility } from "../../../../lib/landingVisibility";
import { MENU_DISPLAY_KEYS, resolveMenuDisplay } from "../../../../lib/menuDisplay";
import type {
  LandingVisibility,
  LandingVisibilityKey,
  MenuDisplay,
  MenuDisplayKey,
} from "../../../../types/index";
import Spinner from "../../../Common/Spinner";
import styles from "./SettingsPanel.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsValues {
  autoGenerateCodes: boolean;
  disableMenuDelete: boolean;
  deleteMenusWithContent: boolean;
  landingVisibility: LandingVisibility;
  menuDisplay: MenuDisplay;
}

// "loading": consultando si ya existe contraseña del panel.
// "create": primera vez — hay que establecerla.
// "enter": ya existe — hay que ingresarla.
// "unlocked": contraseña verificada, muestra los toggles.
type GateStatus = "loading" | "create" | "enter" | "unlocked";

const EMPTY_SETTINGS: SettingsValues = {
  autoGenerateCodes: false,
  disableMenuDelete: false,
  deleteMenusWithContent: false,
  landingVisibility: resolveLandingVisibility(),
  menuDisplay: resolveMenuDisplay(),
};

// Textos de los toggles de la sección "Carta". El orden lo da MENU_DISPLAY_KEYS.
const MENU_DISPLAY_COPY: Record<MenuDisplayKey, { label: string; desc: string }> = {
  featuredSection: {
    label: "Sección de destacados",
    desc: "Los productos que marcás como «Recomendado» se muestran juntos en un carrusel al inicio de la carta. También siguen apareciendo en su categoría.",
  },
  collapsibleCategories: {
    label: "Categorías desplegables",
    desc: "Las categorías aparecen cerradas y tus clientes tocan el nombre para ver los productos.",
  },
  hidePrices: {
    label: "Ocultar precios",
    desc: "No se muestra ningún precio en la carta ni en el PDF. Tus clientes pueden seguir armando pedidos por WhatsApp: te llegan con los productos y las cantidades, sin precios.",
  },
};

// Textos de los toggles de "Página del local". El orden lo da
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
    deleteMenusWithContent: !!data.deleteMenusWithContent,
    landingVisibility: resolveLandingVisibility(data.landingVisibility),
    menuDisplay: resolveMenuDisplay(data.menuDisplay),
  };
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, describedBy, disabled }: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  describedBy?: string;
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
      aria-describedby={describedBy}
      disabled={disabled}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

// `ariaLabel` va cuando el título solo no alcanza fuera de contexto (un lector
// de pantalla anuncia el switch sin la sección a la que pertenece). La
// descripción queda asociada al switch para que también se lea: algunas avisan
// consecuencias (p. ej. que con los precios ocultos no se puede pedir).
function ToggleRow({ label, desc, checked, onChange, disabled, ariaLabel }: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  ariaLabel?: string;
}) {
  const descId = useId();
  return (
    <div className={styles.toggleRow}>
      <div>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleDesc} id={descId}>{desc}</p>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={ariaLabel ?? label}
        describedBy={descId}
      />
    </div>
  );
}

// Encabezado común de las secciones del panel: título, descripción y, si la
// sección cambia algo público, el link para ver el resultado en otra pestaña.
function SettingsSection({ id, title, desc, link, children }: {
  id: string;
  title: string;
  desc: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={id} className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionDesc}>{desc}</p>
        </div>
        {link && (
          <a className={styles.sectionLink} href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label} <ExternalIcon />
          </a>
        )}
      </div>
      {children}
    </section>
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

  const toggleSetting = (key: "autoGenerateCodes" | "disableMenuDelete" | "deleteMenusWithContent") => {
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

  const toggleMenuDisplay = (key: MenuDisplayKey) => {
    const value = !settings.menuDisplay[key];
    saveToggle(
      `menuDisplay.${key}`,
      { ...settings, menuDisplay: { ...settings.menuDisplay, [key]: value } },
      { menuDisplay: { [key]: value } },
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

            <SettingsSection
              id="menu-display-title"
              title="Carta"
              desc="Cómo ven tus clientes tu carta digital."
              link={user?.slug ? { href: `/${user.slug}/menu`, label: "Ver mi carta" } : undefined}
            >
              <div className={styles.toggleGroup}>
                {MENU_DISPLAY_KEYS.map(key => (
                  <ToggleRow
                    key={key}
                    label={MENU_DISPLAY_COPY[key].label}
                    desc={MENU_DISPLAY_COPY[key].desc}
                    checked={settings.menuDisplay[key]}
                    onChange={() => toggleMenuDisplay(key)}
                    disabled={savingToggle !== null}
                    ariaLabel={`${MENU_DISPLAY_COPY[key].label} en tu carta`}
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="landing-visibility-title"
              title="Página del local"
              desc="Elegí qué datos ven tus clientes en la página de tu local. Ocultar uno no lo borra: lo seguís teniendo cargado en Mi negocio."
              link={user?.slug ? { href: `/${user.slug}`, label: "Ver mi página" } : undefined}
            >
              <div className={styles.toggleGroup}>
                {LANDING_VISIBILITY_KEYS.map(key => (
                  <ToggleRow
                    key={key}
                    label={LANDING_VISIBILITY_COPY[key].label}
                    desc={LANDING_VISIBILITY_COPY[key].desc}
                    checked={settings.landingVisibility[key]}
                    onChange={() => toggleLandingVisibility(key)}
                    disabled={savingToggle !== null}
                    ariaLabel={`Mostrar en tu página: ${LANDING_VISIBILITY_COPY[key].label}`}
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="menu-editor-title"
              title="Editor de menú"
              desc="Ajustes para cuando cargás y editás tu carta."
            >
              <div className={styles.toggleGroup}>
                <ToggleRow
                  label="Generar códigos automáticamente"
                  desc="Cuando no indiques un código a mano para un producto, categoría o sección, se genera uno solo."
                  checked={settings.autoGenerateCodes}
                  onChange={() => toggleSetting("autoGenerateCodes")}
                  disabled={savingToggle !== null}
                />
                <ToggleRow
                  label="Deshabilitar eliminar en el editor de menú"
                  desc="No va a ser posible eliminar productos, categorías ni secciones desde el editor de menú."
                  checked={settings.disableMenuDelete}
                  onChange={() => toggleSetting("disableMenuDelete")}
                  disabled={savingToggle !== null}
                />
                <ToggleRow
                  label="Eliminar secciones y categorías con contenido"
                  desc="Al eliminar una sección o categoría se elimina también todo lo que tiene adentro (categorías y productos). Apagado, solo se pueden eliminar vacías."
                  checked={settings.deleteMenusWithContent}
                  onChange={() => toggleSetting("deleteMenusWithContent")}
                  disabled={savingToggle !== null || settings.disableMenuDelete}
                />
              </div>
            </SettingsSection>

            <SettingsSection
              id="settings-password-title"
              title="Contraseña de configuración"
              desc="La que te pide esta pantalla para entrar. Es distinta a la contraseña de tu cuenta."
            >
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
            </SettingsSection>
          </>
        )}
      </div>
    </div>
  );
}
