import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { useAuth } from "../../../../context/useAuth";
import { useNotifications } from "../../../../context/useNotifications";
import { isSubscriptionExpired } from "../../../../lib/plans";
import { useFeedbackMessage } from "../../../../hooks/useFeedbackMessage";
import MassiveImport from "../../../../Utils/MassiveImport";
import type {
  AdminItem as Item,
  AdminCategoria as Categoria,
  AdminSeccion as Seccion,
  AdminMenuData as MenuData,
  DayKey,
  ItemAvailabilitySchedule,
} from "../../../../types";
import Spinner from "../../../Common/Spinner";
import UpgradeModal from "../../../Common/UpgradeModal";
import styles from "./MenuEditor.module.css";

// ── Estado vacío para formulario de item ───────────────────────────────────────

interface OptionRow {
  key: string;
  value: string;
}

interface ItemFormState {
  title: string;
  description: string;
  price: string;
  offerPrice: string;
  offerScheduled: boolean;
  offerRange: { from: string; to: string };
  code: string;
  image: string;
  available: boolean;
  hidden: boolean;
  recommended: boolean;
  options: OptionRow[];
  availabilitySchedule: ItemAvailabilitySchedule;
}

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const emptyAvailabilitySchedule = (): ItemAvailabilitySchedule => ({
  enabled: false,
  mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
});

const toBuenosAiresDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const toBuenosAiresISOString = (value: string) => value ? `${value}:00-03:00` : null;

const EMPTY_ITEM: ItemFormState = {
  title: "",
  description: "",
  price: "",
  offerPrice: "",
  offerScheduled: false,
  offerRange: { from: "", to: "" },
  code: "",
  image: "",
  available: true,
  hidden: false,
  recommended: false,
  options: [],
  availabilitySchedule: emptyAvailabilitySchedule(),
};

// ── Subida de imagen de producto (por el backend, ver handleImageUpload) ──

const MAX_IMAGE_MB = 5;

// ── Vistas posibles ────────────────────────────────────────────────────────────

type View = "menu" | "item-form" | "categoria-form" | "seccion-form" | "massive-import";
type ItemFormSection = "basics" | "promotions" | "availability";

interface ItemFieldErrors {
  title?: string;
  price?: string;
  code?: string;
}

const cloneItemForm = (form: ItemFormState): ItemFormState => ({
  ...form,
  offerRange: { ...form.offerRange },
  options: form.options.map(option => ({ ...option })),
  availabilitySchedule: {
    enabled: form.availabilitySchedule.enabled,
    mon: form.availabilitySchedule.mon.map(range => ({ ...range })),
    tue: form.availabilitySchedule.tue.map(range => ({ ...range })),
    wed: form.availabilitySchedule.wed.map(range => ({ ...range })),
    thu: form.availabilitySchedule.thu.map(range => ({ ...range })),
    fri: form.availabilitySchedule.fri.map(range => ({ ...range })),
    sat: form.availabilitySchedule.sat.map(range => ({ ...range })),
    sun: form.availabilitySchedule.sun.map(range => ({ ...range })),
  },
});

const normalizeSearchValue = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

// ── Íconos ─────────────────────────────────────────────────────────────────────

const icons = {
  lock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  upload: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  ),
  folder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  ),
  layers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  chevron: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  back: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ── Toggle sub-componente ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
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

// ── TopBar sub-componente ─────────────────────────────────────────────────────

function TopBar({
  title,
  subtitle,
  status,
  onBack,
}: {
  title: string;
  subtitle?: string;
  status?: string;
  onBack: () => void;
}) {
  return (
    <header className={styles.topBar}>
      <button
        className={styles.backBtn}
        onClick={onBack}
        type="button"
        aria-label="Volver al menú"
        title="Volver"
      >
        {icons.back}
      </button>
      <div className={styles.topHeading}>
        <span className={styles.topTitle}>{title}</span>
        {subtitle && <span className={styles.topSubtitle}>{subtitle}</span>}
      </div>
      {status
        ? <span className={styles.unsavedStatus} role="status">{status}</span>
        : <span className={styles.topSpacer} aria-hidden="true" />}
    </header>
  );
}

function FormSection({
  number,
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  number: number;
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = `item-form-section-${number}`;

  return (
    <section className={`${styles.formSection} ${expanded ? styles.formSectionOpen : ""}`}>
      <button
        className={styles.formSectionHeader}
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className={styles.formSectionNumber}>{number}</span>
        <span className={styles.formSectionTitle}>{title}</span>
        <span className={styles.formSectionSummary}>{summary}</span>
        <span className={`${styles.formSectionChevron} ${expanded ? styles.formSectionChevronOpen : ""}`}>
          {icons.chevron}
        </span>
      </button>
      {expanded && (
        <div id={panelId} className={styles.formSectionBody}>
          {children}
        </div>
      )}
    </section>
  );
}

// ── CategoriaAcordeon (memoizado) ─────────────────────────────────────────────

interface CategoriaAcordeonProps {
  cat: Categoria;
  expanded: boolean;
  atItemLimit: boolean;
  onToggle: () => void;
  onEditCat: () => void;
  onDeleteCat: () => void;
  onNewItem: () => void;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onToggleAvailable: (item: Item) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragOver: (e: React.DragEvent, catId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, catId: string) => void;
  onDragEnd: () => void;
  dragOverCat: string | null;
  draggedItem: string | null;
}

const CategoriaAcordeon = memo(function CategoriaAcordeon({
  cat, expanded, atItemLimit, onToggle, onEditCat, onDeleteCat, onNewItem,
  onEditItem, onDeleteItem, onToggleAvailable, onDragStart,
  onDragOver, onDragLeave, onDrop, onDragEnd, dragOverCat, draggedItem,
}: CategoriaAcordeonProps) {
  const isDragOver = dragOverCat === cat._id;
  const itemCount  = cat.items?.length ?? 0;

  return (
    <div className={styles.catAcordeon}>
      {/* Header */}
      <div className={`${styles.catHeader} ${expanded ? styles.open : ""}`}>
        <button
          className={styles.catChevronBtn}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Contraer ${cat.title}` : `Expandir ${cat.title}`}
        >
          <span className={`${styles.catChevron} ${expanded ? styles.open : ""}`}>
            {icons.chevron}
          </span>
        </button>

        <button className={styles.catHeaderInfo} onClick={onToggle} type="button">
          <span className={styles.catHeaderName}>{cat.title}</span>
          <span className={styles.catHeaderMeta}>
            {itemCount === 0 ? "Sin productos" : `${itemCount} producto${itemCount !== 1 ? "s" : ""}`}
            {cat.hidden ? " · oculta" : ""}
          </span>
        </button>

        <div className={styles.rowActions}>
          <button
            className={styles.iconBtn}
            onClick={onEditCat}
            title="Editar categoría"
            aria-label={`Editar ${cat.title}`}
          >
            {icons.edit}
          </button>
          <button
            className={`${styles.iconBtn} ${styles.danger}`}
            onClick={onDeleteCat}
            title="Eliminar categoría"
            aria-label={`Eliminar ${cat.title}`}
          >
            {icons.trash}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div
          className={`${styles.catBody} ${isDragOver ? styles.dragOver : ""}`}
          onDragOver={e => onDragOver(e, cat._id)}
          onDragLeave={onDragLeave}
          onDrop={e => onDrop(e, cat._id)}
          role="list"
          aria-label={`Productos de ${cat.title}`}
        >
          {itemCount === 0 && (
            <p className={styles.emptyHint} style={{ padding: "1.25rem", textAlign: "center" }}>
              Arrastrá productos aquí o usá el botón de abajo.
            </p>
          )}

          {cat.items?.map(item => (
            <div
              key={item._id}
              role="listitem"
              className={`${styles.itemRowAc} ${draggedItem === item._id ? styles.dragging : ""}`}
              draggable
              onDragStart={e => onDragStart(e, item._id)}
              onDragEnd={onDragEnd}
            >
              {/* Handle drag */}
              <span className={styles.dragHandle} aria-hidden="true">
                <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                  <circle cx="4" cy="3"  r="1.5" fill="currentColor" />
                  <circle cx="4" cy="8"  r="1.5" fill="currentColor" />
                  <circle cx="4" cy="13" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="3"  r="1.5" fill="currentColor" />
                  <circle cx="8" cy="8"  r="1.5" fill="currentColor" />
                  <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                </svg>
              </span>

              <button className={styles.itemInfoAc} onClick={() => onEditItem(item)} type="button">
                <span className={styles.itemNameAc}>{item.title}</span>
                <span className={styles.itemMetaAc}>
                  {item.price != null
                    ? `$${item.price.toLocaleString("es-AR")}`
                    : Object.keys(item.options || {}).length > 0
                      ? "Con variantes"
                      : "Sin precio"}
                  {item.offerPrice != null && (
                    <span className={styles.itemOffer}>
                      {` · Oferta $${item.offerPrice.toLocaleString("es-AR")}`}
                    </span>
                  )}
                  {item.hidden     ? " · oculto" : ""}
                  {item.recommended ? " · ⭐" : ""}
                </span>
              </button>

              <div className={styles.itemActions}>
                <button
                  className={`${styles.pillBtn} ${item.available ? styles.pillOn : styles.pillOff}`}
                  onClick={() => onToggleAvailable(item)}
                  aria-label={item.available ? `Pausar ${item.title}` : `Activar ${item.title}`}
                  type="button"
                >
                  {item.available ? "Activo" : "Pausado"}
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={() => onDeleteItem(item)}
                  title="Eliminar"
                  aria-label={`Eliminar ${item.title}`}
                  type="button"
                >
                  {icons.trash}
                </button>
              </div>
            </div>
          ))}

          <div className={styles.catFooter}>
            <button
              className={`${styles.addItemBtn} ${atItemLimit ? styles.addItemBtnLimit : ""}`}
              onClick={onNewItem}
              type="button"
            >
              {atItemLimit ? "Límite alcanzado — Mejorar plan" : "+ Agregar producto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Componente principal ───────────────────────────────────────────────────────

export default function MenuEditorPage() {
  const { token, user, logout } = useAuth();
  const { success: notifySuccess } = useNotifications();
  const effectiveSubscription = user && isSubscriptionExpired(
    user.subscription,
    user.subscriptionExpiresAt,
    user.subscriptionStatus,
  )
    ? "free"
    : (user?.subscription ?? "free");

  const [menuData,    setMenuData]    = useState<MenuData | null>(null);
  const [limits,      setLimits]      = useState<{
    itemCount: number;
    canEditMenu: boolean;
    itemLimit: number | null;
    canImportExcel: boolean;
    canExportPdf: boolean;
    canScheduleItems?: boolean;
    canScheduleOffers?: boolean;
  } | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useFeedbackMessage("error");

  // Modal de upgrade compartido: se abre por el límite de productos
  // del plan free o por intentar usar el importador de Excel sin plan
  // pago. "reason" solo cambia el texto que se muestra.
  const [upgradeReason, setUpgradeReason] = useState<"items" | "excel" | "pdf" | "schedule" | "offer" | null>(null);

  const [imageUploading, setImageUploading] = useState(false);
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canExportPdf = limits?.canExportPdf === true;
  const canScheduleItems = limits?.canScheduleItems === true;
  const canScheduleOffers = limits?.canScheduleOffers === true;

  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const [view,            setView]            = useState<View>("menu");
  const [menuSheetOpen,   setMenuSheetOpen]   = useState(false);
  const [activeCategoria, setActiveCategoria] = useState<Categoria | null>(null);
  const [activeItem,      setActiveItem]      = useState<Item | null>(null);
  const [expandedCats,    setExpandedCats]    = useState<Set<string>>(new Set());
  const [searchQuery,     setSearchQuery]     = useState("");
  const [openItemSections, setOpenItemSections] = useState<Set<ItemFormSection>>(new Set(["basics"]));

  const [deleteModal, setDeleteModal] = useState<{
    type: "item" | "categoria" | "seccion";
    id: string;
    name: string;
  } | null>(null);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);

  const [itemForm,      setItemForm]      = useState(() => cloneItemForm(EMPTY_ITEM));
  const [initialItemForm, setInitialItemForm] = useState(() => cloneItemForm(EMPTY_ITEM));
  const [itemFieldErrors, setItemFieldErrors] = useState<ItemFieldErrors>({});
  const [categoriaForm, setCategoriaForm] = useState({ title: "", description: "", code: "", seccionID: "", editingId: "" });
  const [seccionForm,   setSeccionForm]   = useState({ title: "", code: "", editingId: "" });

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Único punto de manejo de respuesta para los fetch() directos de esta
  // pantalla (antes cada llamada repetía su propia variante de "if (!res.ok)
  // throw", sin chequear 401 ni parsear el body con cuidado). Con sesión
  // vencida, desloguea y manda a login en vez de mostrar un error de
  // "no se pudo guardar" que no explica nada. Si no es 401, devuelve el
  // body ya parseado (objeto vacío si la respuesta no es JSON — evita que
  // un 502/504 con HTML explote el res.json() y muestre el error crudo) y
  // tira un Error con el mensaje real del backend cuando `res.ok` es falso.
  const parseApiResponse = useCallback(async (res: Response, fallback: string) => {
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    if (res.status === 401) {
      logout();
      window.location.href = "/login";
      throw new Error("Sesión vencida");
    }
    if (!res.ok) {
      const message = typeof data.message === "string" && data.message ? data.message : fallback;
      throw new Error(message);
    }
    return data;
  }, [logout]);

  // ── Auto-clear error banner ─────────────────────────────────────────────────

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error, setError]);

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        // Endpoint autenticado del propio dueño: a diferencia de la carta
        // pública, incluye secciones/categorías/items ocultos para que se
        // puedan gestionar (reactivar) desde el editor.
        const menuRes  = await fetch("/api/users/me/menu", { headers: { Authorization: `Bearer ${token}` } });
        const menuJson = await parseApiResponse(menuRes, "No se pudo cargar el menú. Intentá recargar la página.");
        setMenuData(menuJson.menu as MenuData);
        setLimits((menuJson.limits as typeof limits) ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el menú. Intentá recargar la página.");
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [token, setError, parseApiResponse]);

  // ── Refresca el menú desde el backend ──────────────────────────────────────

  const refetch = useCallback(async () => {
    try {
      const menuRes  = await fetch("/api/users/me/menu", { headers: { Authorization: `Bearer ${token}` } });
      const menuJson = await parseApiResponse(menuRes, "No se pudo actualizar el menú.");
      const menu = menuJson.menu as MenuData;
      setMenuData(menu);
      setLimits((menuJson.limits as typeof limits) ?? null);

      if (activeCategoria) {
        const todas = [
          ...(menu.sinSeccion ?? []),
          ...(menu.secciones ?? []).flatMap((s: Seccion) => s.categorias),
        ];
        const actualizada = todas.find((c: Categoria) => c._id === activeCategoria._id);
        if (actualizada) setActiveCategoria(actualizada);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el menú.");
    }
  }, [token, activeCategoria, setError, parseApiResponse]);

  // ── Acordeón ──────────────────────────────────────────────────────────────

  const toggleCat = useCallback((id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Handlers ITEMS ────────────────────────────────────────────────────────

  const openNewItem = useCallback((cat: Categoria) => {
    if (limits && limits.itemLimit != null && limits.itemCount >= limits.itemLimit) {
      setUpgradeReason("items");
      return;
    }
    setActiveCategoria(cat);
    setActiveItem(null);
    const nextForm = cloneItemForm({ ...EMPTY_ITEM, availabilitySchedule: emptyAvailabilitySchedule() });
    setItemForm(nextForm);
    setInitialItemForm(cloneItemForm(nextForm));
    setItemFieldErrors({});
    setOpenItemSections(new Set(["basics"]));
    setError("");
    setView("item-form");
  }, [limits, setError]);

  const openEditItem = useCallback((item: Item, cat: Categoria) => {
    setActiveCategoria(cat);
    setActiveItem(item);
    const nextForm: ItemFormState = {
      title:       item.title,
      description: item.description || "",
      price:       item.price?.toString()      || "",
      offerPrice:  item.offerPrice?.toString() || "",
      offerScheduled: Boolean(item.offerRange?.from || item.offerRange?.to),
      offerRange: {
        from: toBuenosAiresDateTimeInput(item.offerRange?.from),
        to: toBuenosAiresDateTimeInput(item.offerRange?.to),
      },
      code:        item.code || "",
      available:   item.available,
      hidden:      item.hidden,
      recommended: item.recommended,
      image: item.image || "",
      options:     Object.entries(item.options || {}).map(([key, value]) => ({ key, value: value.toString() })),
      availabilitySchedule: item.availabilitySchedule
        ? {
            enabled: item.availabilitySchedule.enabled,
            mon: [...item.availabilitySchedule.mon],
            tue: [...item.availabilitySchedule.tue],
            wed: [...item.availabilitySchedule.wed],
            thu: [...item.availabilitySchedule.thu],
            fri: [...item.availabilitySchedule.fri],
            sat: [...item.availabilitySchedule.sat],
            sun: [...item.availabilitySchedule.sun],
          }
        : emptyAvailabilitySchedule(),
    };
    setItemForm(nextForm);
    setInitialItemForm(cloneItemForm(nextForm));
    setItemFieldErrors({});
    const initialSections = new Set<ItemFormSection>(["basics"]);
    if (nextForm.offerPrice || nextForm.offerScheduled || nextForm.options.length > 0) initialSections.add("promotions");
    if (nextForm.availabilitySchedule.enabled || nextForm.hidden || nextForm.recommended || !nextForm.available) {
      initialSections.add("availability");
    }
    setOpenItemSections(initialSections);
    setError("");
    setView("item-form");
  }, [setError]);

  const toggleItemSection = useCallback((section: ItemFormSection) => {
    setOpenItemSections(previous => {
      const next = new Set(previous);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo más adelante

    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("El archivo debe ser una imagen."); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`La imagen no puede superar los ${MAX_IMAGE_MB}MB.`); return; }

    setImageUploading(true);
    setError("");
    try {
      // Sube por nuestro backend, no directo a Cloudinary. El atajo anterior
      // usaba un upload preset sin firmar: el cloud y el preset quedaban en el
      // bundle público, así que cualquiera podía escribir archivos en la cuenta
      // de Cloudinary sin tener sesión. Este endpoint pide JWT y plan con
      // menu_editor, y sirve también al crear un producto (todavía sin itemID).
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/items/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await parseApiResponse(res, "No se pudo subir la imagen.");
      const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : "";
      if (!imageUrl) throw new Error("No se pudo subir la imagen.");

      setItemForm(f => ({ ...f, image: imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setImageUploading(false);
    }
  }, [setError, token, parseApiResponse]);

  const removeItemImage = useCallback(() => {
    setItemForm(f => ({ ...f, image: "" }));
  }, []);

  const saveItem = async () => {
    const preservesLockedOffer = !canScheduleOffers && Boolean(activeItem) && itemForm.offerScheduled;
    const showSectionError = (section: ItemFormSection, message: string) => {
      setOpenItemSections(previous => new Set(previous).add(section));
      setError(message);
    };

    if (imageUploading) {
      showSectionError("basics", "Esperá a que termine de subir la imagen antes de guardar.");
      return;
    }

    const nextFieldErrors: ItemFieldErrors = {};
    if (!itemForm.title.trim()) nextFieldErrors.title = "Ingresá el nombre del producto.";
    if (!itemForm.code.trim()) nextFieldErrors.code = "Ingresá el código interno.";
    if (!itemForm.price.trim()) nextFieldErrors.price = "Ingresá el precio.";
    else if (isNaN(Number(itemForm.price)) || Number(itemForm.price) <= 0) {
      nextFieldErrors.price = "El precio debe ser un número mayor a cero.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setItemFieldErrors(nextFieldErrors);
      showSectionError("basics", "Revisá los campos obligatorios antes de guardar.");
      const firstInvalidId = nextFieldErrors.title ? "item-title" : nextFieldErrors.price ? "item-price" : "item-code";
      window.requestAnimationFrame(() => document.getElementById(firstInvalidId)?.focus());
      return;
    }
    setItemFieldErrors({});

    if (!preservesLockedOffer && itemForm.offerPrice !== "" && isNaN(Number(itemForm.offerPrice))) {
      showSectionError("promotions", "El precio de oferta debe ser un número.");
      return;
    }
    if (!preservesLockedOffer && itemForm.offerPrice !== "" && (!Number(itemForm.offerPrice) || Number(itemForm.offerPrice) <= 0)) {
      showSectionError("promotions", "El precio de oferta debe ser un número positivo.");
      return;
    }
    if (!preservesLockedOffer && itemForm.offerPrice !== "" && Number(itemForm.offerPrice) >= Number(itemForm.price)) {
      showSectionError("promotions", "El precio de oferta debe ser menor al precio original.");
      return;
    }
    if (itemForm.offerScheduled && !preservesLockedOffer) {
      if (!itemForm.offerPrice) { showSectionError("promotions", "Ingresá un precio de oferta antes de programarla."); return; }
      if (!itemForm.offerRange.from || !itemForm.offerRange.to) {
        showSectionError("promotions", "Indicá el inicio y el fin de la oferta.");
        return;
      }
      if (itemForm.offerRange.from >= itemForm.offerRange.to) {
        showSectionError("promotions", "El fin de la oferta debe ser posterior al inicio.");
        return;
      }
    }

    const normalizedOptions = itemForm.options
      .map(option => ({ key: option.key.trim(), value: option.value.trim() }))
      .filter(option => option.key || option.value);
    if (normalizedOptions.some(option => !option.key || !option.value || isNaN(Number(option.value)) || Number(option.value) <= 0)) {
      showSectionError("promotions", "Cada variante necesita un nombre y un precio mayor a cero.");
      return;
    }
    const optionKeys = normalizedOptions.map(option => normalizeSearchValue(option.key));
    if (new Set(optionKeys).size !== optionKeys.length) {
      showSectionError("promotions", "Los nombres de las variantes no pueden repetirse.");
      return;
    }

    if (itemForm.availabilitySchedule.enabled) {
      const ranges = DAYS.flatMap(({ key }) => itemForm.availabilitySchedule[key]);
      if (ranges.length === 0) { showSectionError("availability", "Agregá al menos un horario antes de activar la programación."); return; }
      if (ranges.some(({ from, to }) => !from || !to || from === to)) {
        showSectionError("availability", "Revisá los horarios: cada rango necesita un inicio y un fin diferentes.");
        return;
      }
    }
    setSaving(true); setError("");

    try {
      const optionsObj: Record<string, number> = {};
      normalizedOptions.forEach(({ key, value }) => {
        optionsObj[key] = Number(value);
      });
      const body = {
        menuID: activeCategoria!._id,
        title: itemForm.title.trim(),
        description: itemForm.description,
        image: itemForm.image,
        price: itemForm.price !== "" ? Number(itemForm.price) : null,
        // Al vencer un plan pago, una programación guardada queda intacta e
        // inactiva mientras se editan otros datos del producto.
        ...(preservesLockedOffer
          ? {}
          : {
              offerPrice: itemForm.offerPrice !== "" ? Number(itemForm.offerPrice) : null,
              offerRange: itemForm.offerScheduled
                ? {
                    from: toBuenosAiresISOString(itemForm.offerRange.from),
                    to: toBuenosAiresISOString(itemForm.offerRange.to),
                  }
                : { from: null, to: null },
            }),
        code: itemForm.code.trim(),
        available: itemForm.available,
        hidden: itemForm.hidden,
        recommended: itemForm.recommended,
        options: optionsObj,
        // Si un plan pago venció, el horario guardado queda intacto e inactivo:
        // editar otro campo no debe borrarlo ni intentar volver a habilitarlo.
        ...(canScheduleItems || !itemForm.availabilitySchedule.enabled
          ? { availabilitySchedule: itemForm.availabilitySchedule }
          : {}),
      };
      const url    = activeItem ? `/api/items/${activeItem._id}` : "/api/items";
      const method = activeItem ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (res.status === 403) {
        // Puede pasar aunque el front ya bloqueó el botón: otra pestaña/
        // dispositivo pudo haber usado el último lugar mientras tanto.
        setView("menu");
        const message = String(data.message || "");
        setUpgradeReason(
          message.includes("disponibilidad") ? "schedule"
            : message.includes("oferta") ? "offer"
              : "items"
        );
        return;
      }
      if (!res.ok) throw new Error(data.message || "No se pudo guardar el producto.");
      await refetch();
      notifySuccess(activeItem ? "Producto actualizado." : "Producto creado.");
      setInitialItemForm(cloneItemForm(itemForm));
      setView("menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
  if (!deleteModal) return;
  try {
    const url = deleteModal.type === "item"
      ? `/api/items/${deleteModal.id}`
      : `/api/menus/${deleteModal.id}`;
    const res = await fetch(url, { method: "DELETE", headers: authHeaders });
    if (res.status === 401) {
      logout();
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "No se pudo eliminar.");
    }
    await refetch();
    notifySuccess(
      deleteModal.type === "item"
        ? "Producto eliminado."
        : deleteModal.type === "categoria"
          ? "Categoría eliminada."
          : "Sección eliminada.",
    );
    setDeleteModal(null);
    setView("menu");
  } catch (err) {
    setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    setDeleteModal(null);
  }
};

  const toggleItemAvailable = useCallback(async (item: Item) => {
    // Actualización optimista en el estado local
    setMenuData(prev => {
      if (!prev) return prev;
      const updateItems = (items: Item[]) =>
        items.map(i => i._id === item._id ? { ...i, available: !i.available } : i);
      return {
        secciones: prev.secciones.map(s => ({
          ...s,
          categorias: s.categorias.map(c => ({ ...c, items: updateItems(c.items) })),
        })),
        sinSeccion: prev.sinSeccion.map(c => ({ ...c, items: updateItems(c.items) })),
      };
    });
    try {
      const res = await fetch(`/api/items/${item._id}/available`, {
        method: "PATCH", headers: authHeaders,
        body: JSON.stringify({ available: !item.available }),
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo cambiar la disponibilidad.");
      }
      notifySuccess(item.available ? "Producto pausado." : "Producto activado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la disponibilidad.");
      await refetch(); // Revertir
    }
  }, [authHeaders, refetch, notifySuccess, setError, logout]);

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.setData("text/plain", itemId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, catId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCat(catId);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverCat(null), []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetMenuID: string) => {
    e.preventDefault();
    setDragOverCat(null);
    const itemId = e.dataTransfer.getData("text/plain");
    if (!itemId) return;
    try {
      const res = await fetch(`/api/items/${itemId}/move`, {
        method: "PATCH", headers: authHeaders,
        body: JSON.stringify({ menuID: targetMenuID }),
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo mover el producto.");
      }
      await refetch();
      notifySuccess("Producto movido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mover el producto.");
    } finally {
      setDraggedItem(null);
    }
  }, [authHeaders, refetch, notifySuccess, setError, logout]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverCat(null);
  }, []);

  // ── Handlers CATEGORÍAS ───────────────────────────────────────────────────

  const openNewCategoria = useCallback(() => {
    setCategoriaForm({ title: "", description: "", code: "", seccionID: "", editingId: "" });
    setError("");
    setView("categoria-form");
  }, [setError]);

  const openEditCategoria = useCallback((cat: Categoria) => {
    setCategoriaForm({ title: cat.title, description: cat.description || "", code: cat.code || "", seccionID: "", editingId: cat._id });
    setError("");
    setView("categoria-form");
  }, [setError]);

  const saveCategoria = async () => {
    if (!categoriaForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      let res: Response;
      if (categoriaForm.editingId) {
        res = await fetch(`/api/menus/${categoriaForm.editingId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({ title: categoriaForm.title.trim(), description: categoriaForm.description, code: categoriaForm.code }),
        });
      } else {
        res = await fetch("/api/menus", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ title: categoriaForm.title.trim(), description: categoriaForm.description, code: categoriaForm.code, sectionID: categoriaForm.seccionID || null, section: false }),
        });
      }
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo guardar la categoría.");
      }
      await refetch();
      notifySuccess(categoriaForm.editingId ? "Categoría actualizada." : "Categoría creada.");
      setView("menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers SECCIONES ────────────────────────────────────────────────────

  const openNewSeccion = useCallback(() => {
    setSeccionForm({ title: "", code: "", editingId: "" });
    setError("");
    setView("seccion-form");
  }, [setError]);

  const openEditSeccion = useCallback((sec: Seccion) => {
    setSeccionForm({ title: sec.title, code: sec.code || "", editingId: sec._id });
    setError("");
    setView("seccion-form");
  }, [setError]);

  const saveSeccion = async () => {
    if (!seccionForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      let res: Response;
      if (seccionForm.editingId) {
        res = await fetch(`/api/menus/${seccionForm.editingId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({ title: seccionForm.title.trim(), code: seccionForm.code }),
        });
      } else {
        res = await fetch("/api/menus", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ title: seccionForm.title.trim(), code: seccionForm.code, section: true }),
        });
      }
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo guardar la sección.");
      }
      await refetch();
      notifySuccess(seccionForm.editingId ? "Sección actualizada." : "Sección creada.");
      setView("menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la sección.");
    } finally {
      setSaving(false);
    }
  };

  // ── Handler EXPORTAR A EXCEL ────────────────────────────────────────────────
  // Reutiliza el mismo endpoint que genera la plantilla de importación
  // (GET /api/massive/template): ya trae las secciones, categorías e items
  // actuales cargados en las hojas "Categorías" y "Productos", así que sirve
  // tanto para exportar como para editar y volver a importar.

  const exportMenu = useCallback(async () => {
    if (!limits?.canImportExcel) { setUpgradeReason("excel"); return; }
    setExporting(true); setError("");
    try {
      const res = await fetch("/api/massive/template", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo exportar el menú. Intentá de nuevo.");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "menu-digital-plantilla.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess("Menú exportado a Excel.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el menú. Intentá de nuevo.");
    } finally {
      setExporting(false);
    }
  }, [token, limits, notifySuccess, setError, logout]);

  const exportMenuPdf = async () => {
    if (!canExportPdf) { setUpgradeReason("pdf"); return; }
    if (!user?.slug) { setError("No se encontró el enlace público de tu menú."); return; }
    setExportingPdf(true); setError("");
    try {
      // Endpoint público (carta del menú, no requiere sesión) — un 401 acá no
      // aplica, así que no dispara logout.
      const res = await fetch(`/api/users/${user.slug}/menu/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo exportar el menú a PDF. Intentá de nuevo.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${user.slug}-menu.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess("Menú exportado a PDF.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el menú a PDF. Intentá de nuevo.");
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Conteo total de productos ─────────────────────────────────────────────

  const totalItems = menuData
    ? (menuData.sinSeccion?.flatMap(c => c.items).length ?? 0) +
      (menuData.secciones?.flatMap(s => s.categorias).flatMap(c => c.items).length ?? 0)
    : 0;

  const atItemLimit = !!(limits && limits.itemLimit != null && limits.itemCount >= limits.itemLimit);
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const searchActive = normalizedSearchQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!menuData || !normalizedSearchQuery) return [];

    const matches: { item: Item; categoria: Categoria; sectionTitle: string }[] = [];
    const collectMatches = (categoria: Categoria, sectionTitle: string) => {
      categoria.items?.forEach(item => {
        const searchableText = normalizeSearchValue([
          item.title,
          item.description,
          item.code,
          categoria.title,
          categoria.code,
          sectionTitle,
        ].filter(Boolean).join(" "));

        if (searchableText.includes(normalizedSearchQuery)) {
          matches.push({ item, categoria, sectionTitle });
        }
      });
    };

    menuData.secciones.forEach(section => {
      section.categorias.forEach(categoria => collectMatches(categoria, section.title));
    });
    menuData.sinSeccion.forEach(categoria => collectMatches(categoria, "Sin sección"));

    return matches;
  }, [menuData, normalizedSearchQuery]);

  const activeSectionTitle = useMemo(() => {
    if (!menuData || !activeCategoria) return "";
    return menuData.secciones.find(section =>
      section.categorias.some(categoria => categoria._id === activeCategoria._id)
    )?.title ?? "";
  }, [activeCategoria, menuData]);

  const itemFormDirty = view === "item-form" && JSON.stringify(itemForm) !== JSON.stringify(initialItemForm);
  const itemFormBreadcrumb = [activeSectionTitle, activeCategoria?.title].filter(Boolean).join(" / ");
  const promotionsSummary = itemForm.options.length > 0
    ? `${itemForm.options.length} variante${itemForm.options.length !== 1 ? "s" : ""}${itemForm.offerPrice ? " · Con oferta" : " · Sin oferta"}`
    : itemForm.offerPrice ? "Sin variantes · Con oferta" : "Sin variantes · Sin oferta";
  const availabilitySummary = `${itemForm.available ? "Disponible" : "Pausado"} · ${itemForm.hidden ? "Oculto" : "Visible"}`;

  const requestCloseItemForm = () => {
    if (imageUploading) {
      setError("Esperá a que termine de subir la imagen antes de salir.");
      return;
    }
    if (itemFormDirty) {
      setDiscardModalOpen(true);
      return;
    }
    setView("menu");
  };

  useEffect(() => {
    if (!itemFormDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [itemFormDirty]);

  // ── Pantalla de carga ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando menú..." />
      </div>
    );
  }

  // ── Vista massive-import ──────────────────────────────────────────────────

  if (view === "massive-import") {
    return <MassiveImport onBack={() => setView("menu")} onSuccess={refetch} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loading && limits?.canEditMenu === false) {
    return <main className={styles.me}><p>El editor de menú no está incluido en tu plan actual.</p></main>;
  }

  return (
      <div className={styles.me}>

        {/* ══ VISTA PRINCIPAL: ACORDEÓN ══ */}
        {view === "menu" && (
          <>
            <header className={styles.topBar}>
              <div className={styles.topCenter}>
                <span className={styles.topTitle}>Menú</span>
                {totalItems > 0 && (
                  <span className={styles.topCount}>
                    {totalItems} producto{totalItems !== 1 ? "s" : ""}
                    {limits?.itemLimit != null && `/${limits.itemLimit}`}
                  </span>
                )}
              </div>
              <button
                className={styles.backBtn}
                onClick={() => setMenuSheetOpen(true)}
                title="Más opciones"
                aria-label="Abrir menú de acciones"
                aria-haspopup="true"
                aria-expanded={menuSheetOpen}
              >
                {icons.menu}
              </button>
            </header>

            <div className={styles.content}>
              {error && (
                <div className={styles.errorBanner} role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              <div className={styles.searchPanel}>
                <label className="sr-only" htmlFor="menu-search">Buscar en el menú</label>
                <input
                  id="menu-search"
                  className={styles.searchInput}
                  type="search"
                  placeholder="Buscar producto, categoría o código"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    className={styles.searchClear}
                    type="button"
                    onClick={() => setSearchQuery("")}
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {searchActive ? (
                <section className={styles.searchResults} aria-labelledby="search-results-title">
                  <div className={styles.searchResultsHeader}>
                    <p id="search-results-title">
                      {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
                    </p>
                    <span aria-live="polite">para “{searchQuery.trim()}”</span>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className={styles.searchResultsList} role="list">
                      {searchResults.map(({ item, categoria, sectionTitle }) => (
                        <div key={item._id} role="listitem">
                          <button
                            className={styles.searchResultRow}
                            type="button"
                            onClick={() => openEditItem(item, categoria)}
                          >
                            {item.image && (
                              <img className={styles.searchResultImage} src={item.image} alt="" />
                            )}
                            <span className={styles.searchResultInfo}>
                              <span className={styles.searchResultName}>{item.title}</span>
                              <span className={styles.searchResultPath}>{sectionTitle} / {categoria.title}</span>
                              <span className={styles.searchResultPrice}>
                                {item.offerPrice != null
                                  ? `Oferta $${item.offerPrice.toLocaleString("es-AR")}`
                                  : item.price != null
                                    ? `$${item.price.toLocaleString("es-AR")}`
                                    : "Sin precio"}
                              </span>
                            </span>
                            <span className={`${styles.searchResultStatus} ${item.available ? styles.searchResultStatusOn : styles.searchResultStatusOff}`}>
                              {item.hidden ? "Oculto" : item.available ? "Disponible" : "Pausado"}
                            </span>
                            <span className={styles.searchResultAction}>Editar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.searchEmpty}>
                      <p>No encontramos productos con ese término.</p>
                      <span>Probá con el nombre, código, categoría o sección.</span>
                    </div>
                  )}
                </section>
              ) : (
                <>

              {/* Secciones */}
              {menuData?.secciones.map(sec => (
                <div key={sec._id} className={styles.seccionBlock}>
                  <div className={styles.seccionRow}>
                    <div className={styles.seccionLeft}>
                      <span className={styles.seccionBadge}>Sección</span>
                      <span className={styles.seccionTitle}>{sec.title}</span>
                    </div>
                    <div className={styles.rowActions}>
                      <button className={styles.iconBtn} onClick={() => openEditSeccion(sec)} title="Editar sección" aria-label={`Editar ${sec.title}`}>
                        {icons.edit}
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.danger}`}
                        onClick={() => setDeleteModal({ type: "seccion", id: sec._id, name: sec.title })}
                        title="Eliminar sección"
                        aria-label={`Eliminar ${sec.title}`}
                      >
                        {icons.trash}
                      </button>
                    </div>
                  </div>

                  {sec.categorias.map(cat => (
                    <CategoriaAcordeon
                      key={cat._id}
                      cat={cat}
                      expanded={expandedCats.has(cat._id)}
                      atItemLimit={atItemLimit}
                      onToggle={() => toggleCat(cat._id)}
                      onEditCat={() => openEditCategoria(cat)}
                      onDeleteCat={() => setDeleteModal({ type: "categoria", id: cat._id, name: cat.title })}
                      onNewItem={() => openNewItem(cat)}
                      onEditItem={item => openEditItem(item, cat)}
                      onDeleteItem={item => setDeleteModal({ type: "item", id: item._id, name: item.title })}
                      onToggleAvailable={toggleItemAvailable}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      dragOverCat={dragOverCat}
                      draggedItem={draggedItem}
                    />
                  ))}

                  {sec.categorias.length === 0 && (
                    <p className={styles.emptyHint} style={{ paddingLeft: "0.25rem" }}>
                      Sin categorías en esta sección.
                    </p>
                  )}
                </div>
              ))}

              {/* Categorías sin sección */}
              {(menuData?.sinSeccion?.length ?? 0) > 0 && (
                <div className={styles.seccionBlock}>
                  <div className={styles.seccionRow}>
                    <div className={styles.seccionLeft}>
                      <span className={`${styles.seccionBadge} ${styles.seccionBadgeDark}`}>
                        Sin sección
                      </span>
                    </div>
                  </div>
                  {menuData!.sinSeccion.map(cat => (
                    <CategoriaAcordeon
                      key={cat._id}
                      cat={cat}
                      expanded={expandedCats.has(cat._id)}
                      atItemLimit={atItemLimit}
                      onToggle={() => toggleCat(cat._id)}
                      onEditCat={() => openEditCategoria(cat)}
                      onDeleteCat={() => setDeleteModal({ type: "categoria", id: cat._id, name: cat.title })}
                      onNewItem={() => openNewItem(cat)}
                      onEditItem={item => openEditItem(item, cat)}
                      onDeleteItem={item => setDeleteModal({ type: "item", id: item._id, name: item.title })}
                      onToggleAvailable={toggleItemAvailable}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      dragOverCat={dragOverCat}
                      draggedItem={draggedItem}
                    />
                  ))}
                </div>
              )}

              {/* Estado vacío */}
              {menuData?.secciones.length === 0 && menuData?.sinSeccion.length === 0 && (
                <div className={styles.emptyState}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#272420" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="16" x2="12" y2="16" />
                  </svg>
                  <p>Tu menú está vacío.</p>
                  <p className={styles.emptySub}>Creá una categoría para empezar a agregar productos.</p>
                </div>
              )}
                </>
              )}
            </div>

            {/* ── Bottom sheet: Categoría / Sección / Importar ── */}
            {menuSheetOpen && (
              <div
                className={styles.modalOverlay}
                onClick={() => setMenuSheetOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-sheet-title"
              >
                <div className={styles.sheet} onClick={e => e.stopPropagation()}>
                  <p id="menu-sheet-title" className={styles.sheetTitle}>Agregar al menú</p>

                  <button
                    className={styles.sheetOption}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); openNewCategoria(); }}
                  >
                    <span className={styles.sheetOptionIcon}>{icons.folder}</span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>Nueva categoría</span>
                      <span className={styles.sheetOptionDesc}>Agrupa productos, ej: Pizzas</span>
                    </span>
                  </button>

                  <button
                    className={styles.sheetOption}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); openNewSeccion(); }}
                  >
                    <span className={styles.sheetOptionIcon}>{icons.layers}</span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>Nueva sección</span>
                      <span className={styles.sheetOptionDesc}>Agrupa categorías, ej: Comidas</span>
                    </span>
                  </button>

                  <button
                    className={`${styles.sheetOption} ${!limits?.canImportExcel ? styles.sheetOptionLocked : ""}`}
                    type="button"
                    onClick={() => {
                      setMenuSheetOpen(false);
                      if (!limits?.canImportExcel) { setUpgradeReason("excel"); return; }
                      setView("massive-import");
                    }}
                  >
                    <span className={styles.sheetOptionIcon}>
                      {limits?.canImportExcel ? icons.upload : icons.lock}
                    </span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>
                        Importar desde Excel
                        {!limits?.canImportExcel && <span className={styles.sheetOptionPro}>VER PLANES</span>}
                      </span>
                      <span className={styles.sheetOptionDesc}>Carga o actualiza en lote</span>
                    </span>
                  </button>

                  <button
                    className={`${styles.sheetOption} ${!limits?.canImportExcel ? styles.sheetOptionLocked : ""}`}
                    type="button"
                    disabled={exporting}
                    onClick={() => {
                      setMenuSheetOpen(false);
                      exportMenu();
                    }}
                  >
                    <span className={styles.sheetOptionIcon}>
                      {!limits?.canImportExcel ? icons.lock : exporting ? <Spinner size={16} /> : icons.download}
                    </span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>
                        Exportar a Excel
                        {!limits?.canImportExcel && <span className={styles.sheetOptionPro}>VER PLANES</span>}
                      </span>
                      <span className={styles.sheetOptionDesc}>Descargá tus categorías y productos actuales</span>
                    </span>
                  </button>

                  <button
                    className={`${styles.sheetOption} ${!canExportPdf ? styles.sheetOptionLocked : ""}`}
                    type="button"
                    disabled={exportingPdf}
                    onClick={() => {
                      setMenuSheetOpen(false);
                      exportMenuPdf();
                    }}
                  >
                    <span className={styles.sheetOptionIcon}>
                      {!canExportPdf ? icons.lock : exportingPdf ? <Spinner size={16} /> : icons.download}
                    </span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>
                        Exportar menú a PDF
                        {!canExportPdf && <span className={styles.sheetOptionPro}>VER PLANES</span>}
                      </span>
                      <span className={styles.sheetOptionDesc}>Descargá una versión lista para imprimir</span>
                    </span>
                  </button>

                  <button className={styles.sheetCancel} type="button" onClick={() => setMenuSheetOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ VISTA: FORMULARIO ITEM ══ */}
        {view === "item-form" && (
          <>
            <TopBar
              title={activeItem ? "Editar producto" : "Nuevo producto"}
              subtitle={itemFormBreadcrumb || undefined}
              status={itemFormDirty ? "Cambios sin guardar" : undefined}
              onBack={requestCloseItemForm}
            />
            <div className={`${styles.content} ${styles.formContent}`}>
              {error && <div className={styles.errorBanner} role="alert">{error}</div>}

              <div className={styles.productSummary}>
                {itemForm.image && (
                  <img className={styles.productSummaryImage} src={itemForm.image} alt="" />
                )}
                <div className={styles.productSummaryText}>
                  <strong>{itemForm.title.trim() || (activeItem ? activeItem.title : "Nuevo producto")}</strong>
                  <span>
                    {itemForm.price && Number(itemForm.price) > 0
                      ? `$${Number(itemForm.price).toLocaleString("es-AR")}`
                      : "Completá la información principal"}
                  </span>
                </div>
              </div>

              <form
                className={styles.itemForm}
                onSubmit={event => { event.preventDefault(); void saveItem(); }}
                noValidate
              >
              <FormSection
                number={1}
                title="Información y precio"
                summary="Datos principales"
                expanded={openItemSections.has("basics")}
                onToggle={() => toggleItemSection("basics")}
              >
              <div className={styles.field}>
                <label htmlFor="item-title">Nombre <span className={styles.requiredMark} aria-hidden="true">*</span></label>
                <input
                  id="item-title"
                  type="text"
                  placeholder="Ej: Pizza napolitana"
                  value={itemForm.title}
                  onChange={e => {
                    setItemForm(f => ({ ...f, title: e.target.value }));
                    setItemFieldErrors(previous => ({ ...previous, title: undefined }));
                  }}
                  autoFocus
                  maxLength={80}
                  required
                  aria-invalid={Boolean(itemFieldErrors.title)}
                  aria-describedby={itemFieldErrors.title ? "item-title-error" : undefined}
                />
                {itemFieldErrors.title && <span id="item-title-error" className={styles.fieldError}>{itemFieldErrors.title}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="item-desc">Descripción</label>
                <textarea
                  id="item-desc"
                  placeholder="Ingredientes, alérgenos, preparación..."
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="item-image">Imagen</label>
                <div className={styles.imageUploader}>
                  <input
                    ref={itemImageInputRef}
                    id="item-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles.hiddenInput}
                  />

                  {itemForm.image ? (
                    <div className={styles.imagePreviewWrapper}>
                      <div className={styles.imagePreviewFrame}>
                        <img src={itemForm.image} alt="Vista previa del producto" className={styles.imagePreview} />
                        {imageUploading && (
                          <div className={styles.imageUploadingOverlay}>
                            <Spinner size={18} /> Subiendo...
                          </div>
                        )}
                      </div>
                      <div className={styles.imagePreviewActions}>
                        <button
                          type="button"
                          className={styles.changeImageButton}
                          onClick={() => itemImageInputRef.current?.click()}
                          disabled={imageUploading}
                        >
                          {imageUploading ? "Subiendo..." : "Cambiar imagen"}
                        </button>
                        <button
                          type="button"
                          className={styles.removeImageButton}
                          onClick={removeItemImage}
                          disabled={imageUploading}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.uploadButton}
                      onClick={() => itemImageInputRef.current?.click()}
                      disabled={imageUploading}
                    >
                      {imageUploading ? <Spinner size={16} /> : icons.upload}
                      {imageUploading ? "Subiendo..." : "Subir imagen"}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="item-price">Precio <span className={styles.requiredMark} aria-hidden="true">*</span></label>
                <input
                  id="item-price"
                  type="number"
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  value={itemForm.price}
                  onChange={e => {
                    setItemForm(f => ({ ...f, price: e.target.value }));
                    setItemFieldErrors(previous => ({ ...previous, price: undefined }));
                  }}
                  required
                  aria-invalid={Boolean(itemFieldErrors.price)}
                  aria-describedby={itemFieldErrors.price ? "item-price-error" : undefined}
                />
                {itemFieldErrors.price && <span id="item-price-error" className={styles.fieldError}>{itemFieldErrors.price}</span>}
              </div>

              <div className={styles.field}>
                <label htmlFor="item-code">Código interno <span className={styles.requiredMark} aria-hidden="true">*</span></label>
                <input
                  id="item-code"
                  type="text"
                  placeholder="Ej: pizza-napo"
                  value={itemForm.code}
                  onChange={e => {
                    setItemForm(f => ({ ...f, code: e.target.value }));
                    setItemFieldErrors(previous => ({ ...previous, code: undefined }));
                  }}
                  required
                  aria-invalid={Boolean(itemFieldErrors.code)}
                  aria-describedby={itemFieldErrors.code ? "item-code-error" : "item-code-hint"}
                />
                {itemFieldErrors.code
                  ? <span id="item-code-error" className={styles.fieldError}>{itemFieldErrors.code}</span>
                  : <span id="item-code-hint" className={styles.fieldHint}>Usalo para identificar el producto dentro del editor.</span>}
              </div>
              </FormSection>

              <FormSection
                number={2}
                title="Variantes y promociones"
                summary={promotionsSummary}
                expanded={openItemSections.has("promotions")}
                onToggle={() => toggleItemSection("promotions")}
              >
              <div className={styles.field}>
                <label htmlFor="item-offer">Precio oferta</label>
                <input
                  id="item-offer"
                  type="number"
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  value={itemForm.offerPrice}
                  disabled={!canScheduleOffers && itemForm.offerScheduled}
                  onChange={e => setItemForm(f => ({ ...f, offerPrice: e.target.value }))}
                />
              </div>

              <section className={styles.scheduleCard} aria-labelledby="offer-schedule-title">
                <div className={styles.scheduleHeader}>
                  <div>
                    <div className={styles.scheduleTitleRow}>
                      <p id="offer-schedule-title" className={styles.toggleLabel}>Programar oferta</p>
                      {!canScheduleOffers && <span className={styles.schedulePlan}>VER PLANES</span>}
                    </div>
                    <p className={styles.toggleDesc}>Activá y desactivá el precio de oferta automáticamente.</p>
                  </div>
                  <Toggle
                    checked={itemForm.offerScheduled}
                    onChange={() => {
                      if (!canScheduleOffers && !itemForm.offerScheduled) {
                        setUpgradeReason("offer");
                        return;
                      }
                      setItemForm(f => ({ ...f, offerScheduled: !f.offerScheduled }));
                    }}
                    label="Programar oferta"
                  />
                </div>

                {itemForm.offerScheduled && !canScheduleOffers && (
                  <p className={styles.scheduleInactive}>
                    La programación guardada está inactiva con el plan Free. Podés desactivarla o mejorar el plan para recuperarla.
                  </p>
                )}

                {itemForm.offerScheduled && canScheduleOffers && (
                  <div className={styles.offerScheduleFields}>
                    <div className={styles.field}>
                      <label htmlFor="offer-from">Comienza</label>
                      <input
                        id="offer-from"
                        type="datetime-local"
                        value={itemForm.offerRange.from}
                        onChange={e => setItemForm(f => ({
                          ...f,
                          offerRange: { ...f.offerRange, from: e.target.value },
                        }))}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="offer-to">Finaliza</label>
                      <input
                        id="offer-to"
                        type="datetime-local"
                        value={itemForm.offerRange.to}
                        min={itemForm.offerRange.from || undefined}
                        onChange={e => setItemForm(f => ({
                          ...f,
                          offerRange: { ...f.offerRange, to: e.target.value },
                        }))}
                      />
                    </div>
                    <p className={styles.scheduleHint}>Horario de Argentina. Fuera de este período se muestra el precio original.</p>
                  </div>
                )}
              </section>

              {/* Variantes */}
              <div className={styles.field}>
                <div className={styles.fieldLabelRow}>
                  <label>Variantes</label>
                  <button
                    className={styles.textBtn}
                    type="button"
                    onClick={() => setItemForm(f => ({ ...f, options: [...f.options, { key: "", value: "" }] }))}
                  >
                    + Agregar variante
                  </button>
                </div>
                {itemForm.options.length === 0 && (
                  <p className={styles.emptyHint}>Sin variantes. Útil para tamaños o presentaciones con precio distinto.</p>
                )}
                {itemForm.options.map((opt, i) => (
                  <div key={i} className={styles.optionRow}>
                    <input
                      type="text"
                      placeholder="Nombre (ej: Grande)"
                      value={opt.key}
                      aria-label={`Nombre variante ${i + 1}`}
                      onChange={e => setItemForm(f => {
                        const opts = [...f.options];
                        opts[i] = { ...opts[i], key: e.target.value };
                        return { ...f, options: opts };
                      })}
                    />
                    <input
                      type="number"
                      placeholder="Precio"
                      value={opt.value}
                      min="0"
                      aria-label={`Precio variante ${i + 1}`}
                      onChange={e => setItemForm(f => {
                        const opts = [...f.options];
                        opts[i] = { ...opts[i], value: e.target.value };
                        return { ...f, options: opts };
                      })}
                    />
                    <button
                      className={styles.removeBtn}
                      type="button"
                      aria-label={`Eliminar variante ${i + 1}`}
                      onClick={() => setItemForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                    >
                      {icons.close}
                    </button>
                  </div>
                ))}
              </div>

              </FormSection>

              <FormSection
                number={3}
                title="Disponibilidad y visibilidad"
                summary={availabilitySummary}
                expanded={openItemSections.has("availability")}
                onToggle={() => toggleItemSection("availability")}
              >
              {/* Programación semanal de disponibilidad */}
              <section className={styles.scheduleCard} aria-labelledby="item-schedule-title">
                <div className={styles.scheduleHeader}>
                  <div>
                    <div className={styles.scheduleTitleRow}>
                      <p id="item-schedule-title" className={styles.toggleLabel}>Programar disponibilidad</p>
                      {!canScheduleItems && <span className={styles.schedulePlan}>VER PLANES</span>}
                    </div>
                    <p className={styles.toggleDesc}>Mostrá el plato solo en días y horarios determinados.</p>
                  </div>
                  <Toggle
                    checked={itemForm.availabilitySchedule.enabled}
                    onChange={() => {
                      if (!canScheduleItems && !itemForm.availabilitySchedule.enabled) {
                        setUpgradeReason("schedule");
                        return;
                      }
                      setItemForm(f => ({
                        ...f,
                        availabilitySchedule: {
                          ...f.availabilitySchedule,
                          enabled: !f.availabilitySchedule.enabled,
                        },
                      }));
                    }}
                    label="Programar disponibilidad"
                  />
                </div>

                {itemForm.availabilitySchedule.enabled && !canScheduleItems && (
                  <p className={styles.scheduleInactive}>
                    El horario guardado está inactivo con el plan Free. Podés desactivarlo o mejorar el plan para volver a usarlo.
                  </p>
                )}

                {itemForm.availabilitySchedule.enabled && canScheduleItems && (
                  <div className={styles.scheduleDays}>
                    {DAYS.map(({ key, label }) => {
                      const ranges = itemForm.availabilitySchedule[key];
                      return (
                        <div key={key} className={styles.scheduleDay}>
                          <div className={styles.scheduleDayHeader}>
                            <span>{label}</span>
                            {ranges.length < 4 && (
                              <button
                                type="button"
                                className={styles.textBtn}
                                onClick={() => setItemForm(f => ({
                                  ...f,
                                  availabilitySchedule: {
                                    ...f.availabilitySchedule,
                                    [key]: [...f.availabilitySchedule[key], { from: "12:00", to: "15:00" }],
                                  },
                                }))}
                              >
                                + Horario
                              </button>
                            )}
                          </div>
                          {ranges.length === 0 && (
                            <p className={styles.scheduleClosed}>No disponible este día</p>
                          )}
                          {ranges.map((range, index) => (
                            <div key={`${key}-${index}`} className={styles.scheduleRange}>
                              <input
                                type="time"
                                value={range.from}
                                aria-label={`${label}, hora de inicio ${index + 1}`}
                                onChange={e => setItemForm(f => {
                                  const nextRanges = [...f.availabilitySchedule[key]];
                                  nextRanges[index] = { ...nextRanges[index], from: e.target.value };
                                  return {
                                    ...f,
                                    availabilitySchedule: { ...f.availabilitySchedule, [key]: nextRanges },
                                  };
                                })}
                              />
                              <span>a</span>
                              <input
                                type="time"
                                value={range.to}
                                aria-label={`${label}, hora de fin ${index + 1}`}
                                onChange={e => setItemForm(f => {
                                  const nextRanges = [...f.availabilitySchedule[key]];
                                  nextRanges[index] = { ...nextRanges[index], to: e.target.value };
                                  return {
                                    ...f,
                                    availabilitySchedule: { ...f.availabilitySchedule, [key]: nextRanges },
                                  };
                                })}
                              />
                              <button
                                type="button"
                                className={styles.removeBtn}
                                aria-label={`Eliminar horario ${index + 1} del ${label}`}
                                onClick={() => setItemForm(f => ({
                                  ...f,
                                  availabilitySchedule: {
                                    ...f.availabilitySchedule,
                                    [key]: f.availabilitySchedule[key].filter((_, rangeIndex) => rangeIndex !== index),
                                  },
                                }))}
                              >
                                {icons.close}
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <p className={styles.scheduleHint}>
                      Horario de Argentina. Podés usar rangos que terminen al día siguiente, por ejemplo 20:00 a 02:00.
                    </p>
                  </div>
                )}
              </section>

              {/* Toggles */}
              <div className={styles.toggleGroup}>
                {[
                  { label: "Disponible",   desc: "Se puede pedir ahora",          key: "available" },
                  { label: "Ocultar",      desc: "No aparece en la carta pública", key: "hidden" },
                  { label: "Recomendado",  desc: "Se destaca en la carta pública", key: "recommended" },
                ].map(({ label, desc, key }) => (
                  <div key={key} className={styles.toggleRow}>
                    <div>
                      <p className={styles.toggleLabel}>{label}</p>
                      <p className={styles.toggleDesc}>{desc}</p>
                    </div>
                    <Toggle
                      checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={() => setItemForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                      label={label}
                    />
                  </div>
                ))}
              </div>
              </FormSection>

              {searchActive && (
                <button className={styles.backToResults} type="button" onClick={requestCloseItemForm}>
                  Volver a resultados
                </button>
              )}

              <div className={styles.formBtns}>
                <button
                  className={styles.cancelBtn}
                  type="button"
                  onClick={requestCloseItemForm}
                  disabled={saving || imageUploading}
                >
                  Cancelar
                </button>
                <button
                  className={styles.saveBtn}
                  disabled={saving || imageUploading}
                  aria-busy={saving}
                  type="submit"
                >
                  {saving
                    ? <><Spinner /> Guardando...</>
                    : imageUploading
                      ? "Subiendo imagen..."
                      : activeItem ? "Guardar cambios" : "Crear producto"}
                </button>
              </div>
              {activeItem && (
                <div className={styles.dangerZone}>
                  <button
                    className={styles.deleteBtn}
                    type="button"
                    onClick={() => setDeleteModal({ type: "item", id: activeItem._id, name: activeItem.title })}
                  >
                    Eliminar producto
                  </button>
                </div>
              )}
              </form>
            </div>
          </>
        )}

        {/* ══ VISTA: FORMULARIO CATEGORÍA ══ */}
        {view === "categoria-form" && (
          <>
            <TopBar
              title={categoriaForm.editingId ? "Editar categoría" : "Nueva categoría"}
              onBack={() => setView("menu")}
            />
            <div className={`${styles.content} ${styles.formContent}`}>
              {error && <div className={styles.errorBanner} role="alert">{error}</div>}

              <div className={styles.field}>
                <label htmlFor="cat-title">Nombre <span style={{ color: "#c9a84c" }}>*</span></label>
                <input
                  id="cat-title"
                  type="text"
                  placeholder="Ej: Pizzas"
                  value={categoriaForm.title}
                  onChange={e => setCategoriaForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="cat-desc">Descripción</label>
                <input
                  id="cat-desc"
                  type="text"
                  placeholder="Opcional"
                  value={categoriaForm.description}
                  onChange={e => setCategoriaForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="cat-code">Código interno</label>
                <input
                  id="cat-code"
                  type="text"
                  placeholder="Ej: pizzas"
                  value={categoriaForm.code}
                  onChange={e => setCategoriaForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
              {!categoriaForm.editingId && (
                <div className={styles.field}>
                  <label htmlFor="cat-seccion">Sección</label>
                  <select
                    id="cat-seccion"
                    value={categoriaForm.seccionID}
                    onChange={e => setCategoriaForm(f => ({ ...f, seccionID: e.target.value }))}
                  >
                    <option value="">Sin sección</option>
                    {menuData?.secciones.map(s => (
                      <option key={s._id} value={s._id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.formBtns}>
                <button
                  className={styles.saveBtn}
                  onClick={saveCategoria}
                  disabled={saving}
                  aria-busy={saving}
                  type="button"
                >
                  {saving ? <><Spinner /> Guardando...</> : categoriaForm.editingId ? "Guardar cambios" : "Crear categoría"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ VISTA: FORMULARIO SECCIÓN ══ */}
        {view === "seccion-form" && (
          <>
            <TopBar
              title={seccionForm.editingId ? "Editar sección" : "Nueva sección"}
              onBack={() => setView("menu")}
            />
            <div className={`${styles.content} ${styles.formContent}`}>
              {error && <div className={styles.errorBanner} role="alert">{error}</div>}

              <div className={styles.field}>
                <label htmlFor="sec-title">Nombre <span style={{ color: "#c9a84c" }}>*</span></label>
                <input
                  id="sec-title"
                  type="text"
                  placeholder="Ej: Comidas"
                  value={seccionForm.title}
                  onChange={e => setSeccionForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="sec-code">Código interno</label>
                <input
                  id="sec-code"
                  type="text"
                  placeholder="Ej: comidas"
                  value={seccionForm.code}
                  onChange={e => setSeccionForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className={styles.formBtns}>
                <button
                  className={styles.saveBtn}
                  onClick={saveSeccion}
                  disabled={saving}
                  aria-busy={saving}
                  type="button"
                >
                  {saving ? <><Spinner /> Guardando...</> : seccionForm.editingId ? "Guardar cambios" : "Crear sección"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ MODAL: DESCARTAR CAMBIOS DEL PRODUCTO ══ */}
        {discardModalOpen && (
          <div
            className={styles.modalOverlay}
            onClick={() => setDiscardModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-modal-title"
          >
            <div className={styles.modal} onClick={event => event.stopPropagation()}>
              <p id="discard-modal-title" className={styles.modalTitle}>¿Descartar los cambios?</p>
              <p className={styles.modalDesc}>
                Los datos que modificaste en este producto no se guardarán.
              </p>
              <div className={styles.modalBtns}>
                <button className={styles.modalCancel} onClick={() => setDiscardModalOpen(false)} type="button" autoFocus>
                  Seguir editando
                </button>
                <button
                  className={styles.modalConfirm}
                  onClick={() => { setDiscardModalOpen(false); setView("menu"); }}
                  type="button"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL DE CONFIRMACIÓN ══ */}
        {deleteModal && (
          <div
            className={styles.modalOverlay}
            onClick={() => setDeleteModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <p id="delete-modal-title" className={styles.modalTitle}>
                ¿Eliminar "{deleteModal.name}"?
              </p>
              <p className={styles.modalDesc}>
                {deleteModal.type === "item"
                  ? "El producto se eliminará de forma permanente. Esta acción no se puede deshacer."
                  : deleteModal.type === "categoria"
                    ? "La categoría se eliminará permanentemente. Debe estar vacía antes de eliminarla."
                    : "La sección se eliminará. Solo podés hacerlo si no tiene categorías asignadas."}
              </p>
              <div className={styles.modalBtns}>
                <button className={styles.modalCancel} onClick={() => setDeleteModal(null)} type="button">
                  Cancelar
                </button>
                <button className={styles.modalConfirm} onClick={confirmDelete} type="button" autoFocus>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL DE UPGRADE (límite de productos / importador Excel) ══ */}
        {upgradeReason && (
          <UpgradeModal
            currentPlan={effectiveSubscription}
            minPlan="basic"
            requiredFeature={upgradeReason === "excel" ? "carga_masiva_excel" : upgradeReason === "pdf" ? "menu_pdf" : upgradeReason === "items" ? undefined : "programacion_productos"}
            minimumItems={upgradeReason === "items" ? (limits?.itemCount ?? totalItems) + 1 : undefined}
            title={upgradeReason === "items" ? `Llegaste al límite de ${limits?.itemLimit ?? "tu plan"} productos` : "Esta función no está incluida en tu plan"}
            description="Consultá los planes disponibles con esta capacidad. Los precios y beneficios corresponden al catálogo vigente."
            onClose={() => setUpgradeReason(null)}
          />
        )}

      </div>
  );
}
