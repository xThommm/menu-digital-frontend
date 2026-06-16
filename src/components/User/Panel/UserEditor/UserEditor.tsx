import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";
import styles from "./UserEditor.module.css";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
// Fuera del componente para evitar recreaciones en cada render.

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.on : ""}`}
      onClick={onChange}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

// ── Loader inline ─────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className={styles.spinner}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

// ── Templates disponibles ─────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 1, name: "Clásico",  color: "#2a2420", accent: "#c9a84c" },
  { id: 2, name: "Moderno",  color: "#0d1117", accent: "#58a6ff" },
  { id: 3, name: "Natural",  color: "#1a2a1a", accent: "#4caf82" },
  { id: 4, name: "Rojo",     color: "#1a0a0a", accent: "#e05555" },
  { id: 5, name: "Minimal",  color: "#f5f5f5", accent: "#222222" },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function UserEditorPage() {
  const { token } = useAuth();
  const navigate  = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState<"bg" | "gallery" | null>(null);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  const [tab, setTab] = useState<"info" | "media" | "template">("info");

  const [form, setForm] = useState({
    businessName: "",
    mail:         "",
    number:       "",
    address:      "",
    instagram:    "",
    facebook:     "",
    hasDelivery:  false,
  });

  const [pictures,          setPictures]   = useState<string[]>([]);
  const [backgroundPicture, setBackground] = useState("");
  const [template,          setTemplate]   = useState(1);

  // Dirty tracking para mostrar botón de guardar sólo cuando hay cambios
  const [isDirty, setIsDirty] = useState(false);
  const initialFormRef = useRef(form);

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Auto-clear banners ────────────────────────────────────────────────────

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3500);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Dirty tracking ────────────────────────────────────────────────────────

  useEffect(() => {
    const initial = initialFormRef.current;
    const dirty = Object.keys(form).some(
      (k) => form[k as keyof typeof form] !== initial[k as keyof typeof form]
    );
    setIsDirty(dirty);
  }, [form]);

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchNegocio = async () => {
      try {
        const res  = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error al cargar");
        const data = await res.json();

        const loaded = {
          businessName: data.contactInfo?.businessName || "",
          mail:         data.contactInfo?.mail         || "",
          number:       data.contactInfo?.number?.toString() || "",
          address:      data.contactInfo?.address      || "",
          instagram:    data.contactInfo?.social?.instagram || "",
          facebook:     data.contactInfo?.social?.facebook  || "",
          hasDelivery:  data.hasDelivery ?? false,
        };
        setForm(loaded);
        initialFormRef.current = loaded;
        setPictures(data.media?.pictures || []);
        setBackground(data.media?.backgroundPicture || "");
        setTemplate(data.template || 1);
      } catch {
        setError("No se pudo cargar la información del negocio.");
      } finally {
        setLoading(false);
      }
    };
    fetchNegocio();
  }, [token]);

  // ── Guardar información de contacto ──────────────────────────────────────

  const saveInfo = async () => {
    if (!form.businessName.trim()) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          contactInfo: {
            businessName: form.businessName.trim(),
            mail:         form.mail.trim(),
            number:       form.number ? Number(form.number) : null,
            address:      form.address.trim(),
            social: {
              instagram: form.instagram.trim(),
              facebook:  form.facebook.trim(),
            },
          },
          hasDelivery: form.hasDelivery,
        }),
      });
      if (!res.ok) throw new Error();
      initialFormRef.current = form;
      setIsDirty(false);
      setSuccess("Información guardada.");
    } catch {
      setError("No se pudo guardar la información.");
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar template ──────────────────────────────────────────────────────

  const saveTemplate = async (t: number) => {
    setTemplate(t);
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/users/template", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ template: t }),
      });
      if (!res.ok) throw new Error();
      setSuccess("Apariencia actualizada.");
    } catch {
      setError("No se pudo guardar la apariencia.");
    }
  };

  // ── Subir imagen a la galería ─────────────────────────────────────────────

  const uploadGalleryImage = async (file: File) => {
    if (pictures.length >= 10) {
      setError("Máximo 10 fotos en la galería.");
      return;
    }
    setUploading("gallery"); setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res  = await fetch("/api/users/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPictures(data.media?.pictures || [...pictures, data.imageUrl]);
      setSuccess("Foto agregada.");
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setUploading(null);
    }
  };

  // ── Subir imagen de portada ───────────────────────────────────────────────

  const uploadBackgroundImage = async (file: File) => {
    setUploading("bg"); setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res  = await fetch("/api/users/upload-background", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBackground(data.media?.backgroundPicture || data.imageUrl || "");
      setSuccess("Portada actualizada.");
    } catch {
      setError("No se pudo subir la imagen de portada.");
    } finally {
      setUploading(null);
    }
  };

  // ── Eliminar imagen de la galería ─────────────────────────────────────────
  // Actualización optimista: quita la imagen del estado de inmediato
  // y revierte si el servidor responde con error.

  const removeImage = useCallback(async (index: number) => {
    const prev = [...pictures];
    setPictures(pictures.filter((_, i) => i !== index));
    try {
      const res = await fetch("/api/users/remove-image", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ index }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPictures(prev);
      setError("No se pudo eliminar la imagen.");
    }
  }, [pictures, authHeaders]);

  // ── Cambio de tab ─────────────────────────────────────────────────────────

  const changeTab = (next: "info" | "media" | "template") => {
    setTab(next);
    setError("");
    setSuccess("");
  };

  // ── Pantalla de carga ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.pageCenter}>
        <div className={styles.loaderRing} aria-label="Cargando..." />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.ne}>

      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/dashboard")}
          aria-label="Volver al inicio"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className={styles.topTitle}>Mi negocio</span>
        <div style={{ width: 36 }} aria-hidden="true" />
      </header>

      {/* ── Tabs ── */}
      <div className={styles.tabs} role="tablist" aria-label="Secciones del editor">
        {([
          { key: "info",     label: "Información" },
          { key: "media",    label: "Imágenes"    },
          { key: "template", label: "Apariencia"  },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`${styles.tabBtn} ${tab === key ? styles.active : ""}`}
            onClick={() => changeTab(key)}
          >
            {label}
            {key === "info" && isDirty && <span className={styles.dirtyDot} aria-label="Cambios sin guardar" />}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ── Banners ── */}
        {error && (
          <div className={styles.errorBanner} role="alert" aria-live="assertive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className={styles.successBanner} role="status" aria-live="polite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {success}
          </div>
        )}

        {/* ══ TAB 1: INFORMACIÓN ══ */}
        {tab === "info" && (
          <>
            <div className={styles.field}>
              <label htmlFor="businessName">Nombre del negocio <span className={styles.required} aria-hidden="true">*</span></label>
              <input
                id="businessName"
                type="text"
                placeholder="Ej: La Pizzería de Juan"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                autoComplete="organization"
                maxLength={80}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="address">Dirección</label>
              <input
                id="address"
                type="text"
                placeholder="Av. Principal 123"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                autoComplete="street-address"
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="phone">Teléfono</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="11 1234-5678"
                  value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                  autoComplete="tel"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="negocio@mail.com"
                  value={form.mail}
                  onChange={e => setForm(f => ({ ...f, mail: e.target.value }))}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="instagram">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 4, verticalAlign: "middle" }}>
                    <rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  Instagram
                </label>
                <input
                  id="instagram"
                  type="text"
                  placeholder="@tunegocio"
                  value={form.instagram}
                  onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="facebook">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 4, verticalAlign: "middle" }}>
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                  Facebook
                </label>
                <input
                  id="facebook"
                  type="text"
                  placeholder="tunegocio"
                  value={form.facebook}
                  onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.toggleGroup}>
              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Delivery</p>
                  <p className={styles.toggleDesc}>El negocio realiza envíos a domicilio</p>
                </div>
                <Toggle
                  checked={form.hasDelivery}
                  onChange={() => setForm(f => ({ ...f, hasDelivery: !f.hasDelivery }))}
                  label="Activar delivery"
                />
              </div>
            </div>

            <button
              className={styles.saveBtn}
              onClick={saveInfo}
              disabled={saving || !isDirty}
              aria-busy={saving}
            >
              {saving ? (
                <><Spinner size={16} /> Guardando...</>
              ) : isDirty ? (
                "Guardar cambios"
              ) : (
                "Sin cambios"
              )}
            </button>
          </>
        )}

        {/* ══ TAB 2: IMÁGENES ══ */}
        {tab === "media" && (
          <>
            {/* Imagen de portada */}
            <div className={styles.mediaSection}>
              <p className={styles.mediaLabel}>Imagen de portada</p>
              <div
                className={`${styles.bgPreview} ${uploading === "bg" ? styles.uploading : ""}`}
                style={backgroundPicture ? { backgroundImage: `url(${backgroundPicture})` } : undefined}
                onClick={() => uploading === null && bgInputRef.current?.click()}
                role="button"
                aria-label={backgroundPicture ? "Cambiar imagen de portada" : "Subir imagen de portada"}
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && uploading === null && bgInputRef.current?.click()}
              >
                {uploading === "bg" ? (
                  <div className={styles.uploadingOverlay}>
                    <Spinner size={28} />
                    <span>Subiendo...</span>
                  </div>
                ) : !backgroundPicture ? (
                  <div className={styles.uploadPlaceholder}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                      stroke="#5c5649" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Subir portada</span>
                    <span className={styles.uploadHint}>Recomendado: 1200 × 400 px</span>
                  </div>
                ) : (
                  <div className={styles.overlayEdit}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Cambiar portada</span>
                  </div>
                )}
              </div>
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                  if (e.target.files?.[0]) uploadBackgroundImage(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Galería */}
            <div className={styles.mediaSection}>
              <div className={styles.mediaLabelRow}>
                <p className={styles.mediaLabel}>
                  Galería
                  <span className={styles.mediaCount}>{pictures.length}/10</span>
                </p>
                <button
                  className={styles.textBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading !== null || pictures.length >= 10}
                  type="button"
                >
                  {uploading === "gallery" ? (
                    <><Spinner size={12} /> Subiendo...</>
                  ) : (
                    "+ Agregar foto"
                  )}
                </button>
              </div>

              {pictures.length === 0 && (
                <p className={styles.emptyHint}>
                  Agregá fotos de tu local para que los clientes conozcan el lugar.
                </p>
              )}

              <div className={styles.galleryGrid}>
                {pictures.map((url, i) => (
                  <div key={`${url}-${i}`} className={styles.galleryItem}>
                    <img src={url} alt={`Foto del negocio ${i + 1}`} loading="lazy" />
                    <button
                      className={styles.galleryItemRemove}
                      onClick={() => removeImage(i)}
                      aria-label={`Eliminar foto ${i + 1}`}
                      type="button"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}

                {pictures.length < 10 && (
                  <button
                    className={styles.galleryAdd}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading !== null}
                    aria-label="Agregar foto"
                    type="button"
                  >
                    {uploading === "gallery" ? (
                      <Spinner size={20} />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="#5c5649" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                  if (e.target.files?.[0]) uploadGalleryImage(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        )}

        {/* ══ TAB 3: APARIENCIA ══ */}
        {tab === "template" && (
          <>
            <p className={styles.templateDesc}>
              Elegí el estilo visual de tu carta pública. El cambio se aplica de inmediato para todos tus clientes.
            </p>
            <div className={styles.templateGrid}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`${styles.templateCard} ${template === t.id ? styles.selected : ""}`}
                  onClick={() => saveTemplate(t.id)}
                  aria-pressed={template === t.id}
                  type="button"
                >
                  <div className={styles.templatePreview} style={{ background: t.color }}>
                    <div className={styles.templateBar} style={{ background: t.accent }} />
                    <div className={styles.templateLines}>
                      <div className={styles.tl} style={{ background: `${t.accent}99` }} />
                      <div className={`${styles.tl} ${styles.tlShort}`} style={{ background: `${t.accent}55` }} />
                      <div className={styles.tl} style={{ background: `${t.accent}55` }} />
                    </div>
                  </div>
                  <div className={styles.templateFooter}>
                    <span className={styles.templateName}>{t.name}</span>
                    {template === t.id && (
                      <span className={styles.templateActive} aria-label="Plantilla activa">Activo</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}