import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";
import styles from "./UserEditor.module.css";

// ── Toggle — fuera del componente principal para evitar re-renders ─────────────
interface ToggleProps { checked: boolean; onChange: () => void; }

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.on : ""}`}
      onClick={onChange}
      type="button"
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

// ── Templates disponibles ──────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 1, name: "Clásico", color: "#2a2420", accent: "#c9a84c" },
  { id: 2, name: "Moderno", color: "#0d1117", accent: "#58a6ff" },
  { id: 3, name: "Natural", color: "#1a2a1a", accent: "#4caf82" },
  { id: 4, name: "Rojo",    color: "#1a0a0a", accent: "#e05555" },
  { id: 5, name: "Minimal", color: "#f5f5f5", accent: "#222222" },
];

// ── Componente principal ───────────────────────────────────────────────────────
export default function UserEditorPage() {
  const { token } = useAuth();
  const navigate  = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const [pictures,          setPictures]  = useState<string[]>([]);
  const [backgroundPicture, setBackground] = useState("");
  const [template,          setTemplate]  = useState(1);

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchNegocio = async () => {
      try {
        const res  = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        setForm({
          businessName: data.contactInfo?.businessName || "",
          mail:         data.contactInfo?.mail         || "",
          number:       data.contactInfo?.number?.toString() || "",
          address:      data.contactInfo?.address      || "",
          instagram:    data.contactInfo?.social?.instagram || "",
          facebook:     data.contactInfo?.social?.facebook  || "",
          hasDelivery:  data.hasDelivery ?? false,
        });

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

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Guardar info ─────────────────────────────────────────────────────────────
  const saveInfo = async () => {
    if (!form.businessName.trim()) { setError("El nombre del negocio es obligatorio."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await fetch("/api/users/me", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          contactInfo: {
            businessName: form.businessName,
            mail:         form.mail,
            number:       form.number ? Number(form.number) : null,
            address:      form.address,
            social: { instagram: form.instagram, facebook: form.facebook },
          },
          hasDelivery: form.hasDelivery,
        }),
      });
      setSuccess("Información guardada correctamente.");
    } catch {
      setError("No se pudo guardar la información.");
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar template ─────────────────────────────────────────────────────────
  const saveTemplate = async (t: number) => {
    setTemplate(t);
    try {
      await fetch("/api/users/template", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ template: t }),
      });
      setSuccess("Template guardado.");
    } catch {
      setError("No se pudo guardar el template.");
    }
  };

  // ── Subir imagen ─────────────────────────────────────────────────────────────
  const uploadImage = async (file: File) => {
    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res  = await fetch("/api/users/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setPictures(data.media?.pictures || [...pictures, data.imageUrl]);
      setSuccess("Imagen subida correctamente.");
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className={styles.pageCenter}>
      <div className="loader" />
    </div>
  );

  return (
    <div className={styles.ne}>

      {/* Top bar */}
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate("/dashboard")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className={styles.topTitle}>Editor de negocio</span>
        <div style={{ width: 36 }} />
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        {([
          { key: "info",     label: "Información" },
          { key: "media",    label: "Imágenes"    },
          { key: "template", label: "Template"    },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            className={`${styles.tabBtn} ${tab === key ? styles.active : ""}`}
            onClick={() => { setTab(key); setError(""); setSuccess(""); }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {error   && <div className={styles.errorBanner}>{error}</div>}
        {success && <div className={styles.successBanner}>{success}</div>}

        {/* ══════════════════════════════════
            TAB 1: INFORMACIÓN
        ══════════════════════════════════ */}
        {tab === "info" && (
          <>
            <div className={styles.field}>
              <label>Nombre del negocio *</label>
              <input type="text" placeholder="Ej: La Pizzería de Juan"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} />
            </div>

            <div className={styles.field}>
              <label>Dirección</label>
              <input type="text" placeholder="Av. Principal 123"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Teléfono</label>
                <input type="tel" placeholder="11 1234-5678"
                  value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input type="email" placeholder="negocio@mail.com"
                  value={form.mail}
                  onChange={e => setForm(f => ({ ...f, mail: e.target.value }))} />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Instagram</label>
                <input type="text" placeholder="@tunegocio"
                  value={form.instagram}
                  onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>Facebook</label>
                <input type="text" placeholder="tunegocio"
                  value={form.facebook}
                  onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} />
              </div>
            </div>

            <div className={styles.toggleGroup}>
              <div className={styles.toggleRow}>
                <div>
                  <p className={styles.toggleLabel}>Delivery</p>
                  <p className={styles.toggleDesc}>El negocio hace envíos a domicilio</p>
                </div>
                <Toggle
                  checked={form.hasDelivery}
                  onChange={() => setForm(f => ({ ...f, hasDelivery: !f.hasDelivery }))}
                />
              </div>
            </div>

            <button className={styles.saveBtn} onClick={saveInfo} disabled={saving}>
              {saving ? "Guardando..." : "Guardar información"}
            </button>
          </>
        )}

        {/* ══════════════════════════════════
            TAB 2: IMÁGENES
        ══════════════════════════════════ */}
        {tab === "media" && (
          <>
            <div className={styles.mediaSection}>
              <p className={styles.mediaLabel}>Imagen de portada</p>
              <div
                className={styles.bgPreview}
                style={backgroundPicture ? { backgroundImage: `url(${backgroundPicture})` } : undefined}
                onClick={() => bgInputRef.current?.click()}
              >
                {!backgroundPicture && (
                  <div className={styles.uploadPlaceholder}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5c5649" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Subir portada</span>
                  </div>
                )}
                {backgroundPicture && (
                  <div className={styles.overlayEdit}>
                    <span>Cambiar</span>
                  </div>
                )}
              </div>
              <input ref={bgInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
            </div>

            <div className={styles.mediaSection}>
              <div className={styles.mediaLabelRow}>
                <p className={styles.mediaLabel}>Galería</p>
                <button className={styles.textBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}>
                  {uploading ? "Subiendo..." : "+ Agregar"}
                </button>
              </div>

              {pictures.length === 0 && (
                <p className={styles.emptyHint}>Sin imágenes. Agregá fotos de tu local.</p>
              )}

              <div className={styles.galleryGrid}>
                {pictures.map((url, i) => (
                  <div key={i} className={styles.galleryItem}>
                    <img src={url} alt={`Foto ${i + 1}`} />
                  </div>
                ))}
                <button className={styles.galleryAdd}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5c5649" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
            </div>
          </>
        )}

        {/* ══════════════════════════════════
            TAB 3: TEMPLATE
        ══════════════════════════════════ */}
        {tab === "template" && (
          <>
            <p className={styles.templateDesc}>
              Elegí el estilo visual de tu página de menú pública.
            </p>
            <div className={styles.templateGrid}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`${styles.templateCard} ${template === t.id ? styles.selected : ""}`}
                  onClick={() => saveTemplate(t.id)}
                >
                  <div className={styles.templatePreview} style={{ background: t.color }}>
                    <div className={styles.templateBar} style={{ background: t.accent }} />
                    <div className={styles.templateLines}>
                      <div className={styles.tl} style={{ background: t.accent + "99" }} />
                      <div className={`${styles.tl} ${styles.tlShort}`} style={{ background: t.accent + "55" }} />
                      <div className={styles.tl} style={{ background: t.accent + "55" }} />
                    </div>
                  </div>
                  <div className={styles.templateFooter}>
                    <span className={styles.templateName}>{t.name}</span>
                    {template === t.id && <span className={styles.templateActive}>Activo</span>}
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