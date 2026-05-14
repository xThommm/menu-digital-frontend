import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";

// Templates disponibles — 5 estilos para la landing page
const TEMPLATES = [
  { id: 1, name: "Clásico", color: "#2a2420", accent: "#c9a84c" },
  { id: 2, name: "Moderno", color: "#0d1117", accent: "#58a6ff" },
  { id: 3, name: "Natural", color: "#1a2a1a", accent: "#4caf82" },
  { id: 4, name: "Rojo", color: "#1a0a0a", accent: "#e05555" },
  { id: 5, name: "Minimal", color: "#f5f5f5", accent: "#222222" },
];

export default function NegocioEditorPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  // Sección activa del editor (tabs)
  const [tab, setTab] = useState<"info" | "media" | "template">("info");

  // Formulario mapeado a la estructura real del backend
  const [form, setForm] = useState({
    businessName: "",
    mail: "",
    number: "",
    address: "",
    instagram: "",
    facebook: "",
    hasDelivery: false,
  });

  // Media
  const [pictures, setPictures]             = useState<string[]>([]);
  const [backgroundPicture, setBackground]  = useState("");

  // Template seleccionado
  const [template, setTemplate] = useState(1);

  // ── Carga inicial desde GET /api/users/me ─────────────────────────────────
  useEffect(() => {
    const fetchNegocio = async () => {
      try {
        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        // Mapea los campos del backend al formulario
        setForm({
          businessName: data.contactInfo?.businessName || "",
          mail:         data.contactInfo?.mail || "",
          number:       data.contactInfo?.number?.toString() || "",
          address:      data.contactInfo?.address || "",
          instagram:    data.contactInfo?.social?.instagram || "",
          facebook:     data.contactInfo?.social?.facebook || "",
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
  }, []);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Guarda info de contacto con PUT /api/users/me ─────────────────────────
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
            social: {
              instagram: form.instagram,
              facebook:  form.facebook,
            },
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

  // ── Guarda template con PATCH /api/users/template ─────────────────────────
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

  // ── Sube imagen a POST /api/users/upload-image ────────────────────────────
  const uploadImage = async (file: File) => {
    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/users/upload-image", {
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

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button className={`toggle ${checked ? "on" : ""}`} onClick={onChange} type="button">
      <span className="toggle-knob" />
    </button>
  );

  if (loading) return <div className="page-center"><div className="loader-ring" /></div>;

  return (
    <div className="ne">

      {/* Top bar */}
      <header className="top-bar">
        <button className="back-btn" onClick={() => navigate("/admin")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="top-title">Editor de negocio</span>
        <div style={{ width: 36 }} />
      </header>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: "info",     label: "Información" },
          { key: "media",    label: "Imágenes" },
          { key: "template", label: "Template" },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn ${tab === key ? "active" : ""}`}
            onClick={() => { setTab(key as typeof tab); setError(""); setSuccess(""); }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="content form-content">
        {error   && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {/* ══════════════════════════════════
            TAB 1: INFORMACIÓN
        ══════════════════════════════════ */}
        {tab === "info" && (
          <>
            <div className="field">
              <label>Nombre del negocio *</label>
              <input type="text" placeholder="Ej: La Pizzería de Juan"
                value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} />
            </div>

            <div className="field">
              <label>Dirección</label>
              <input type="text" placeholder="Av. Principal 123"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Teléfono</label>
                <input type="tel" placeholder="11 1234-5678"
                  value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="negocio@mail.com"
                  value={form.mail}
                  onChange={e => setForm(f => ({ ...f, mail: e.target.value }))} />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Instagram</label>
                <input type="text" placeholder="@tunegocio"
                  value={form.instagram}
                  onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
              </div>
              <div className="field">
                <label>Facebook</label>
                <input type="text" placeholder="tunegocio"
                  value={form.facebook}
                  onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} />
              </div>
            </div>

            <div className="toggle-group">
              <div className="toggle-row">
                <div>
                  <p className="toggle-label">Delivery</p>
                  <p className="toggle-desc">El negocio hace envíos a domicilio</p>
                </div>
                <Toggle
                  checked={form.hasDelivery}
                  onChange={() => setForm(f => ({ ...f, hasDelivery: !f.hasDelivery }))}
                />
              </div>
            </div>

            <button className="save-btn" onClick={saveInfo} disabled={saving}>
              {saving ? "Guardando..." : "Guardar información"}
            </button>
          </>
        )}

        {/* ══════════════════════════════════
            TAB 2: IMÁGENES
        ══════════════════════════════════ */}
        {tab === "media" && (
          <>
            {/* Imagen de portada */}
            <div className="media-section">
              <p className="media-label">Imagen de portada</p>
              <div
                className="bg-preview"
                style={{ backgroundImage: backgroundPicture ? `url(${backgroundPicture})` : "none" }}
                onClick={() => bgInputRef.current?.click()}
              >
                {!backgroundPicture && (
                  <div className="upload-placeholder">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5c5649" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Subir portada</span>
                  </div>
                )}
                {backgroundPicture && (
                  <div className="overlay-edit">
                    <span>Cambiar</span>
                  </div>
                )}
              </div>
              <input ref={bgInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
            </div>

            {/* Galería de imágenes */}
            <div className="media-section">
              <div className="media-label-row">
                <p className="media-label">Galería</p>
                <button className="text-btn" onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}>
                  {uploading ? "Subiendo..." : "+ Agregar"}
                </button>
              </div>

              {pictures.length === 0 && (
                <p className="empty-hint">Sin imágenes. Agregá fotos de tu local.</p>
              )}

              <div className="gallery-grid">
                {pictures.map((url, i) => (
                  <div key={i} className="gallery-item">
                    <img src={url} alt={`Foto ${i + 1}`} />
                  </div>
                ))}
                {/* Botón para agregar más */}
                <button
                  className="gallery-add"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
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
            <p className="template-desc">
              Elegí el estilo visual de tu página de menú pública.
            </p>
            <div className="template-grid">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`template-card ${template === t.id ? "selected" : ""}`}
                  onClick={() => saveTemplate(t.id)}
                >
                  {/* Preview del template */}
                  <div className="template-preview" style={{ background: t.color }}>
                    <div className="template-bar" style={{ background: t.accent }} />
                    <div className="template-lines">
                      <div className="tl" style={{ background: t.accent + "99" }} />
                      <div className="tl short" style={{ background: t.accent + "55" }} />
                      <div className="tl" style={{ background: t.accent + "55" }} />
                    </div>
                  </div>
                  <div className="template-footer">
                    <span className="template-name">{t.name}</span>
                    {template === t.id && (
                      <span className="template-active">Activo</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ne {
          min-height: 100vh; background: #0c0b09;
          font-family: 'DM Sans', system-ui, sans-serif; color: #d4c9b0;
          display: flex; flex-direction: column;
          max-width: 600px; margin: 0 auto;
        }

        /* Top bar */
        .top-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem; border-bottom: 0.5px solid #1e1c18;
          background: #0c0b09; position: sticky; top: 0; z-index: 10;
        }
        .top-title { font-size: 1rem; font-weight: 500; color: #ede4d0; }
        .back-btn {
          width: 36px; height: 36px; background: #181614; border: 0.5px solid #272420;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #a09070; transition: border-color 0.15s, color 0.15s;
        }
        .back-btn:hover { border-color: #c9a84c; color: #c9a84c; }

        /* Tabs */
        .tabs {
          display: flex; border-bottom: 0.5px solid #1e1c18;
          background: #0c0b09; position: sticky; top: 57px; z-index: 9;
        }
        .tab-btn {
          flex: 1; padding: 0.75rem 0.5rem; background: none; border: none;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.82rem; color: #5c5649; cursor: pointer;
          border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
        }
        .tab-btn.active { color: #c9a84c; border-bottom-color: #c9a84c; }

        /* Content */
        .content { flex: 1; padding: 1.25rem 1rem 2rem; }
        .form-content { padding-bottom: 2rem; }

        /* Banners */
        .error-banner {
          background: #1c1009; border: 0.5px solid #4a2010; border-radius: 8px;
          padding: 0.65rem 1rem; font-size: 0.82rem; color: #b86040; margin-bottom: 1rem;
        }
        .success-banner {
          background: #0d2b18; border: 0.5px solid #1a4a2e; border-radius: 8px;
          padding: 0.65rem 1rem; font-size: 0.82rem; color: #4caf82; margin-bottom: 1rem;
        }

        /* Fields */
        .field { margin-bottom: 1.1rem; }
        .field label {
          display: block; font-size: 0.72rem; letter-spacing: 0.1em;
          text-transform: uppercase; color: #5c5649; margin-bottom: 0.4rem;
        }
        .field input, .field textarea, .field select {
          width: 100%; background: #0e0d0b; border: 0.5px solid #272420;
          border-radius: 10px; padding: 0.75rem 1rem;
          font-size: 0.9rem; color: #d4c9b0;
          font-family: 'DM Sans', system-ui, sans-serif;
          outline: none; transition: border-color 0.2s;
        }
        .field input:focus, .field textarea:focus { border-color: #c9a84c; }
        .field input::placeholder, .field textarea::placeholder { color: #333029; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        /* Toggles */
        .toggle-group {
          margin: 1.25rem 0; border: 0.5px solid #1e1c18; border-radius: 12px; overflow: hidden;
        }
        .toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.9rem 1rem; border-bottom: 0.5px solid #1e1c18;
        }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-label { font-size: 0.88rem; font-weight: 500; color: #ede4d0; }
        .toggle-desc  { font-size: 0.75rem; color: #5c5649; margin-top: 2px; }
        .toggle {
          width: 44px; height: 26px; border-radius: 13px;
          background: #1e1c17; border: 0.5px solid #2e2b23;
          cursor: pointer; position: relative; transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle.on { background: #2a3d1a; border-color: #4c7a2e; }
        .toggle-knob {
          position: absolute; top: 3px; left: 3px;
          width: 18px; height: 18px; border-radius: 50%;
          background: #5c5649; transition: transform 0.2s, background 0.2s;
        }
        .toggle.on .toggle-knob { transform: translateX(18px); background: #7ec850; }

        /* Save btn */
        .save-btn {
          width: 100%; background: #c9a84c; border: none; border-radius: 12px;
          padding: 0.9rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.95rem; font-weight: 500; color: #0c0b09;
          cursor: pointer; margin-top: 0.5rem; transition: background 0.2s;
        }
        .save-btn:hover:not(:disabled) { background: #dabb62; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Media */
        .media-section { margin-bottom: 1.75rem; }
        .media-label { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: #5c5649; margin-bottom: 0.6rem; }
        .media-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
        .text-btn {
          background: none; border: none; color: #c9a84c;
          font-size: 0.82rem; cursor: pointer; padding: 0; font-family: inherit;
        }
        .text-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Portada */
        .bg-preview {
          width: 100%; height: 160px; border-radius: 12px;
          border: 0.5px solid #272420; background-size: cover; background-position: center;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; overflow: hidden; position: relative;
          background-color: #0e0d0b;
        }
        .upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .upload-placeholder span { font-size: 0.8rem; color: #5c5649; }
        .overlay-edit {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .bg-preview:hover .overlay-edit { opacity: 1; }
        .overlay-edit span { font-size: 0.85rem; color: #ede4d0; font-weight: 500; }

        /* Galería */
        .gallery-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
        }
        .gallery-item {
          aspect-ratio: 1; border-radius: 10px; overflow: hidden;
          border: 0.5px solid #272420;
        }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-add {
          aspect-ratio: 1; border-radius: 10px;
          border: 0.5px dashed #272420; background: #0e0d0b;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: border-color 0.15s;
        }
        .gallery-add:hover { border-color: #c9a84c; }
        .gallery-add:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Template */
        .template-desc { font-size: 0.82rem; color: #5c5649; margin-bottom: 1.25rem; line-height: 1.5; }
        .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .template-card {
          background: #131210; border: 0.5px solid #272420; border-radius: 14px;
          padding: 0; overflow: hidden; cursor: pointer;
          transition: border-color 0.15s; text-align: left;
        }
        .template-card.selected { border-color: #c9a84c; }
        .template-card:hover { border-color: #c9a84c44; }
        .template-preview {
          height: 90px; padding: 10px; display: flex; flex-direction: column; gap: 6px;
        }
        .template-bar { height: 8px; border-radius: 4px; width: 40%; }
        .template-lines { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
        .tl { height: 4px; border-radius: 2px; width: 80%; }
        .tl.short { width: 50%; }
        .template-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.6rem 0.75rem;
        }
        .template-name { font-size: 0.82rem; font-weight: 500; color: #ede4d0; }
        .template-active {
          font-size: 0.68rem; background: #1e1a10; color: #c9a84c;
          border: 0.5px solid #3a3020; padding: 2px 7px; border-radius: 4px;
        }

        /* Misc */
        .empty-hint { font-size: 0.82rem; color: #3d3a33; padding: 0.5rem 0; margin-bottom: 0.75rem; }
        .page-center {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; background: #0c0b09;
        }
        .loader-ring {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid #272420; border-top-color: #c9a84c;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}