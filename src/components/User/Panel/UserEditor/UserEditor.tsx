import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../../../../context/useAuth";
import { useFeedbackMessage } from "../../../../hooks/useFeedbackMessage";
import type { Subscription, DayKey, DayHours, Schedule } from "../../../../types/index";
import { usePlans } from "../../../../hooks/usePlans";
import { BUSINESS_TIME_PATTERN } from "../../../../Utils/businessSchedule";
import WeeklySchedule from "../../../Common/WeeklySchedule/WeeklySchedule";
import { WEEK_DAYS } from "../../../Common/WeeklySchedule/weekSchedule";
import type { WeekRanges } from "../../../Common/WeeklySchedule/weekSchedule";
import Spinner from "../../../Common/Spinner";
import UpgradeModal from "../../../Common/UpgradeModal";
import MenuStylePicker from "./MenuStylePicker";
import { resolveMenuStyle, getVisualFamily, buildAppearanceBody, type MenuStyle } from "../../../../lib/menuStyles";
import { TEMPLATES, type TemplateOption } from "../../../../lib/templates";
import { normalizeArPhone, isValidArLocalPhone } from "../../../../lib/whatsapp";
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
  hasDelivery: boolean;
  reservationMessage: string;
  orderMessage: string;
}

const EMPTY_FORM: FormState = {
  businessName: "",
  mail: "",
  number: "",
  address: "",
  instagram: "",
  facebook: "",
  hasDelivery: false,
  reservationMessage: "",
  orderMessage: "",
};

// Espejo del máximo de contactInfo.orderMessage en el backend.
const ORDER_MESSAGE_MAX_LENGTH = 500;

// ── Logo del favicon (media.favicon) ──
// Espejo de FAVICON_MAX_BYTES en el backend (config/cloudinary.js). Se
// valida sobre el archivo que elige el dueño, antes de procesarlo: un logo
// no necesita más, y así una foto de varios MB no llega a decodificarse.
const FAVICON_MAX_BYTES = 1024 * 1024;
const FAVICON_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Debajo de esto el ícono se ve pixelado hasta en la pestaña.
const FAVICON_MIN_SIDE = 32;
// Lo que se sube: un PNG cuadrado de 256 px con el logo centrado sobre
// fondo transparente (pesa pocos KB). Un favicon no cuadrado el navegador
// lo deforma o lo recorta según el caso.
const FAVICON_OUTPUT_SIDE = 256;

const formatMb = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

// Valida el logo y lo devuelve listo para subir como favicon. Tira un Error
// con el mensaje para el usuario si no sirve.
async function prepareFaviconFile(file: File): Promise<File> {
  if (!FAVICON_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("El logo tiene que ser una imagen JPG, PNG o WebP.");
  }
  if (file.size > FAVICON_MAX_BYTES) {
    throw new Error(
      `El logo pesa ${formatMb(file.size)}. El máximo es ${formatMb(FAVICON_MAX_BYTES)}: probá con una versión más liviana.`
    );
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("No se pudo leer la imagen. Probá con otro archivo.");
    }

    const { naturalWidth: w, naturalHeight: h } = img;
    if (w < FAVICON_MIN_SIDE || h < FAVICON_MIN_SIDE) {
      throw new Error(
        `El logo es muy chico (${w} × ${h} px). Tiene que medir al menos ${FAVICON_MIN_SIDE} × ${FAVICON_MIN_SIDE} px.`
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = FAVICON_OUTPUT_SIDE;
    canvas.height = FAVICON_OUTPUT_SIDE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen. Probá de nuevo.");
    // "contain": entra entero, sin recortar, y nunca se agranda más allá de
    // su tamaño real.
    const scale = Math.min(FAVICON_OUTPUT_SIDE / w, FAVICON_OUTPUT_SIDE / h, 1);
    const dw = w * scale, dh = h * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (FAVICON_OUTPUT_SIDE - dw) / 2, (FAVICON_OUTPUT_SIDE - dh) / 2, dw, dh);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen. Probá de nuevo."))),
        "image/png"
      );
    });
    return new File([blob], "favicon.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// WhatsApp por sucursal (contactInfo.whatsappNumbers). Espejo de los topes
// del backend (parseWhatsappNumbers en userController.js).
interface WaNumberRow {
  name: string;
  number: string;
}
const WHATSAPP_NUMBERS_MAX = 10;
const WHATSAPP_NAME_MAX_LENGTH = 40;
const PHONE_FORMAT_HINT = "Código de área y número, sin 0 ni 15 (ej: 11 2345-6789).";

// ── Horario de atención ──
// Los tipos (DayKey/DayHours/Schedule) viven en types/index.ts, espejo del
// shape que guarda el backend — acá solo las constantes/helpers de UI que
// los usan.
const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABEL: Record<DayKey, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const DEFAULT_DAY_HOURS: DayHours = { enabled: true, open: "09:00", close: "18:00" };

const EMPTY_SCHEDULE: Schedule = DAY_ORDER.reduce((acc, day) => {
  acc[day] = { ...DEFAULT_DAY_HOURS };
  return acc;
}, {} as Schedule);

// Completa días faltantes con el default en vez de asumir que el backend
// siempre manda los 7 — así datos viejos (de antes de esta funcionalidad)
// no rompen el render.
function normalizeSchedule(raw: unknown): Schedule {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<DayKey, Partial<DayHours>>>;
  return DAY_ORDER.reduce((acc, day) => {
    const d = src[day];
    acc[day] = {
      enabled: d?.enabled ?? DEFAULT_DAY_HOURS.enabled,
      open:    d?.open    ?? DEFAULT_DAY_HOURS.open,
      close:   d?.close   ?? DEFAULT_DAY_HOURS.close,
    };
    return acc;
  }, {} as Schedule);
}

// El horario de atención se edita con el mismo control que la programación
// de productos (WeeklySchedule), que habla en rangos por día. Como el negocio
// guarda un solo turno por día, va con maxRangesPerDay={1}.
function scheduleToWeek(schedule: Schedule): WeekRanges {
  return WEEK_DAYS.reduce((acc, day) => {
    const d = schedule[day];
    acc[day] = d?.enabled ? [{ from: d.open, to: d.close }] : [];
    return acc;
  }, {} as WeekRanges);
}

// Un día que queda cerrado conserva las horas que tenía guardadas: volver a
// abrirlo no pierde lo que había cargado el dueño.
function weekToSchedule(week: WeekRanges, previous: Schedule): Schedule {
  return DAY_ORDER.reduce((acc, day) => {
    const range = week[day]?.[0];
    acc[day] = range
      ? { enabled: true, open: range.from, close: range.to }
      : { ...previous[day], enabled: false };
    return acc;
  }, {} as Schedule);
}


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
  const { token, logout } = useAuth();
  const catalog = usePlans();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const galleryDragCounter = useRef(0);

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState<"bg" | "gallery" | "favicon" | null>(null);
  const [galleryProgress, setGalleryProgress] = useState<{ done: number; total: number } | null>(null);
  const [galleryDragOver, setGalleryDragOver] = useState(false);
  const [error,     setError]     = useFeedbackMessage("error");
  const [success,   setSuccess]   = useFeedbackMessage("success");

  const [tab, setTab] = useState<Tab>("info");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [schedule, setSchedule] = useState<Schedule>(EMPTY_SCHEDULE);
  const initialScheduleRef = useRef<Schedule>(EMPTY_SCHEDULE);
  const [waNumbers, setWaNumbers] = useState<WaNumberRow[]>([]);
  const initialWaNumbersRef = useRef<WaNumberRow[]>([]);
  const [pictures,         setPictures]   = useState<string[]>([]);
  const [backgroundPicture, setBackground] = useState("");
  const [favicon,           setFavicon]    = useState("");
  const [template,         setTemplate]   = useState(1);
  const [menuStyle, setMenuStyle] = useState<MenuStyle>("classic");
  const [savingAppearance, setSavingAppearance] = useState(false);
  const appearanceSavingRef = useRef(false);
  const [subscription,      setSubscription] = useState<Subscription>("free");
  const [lockedTemplate,    setLockedTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [stylesLocked,      setStylesLocked] = useState(false);
  const [nameChangeConfirmOpen, setNameChangeConfirmOpen] = useState(false);

  const currentPlan = catalog.isError ? undefined : catalog.data?.find(plan => plan.name === subscription);
  // El mensaje de pedido se guarda con cualquier plan (así el dueño lo deja
  // listo antes de cambiar), pero solo se usa donde la carta tiene carrito:
  // en vez de bloquear el campo, se avisa y se nombra el plan que lo incluye,
  // como en los diseños bloqueados. Mientras carga el catálogo no se avisa.
  const orderMessageLocked = currentPlan?.features.pedido_whatsapp === false;
  const orderMessagePlan = catalog.data?.find(plan => plan.features.pedido_whatsapp);
  // Las familias visuales son una feature aparte de las paletas: el permiso y
  // la etiqueta del plan que las incluye salen del catálogo, no del nombre.
  const familiesLocked = currentPlan?.features.menu_styles === false;
  const familiesPlan = catalog.data?.find(plan => plan.features.menu_styles);

  const [isDirty, setIsDirty]   = useState(false);
  const initialFormRef = useRef<FormState>(EMPTY_FORM);

  // ── Cambio de email de contacto ──
  // Cambiar el mail no se guarda junto con el resto de "Info": requiere
  // confirmar un código mandado a la casilla nueva (POST /users/me/email-change
  // + /email-change/confirm) antes de que el backend lo escriba de verdad —
  // así nunca queda guardado un mail que el dueño no probó controlar.
  const [emailChangeStep, setEmailChangeStep] = useState<"idle" | "pending">("idle");
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [emailChangeSubmitting, setEmailChangeSubmitting] = useState(false);
  const [emailChangeMasked, setEmailChangeMasked] = useState<string | null>(null);
  const [emailChangeError, setEmailChangeError] = useState("");

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
  }, [success, setSuccess]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error, setError]);

  // Libera el object URL del recorte si el componente se desmonta con el
  // modal abierto.
  useEffect(() => {
    return () => { if (cropSrc) URL.revokeObjectURL(cropSrc); };
  }, [cropSrc]);

  // Dirty tracking
  // El horario se compara por JSON (no shallow) porque es un objeto anidado:
  // un shallow `!==` en `schedule` cambiaría de referencia en cada setState
  // y siempre marcaría dirty aunque el contenido sea igual.
  useEffect(() => {
    const initial = initialFormRef.current;
    const formDirty = (Object.keys(form) as (keyof FormState)[]).some(
      k => form[k] !== initial[k]
    );
    const scheduleDirty = JSON.stringify(schedule) !== JSON.stringify(initialScheduleRef.current);
    const waNumbersDirty = JSON.stringify(waNumbers) !== JSON.stringify(initialWaNumbersRef.current);
    setIsDirty(formDirty || scheduleDirty || waNumbersDirty);
  }, [form, schedule, waNumbers]);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res  = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          logout();
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "No se pudo cargar la información del negocio.");
        }
        const data = await res.json();

        const loaded: FormState = {
          businessName: data.contactInfo?.businessName || "",
          mail:         data.contactInfo?.mail         || "",
          // Se muestra ya normalizado (sin 54/9/0/15): los números viejos
          // guardados con código de país quedan en el formato nuevo al guardar.
          number:       normalizeArPhone(data.contactInfo?.number),
          address:      data.contactInfo?.address      || "",
          instagram:    data.contactInfo?.social?.instagram || "",
          facebook:     data.contactInfo?.social?.facebook  || "",
          hasDelivery:  data.hasDelivery ?? false,
          reservationMessage: data.contactInfo?.reservationMessage || "",
          orderMessage: data.contactInfo?.orderMessage || "",
        };
        setForm(loaded);
        initialFormRef.current = loaded;
        const loadedWaNumbers: WaNumberRow[] = Array.isArray(data.contactInfo?.whatsappNumbers)
          ? data.contactInfo.whatsappNumbers.map((w: { name?: string; number?: string }) => ({
            name: w.name || "",
            number: w.number || "",
          }))
          : [];
        setWaNumbers(loadedWaNumbers);
        initialWaNumbersRef.current = loadedWaNumbers;
        const loadedSchedule = normalizeSchedule(data.schedule);
        setSchedule(loadedSchedule);
        initialScheduleRef.current = loadedSchedule;
        setPictures(data.media?.pictures || []);
        setBackground(data.media?.backgroundPicture || "");
        setFavicon(data.media?.favicon || "");
        setTemplate(data.template || 1);
        setMenuStyle(resolveMenuStyle(data.menuStyle));
        setSubscription(data.subscription || "free");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la información del negocio.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, setError, logout]);

  // Valida la pestaña "Información"; separado de saveInfo para poder
  // correrlo también antes de abrir la confirmación de cambio de nombre,
  // sin duplicar las reglas.
  const validateInfoForm = (): boolean => {
    if (!form.businessName.trim()) {
      setError("El nombre del negocio es obligatorio.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mail.trim())) {
      setError("Ingresá un email de contacto válido.");
      return false;
    }
    if (form.number.trim() && !isValidArLocalPhone(normalizeArPhone(form.number))) {
      setError(`El teléfono no es válido. ${PHONE_FORMAT_HINT}`);
      return false;
    }
    const filledWaNumbers = waNumbers.filter(w => w.name.trim() || w.number.trim());
    for (const w of filledWaNumbers) {
      if (!isValidArLocalPhone(normalizeArPhone(w.number))) {
        setError(`El WhatsApp${w.name.trim() ? ` "${w.name.trim()}"` : ""} no es válido. ${PHONE_FORMAT_HINT}`);
        return false;
      }
    }
    if (filledWaNumbers.length > 1 && filledWaNumbers.some(w => !w.name.trim())) {
      setError("Si cargás más de un WhatsApp, ponele un nombre a cada uno (ej: la sucursal).");
      return false;
    }
    for (const day of DAY_ORDER) {
      const d = schedule[day];
      if (d.enabled && (!BUSINESS_TIME_PATTERN.test(d.open) || !BUSINESS_TIME_PATTERN.test(d.close))) {
        setError(`En ${DAY_LABEL[day]} ingresá una hora de apertura y de cierre válidas.`);
        return false;
      }
    }
    return true;
  };

  // Cambiar el nombre cambia el slug de la carta pública (generateUniqueSlug
  // en el backend) y por lo tanto la URL que codifica cualquier QR ya
  // impreso o compartido — se confirma aparte para que el dueño no se lo
  // pierda en medio del resto de los cambios de "Info".
  const businessNameChanged = form.businessName.trim() !== initialFormRef.current.businessName.trim();

  // Save info
  const saveInfo = async () => {
    const trimmedMail = form.mail.trim();
    const numberDigits = normalizeArPhone(form.number);
    // Las filas vacías se descartan; el resto va normalizado como lo guarda
    // el backend, y así queda también como estado "sin cambios".
    const savedWaNumbers: WaNumberRow[] = waNumbers
      .filter(w => w.name.trim() || w.number.trim())
      .map(w => ({ name: w.name.trim(), number: normalizeArPhone(w.number) }));
    // Cambiar el mail no pasa por este PUT (el backend lo rechaza): se manda
    // siempre el valor ya guardado, y si el dueño tipeó uno distinto se
    // dispara aparte el flujo de confirmación por código.
    const mailChanged = trimmedMail !== initialFormRef.current.mail;

    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          contactInfo: {
            businessName: form.businessName.trim(),
            mail:         initialFormRef.current.mail,
            number:       numberDigits ? Number(numberDigits) : null,
            whatsappNumbers: savedWaNumbers,
            address:      form.address.trim(),
            social: {
              instagram: form.instagram.trim(),
              facebook:  form.facebook.trim(),
            },
            reservationMessage: form.reservationMessage.trim(),
            orderMessage: form.orderMessage.trim(),
          },
          hasDelivery: form.hasDelivery,
          schedule,
        }),
      });
      if (res.status === 401) {
        logout();
        window.location.assign("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo guardar la información.");
      }
      // El mail queda afuera a propósito: sigue siendo el viejo hasta
      // confirmar el código, así isDirty refleja que ese cambio puntual
      // todavía no se guardó de verdad.
      // El teléfono se reemplaza por su versión normalizada (la guardada).
      initialFormRef.current = { ...form, number: numberDigits, mail: initialFormRef.current.mail };
      setForm(f => ({ ...f, number: numberDigits }));
      initialScheduleRef.current = schedule;
      initialWaNumbersRef.current = savedWaNumbers;
      setWaNumbers(savedWaNumbers);
      setIsDirty(mailChanged);
      setSuccess("Información guardada.");

      if (mailChanged) {
        await startEmailChange(trimmedMail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la información.");
    } finally {
      setSaving(false);
    }
  };

  // Si el nombre cambió, primero se confirma en un modal (ver
  // businessNameChanged); si no, se guarda directo.
  const handleSaveClick = () => {
    if (!validateInfoForm()) return;
    if (businessNameChanged) {
      setNameChangeConfirmOpen(true);
      return;
    }
    saveInfo();
  };

  const confirmBusinessNameChange = () => {
    setNameChangeConfirmOpen(false);
    saveInfo();
  };

  // Paso 1: pide el cambio de mail — manda un código a la casilla nueva, no
  // toca contactInfo.mail todavía.
  const startEmailChange = async (mail: string) => {
    setEmailChangeSubmitting(true);
    setEmailChangeError("");
    try {
      const res = await fetch("/api/users/me/email-change", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ mail }),
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo iniciar el cambio de email.");
      setEmailChangeMasked(data.maskedEmail || null);
      setEmailChangeStep("pending");
    } catch (err) {
      setEmailChangeError(err instanceof Error ? err.message : "No se pudo iniciar el cambio de email.");
    } finally {
      setEmailChangeSubmitting(false);
    }
  };

  // Paso 2: recién acá el backend escribe contactInfo.mail, si el código coincide.
  const confirmEmailChangeCode = async () => {
    if (emailChangeCode.length !== 6) return;
    setEmailChangeSubmitting(true);
    setEmailChangeError("");
    try {
      const res = await fetch("/api/users/me/email-change/confirm", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: emailChangeCode }),
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "El código no es correcto.");
      const newMail = data.contactInfo?.mail || form.mail.trim();
      setForm(f => ({ ...f, mail: newMail }));
      initialFormRef.current = { ...initialFormRef.current, mail: newMail };
      setEmailChangeStep("idle");
      setEmailChangeCode("");
      setEmailChangeMasked(null);
      setSuccess("Email de contacto actualizado.");
    } catch (err) {
      setEmailChangeError(err instanceof Error ? err.message : "El código no es correcto.");
    } finally {
      setEmailChangeSubmitting(false);
    }
  };

  // Abandona el cambio pendiente sin llamar al backend: como nunca se llegó
  // a guardar nada, alcanza con volver el form al mail vigente.
  const cancelEmailChange = () => {
    setForm(f => ({ ...f, mail: initialFormRef.current.mail }));
    setEmailChangeStep("idle");
    setEmailChangeCode("");
    setEmailChangeMasked(null);
    setEmailChangeError("");
  };

  // Save template
  //
  // `nextStyle` es opcional a propósito: sin él, esto es un cambio de paleta y
  // el diseño guardado no se toca. Ver buildAppearanceBody — reenviar el
  // estado actual pisaría la familia de una cuenta con el plan vencido.
  const saveTemplate = async (t: number, nextStyle?: MenuStyle) => {
    if (appearanceSavingRef.current) return;
    appearanceSavingRef.current = true;
    setSavingAppearance(true);
    const previous = template;
    const previousStyle = menuStyle;
    setTemplate(t);
    if (nextStyle !== undefined) setMenuStyle(nextStyle);
    setError(""); setSuccess("");
    try {
      const res = await fetch("/api/users/template", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(buildAppearanceBody(t, nextStyle)),
      });
      if (res.status === 401) {
        logout();
        window.location.assign("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const fallback = res.status !== 403
          ? "No se pudo guardar la apariencia."
          : getVisualFamily(nextStyle)
            ? "Las familias visuales requieren un plan superior."
            : "Ese template requiere un plan pago.";
        throw new Error(data?.message || fallback);
      }
      const data = await res.json();
      // Un backend anterior ignora menuStyle: no confirmar un diseño que no guardó.
      setTemplate(data.template);
      setMenuStyle(resolveMenuStyle(data.menuStyle));
      if (nextStyle !== undefined && nextStyle !== "classic" && data.menuStyle !== nextStyle) {
        setError("Este diseño todavía no está disponible. Tu paleta se guardó y la carta conserva el diseño Clásico.");
      } else {
        setSuccess("Apariencia actualizada.");
      }
    } catch (err) {
      setTemplate(previous);
      setMenuStyle(previousStyle);
      setError(err instanceof Error && err.message ? err.message : "No se pudo guardar la apariencia.");
    } finally {
      appearanceSavingRef.current = false;
      setSavingAppearance(false);
    }
  };

  // Si el template requiere un plan superior y el usuario no lo tiene, no lo
  // aplicamos — mostramos el modal de upsell en su lugar. El backend
  // también lo valida (useTemplate en userController.js): esto es UX,
  // no la única barrera.
  const selectTemplate = (t: TemplateOption) => {
    if (!currentPlan || catalog.isFetching) return;
    if (!currentPlan?.features.templateIds.includes(t.id)) {
      setLockedTemplate(t);
      return;
    }
    saveTemplate(t.id);
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
    let lastErrorMessage: string | null = null;
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
        if (res.status === 401) {
          logout();
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          lastErrorMessage = typeof data.message === "string" ? data.message : null;
          failed++;
          continue;
        }
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
      if (failed > 0) parts.push(`${failed} no se pudieron subir${lastErrorMessage ? ` (${lastErrorMessage})` : ""}`);
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
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo subir la imagen de portada.");
      }
      const data = await res.json();
      setBackground(data.media?.backgroundPicture || data.imageUrl || "");
      setSuccess("Portada actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen de portada.");
    } finally {
      setUploading(null);
    }
  };

  // Logo del favicon: se valida y se achica en el navegador (ver
  // prepareFaviconFile) y recién ahí se sube.
  const uploadFaviconImage = async (file: File) => {
    setUploading("favicon"); setError(""); setSuccess("");
    try {
      const prepared = await prepareFaviconFile(file);
      const formData = new FormData();
      formData.append("image", prepared);
      const res = await fetch("/api/users/upload-favicon", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo subir el logo.");
      }
      const data = await res.json();
      setFavicon(data.media?.favicon || data.imageUrl || "");
      setSuccess("Logo actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setUploading(null);
    }
  };

  // Quitar el logo (optimista): la landing y la carta vuelven al favicon
  // de Menú Digital.
  const removeFavicon = async () => {
    const prev = favicon;
    setFavicon("");
    try {
      const res = await fetch("/api/users/favicon", {
        method: "DELETE",
        headers: authHeaders,
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo quitar el logo.");
      }
      setSuccess("Logo quitado. Se muestra el ícono de Menú Digital.");
    } catch (err) {
      setFavicon(prev);
      setError(err instanceof Error ? err.message : "No se pudo quitar el logo.");
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
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo eliminar la imagen.");
      }
    } catch (err) {
      setPictures(prev);
      setError(err instanceof Error ? err.message : "No se pudo eliminar la imagen.");
    }
  }, [pictures, authHeaders, setError, logout]);

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

  const scheduleWeek = scheduleToWeek(schedule);

  const handleScheduleChange = (week: WeekRanges) => {
    setSchedule(s => weekToSchedule(week, s));
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
                  inputMode="tel"
                  placeholder="11 2345-6789"
                  value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                  autoComplete="tel-national"
                  aria-describedby="phone-hint"
                />
                <p id="phone-hint" className={styles.fieldHint}>{PHONE_FORMAT_HINT}</p>
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
                  disabled={emailChangeStep === "pending"}
                />
              </div>
            </div>

            {emailChangeStep === "pending" && (
              <div className={styles.emailChangeCard}>
                <p className={styles.fieldHint}>
                  Te mandamos un código a {emailChangeMasked || "tu email nuevo"} para
                  confirmarlo. El email de contacto se actualiza recién al ingresarlo acá
                  — el resto de esta pestaña ya se guardó.
                </p>
                <div className={styles.emailChangeRow}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={emailChangeCode}
                    onChange={e => setEmailChangeCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={emailChangeSubmitting}
                    aria-label="Código de confirmación del email nuevo"
                  />
                  <button
                    type="button"
                    className={styles.emailChangeConfirmBtn}
                    onClick={confirmEmailChangeCode}
                    disabled={emailChangeSubmitting || emailChangeCode.length !== 6}
                  >
                    {emailChangeSubmitting ? "Confirmando..." : "Confirmar"}
                  </button>
                </div>
                {emailChangeError && <p className={styles.emailChangeError}>{emailChangeError}</p>}
                <div className={styles.emailChangeActions}>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => void startEmailChange(form.mail.trim())}
                    disabled={emailChangeSubmitting}
                  >
                    Reenviar código
                  </button>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={cancelEmailChange}
                    disabled={emailChangeSubmitting}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className={styles.field} role="group" aria-labelledby="waNumbers-label" aria-describedby="waNumbers-hint">
              <p id="waNumbers-label" className={styles.groupLabel}>WhatsApp para pedidos y reservas</p>
              {waNumbers.length > 0 && (
                <ul className={styles.waList}>
                  {waNumbers.map((w, i) => (
                    <li key={i} className={styles.waRow}>
                      <input
                        type="text"
                        placeholder={waNumbers.length > 1 ? "Nombre (ej: Sucursal Centro)" : "Nombre (opcional)"}
                        value={w.name}
                        maxLength={WHATSAPP_NAME_MAX_LENGTH}
                        onChange={e => setWaNumbers(list => list.map((row, j) => j === i ? { ...row, name: e.target.value } : row))}
                        aria-label={`Nombre del WhatsApp ${i + 1}`}
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="11 2345-6789"
                        value={w.number}
                        onChange={e => setWaNumbers(list => list.map((row, j) => j === i ? { ...row, number: e.target.value } : row))}
                        aria-label={`Número del WhatsApp ${i + 1}`}
                      />
                      <button
                        type="button"
                        className={styles.waRemove}
                        onClick={() => setWaNumbers(list => list.filter((_, j) => j !== i))}
                        aria-label={`Quitar el WhatsApp ${w.name.trim() || i + 1}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {waNumbers.length < WHATSAPP_NUMBERS_MAX && (
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setWaNumbers(list => [...list, { name: "", number: "" }])}
                >
                  + Agregar {waNumbers.length === 0 ? "un WhatsApp" : "otro WhatsApp"}
                </button>
              )}
              <p id="waNumbers-hint" className={styles.fieldHint}>
                {PHONE_FORMAT_HINT} Si tenés más de una sucursal, cargá un número por cada una con su
                nombre: al pedir o reservar, tus clientes eligen a cuál escribir. Si no cargás
                ninguno, se usa el teléfono de arriba.
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="reservationMessage">Mensaje de reserva (WhatsApp)</label>
              <textarea
                id="reservationMessage"
                rows={2}
                placeholder="Hola! Quiero hacer una reserva en [nombre del negocio]."
                value={form.reservationMessage}
                onChange={e => setForm(f => ({ ...f, reservationMessage: e.target.value }))}
                aria-describedby="reservationMessage-hint"
              />
              <p id="reservationMessage-hint" className={styles.fieldHint}>
                Este texto se pre-carga cuando un cliente toca "Reservar por WhatsApp" en tu carta pública.
                Si lo dejás vacío, se usa un mensaje genérico con el nombre de tu negocio.
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="orderMessage">Mensaje de pedido (WhatsApp)</label>
              <textarea
                id="orderMessage"
                rows={3}
                maxLength={ORDER_MESSAGE_MAX_LENGTH}
                // Expresión JS y no atributo literal: en JSX "\n" dentro de
                // comillas no es un salto de línea.
                placeholder={"Nombre y apellido:\nDirección:\nEntre calles:"}
                value={form.orderMessage}
                onChange={e => setForm(f => ({ ...f, orderMessage: e.target.value }))}
                // Así el lector de pantalla también lee la nota del plan cuando aparece.
                aria-describedby="orderMessage-hint"
              />
              <p id="orderMessage-hint" className={styles.fieldHint}>
                Se agrega al final del pedido que te mandan tus clientes por WhatsApp, después
                del detalle y el total. Sirve para pedirles datos como nombre, dirección o entre calles.
                Si lo dejás vacío, el pedido sale como siempre.
                {orderMessageLocked && (
                  <>
                    {" "}Tu plan actual no incluye pedidos por WhatsApp: podés dejarlo cargado y se
                    va a usar cuando tengas un plan que los incluya
                    {orderMessagePlan ? ` (${orderMessagePlan.label})` : ""}.
                  </>
                )}
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

            <div className={styles.scheduleSection}>
              <div className={styles.scheduleHeader}>
                <p className={styles.mediaLabel}>Horario de atención</p>
              </div>

              <div className={styles.scheduleCard}>
                <WeeklySchedule
                  value={scheduleWeek}
                  onChange={handleScheduleChange}
                  idPrefix="business-hours"
                  maxRangesPerDay={1}
                  daysLabel="Días que abrís"
                  timeLabel="Horario de atención"
                  allDayLabel="Abierto 24 h"
                  emptyLabel="Sin días abiertos: la carta no va a mostrar horarios."
                  exceptionLabel="Algún día abro en otro horario"
                />
              </div>

              <p className={styles.fieldHint}>
                Cargá el horario una sola vez y prendé los días que abrís. Si algún
                día tenés otro horario, marcá la opción y cambiá solo ese día.
                Si el cierre es anterior a la apertura, termina al día siguiente.
                Se muestra en tu carta pública junto con el estado abierto/cerrado.
              </p>
            </div>

            <button
              className={styles.saveBtn}
              onClick={handleSaveClick}
              disabled={saving || !isDirty || emailChangeStep === "pending"}
              aria-busy={saving}
            >
              {saving
                ? <><Spinner size={16} /> Guardando...</>
                : emailChangeStep === "pending" ? "Confirmá el email arriba"
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

            {/* Favicon */}
            <div className={styles.mediaSection}>
              <div className={styles.mediaLabelRow}>
                <p className={styles.mediaLabel}>Logo (ícono de la pestaña)</p>
                {favicon && (
                  <button
                    className={styles.textBtn}
                    onClick={removeFavicon}
                    disabled={uploading !== null}
                    type="button"
                  >
                    Quitar logo
                  </button>
                )}
              </div>
              <div className={styles.faviconRow}>
                <button
                  className={`${styles.faviconPreview} ${uploading === "favicon" ? styles.uploading : ""}`}
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploading !== null}
                  aria-label={favicon ? "Cambiar logo" : "Subir logo"}
                  type="button"
                >
                  {uploading === "favicon" ? (
                    <Spinner size={18} />
                  ) : favicon ? (
                    <img src={favicon} alt="Logo actual" />
                  ) : (
                    <img src="/favicon-96x96.png" alt="Ícono de Menú Digital (por defecto)" />
                  )}
                </button>
                <div className={styles.faviconInfo}>
                  <p className={styles.faviconText}>
                    {favicon
                      ? "Tu logo se muestra en la pestaña del navegador cuando entran a tu página y a tu carta."
                      : "Sin logo cargado: tu página y tu carta muestran el ícono de Menú Digital."}
                  </p>
                  <span className={styles.uploadHint}>
                    Imagen cuadrada, JPG, PNG o WebP, hasta {formatMb(FAVICON_MAX_BYTES)}. Mejor con fondo transparente.
                  </span>
                  <button
                    className={styles.textBtn}
                    onClick={() => faviconInputRef.current?.click()}
                    disabled={uploading !== null}
                    type="button"
                  >
                    {uploading === "favicon"
                      ? <><Spinner size={12} /> Subiendo...</>
                      : favicon ? "Cambiar logo" : "+ Subir logo"}
                  </button>
                </div>
              </div>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={e => {
                  if (e.target.files?.[0]) uploadFaviconImage(e.target.files[0]);
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
              Elegí el diseño de tu carta y combinalo con tu paleta. Los cambios se guardan al elegir.
            </p>
            <MenuStylePicker
              value={menuStyle}
              template={template}
              disabled={savingAppearance || !currentPlan || catalog.isFetching}
              onChange={(value) => void saveTemplate(template, value)}
              templateIds={currentPlan?.features.templateIds}
              familiesLocked={familiesLocked}
              lockedPlanLabel={familiesPlan?.label}
              onLockedFamily={() => setStylesLocked(true)}
            />
            <h2 className={styles.appearanceHeading}>Paleta de colores</h2>
            <p className={styles.templateDesc}>Se aplica al diseño elegido y a la página de tu local. Las paletas disponibles dependen de tu plan.</p>
            {savingAppearance && <Spinner label="Guardando apariencia" />}
            {catalog.isPending && <Spinner label="Cargando diseños del plan" />}
            {catalog.isError && <div role="alert"><p>No se pudo consultar el catálogo.</p><button type="button" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>Reintentar</button></div>}
            <div className={styles.templateGrid}>
              {TEMPLATES.map(t => {
                const isLocked = !currentPlan?.features.templateIds.includes(t.id);
                const offeredBy = catalog.data?.find(plan => plan.features.templateIds.includes(t.id));
                return (
                  <button
                    key={t.id}
                    className={`${styles.templateCard} ${template === t.id ? styles.selected : ""} ${isLocked ? styles.locked : ""}`}
                    onClick={() => selectTemplate(t)}
                    disabled={savingAppearance || !currentPlan || catalog.isFetching}
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
                      ) : isLocked ? (
                        <span className={styles.templatePro}>{offeredBy?.label ?? "No disponible"}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

      </div>

      {/* ── Modal: confirmar cambio de nombre del negocio ── */}
      {nameChangeConfirmOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setNameChangeConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="name-change-modal-title"
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p id="name-change-modal-title" className={styles.modalTitle}>
              ¿Cambiar el nombre del negocio?
            </p>
            <p className={styles.modalDesc}>
              El nombre define el enlace de tu carta pública. Si ya imprimiste o
              compartiste el código QR, dejará de funcionar y vas a tener que
              generar uno nuevo con el enlace actualizado.
            </p>
            <div className={styles.modalBtns}>
              <button
                className={styles.modalCancel}
                onClick={() => setNameChangeConfirmOpen(false)}
                type="button"
                autoFocus
              >
                Seguir editando
              </button>
              <button
                className={styles.modalUpgrade}
                onClick={confirmBusinessNameChange}
                type="button"
              >
                Sí, cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: template bloqueado por plan ── */}
      {stylesLocked && (
        <UpgradeModal
          currentPlan={subscription}
          minPlan="basic"
          requiredFeature="menu_styles"
          title="Desbloqueá las familias visuales"
          description="Una identidad completa para la portada y la carta. Tu paleta de colores actual se conserva."
          onClose={() => setStylesLocked(false)}
        />
      )}

      {lockedTemplate && (
        <UpgradeModal
          currentPlan={subscription}
          minPlan="basic"
          requiredTemplateId={lockedTemplate.id}
          title={`Desbloqueá ${lockedTemplate.name}`}
          description="Estos planes incluyen el diseño elegido según el catálogo vigente."
          onClose={() => setLockedTemplate(null)}
        />
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
