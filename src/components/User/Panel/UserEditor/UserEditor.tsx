import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../../../../context/useAuth";
import type { Subscription } from "../../../../types/index";
import { planMeetsMin, PLAN_LABEL } from "../../../../lib/plans";
import Spinner from "../../../Common/Spinner";
import styles from "./UserEditor.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "info" | "media" | "template";

interface FormState {
  businessName: string;
  mail: string;
  number: string;
  address: string;
  instagram: string;
  facebook: string;
  googleReviewUrl: string;
  googlePlaceId: string;
  hasDelivery: boolean;
  reservationMessage: string;
}

const EMPTY_FORM: FormState = {
  businessName: "",
  mail: "",
  number: "",
  address: "",
  instagram: "",
  facebook: "",
  googleReviewUrl: "",
  googlePlaceId: "",
  hasDelivery: false,
  reservationMessage: "",
};

// Templates de la carta pública, ordenados por plan (free → premium) para que
// la grilla del editor se lea como una progresión. `minPlan` es el plan mínimo
// que desbloquea cada uno; espeja TEMPLATE_MIN_PLAN del backend (que es la
// barrera real). `color`/`accent` son solo para el mini-preview de la tarjeta
// y coinciden con los tokens --t-bg / --t-accent de globals.css.
interface TemplateOption {
  id: number;
  name: string;
  color: string;
  accent: string;
  minPlan: Subscription;
}

const TEMPLATES: TemplateOption[] = [
  // free
  { id: 1,  name: "Clásico",    color: "#0b0a08", accent: "#c9a84c", minPlan: "free" },
  { id: 3,  name: "Natural",    color: "#f2f6ef", accent: "#2e7d32", minPlan: "free" },
  { id: 5,  name: "Minimal",    color: "#ffffff", accent: "#111111", minPlan: "free" },
  // starter
  { id: 2,  name: "Moderno",    color: "#0d1117", accent: "#58a6ff", minPlan: "starter" },
  { id: 4,  name: "Rojo",       color: "#110606", accent: "#e05555", minPlan: "starter" },
  { id: 8,  name: "Coastal",    color: "#f4f8fb", accent: "#2a91c4", minPlan: "starter" },
  { id: 9,  name: "Charcoal",   color: "#1a1a1c", accent: "#ff6b5c", minPlan: "starter" },
  // pro
  { id: 10, name: "Terracotta", color: "#f7ede3", accent: "#c2571f", minPlan: "pro" },
  { id: 11, name: "Lavender",   color: "#f6f3fa", accent: "#8256c4", minPlan: "pro" },
  { id: 12, name: "Forest",     color: "#0c1410", accent: "#86c397", minPlan: "pro" },
  // premium
  { id: 6,  name: "Aurora",     color: "#efddc9", accent: "#a8703f", minPlan: "premium" },
  { id: 7,  name: "Noir Gold",  color: "#08070a", accent: "#d4af37", minPlan: "premium" },
  { id: 13, name: "Platinum",   color: "#0a0b0d", accent: "#b8c2cf", minPlan: "premium" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
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

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UserEditorPage() {
  const { token } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);
  const galleryDragCounter = useRef(0);

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState<"bg" | "gallery" | null>(null);
  const [galleryProgress, setGalleryProgress] = useState<{ done: number; total: number } | null>(null);
  const [galleryDragOver, setGalleryDragOver] = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");

  const [tab, setTab] = useState<Tab>("info");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pictures,          setPictures]   = useState<string[]>([]);
  const [backgroundPicture, setBackground] = useState("");
  const [template,          setTemplate]   = useState(1);
  const [subscription,      setSubscription] = useState<Subscription>("free");
  const [lockedTemplate,    setLockedTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [upgrading,         setUpgrading]      = useState(false);

  const [isDirty, setIsDirty]   = useState(false);
  const initialFormRef = useRef<FormState>(EMPTY_FORM);

  // ── Ajuste de portada (crop/zoom) ──
  // En vez de subir el archivo tal cual se selecciona, se abre un modal
  // donde el usuario puede arrastrar y hacer zoom sobre un recorte fijo
  // (relación 3:1, igual que el recomendado 1200×400). Al confirmar, se
  // renderiza ese recorte a un canvas y se sube el resultado.
  const [cropSrc, setCropSrc]     = useState<string | null>(null);
  const [cropZoom, setCropZoom]   = useState(1);
  const [cropPos, setCropPos]     = useState({ x: 0, y: 0 });
  const [cropReady, setCropReady] = useState(false);
  const [cropSaving, setCropSaving] = useState(false);
  const cropImgRef   = useRef<HTMLImageElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const [cropNatural, setCropNatural] = useState({ w: 0, h: 0, base: 1 });
  const cropDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const CROP_MIN_ZOOM = 1;
  const CROP_MAX_ZOOM = 3;
  const CROP_OUTPUT_W = 1600;
  const CROP_OUTPUT_H = 900;

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Auto-clear banners
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

  // Libera el object URL del recorte si el componente se desmonta con el
  // modal abierto.
  useEffect(() => {
    return () => { if (cropSrc) URL.revokeObjectURL(cropSrc); };
  }, [cropSrc]);

  // Dirty tracking
  useEffect(() => {
    const initial = initialFormRef.current;
    const dirty = (Object.keys(form) as (keyof FormState)[]).some(
      k => form[k] !== initial[k]
    );
    setIsDirty(dirty);
  }, [form]);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res  = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        const loaded: FormState = {
          businessName: data.contactInfo?.businessName || "",
          mail:         data.contactInfo?.mail         || "",
          number:       data.contactInfo?.number?.toString() || "",
          address:      data.contactInfo?.address      || "",
          instagram:    data.contactInfo?.social?.instagram || "",
          facebook:     data.contactInfo?.social?.facebook  || "",
          googleReviewUrl: data.contactInfo?.googleReviewUrl || "",
          googlePlaceId: data.contactInfo?.googlePlaceId || "",
          hasDelivery:  data.hasDelivery ?? false,
          reservationMessage: data.contactInfo?.reservationMessage || "",
        };
        setForm(loaded);
        initialFormRef.current = loaded;
        setPictures(data.media?.pictures || []);
        setBackground(data.media?.backgroundPicture || "");
        setTemplate(data.template || 1);
        setSubscription(data.subscription || "free");
      } catch {
        setError("No se pudo cargar la información del negocio.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Save info
  const saveInfo = async () => {
    if (!form.businessName.trim()) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }
    const numberDigits = form.number.replace(/\D/g, "");
    if (form.number.trim() && !numberDigits) {
      setError("El teléfono no es válido.");
      return;
    }
    const reviewUrl = form.googleReviewUrl.trim();
    if (reviewUrl && !/^https?:\/\//i.test(reviewUrl)) {
      setError("El link de reseñas debe empezar con http:// o https://");
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
            number:       numberDigits ? Number(numberDigits) : null,
            address:      form.address.trim(),
            social: {
              instagram: form.instagram.trim(),
              facebook:  form.facebook.trim(),
            },
            googleReviewUrl: reviewUrl,
            googlePlaceId: form.googlePlaceId.trim(),
            reservationMessage: form.reservationMessage.trim(),
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

  // Save template
  const saveTemplate = async (t: number) => {
    const previous = template;
    setTemplate(t);
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/users/template", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ template: t }),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Ese template requiere un plan pago.");
      }
      if (!res.ok) throw new Error();
      setSuccess("Apariencia actualizada.");
    } catch (err) {
      setTemplate(previous);
      setError(err instanceof Error && err.message ? err.message : "No se pudo guardar la apariencia.");
    }
  };

  // Si el template es premium y el usuario no tiene un plan pago, no lo
  // aplicamos — mostramos el modal de upsell en su lugar. El backend
  // también lo valida (useTemplate en userController.js): esto es UX,
  // no la única barrera.
  const selectTemplate = (t: TemplateOption) => {
    if (!planMeetsMin(subscription, t.minPlan)) {
      setLockedTemplate(t);
      return;
    }
    saveTemplate(t.id);
  };

  // Dispara el pago real desde el modal de upsell, apuntando al plan que el
  // template bloqueado requiere (starter/pro/premium). crear-preferencia
  // requiere estar logueado — ya lo estamos acá — y usa el propio usuario
  // como external_reference para acreditarle el plan cuando MP confirme.
  const handleUpgrade = async () => {
    const planId = lockedTemplate?.minPlan ?? "pro";
    setUpgrading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/crear-preferencia", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error();
      const { init_point } = await res.json();
      window.location.href = init_point;
    } catch {
      setError("No se pudo iniciar el pago. Intentá de nuevo.");
      setUpgrading(false);
    }
  };

  // Upload gallery image(s) — soporta subir varias a la vez (selección
  // múltiple del picker o arrastrando 2+ archivos). El backend solo acepta
  // un archivo por request, así que se suben de a una, en secuencia, y se
  // va actualizando `pictures` con la respuesta real del server después de
  // cada una — así si falla una a mitad de camino no se pierde el progreso
  // de las anteriores.
  const uploadGalleryFiles = async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (files.length > 0) setError("Solo se pueden subir imágenes.");
      return;
    }

    const room = 10 - pictures.length;
    if (room <= 0) { setError("Máximo 10 fotos en la galería."); return; }

    const toUpload = images.slice(0, room);
    const skipped = images.length - toUpload.length;

    setUploading("gallery"); setError(""); setSuccess("");
    let uploaded = 0;
    let failed = 0;
    for (let i = 0; i < toUpload.length; i++) {
      setGalleryProgress({ done: i, total: toUpload.length });
      try {
        const formData = new FormData();
        formData.append("image", toUpload[i]);
        const res = await fetch("/api/users/upload-image", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.media?.pictures) setPictures(data.media.pictures);
        uploaded++;
      } catch {
        failed++;
      }
    }
    setGalleryProgress(null);
    setUploading(null);

    if (failed === 0 && skipped === 0) {
      setSuccess(uploaded === 1 ? "Foto agregada." : `${uploaded} fotos agregadas.`);
    } else {
      const parts = [];
      if (failed > 0) parts.push(`${failed} no se pudieron subir`);
      if (skipped > 0) parts.push(`${skipped} no entraban (máximo 10 fotos)`);
      setError(`${uploaded > 0 ? `${uploaded} fotos agregadas. ` : ""}${parts.join(" y ")}.`);
    }
  };

  // Upload background
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

  // Clampea la posición del recorte para que la imagen siempre cubra el
  // marco (no puede quedar espacio vacío a los costados).
  const clampCropPos = useCallback((x: number, y: number, scale: number) => {
    const frame = cropFrameRef.current;
    if (!frame) return { x, y };
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const { w: nw, h: nh } = cropNatural;
    const dispW = nw * scale, dispH = nh * scale;
    const minX = Math.min(0, fw - dispW);
    const minY = Math.min(0, fh - dispH);
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }, [cropNatural]);

  // Se abre al elegir un archivo de portada, en vez de subirlo directo.
  const openCropModal = (file: File) => {
    const url = URL.createObjectURL(file);
    setCropZoom(1);
    setCropPos({ x: 0, y: 0 });
    setCropReady(false);
    setCropSrc(url);
  };

  const closeCropModal = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropReady(false);
    cropDragRef.current = null;
  };

  // Al cargar la imagen dentro del modal: calcula la escala mínima que la
  // hace cubrir el marco (equivalente a object-fit: cover) y la centra.
  const onCropImageLoad = () => {
    const img = cropImgRef.current;
    const frame = cropFrameRef.current;
    if (!img || !frame) return;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const base = Math.max(fw / nw, fh / nh);
    setCropNatural({ w: nw, h: nh, base });
    const dispW = nw * base, dispH = nh * base;
    setCropPos({ x: (fw - dispW) / 2, y: (fh - dispH) / 2 });
    setCropZoom(1);
    setCropReady(true);
  };

  // Cambia el zoom manteniendo fijo el punto de la imagen que está en el
  // centro del marco, para que el zoom "se sienta" centrado.
  const handleCropZoomChange = (newZoom: number) => {
    const frame = cropFrameRef.current;
    if (!frame || !cropReady) { setCropZoom(newZoom); return; }
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const { base } = cropNatural;
    const oldScale = base * cropZoom;
    const newScale = base * newZoom;
    const centerImgX = (fw / 2 - cropPos.x) / oldScale;
    const centerImgY = (fh / 2 - cropPos.y) / oldScale;
    const nextX = fw / 2 - centerImgX * newScale;
    const nextY = fh / 2 - centerImgY * newScale;
    setCropZoom(newZoom);
    setCropPos(clampCropPos(nextX, nextY, newScale));
  };

  const onCropPointerDown = (e: React.PointerEvent) => {
    if (!cropReady) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    cropDragRef.current = { startX: e.clientX, startY: e.clientY, posX: cropPos.x, posY: cropPos.y };
  };

  const onCropPointerMove = (e: React.PointerEvent) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const scale = cropNatural.base * cropZoom;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setCropPos(clampCropPos(drag.posX + dx, drag.posY + dy, scale));
  };

  const onCropPointerUp = () => { cropDragRef.current = null; };

  // Renderiza el recorte actual a un canvas del tamaño recomendado
  // (1200×400) y sube ese resultado, en vez del archivo original.
  const confirmCrop = async () => {
    const frame = cropFrameRef.current;
    const img = cropImgRef.current;
    if (!frame || !img || !cropReady) return;
    setCropSaving(true);
    try {
      const fw = frame.clientWidth;
      const exportScale = CROP_OUTPUT_W / fw;
      const scale = cropNatural.base * cropZoom;

      const canvas = document.createElement("canvas");
      canvas.width = CROP_OUTPUT_W;
      canvas.height = CROP_OUTPUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.drawImage(
        img,
        cropPos.x * exportScale,
        cropPos.y * exportScale,
        cropNatural.w * scale * exportScale,
        cropNatural.h * scale * exportScale
      );

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error())), "image/jpeg", 0.92);
      });
      const file = new File([blob], "portada.jpg", { type: "image/jpeg" });
      closeCropModal();
      await uploadBackgroundImage(file);
    } catch {
      setError("No se pudo procesar la imagen. Probá de nuevo.");
      setCropSaving(false);
    } finally {
      setCropSaving(false);
    }
  };

  // Remove gallery image (optimistic)
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

  // Drag & drop de fotos sobre la galería. Se usa un contador de
  // enter/leave (en vez de un booleano simple) porque el grid tiene hijos:
  // al arrastrar sobre un hijo, el navegador dispara dragLeave del padre
  // seguido de dragEnter del hijo, y un booleano simple parpadearía.
  const handleGalleryDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading !== null || pictures.length >= 10) return;
    galleryDragCounter.current++;
    setGalleryDragOver(true);
  };

  const handleGalleryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    galleryDragCounter.current = Math.max(0, galleryDragCounter.current - 1);
    if (galleryDragCounter.current === 0) setGalleryDragOver(false);
  };

  const handleGalleryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGalleryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    galleryDragCounter.current = 0;
    setGalleryDragOver(false);
    if (uploading !== null) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadGalleryFiles(files);
  };

  const changeTab = (next: Tab) => {
    setTab(next);
    setError("");
    setSuccess("");
  };

  if (loading) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando..." />
      </div>
    );
  }

  return (
    <div className={styles.ne}>

      {/* Top bar */}
      <header className={styles.topBar}>
        <span className={styles.topTitle}>Mi negocio</span>
        <div style={{ width: 32 }} aria-hidden="true" />
      </header>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist" aria-label="Secciones">
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
            {key === "info" && isDirty && (
              <span className={styles.dirtyDot} aria-label="Cambios sin guardar" />
            )}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* Banners */}
        {error && (
          <div className={styles.errorBanner} role="alert" aria-live="assertive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className={styles.successBanner} role="status" aria-live="polite">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {success}
          </div>
        )}

        {/* ── TAB: INFO ── */}
        {tab === "info" && (
          <>
            <div className={styles.field}>
              <label htmlFor="businessName">
                Nombre del negocio
                <span className={styles.required} aria-hidden> *</span>
              </label>
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

            <div className={styles.field}>
              <label htmlFor="reservationMessage">Mensaje de reserva (WhatsApp)</label>
              <textarea
                id="reservationMessage"
                rows={2}
                placeholder="Hola! Quiero hacer una reserva en [nombre del negocio]."
                value={form.reservationMessage}
                onChange={e => setForm(f => ({ ...f, reservationMessage: e.target.value }))}
              />
              <p className={styles.fieldHint}>
                Este texto se pre-carga cuando un cliente toca "Reservar por WhatsApp" en tu carta pública.
                Si lo dejás vacío, se usa un mensaje genérico con el nombre de tu negocio.
              </p>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="instagram">Instagram</label>
                <input
                  id="instagram"
                  type="text"
                  placeholder="@tunegocio"
                  value={form.instagram}
                  onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="facebook">Facebook</label>
                <input
                  id="facebook"
                  type="text"
                  placeholder="tunegocio"
                  value={form.facebook}
                  onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="googleReviewUrl">Link de reseñas de Google Maps</label>
              <input
                id="googleReviewUrl"
                type="url"
                placeholder="https://g.page/r/tu-negocio/review"
                value={form.googleReviewUrl}
                onChange={e => setForm(f => ({ ...f, googleReviewUrl: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="googlePlaceId">ID de lugar de Google (Place ID)</label>
              <input
                id="googlePlaceId"
                type="text"
                placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                value={form.googlePlaceId}
                onChange={e => setForm(f => ({ ...f, googlePlaceId: e.target.value }))}
              />
              <p className={styles.fieldHint}>
                Necesario para mostrar el rating y la cantidad de reseñas reales en tu
                carta. Buscalo con el{" "}
                <a
                  href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Place ID Finder de Google
                </a>.
              </p>
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
              {saving
                ? <><Spinner size={16} /> Guardando...</>
                : isDirty ? "Guardar cambios" : "Sin cambios"
              }
            </button>
          </>
        )}

        {/* ── TAB: MEDIA ── */}
        {tab === "media" && (
          <>
            {/* Background */}
            <div className={styles.mediaSection}>
              <p className={styles.mediaLabel}>Imagen de portada</p>
              <div
                className={`${styles.bgPreview} ${uploading === "bg" ? styles.uploading : ""}`}
                style={backgroundPicture ? { backgroundImage: `url(${backgroundPicture})` } : undefined}
                onClick={() => uploading === null && bgInputRef.current?.click()}
                role="button"
                aria-label={backgroundPicture ? "Cambiar portada" : "Subir portada"}
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && uploading === null && bgInputRef.current?.click()}
              >
                {uploading === "bg" ? (
                  <div className={styles.uploadingOverlay}>
                    <Spinner size={24} />
                    <span>Subiendo...</span>
                  </div>
                ) : !backgroundPicture ? (
                  <div className={styles.uploadPlaceholder}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                      strokeLinejoin="round" style={{ color: "var(--gray-400)" }} aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Subir portada</span>
                    <span className={styles.uploadHint}>Recomendado: 1600 × 900 px</span>
                  </div>
                ) : (
                  <div className={styles.overlayEdit}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
                  if (e.target.files?.[0]) openCropModal(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Gallery */}
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
                  {uploading === "gallery"
                    ? <><Spinner size={12} /> {galleryProgress ? `Subiendo ${galleryProgress.done + 1}/${galleryProgress.total}...` : "Subiendo..."}</>
                    : "+ Agregar fotos"
                  }
                </button>
              </div>

              {pictures.length === 0 && (
                <p className={styles.emptyHint}>
                  Agregá o arrastrá fotos de tu local para que los clientes lo conozcan.
                </p>
              )}

              <div
                className={`${styles.galleryGrid} ${galleryDragOver ? styles.galleryGridDragging : ""}`}
                onDragEnter={handleGalleryDragEnter}
                onDragOver={handleGalleryDragOver}
                onDragLeave={handleGalleryDragLeave}
                onDrop={handleGalleryDrop}
              >
                {pictures.map((url, i) => (
                  <div key={`${url}-${i}`} className={styles.galleryItem}>
                    <img src={url} alt={`Foto del negocio ${i + 1}`} loading="lazy" />
                    <button
                      className={styles.galleryItemRemove}
                      onClick={() => removeImage(i)}
                      aria-label={`Eliminar foto ${i + 1}`}
                      type="button"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden>
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
                      <Spinner size={18} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden>
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
                multiple
                style={{ display: "none" }}
                onChange={e => {
                  if (e.target.files?.length) uploadGalleryFiles(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />
            </div>
          </>
        )}

        {/* ── TAB: TEMPLATE ── */}
        {tab === "template" && (
          <>
            <p className={styles.templateDesc}>
              Elegí el estilo visual de tu carta pública. El cambio se aplica de inmediato.
            </p>
            <div className={styles.templateGrid}>
              {TEMPLATES.map(t => {
                const isLocked = !planMeetsMin(subscription, t.minPlan);
                return (
                  <button
                    key={t.id}
                    className={`${styles.templateCard} ${template === t.id ? styles.selected : ""} ${isLocked ? styles.locked : ""}`}
                    onClick={() => selectTemplate(t)}
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
                      {isLocked && (
                        <div className={styles.templateLockOverlay}>
                          <LockIcon />
                        </div>
                      )}
                    </div>
                    <div className={styles.templateFooter}>
                      <span className={styles.templateName}>{t.name}</span>
                      {template === t.id ? (
                        <span className={styles.templateActive}>Activo</span>
                      ) : t.minPlan !== "free" ? (
                        // Muestra el plan que desbloquea el template (Starter/Pro/
                        // Premium) en vez de un "PRO" genérico.
                        <span className={styles.templatePro}>{PLAN_LABEL[t.minPlan]}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

      </div>

      {/* ── Modal: template premium bloqueado ── */}
      {lockedTemplate && (
        <div
          className={styles.modalOverlay}
          onClick={() => setLockedTemplate(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-modal-title"
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}><LockIcon size={20} /></div>
            <p id="premium-modal-title" className={styles.modalTitle}>
              {lockedTemplate.name} es un template {PLAN_LABEL[lockedTemplate.minPlan]}
            </p>
            <p className={styles.modalDesc}>
              Con el plan {PLAN_LABEL[lockedTemplate.minPlan]} desbloqueás este
              estilo y todos los templates de ese nivel.
            </p>
            <div className={styles.modalBtns}>
              <button
                className={styles.modalCancel}
                onClick={() => setLockedTemplate(null)}
                type="button"
                disabled={upgrading}
              >
                Cerrar
              </button>
              <button
                className={styles.modalUpgrade}
                onClick={handleUpgrade}
                type="button"
                disabled={upgrading}
              >
                {upgrading ? <><Spinner size={14} /> Redirigiendo...</> : `Mejorar a ${PLAN_LABEL[lockedTemplate.minPlan]}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: ajustar imagen de portada ── */}
      {cropSrc && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="crop-modal-title">
          <div className={styles.cropModal}>
            <p id="crop-modal-title" className={styles.modalTitle}>Ajustar portada</p>

            <div
              ref={cropFrameRef}
              className={styles.cropStage}
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={onCropPointerUp}
              onPointerCancel={onCropPointerUp}
            >
              <img
                ref={cropImgRef}
                src={cropSrc}
                alt=""
                className={styles.cropStageImg}
                onLoad={onCropImageLoad}
                style={{
                  transform: `translate(${cropPos.x}px, ${cropPos.y}px)`,
                  width: cropNatural.w * cropNatural.base * cropZoom,
                  height: cropNatural.h * cropNatural.base * cropZoom,
                  visibility: cropReady ? "visible" : "hidden",
                }}
                draggable={false}
              />
            </div>

            <div className={styles.cropZoomRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" aria-hidden style={{ color: "var(--admin-text-muted)", flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="range"
                min={CROP_MIN_ZOOM}
                max={CROP_MAX_ZOOM}
                step={0.01}
                value={cropZoom}
                disabled={!cropReady}
                onChange={e => handleCropZoomChange(Number(e.target.value))}
                aria-label="Zoom"
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" aria-hidden style={{ color: "var(--admin-text-muted)", flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>

            <p className={styles.cropHint}>Arrastrá para posicionar y usá el control para hacer zoom.</p>

            <div className={styles.modalBtns}>
              <button
                className={styles.modalCancel}
                onClick={closeCropModal}
                type="button"
                disabled={cropSaving}
              >
                Cancelar
              </button>
              <button
                className={styles.modalUpgrade}
                onClick={confirmCrop}
                type="button"
                disabled={!cropReady || cropSaving}
              >
                {cropSaving ? <><Spinner size={14} /> Subiendo...</> : "Guardar portada"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}