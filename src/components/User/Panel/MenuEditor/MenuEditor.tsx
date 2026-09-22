import { useState, useEffect, useCallback, useRef, memo, useMemo, useLayoutEffect, useEffectEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CheckSquare, FolderPlus, Layers, Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import { useMediaQuery } from "../../../../hooks/useMediaQuery";
import { useNotifications } from "../../../../context/useNotifications";
import { isSubscriptionExpired } from "../../../../lib/plans";
import { formatDateAR } from "../../../../lib/dates";
import { useFeedbackMessage } from "../../../../hooks/useFeedbackMessage";
import MassiveImport from "../../../../Utils/MassiveImport";
import ImageManager from "./ImageManager/ImageManager";
import MenuTemplatePicker from "./MenuTemplatePicker/MenuTemplatePicker";
import type {
  AdminItem as Item,
  AdminCategoria as Categoria,
  AdminSeccion as Seccion,
  AdminMenuData as MenuData,
  DayKey,
  TimeRange,
} from "../../../../types";
import { BUSINESS_TIME_PATTERN } from "../../../../Utils/businessSchedule";
import WeeklySchedule from "../../../Common/WeeklySchedule/WeeklySchedule";
import ScheduleDateRange from "../../../Common/WeeklySchedule/ScheduleDateRange";
import { EMPTY_DATE_RANGE, WEEK_DAYS, emptyWeekRanges } from "../../../Common/WeeklySchedule/weekSchedule";
import type { DateRangeValue, WeekRanges } from "../../../Common/WeeklySchedule/weekSchedule";
import Spinner from "../../../Common/Spinner";
import UpgradeModal from "../../../Common/UpgradeModal";
import {
  BoardSection,
  SortableWorkspaceCategory,
  WorkspaceCategory,
  WorkspaceFilters,
  WorkspaceFoldControls,
  WorkspaceJumpBar,
  WorkspaceNav,
  WorkspaceOverview,
  WorkspacePanel,
  type CategorySelectionState,
  type GroupSelection,
} from "./Workspace/MenuWorkspace";
import { countWorkspaceItems, matchesWorkspaceFilter, type WorkspaceFilter } from "./Workspace/workspaceFilters";
import DragHandle from "./Reorder/DragHandle";
import MenuReorderProvider from "./Reorder/MenuReorderProvider";
import {
  LOOSE_SECTION, allCategories, categoryDndId, findCategory, itemDndId, sectionDndId,
} from "./Reorder/menuReorder";
import { useReorderState } from "./Reorder/reorderContext";
import { useMenuReorder } from "./Reorder/useMenuReorder";
import { useReorderList, useReorderSortable } from "./Reorder/useReorderSortable";
import styles from "./MenuEditor.module.css";
import rs from "./Reorder/Reorder.module.css";
import ws from "./Workspace/MenuWorkspace.module.css";

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
  // ── Programación del producto ──
  // La oferta y la disponibilidad se configuran igual: un horario semanal
  // (días prendidos/apagados) más un rango de fechas opcional.
  offerScheduled: boolean;
  offerRange: DateRangeValue;
  offerWeek: WeekRanges;
  availabilityScheduled: boolean;
  availabilityRange: DateRangeValue;
  availabilityWeek: WeekRanges;
  code: string;
  image: string;
  available: boolean;
  hidden: boolean;
  recommended: boolean;
  options: OptionRow[];
}

// Al activar una programación sin horario guardado arrancamos con la semana
// completa y "todo el día" (horas iguales, mismo criterio que el backend):
// así prender el interruptor nunca cambia por sí solo lo que se ve en la
// carta — el dueño recorta días, horas o fechas desde ahí.
const ALL_DAY_RANGE: TimeRange = { from: "00:00", to: "00:00" };

const defaultWeekRanges = (): WeekRanges =>
  WEEK_DAYS.reduce((acc, day) => { acc[day] = [{ ...ALL_DAY_RANGE }]; return acc; }, {} as WeekRanges);

const toWeekRanges = (schedule?: Partial<Record<DayKey, TimeRange[]>> | null): WeekRanges =>
  WEEK_DAYS.reduce((acc, day) => {
    acc[day] = (schedule?.[day] ?? []).map(range => ({ ...range }));
    return acc;
  }, {} as WeekRanges);

const hasAnyRange = (week: WeekRanges) => WEEK_DAYS.some(day => week[day].length > 0);

const toDateRange = (range?: { from?: string | null; to?: string | null } | null): DateRangeValue => ({
  from: formatDateAR(range?.from, { output: "date-input", fallback: "" }),
  to: formatDateAR(range?.to, { output: "date-input", fallback: "" }),
});

const toApiDateRange = (range: DateRangeValue) => ({
  from: range.from || null,
  to: range.to || null,
});

// Espejo liviano de validateAvailabilitySchedule (backend): solo lo que el
// dueño puede corregir sin esperar la respuesta. El solapamiento de rangos
// lo sigue rechazando el servidor, con su propio mensaje.
const validateWeekSchedule = (week: WeekRanges, range: DateRangeValue, subject: string): string | null => {
  const ranges = WEEK_DAYS.flatMap(day => week[day]);
  if (ranges.length === 0) return `Elegí al menos un día para ${subject}.`;
  if (ranges.some(({ from, to }) => !BUSINESS_TIME_PATTERN.test(from) || !BUSINESS_TIME_PATTERN.test(to))) {
    return `Revisá los horarios de ${subject}: cada uno necesita una hora de inicio y una de fin.`;
  }
  if (range.from && range.to && range.from > range.to) {
    return `En ${subject}, la fecha de fin debe ser posterior a la de inicio.`;
  }
  return null;
};

const EMPTY_ITEM: ItemFormState = {
  title: "",
  description: "",
  price: "",
  offerPrice: "",
  offerScheduled: false,
  offerRange: { ...EMPTY_DATE_RANGE },
  offerWeek: emptyWeekRanges(),
  availabilityScheduled: false,
  availabilityRange: { ...EMPTY_DATE_RANGE },
  availabilityWeek: emptyWeekRanges(),
  code: "",
  image: "",
  available: true,
  hidden: false,
  recommended: false,
  options: [],
};

// ── Subida de imagen de producto (por el backend, ver handleImageUpload) ──

const MAX_IMAGE_MB = 5;

// ── Vistas posibles ────────────────────────────────────────────────────────────

type View = "menu" | "item-form" | "categoria-form" | "seccion-form" | "massive-import" | "image-manager" | "template-picker";
type ItemFormSection = "basics" | "promotions" | "scheduling" | "availability";

interface ItemFieldErrors {
  title?: string;
  price?: string;
  code?: string;
}

const cloneItemForm = (form: ItemFormState): ItemFormState => ({
  ...form,
  offerRange: { ...form.offerRange },
  offerWeek: toWeekRanges(form.offerWeek),
  availabilityRange: { ...form.availabilityRange },
  availabilityWeek: toWeekRanges(form.availabilityWeek),
  options: form.options.map(option => ({ ...option })),
});

const normalizeSearchValue = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

// Aplica un cambio a un producto dentro del \u00e1rbol del men\u00fa (actualizaciones
// optimistas de disponibilidad y visibilidad).
const patchMenuItem = (menu: MenuData, itemId: string, patch: Partial<Item>): MenuData => {
  const updateItems = (items: Item[]) => items.map(item => item._id === itemId ? { ...item, ...patch } : item);
  return {
    secciones: menu.secciones.map(seccion => ({
      ...seccion,
      categorias: seccion.categorias.map(categoria => ({ ...categoria, items: updateItems(categoria.items) })),
    })),
    sinSeccion: menu.sinSeccion.map(categoria => ({ ...categoria, items: updateItems(categoria.items) })),
  };
};

// Aplica un cambio a una sección o categoría (actualización optimista de
// visibilidad).
const patchMenuNode = (menu: MenuData, nodeId: string, patch: { hidden: boolean }): MenuData => {
  const updateCats = (categorias: Categoria[]) =>
    categorias.map(categoria => categoria._id === nodeId ? { ...categoria, ...patch } : categoria);
  return {
    secciones: menu.secciones.map(seccion => ({
      ...(seccion._id === nodeId ? { ...seccion, ...patch } : seccion),
      categorias: updateCats(seccion.categorias),
    })),
    sinSeccion: updateCats(menu.sinSeccion),
  };
};

// Tope de productos por pedido de las acciones en lote (MAX_BULK_ITEMS en
// backend/src/controllers/itemController.js).
const BULK_CHUNK_SIZE = 200;

// Selección múltiple: productos y secciones/categorías marcadas enteras.
interface Selection {
  items: Set<string>;
  menus: Set<string>;
}
const EMPTY_SELECTION: Selection = { items: new Set(), menus: new Set() };

// Estado de la casilla de un grupo (categoría, sección, "Sin sección" o
// todo el menú): marcado si están marcadas todas sus secciones/categorías
// (o, sin ninguna, todos sus productos); a medias si hay algo marcado adentro.
const groupCheckState = (selection: Selection, menuIds: string[], itemIds: string[]) => {
  const checked = menuIds.length > 0
    ? menuIds.every(id => selection.menus.has(id))
    : itemIds.length > 0 && itemIds.every(id => selection.items.has(id));
  const indeterminate = !checked
    && (menuIds.some(id => selection.menus.has(id)) || itemIds.some(id => selection.items.has(id)));
  return { checked, indeterminate };
};

// "2 categorías · 15 productos", para la barra y la confirmación de borrado.
const countLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

// Aviso de una acción en lote sobre productos (con los que fallaron).
const itemsOutcome = (updated: number, failed: number, label: string) => {
  const message = `${countLabel(updated, "producto", "productos")} ${label}.`;
  if (failed === 0) return { message };
  return {
    message,
    error: updated === 0
      ? "No se pudo aplicar la acción a ningún producto seleccionado."
      : `${message} ${countLabel(failed, "producto", "productos")} no se ${failed !== 1 ? "pudieron" : "pudo"} actualizar.`,
  };
};

// Conjuntos de ids plegados (secciones y categorías del tablero).
const toggleInSet = (prev: Set<string>, id: string) => {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
};
const withoutId = (prev: Set<string>, id: string) => {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
};

// Desde este ancho el editor pasa a espacio de trabajo: estructura, tablero y
// panel de edici\u00f3n a la vista a la vez. Por debajo sigue el flujo m\u00f3vil.
const DESKTOP_QUERY = "(min-width: 1024px)";
// Desde este ancho se ve la columna de estructura (ver MenuWorkspace.module.css),
// y las secciones y categorías se ordenan ahí en vez de en el tablero.
const WIDE_DESKTOP_QUERY = "(min-width: 1280px)";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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
  checkSquare: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <polyline points="7 12 10 15 17 8" />
    </svg>
  ),
  images: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M3 13l3.5-3.5a2 2 0 0 1 2.8 0L13 13" />
      <path d="M21 8v11a2 2 0 0 1-2 2H8" />
    </svg>
  ),
  sparkles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
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

// ── Móvil: secciones, categorías y productos que se ordenan arrastrando ──────
// Cada uno se arrastra desde su manija. Un producto soltado sobre una
// categoría cerrada va al final de esa categoría (ver Reorder/useMenuReorder).

// Casilla que marca una sección entera (todos sus productos) en la
// selección múltiple.
function GroupCheckbox({ selection, title }: { selection: GroupSelection; title: string }) {
  return (
    <label className={styles.itemCheckboxWrap}>
      <input
        type="checkbox"
        checked={selection.checked}
        ref={el => { if (el) el.indeterminate = selection.indeterminate; }}
        onChange={selection.onToggle}
        aria-label={selection.checked
          ? `Deseleccionar todos los productos de ${title}`
          : `Seleccionar todos los productos de ${title}`}
      />
    </label>
  );
}

// Una sección con sus categorías: se mueve entera.
function MobileSeccionBlock({ seccion, deleteDisabled, selection, onAddCategory, onEdit, onDelete, children }: {
  seccion: Seccion;
  deleteDisabled: boolean;
  // Con categorías, "+ categoría" va con las acciones de la sección; vacía,
  // en su lugar (ver MobileCategoryList).
  onAddCategory: () => void;
  // En selección múltiple: la casilla de la sección entera (reemplaza a la manija).
  selection?: GroupSelection;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const sortable = useReorderSortable({ kind: "section", id: seccion._id, title: seccion.title });
  const { setNode, style, isDragging } = sortable;

  return (
    <div ref={setNode} style={style} className={`${styles.seccionBlock} ${isDragging ? rs.placeholder : ""}`}>
      <div className={styles.seccionRow}>
        <div className={styles.seccionLeft}>
          {selection
            ? <GroupCheckbox selection={selection} title={`la sección ${seccion.title}`} />
            : <DragHandle sortable={sortable} label={`Mover la sección ${seccion.title}`} />}
          <span className={styles.seccionBadge}>Sección</span>
          <span className={`${styles.seccionTitle} ${seccion.hidden ? styles.seccionTitleHidden : ""}`}>{seccion.title}</span>
          {seccion.hidden && <span className={styles.hiddenBadge}>Oculta</span>}
        </div>
        <div className={styles.rowActions}>
          {seccion.categorias.length > 0 && (
            <button
              className={`${styles.iconBtn} ${styles.addIconBtn}`}
              onClick={onAddCategory}
              title="Agregar una categoría a esta sección"
              aria-label={`Agregar una categoría a ${seccion.title}`}
            >
              {icons.plus}
            </button>
          )}
          <button className={styles.iconBtn} onClick={onEdit} title="Editar sección" aria-label={`Editar ${seccion.title}`}>
            {icons.edit}
          </button>
          <button
            className={`${styles.iconBtn} ${styles.danger}`}
            onClick={onDelete}
            disabled={deleteDisabled}
            title={deleteDisabled ? "Eliminar deshabilitado desde Configuración" : "Eliminar sección"}
            aria-label={`Eliminar ${seccion.title}`}
          >
            {icons.trash}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// Las categorías de una sección (o las sueltas). Recibe una categoría que se
// suelta en su margen o, vacía, en su lugar.
function MobileCategoryList({ sectionKey, title, categorias, emptyText, renderCategoria }: {
  sectionKey: string;
  title: string;
  categorias: Categoria[];
  // Lo que se muestra sin categorías (un texto o un botón), o nada.
  emptyText: ReactNode;
  renderCategoria: (cat: Categoria, sectionKey: string) => ReactNode;
}) {
  const { activeKind } = useReorderState();
  const { setNode, isOver } = useReorderList({ kind: "category-list", sectionKey, title });

  return (
    <div ref={setNode}>
      <SortableContext items={categorias.map(cat => categoryDndId(cat._id))} strategy={verticalListSortingStrategy}>
        {categorias.map(cat => renderCategoria(cat, sectionKey))}
      </SortableContext>
      {categorias.length === 0 && (activeKind === "category"
        ? <p className={`${rs.dropZone} ${isOver ? rs.dropZoneOver : ""}`}>Soltá la categoría acá</p>
        : emptyText)}
    </div>
  );
}

interface CategoriaAcordeonProps {
  cat: Categoria;
  // Sección donde está (o LOOSE_SECTION): la necesita la categoría arrastrable.
  sectionKey: string;
  // Su sección está oculta: la categoría tampoco se ve en la carta.
  sectionHidden: boolean;
  expanded: boolean;
  atItemLimit: boolean;
  deleteDisabled: boolean;
  onToggle: () => void;
  onEditCat: () => void;
  onDeleteCat: () => void;
  onNewItem: () => void;
  onEditItem: (item: Item) => void;
  onToggleAvailable: (item: Item) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  catSelection: CategorySelectionState;
  onToggleSelectItem: (id: string) => void;
  onToggleSelectAllInCat: (cat: Categoria) => void;
}

const CategoriaAcordeon = memo(function CategoriaAcordeon({
  cat, sectionKey, sectionHidden, expanded, atItemLimit, deleteDisabled, onToggle, onEditCat, onDeleteCat, onNewItem,
  onEditItem, onToggleAvailable, selectionMode, selectedIds, catSelection, onToggleSelectItem, onToggleSelectAllInCat,
}: CategoriaAcordeonProps) {
  const { activeKind } = useReorderState();
  const sortable = useReorderSortable({ kind: "category", id: cat._id, sectionKey, title: cat.title });
  const { setNode, style, isDragging, isOver } = sortable;
  const itemCount  = cat.items?.length ?? 0;
  // Cerrada, recibe productos: van al final.
  const itemDropTarget = !expanded && isOver && activeKind === "item";

  return (
    <div
      ref={setNode}
      style={style}
      className={`${styles.catAcordeon} ${isDragging ? rs.placeholder : ""} ${itemDropTarget ? styles.catDropTarget : ""} ${cat.hidden || sectionHidden ? styles.catHidden : ""}`}
    >
      {/* Header */}
      <div className={`${styles.catHeader} ${expanded ? styles.open : ""}`}>
        {!selectionMode && <DragHandle sortable={sortable} label={`Mover la categoría ${cat.title}`} />}
        {catSelection !== "hidden" && (
          <label className={styles.itemCheckboxWrap} onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={catSelection === "on"}
              ref={el => { if (el) el.indeterminate = catSelection === "partial"; }}
              onChange={() => onToggleSelectAllInCat(cat)}
              aria-label={catSelection === "on" ? `Deseleccionar la categoría ${cat.title}` : `Seleccionar la categoría ${cat.title}`}
            />
          </label>
        )}
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
            {cat.hidden ? " · oculta" : sectionHidden ? " · oculta por su sección" : ""}
          </span>
        </button>

        <div className={styles.rowActions}>
          {/* Con productos (o cerrada), "+ producto" va acá; abierta y vacía,
              en su lugar dentro de la lista. */}
          {(itemCount > 0 || !expanded) && (
            <button
              className={`${styles.iconBtn} ${styles.addIconBtn}`}
              onClick={onNewItem}
              title={atItemLimit ? "Llegaste al límite de productos de tu plan" : "Agregar un producto a esta categoría"}
              aria-label={`Agregar un producto a ${cat.title}`}
            >
              {icons.plus}
            </button>
          )}
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
            disabled={deleteDisabled}
            title={deleteDisabled ? "Eliminar deshabilitado desde Configuración" : "Eliminar categoría"}
            aria-label={`Eliminar ${cat.title}`}
          >
            {icons.trash}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <AcordeonItems
          cat={cat}
          atItemLimit={atItemLimit}
          onNewItem={onNewItem}
          onEditItem={onEditItem}
          onToggleAvailable={onToggleAvailable}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelectItem={onToggleSelectItem}
        />
      )}
    </div>
  );
});

// Productos de una categoría abierta.
function AcordeonItems({
  cat, atItemLimit, onNewItem, onEditItem, onToggleAvailable, selectionMode, selectedIds, onToggleSelectItem,
}: {
  cat: Categoria;
  atItemLimit: boolean;
  onNewItem: () => void;
  onEditItem: (item: Item) => void;
  onToggleAvailable: (item: Item) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelectItem: (id: string) => void;
}) {
  const { activeKind } = useReorderState();
  const { setNode, isOver } = useReorderList({ kind: "item-list", catId: cat._id, title: cat.title });
  const items = cat.items ?? [];

  return (
    <div
      ref={setNode}
      className={`${styles.catBody} ${isOver && activeKind === "item" ? styles.dragOver : ""}`}
      role="list"
      aria-label={`Productos de ${cat.title}`}
    >
      {items.length === 0 && (
        <div className={styles.emptyAdd}>
          <button
            className={`${styles.addItemBtn} ${atItemLimit ? styles.addItemBtnLimit : ""}`}
            onClick={onNewItem}
            type="button"
          >
            {atItemLimit ? "Límite alcanzado — Mejorar plan" : "+ Agregar producto"}
          </button>
        </div>
      )}

      <SortableContext items={items.map(item => itemDndId(item._id))} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <AcordeonItemRow
            key={item._id}
            item={item}
            catId={cat._id}
            selected={selectedIds.has(item._id)}
            selectionMode={selectionMode}
            onEditItem={onEditItem}
            onToggleAvailable={onToggleAvailable}
            onToggleSelectItem={onToggleSelectItem}
          />
        ))}
      </SortableContext>
    </div>
  );
}

interface AcordeonItemRowProps {
  item: Item;
  catId: string;
  selected: boolean;
  selectionMode: boolean;
  onEditItem: (item: Item) => void;
  onToggleAvailable: (item: Item) => void;
  onToggleSelectItem: (id: string) => void;
}

// Envoltura arrastrable fina y cuerpo memorizado: mientras se arrastra,
// dnd-kit vuelve a renderizar cada fila en cada cambio de destino.
const AcordeonItemRow = memo(function AcordeonItemRow({
  item, catId, selected, selectionMode, onEditItem, onToggleAvailable, onToggleSelectItem,
}: AcordeonItemRowProps) {
  const sortable = useReorderSortable({ kind: "item", id: item._id, catId, title: item.title });
  const { setNode, style, isDragging } = sortable;

  return (
    <div
      ref={setNode}
      style={style}
      role="listitem"
      className={`${styles.itemRowAc} ${isDragging ? styles.dragging : ""} ${selected ? styles.selected : ""}`}
    >
      {selectionMode ? (
        <label className={styles.itemCheckboxWrap}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelectItem(item._id)}
            aria-label={`Seleccionar ${item.title}`}
          />
        </label>
      ) : (
        <DragHandle sortable={sortable} label={`Mover ${item.title}`} />
      )}
      <AcordeonItemBody
        item={item}
        selectionMode={selectionMode}
        onEditItem={onEditItem}
        onToggleAvailable={onToggleAvailable}
        onToggleSelectItem={onToggleSelectItem}
      />
    </div>
  );
});

const AcordeonItemBody = memo(function AcordeonItemBody({
  item, selectionMode, onEditItem, onToggleAvailable, onToggleSelectItem,
}: Omit<AcordeonItemRowProps, "catId" | "selected">) {
  return (
    <>
      <button
        className={styles.itemInfoAc}
        onClick={() => selectionMode ? onToggleSelectItem(item._id) : onEditItem(item)}
        type="button"
      >
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

      {!selectionMode && (
        <div className={styles.itemActions}>
          <button
            className={`${styles.pillBtn} ${item.available ? styles.pillOn : styles.pillOff}`}
            onClick={() => onToggleAvailable(item)}
            aria-label={item.available ? `Pausar ${item.title}` : `Activar ${item.title}`}
            type="button"
          >
            {item.available ? "Activo" : "Pausado"}
          </button>
        </div>
      )}
    </>
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
    canUseImageManager?: boolean;
    canUseTemplates?: boolean;
    // Lo manda un backend que sabe ordenar (PATCH /items/reorder y
    // /menus/reorder): sin la clave no se muestran las manijas.
    canReorder?: boolean;
    autoGenerateCodes?: boolean;
    disableMenuDelete?: boolean;
    // Configuración: eliminar secciones y categorías con todo su contenido.
    deleteMenusWithContent?: boolean;
    // Lo manda un backend con /menus/bulk/*: sin la clave la selección
    // múltiple marca solo productos.
    canBulkMenus?: boolean;
  } | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useFeedbackMessage("error");

  // Modal de upgrade compartido: se abre por el límite de productos
  // del plan free o por intentar usar el importador de Excel sin plan
  // pago. "reason" solo cambia el texto que se muestra.
  const [upgradeReason, setUpgradeReason] = useState<"items" | "excel" | "pdf" | "schedule" | "offer" | "images" | "templates" | null>(null);

  const [imageUploading, setImageUploading] = useState(false);
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canExportPdf = limits?.canExportPdf === true;
  const canScheduleItems = limits?.canScheduleItems === true;
  const canScheduleOffers = limits?.canScheduleOffers === true;

  // ── Selección múltiple ──────────────────────────────────────────────────
  // Productos (items) y secciones/categorías enteras (menus), ver
  // toggleSelectGroup.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const selectedIds = selection.items;
  const selectedMenuIds = selection.menus;
  // Este backend acepta acciones en lote sobre secciones y categorías
  // (/menus/bulk/*). Sin la clave, se seleccionan solo productos.
  const canSelectMenus = limits?.canBulkMenus === true;
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const [view,            setView]            = useState<View>("menu");
  const [menuSheetOpen,   setMenuSheetOpen]   = useState(false);
  // ── Espacio de trabajo de escritorio ──────────────────────────────────
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [statusFilter,  setStatusFilter]  = useState<WorkspaceFilter>("all");
  const [focusedCatId,  setFocusedCatId]  = useState<string | null>(null);
  const [flashItemId,   setFlashItemId]   = useState<string | null>(null);
  // Escritorio: secciones y categorías plegadas en el tablero (por id). Todo
  // arranca desplegado; es solo vista, no se guarda.
  const [collapsedSecs, setCollapsedSecs] = useState<Set<string>>(() => new Set());
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => new Set());
  // Despliega una categoría (y su sección) para mostrar algo que queda adentro.
  const unfoldCategory = useCallback((catId: string, sectionKey?: string) => {
    setCollapsedCats(prev => withoutId(prev, catId));
    if (sectionKey && sectionKey !== LOOSE_SECTION) setCollapsedSecs(prev => withoutId(prev, sectionKey));
  }, []);
  // Producto que se está duplicando: su botón queda deshabilitado mientras.
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  // Cambia con cada apertura del panel: reinicia el formulario (scroll,
  // autofocus) aunque la vista siga siendo la misma.
  const [formSeq,       setFormSeq]       = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const boardRef       = useRef<HTMLDivElement>(null);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const jumpLockRef = useRef(0);
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
  const [categoriaForm, setCategoriaForm] = useState({ title: "", description: "", code: "", seccionID: "", editingId: "", hidden: false });
  const [seccionForm,   setSeccionForm]   = useState({ title: "", code: "", editingId: "", hidden: false });

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

  // ── Ordenar arrastrando ───────────────────────────────────────────────────
  // El orden cambia al soltar y se guarda en segundo plano (ver
  // Reorder/useMenuReorder). Desde 1280px las secciones y categorías se
  // ordenan en la columna de estructura; más angosto, en el tablero.

  const isWideDesktop = useMediaQuery(WIDE_DESKTOP_QUERY);
  // refetch se define más abajo y a su vez espera a la cola de este hook.
  const refetchRef = useRef<() => Promise<void>>(async () => {});
  const reorder = useMenuReorder({
    menuData,
    setMenuData,
    authHeaders,
    onUnauthorized: () => {
      logout();
      window.location.href = "/login";
    },
    onSaveError: message => {
      setError(message);
      void refetchRef.current();
    },
    // Soltado sobre una categoría cuya lista no se ve: se avisa adónde fue y
    // se muestra (en el tablero se resalta; en el celular se abre la categoría).
    onItemAppended: (itemId, catId) => {
      const title = menuData ? allCategories(menuData).find(cat => cat._id === catId)?.title : undefined;
      notifySuccess(title ? `Producto movido a «${title}».` : "Producto movido.");
      if (isDesktop) {
        unfoldCategory(catId, menuData ? findCategory(menuData, catId)?.sectionKey : undefined);
        setFlashItemId(itemId);
      }
      else setExpandedCats(prev => new Set(prev).add(catId));
    },
  });
  const { waitForSaves } = reorder;

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
      // Con un orden todavía sin guardar, el menú del servidor vendría con el
      // orden anterior y lo pisaría: primero se espera a la cola.
      await waitForSaves();
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
  }, [token, activeCategoria, setError, parseApiResponse, waitForSaves]);
  useLayoutEffect(() => { refetchRef.current = refetch; });

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
    const nextForm = cloneItemForm(EMPTY_ITEM);
    setItemForm(nextForm);
    setInitialItemForm(cloneItemForm(nextForm));
    setItemFieldErrors({});
    setOpenItemSections(new Set(["basics"]));
    setError("");
    setFormSeq(seq => seq + 1);
    setView("item-form");
  }, [limits, setError]);

  const openEditItem = useCallback((item: Item, cat: Categoria) => {
    setActiveCategoria(cat);
    setActiveItem(item);
    // Una oferta guardada con la interfaz anterior (solo fechas, sin horario
    // semanal) se abre como "todos los días, todo el día": volver a guardarla
    // sin tocar nada no cambia cuándo rige.
    const offerWeek = toWeekRanges(item.offerSchedule);
    const availabilityWeek = toWeekRanges(item.availabilitySchedule);
    const nextForm: ItemFormState = {
      title:       item.title,
      description: item.description || "",
      price:       item.price?.toString()      || "",
      offerPrice:  item.offerPrice?.toString() || "",
      offerScheduled: Boolean(item.offerRange?.from || item.offerRange?.to || item.offerSchedule?.enabled),
      offerRange: toDateRange(item.offerRange),
      offerWeek: hasAnyRange(offerWeek) ? offerWeek : defaultWeekRanges(),
      availabilityScheduled: item.availabilitySchedule?.enabled === true,
      availabilityRange: toDateRange(item.availabilitySchedule?.dateRange),
      availabilityWeek: hasAnyRange(availabilityWeek) ? availabilityWeek : defaultWeekRanges(),
      code:        item.code || "",
      available:   item.available,
      hidden:      item.hidden,
      recommended: item.recommended,
      image: item.image || "",
      options:     Object.entries(item.options || {}).map(([key, value]) => ({ key, value: value.toString() })),
    };
    setItemForm(nextForm);
    setInitialItemForm(cloneItemForm(nextForm));
    setItemFieldErrors({});
    const initialSections = new Set<ItemFormSection>(["basics"]);
    if (nextForm.offerPrice || nextForm.options.length > 0) initialSections.add("promotions");
    if (nextForm.offerScheduled || nextForm.availabilityScheduled) initialSections.add("scheduling");
    if (nextForm.hidden || nextForm.recommended || !nextForm.available) initialSections.add("availability");
    setOpenItemSections(initialSections);
    setError("");
    setFormSeq(seq => seq + 1);
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

  // `andNew`: en escritorio, guardar y dejar listo otro producto en la misma
  // categoría — cargar una carta entera es el caso más pesado del editor.
  const saveItem = async ({ andNew = false }: { andNew?: boolean } = {}) => {
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
    // Con la generación automática de códigos activa (Configuración), dejarlo
    // vacío no es un error: el backend le asigna uno al crear el producto.
    if (!itemForm.code.trim() && !limits?.autoGenerateCodes) nextFieldErrors.code = "Ingresá el código interno.";
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
      if (!itemForm.offerPrice) { showSectionError("scheduling", "Ingresá un precio de oferta antes de programarla."); return; }
      const offerError = validateWeekSchedule(itemForm.offerWeek, itemForm.offerRange, "la oferta");
      if (offerError) { showSectionError("scheduling", offerError); return; }
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

    if (itemForm.availabilityScheduled) {
      const availabilityError = validateWeekSchedule(
        itemForm.availabilityWeek, itemForm.availabilityRange, "la disponibilidad",
      );
      if (availabilityError) { showSectionError("scheduling", availabilityError); return; }
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
                ? toApiDateRange(itemForm.offerRange)
                : { from: null, to: null },
              offerSchedule: itemForm.offerScheduled
                ? { enabled: true, ...itemForm.offerWeek }
                : { enabled: false, ...emptyWeekRanges() },
            }),
        code: itemForm.code.trim(),
        available: itemForm.available,
        hidden: itemForm.hidden,
        recommended: itemForm.recommended,
        options: optionsObj,
        // Si un plan pago venció, el horario guardado queda intacto e inactivo:
        // editar otro campo no debe borrarlo ni intentar volver a habilitarlo.
        ...(canScheduleItems || !itemForm.availabilityScheduled
          ? {
              availabilitySchedule: itemForm.availabilityScheduled
                ? {
                    enabled: true,
                    ...itemForm.availabilityWeek,
                    dateRange: toApiDateRange(itemForm.availabilityRange),
                  }
                : { enabled: false, ...emptyWeekRanges(), dateRange: { from: null, to: null } },
            }
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
      const savedCategoria = activeCategoria;
      await refetch();
      notifySuccess(activeItem ? "Producto actualizado." : "Producto creado.");
      setInitialItemForm(cloneItemForm(itemForm));
      const savedId = activeItem?._id ?? (typeof data._id === "string" ? data._id : null);
      if (isDesktop && savedId) {
        // Creado desde una categoría plegada: se despliega para verlo.
        if (savedCategoria) {
          unfoldCategory(savedCategoria._id, menuData ? findCategory(menuData, savedCategoria._id)?.sectionKey : undefined);
        }
        setFlashItemId(savedId);
      }
      if (andNew && savedCategoria) openNewItem(savedCategoria);
      else setView("menu");
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

  // El formulario abierto en el panel lateral (escritorio) puede ser el mismo
  // producto que se está cambiando desde la fila: se sincroniza el valor para
  // que guardar después no revierta el cambio ni lo marque como pendiente.
  const syncOpenItemFlags = useCallback((itemId: string, patch: Partial<ItemFormState>) => {
    if (view !== "item-form" || activeItem?._id !== itemId) return;
    setItemForm(form => ({ ...form, ...patch }));
    setInitialItemForm(form => ({ ...form, ...patch }));
  }, [view, activeItem]);

  const toggleItemAvailable = useCallback(async (item: Item) => {
    const available = !item.available;
    // Actualización optimista en el estado local
    setMenuData(prev => prev && patchMenuItem(prev, item._id, { available }));
    syncOpenItemFlags(item._id, { available });
    try {
      const res = await fetch(`/api/items/${item._id}/available`, {
        method: "PATCH", headers: authHeaders,
        body: JSON.stringify({ available }),
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
      notifySuccess(available ? "Producto activado." : "Producto pausado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la disponibilidad.");
      await refetch(); // Revertir
    }
  }, [authHeaders, refetch, notifySuccess, setError, logout, syncOpenItemFlags]);

  // Mostrar/ocultar un producto en la carta pública sin abrir el formulario.
  const toggleItemHidden = useCallback(async (item: Item) => {
    const hidden = !item.hidden;
    setMenuData(prev => prev && patchMenuItem(prev, item._id, { hidden }));
    syncOpenItemFlags(item._id, { hidden });
    try {
      const res = await fetch(`/api/items/${item._id}/hidden`, {
        method: "PATCH", headers: authHeaders,
        body: JSON.stringify({ hidden }),
      });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo cambiar la visibilidad.");
      }
      notifySuccess(hidden ? "Producto oculto de la carta." : "Producto visible en la carta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la visibilidad.");
      await refetch(); // Revertir
    }
  }, [authHeaders, refetch, notifySuccess, setError, logout, syncOpenItemFlags]);

  // Duplica un producto (POST /items/:id/duplicate): la copia queda en la
  // misma categoría, debajo del original, como "Copia de ..." y con el código
  // del original + "-COPIA". Con `openCopy` (formulario del celular) se sigue
  // editando la copia.
  const duplicateItem = useCallback(async (item: Item, cat: Categoria | null, { openCopy = false } = {}) => {
    // Mismo tope del plan que al crear un producto (el backend lo vuelve a
    // chequear: esto evita el pedido y ofrece mejorar el plan).
    if (limits && limits.itemLimit != null && limits.itemCount >= limits.itemLimit) {
      setUpgradeReason("items");
      return;
    }
    setDuplicatingId(item._id);
    try {
      const res = await fetch(`/api/items/${item._id}/duplicate`, { method: "POST", headers: authHeaders });
      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // El tope se alcanzó desde otra pestaña/dispositivo: mismo modal.
        if (res.status === 403 && /límite/i.test(data.message ?? "")) {
          await refetch();
          setUpgradeReason("items");
          return;
        }
        throw new Error(data.message || "No se pudo duplicar el producto.");
      }
      const copy = data as Item;
      await refetch();
      notifySuccess(openCopy ? "Producto duplicado. Estás editando la copia." : "Producto duplicado.");
      if (openCopy && cat) openEditItem(copy, cat);
      else if (isDesktop) setFlashItemId(copy._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo duplicar el producto.");
    } finally {
      setDuplicatingId(null);
    }
  }, [limits, authHeaders, logout, refetch, notifySuccess, openEditItem, isDesktop, setError]);

  // ── Selección múltiple ──────────────────────────────────────────────────
  // Se marcan productos y, desde sus casillas, secciones y categorías enteras.
  // Marcar una categoría marca también sus productos; una sección, sus
  // categorías y todos sus productos. Desmarcar algo de adentro desmarca a
  // quien lo contiene: un contenedor marcado está siempre marcado entero, así
  // que las acciones sobre él (ocultar, eliminar) valen para todo lo que tiene.

  // Dónde está cada cosa, para desmarcar contenedores (ver toggleSelectItem).
  const menuParents = useMemo(() => {
    const sectionOfCat = new Map<string, string>();
    const catOfItem = new Map<string, string>();
    menuData?.secciones.forEach(sec => sec.categorias.forEach(cat => sectionOfCat.set(cat._id, sec._id)));
    if (menuData) {
      allCategories(menuData).forEach(cat => (cat.items ?? []).forEach(item => catOfItem.set(item._id, cat._id)));
    }
    return { sectionOfCat, catOfItem };
  }, [menuData]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => !prev);
    setSelection(EMPTY_SELECTION);
  }, []);

  const toggleSelectItem = useCallback((id: string) => {
    setSelection(prev => {
      const items = new Set(prev.items);
      let menus = prev.menus;
      if (items.has(id)) {
        items.delete(id);
        const catId = menuParents.catOfItem.get(id);
        const sectionId = catId ? menuParents.sectionOfCat.get(catId) : undefined;
        if ((catId && menus.has(catId)) || (sectionId && menus.has(sectionId))) {
          menus = new Set(menus);
          if (catId) menus.delete(catId);
          if (sectionId) menus.delete(sectionId);
        }
      } else {
        items.add(id);
      }
      return { items, menus };
    });
  }, [menuParents]);

  // Marca un grupo entero (sus secciones/categorías y sus productos) o, si ya
  // estaba marcado, lo desmarca junto con los contenedores de más arriba
  // (`parentIds`), que dejan de estar enteros.
  const toggleSelectGroup = useCallback((menuIds: string[], itemIds: string[], parentIds: string[] = []) => {
    setSelection(prev => {
      const { checked } = groupCheckState(prev, menuIds, itemIds);
      const items = new Set(prev.items);
      const menus = new Set(prev.menus);
      if (checked) {
        itemIds.forEach(id => items.delete(id));
        [...menuIds, ...parentIds].forEach(id => menus.delete(id));
      } else {
        itemIds.forEach(id => items.add(id));
        menuIds.forEach(id => menus.add(id));
      }
      return { items, menus };
    });
  }, []);

  // Lo que marca la casilla de una categoría, de una sección o de un grupo de
  // categorías ("Sin sección", todo el menú). Sin canSelectMenus (backend
  // anterior) solo se marcan productos.
  const categoryGroup = useCallback((cat: Categoria) => ({
    menuIds: canSelectMenus ? [cat._id] : [],
    itemIds: (cat.items ?? []).map(item => item._id),
  }), [canSelectMenus]);

  const categoriesGroup = (categorias: Categoria[], sectionId?: string) => ({
    menuIds: canSelectMenus ? [...(sectionId ? [sectionId] : []), ...categorias.map(cat => cat._id)] : [],
    itemIds: categorias.flatMap(cat => (cat.items ?? []).map(item => item._id)),
  });

  const toggleSelectAllInCat = useCallback((cat: Categoria) => {
    const { menuIds, itemIds } = categoryGroup(cat);
    const sectionId = menuParents.sectionOfCat.get(cat._id);
    toggleSelectGroup(menuIds, itemIds, sectionId ? [sectionId] : []);
  }, [categoryGroup, menuParents, toggleSelectGroup]);

  // Casilla de una categoría: no se muestra (fuera del modo selección o sin
  // nada que marcar), vacía, a medias o marcada.
  const categorySelectionState = (cat: Categoria): CategorySelectionState => {
    const { menuIds, itemIds } = categoryGroup(cat);
    if (!selectionMode || (menuIds.length === 0 && itemIds.length === 0)) return "hidden";
    const { checked, indeterminate } = groupCheckState(selection, menuIds, itemIds);
    return checked ? "on" : indeterminate ? "partial" : "off";
  };

  // Casilla de una sección (o de "Sin sección"): la sección, todas sus
  // categorías y todos sus productos.
  const groupSelection = (categorias: Categoria[], sectionId?: string): GroupSelection | undefined => {
    const { menuIds, itemIds } = categoriesGroup(categorias, sectionId);
    if (!selectionMode || (menuIds.length === 0 && itemIds.length === 0)) return undefined;
    return {
      ...groupCheckState(selection, menuIds, itemIds),
      onToggle: () => toggleSelectGroup(menuIds, itemIds),
    };
  };

  // ── Acciones en lote ────────────────────────────────────────────────────
  // El backend acepta hasta BULK_CHUNK_SIZE ids por pedido: una selección más
  // grande ("Seleccionar todo" en una carta grande) se manda en tandas y se
  // suman los resultados.
  const sendInChunks = useCallback(async (
    url: string,
    method: "PATCH" | "POST",
    key: "itemIds" | "menuIds",
    ids: string[],
    body: Record<string, unknown> | undefined,
    failureFallback: string,
  ) => {
    let updated = 0;
    let failed = 0;
    for (let start = 0; start < ids.length; start += BULK_CHUNK_SIZE) {
      const res = await fetch(url, {
        method, headers: authHeaders,
        body: JSON.stringify({ ...body, [key]: ids.slice(start, start + BULK_CHUNK_SIZE) }),
      });
      const data = await parseApiResponse(res, failureFallback);
      updated += Number(data.updatedCount ?? data.deletedCount ?? data.deletedMenus ?? 0);
      failed += Array.isArray(data.failedIds) ? data.failedIds.length : 0;
    }
    return { updated, failed };
  }, [authHeaders, parseApiResponse]);

  // Corre una acción sobre la selección: recarga el menú aunque falle a mitad
  // de camino (lo anterior ya se aplicó), avisa y sale del modo selección.
  // `task` devuelve el aviso de éxito, o un error si algo no se aplicó.
  const runBulk = useCallback(async (
    task: () => Promise<{ message: string; error?: string }>,
    failureFallback: string,
  ) => {
    if (selectedIds.size === 0 && selectedMenuIds.size === 0) return;
    setBulkBusy(true);
    try {
      let result: { message: string; error?: string };
      try {
        result = await task();
      } finally {
        await refetch();
      }
      if (result.error) setError(result.error);
      else notifySuccess(result.message);
      setSelection(EMPTY_SELECTION);
      setSelectionMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : failureFallback);
    } finally {
      setBulkBusy(false);
      setBulkDeleteConfirmOpen(false);
    }
  }, [selectedIds, selectedMenuIds, refetch, notifySuccess, setError]);

  // Activar/pausar: solo productos (las secciones y categorías no tienen
  // disponibilidad).
  const bulkSetAvailable = useCallback((available: boolean) => runBulk(async () => {
    const { updated, failed } = await sendInChunks(
      "/api/items/bulk/available", "PATCH", "itemIds", Array.from(selectedIds), { available },
      "No se pudo cambiar la disponibilidad.",
    );
    const label = available ? (updated === 1 ? "activado" : "activados") : (updated === 1 ? "pausado" : "pausados");
    return itemsOutcome(updated, failed, label);
  }, "No se pudo cambiar la disponibilidad."), [runBulk, sendInChunks, selectedIds]);

  // Mostrar/ocultar: las secciones y categorías marcadas y los productos.
  const bulkSetHidden = useCallback((hidden: boolean) => runBulk(async () => {
    const fallback = "No se pudo cambiar la visibilidad.";
    const menuIds = Array.from(selectedMenuIds);
    const menusResult = menuIds.length > 0
      ? await sendInChunks("/api/menus/bulk/hidden", "PATCH", "menuIds", menuIds, { hidden }, fallback)
      : { updated: 0, failed: 0 };
    const itemIds = Array.from(selectedIds);
    const itemsResult = itemIds.length > 0
      ? await sendInChunks("/api/items/bulk/hidden", "PATCH", "itemIds", itemIds, { hidden }, fallback)
      : { updated: 0, failed: 0 };

    const verb = hidden ? "Se ocultaron" : "Se mostraron";
    const parts = [
      menusResult.updated > 0 && countLabel(menusResult.updated, "sección o categoría", "secciones y categorías"),
      itemsResult.updated > 0 && countLabel(itemsResult.updated, "producto", "productos"),
    ].filter(Boolean);
    const message = parts.length > 0 ? `${verb} ${parts.join(" y ")}.` : "No había nada para cambiar.";
    if (itemsResult.failed === 0) return { message };
    return { message, error: `${message} ${countLabel(itemsResult.failed, "producto", "productos")} no se pudo actualizar.` };
  }, "No se pudo cambiar la visibilidad."), [runBulk, sendInChunks, selectedIds, selectedMenuIds]);

  // Qué se elimina: secciones, categorías y productos marcados, y si la
  // opción de Configuración no deja eliminar contenedores con contenido, por
  // qué no se puede.
  const bulkDeletePlan = useMemo(() => {
    const sectionIds = (menuData?.secciones ?? []).filter(sec => selectedMenuIds.has(sec._id)).map(sec => sec._id);
    const categories = menuData ? allCategories(menuData).filter(cat => selectedMenuIds.has(cat._id)) : [];
    let blocked = false;
    if (!limits?.deleteMenusWithContent && menuData) {
      // Sin la opción, solo se eliminan vacías: una categoría sin productos y
      // una sección cuyas categorías también se eliminan.
      blocked = categories.some(cat => (cat.items ?? []).length > 0)
        || menuData.secciones.some(sec => selectedMenuIds.has(sec._id)
          && sec.categorias.some(cat => !selectedMenuIds.has(cat._id)));
    }
    // Productos que no caen con su categoría o sección (se eliminan aparte).
    const looseItemIds = Array.from(selectedIds).filter(id => {
      const catId = menuParents.catOfItem.get(id);
      const sectionId = catId ? menuParents.sectionOfCat.get(catId) : undefined;
      return !(catId && selectedMenuIds.has(catId)) && !(sectionId && selectedMenuIds.has(sectionId));
    });
    return {
      sectionIds,
      categoryIds: categories.map(cat => cat._id),
      itemCount: selectedIds.size,
      looseItemIds,
      blocked,
    };
  }, [menuData, selectedIds, selectedMenuIds, menuParents, limits?.deleteMenusWithContent]);

  // Eliminar: primero las categorías y después las secciones (así una sección
  // cuyas categorías también se eliminan ya está vacía cuando le toca, aun
  // repartida en tandas), y al final los productos que no cayeron con ellas.
  const bulkDelete = useCallback(() => runBulk(async () => {
    const fallback = "No se pudo eliminar.";
    const { sectionIds, categoryIds, looseItemIds } = bulkDeletePlan;
    let menus = 0;
    let items = 0;
    for (const ids of [categoryIds, sectionIds]) {
      if (ids.length === 0) continue;
      for (let start = 0; start < ids.length; start += BULK_CHUNK_SIZE) {
        const res = await fetch("/api/menus/bulk/delete", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ menuIds: ids.slice(start, start + BULK_CHUNK_SIZE) }),
        });
        const data = await parseApiResponse(res, fallback);
        menus += Number(data.deletedMenus ?? 0);
        items += Number(data.deletedItems ?? 0);
      }
    }
    const itemsResult = looseItemIds.length > 0
      ? await sendInChunks("/api/items/bulk/delete", "POST", "itemIds", looseItemIds, undefined, fallback)
      : { updated: 0, failed: 0 };
    items += itemsResult.updated;

    const parts = [
      menus > 0 && countLabel(menus, "sección o categoría", "secciones y categorías"),
      items > 0 && countLabel(items, "producto", "productos"),
    ].filter(Boolean);
    const message = parts.length > 0 ? `Se eliminaron ${parts.join(" y ")}.` : "No había nada para eliminar.";
    if (itemsResult.failed === 0) return { message };
    return { message, error: `${message} ${countLabel(itemsResult.failed, "producto", "productos")} no se pudo eliminar.` };
  }, "No se pudo eliminar."), [runBulk, bulkDeletePlan, authHeaders, parseApiResponse, sendInChunks]);

  // ── Ocultar/mostrar secciones y categorías ─────────────────────────────
  // Una sección o categoría oculta sale de la carta pública con todo su
  // contenido (el backend no sirve lo que cuelga de ella). Los productos
  // conservan su propio `hidden`: al volver a mostrarla reaparecen como
  // estaban.

  const patchMenuHidden = useCallback(async (menuId: string, hidden: boolean) => {
    const res = await fetch(`/api/menus/${menuId}/hidden`, {
      method: "PATCH", headers: authHeaders,
      body: JSON.stringify({ hidden }),
    });
    if (res.status === 401) {
      logout();
      window.location.href = "/login";
      throw new Error("Tu sesión expiró.");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "No se pudo cambiar la visibilidad.");
    }
  }, [authHeaders, logout]);

  // Desde el formulario: solo pega si lo elegido difiere de lo guardado.
  const syncMenuHidden = async (menuId: string | undefined, current: boolean, wanted: boolean) => {
    if (!menuId || current === wanted) return;
    await patchMenuHidden(menuId, wanted);
  };

  const toggleMenuHidden = useCallback(async (kind: "seccion" | "categoria", node: Seccion | Categoria) => {
    const hidden = !node.hidden;
    setMenuData(prev => prev && patchMenuNode(prev, node._id, { hidden }));
    // Si ese mismo nodo está abierto en el formulario, sigue el cambio para
    // que guardar después no lo revierta.
    if (kind === "categoria") {
      setCategoriaForm(form => form.editingId === node._id ? { ...form, hidden } : form);
    } else {
      setSeccionForm(form => form.editingId === node._id ? { ...form, hidden } : form);
    }
    const label = kind === "seccion" ? "Sección" : "Categoría";
    try {
      await patchMenuHidden(node._id, hidden);
      notifySuccess(hidden ? `${label} oculta de la carta, con todo su contenido.` : `${label} visible en la carta.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la visibilidad.");
      await refetch(); // Revertir
    }
  }, [patchMenuHidden, notifySuccess, setError, refetch]);

  const toggleSeccionHidden = useCallback((sec: Seccion) => toggleMenuHidden("seccion", sec), [toggleMenuHidden]);
  const toggleCategoriaHidden = useCallback((cat: Categoria) => toggleMenuHidden("categoria", cat), [toggleMenuHidden]);

  // ── Handlers CATEGORÍAS ───────────────────────────────────────────────────

  // `seccionID`: desde el "+ categoría" de una sección, ya elegida en el form.
  const openNewCategoria = useCallback((seccionID = "") => {
    setCategoriaForm({ title: "", description: "", code: "", seccionID, editingId: "", hidden: false });
    setError("");
    setFormSeq(seq => seq + 1);
    setView("categoria-form");
  }, [setError]);

  const openEditCategoria = useCallback((cat: Categoria) => {
    setCategoriaForm({ title: cat.title, description: cat.description || "", code: cat.code || "", seccionID: "", editingId: cat._id, hidden: cat.hidden === true });
    setError("");
    setFormSeq(seq => seq + 1);
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
      const saved = await res.json().catch(() => ({})) as { _id?: string; hidden?: boolean };
      await syncMenuHidden(categoriaForm.editingId || saved._id, saved.hidden === true, categoriaForm.hidden);
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
    setSeccionForm({ title: "", code: "", editingId: "", hidden: false });
    setError("");
    setFormSeq(seq => seq + 1);
    setView("seccion-form");
  }, [setError]);

  const openEditSeccion = useCallback((sec: Seccion) => {
    setSeccionForm({ title: sec.title, code: sec.code || "", editingId: sec._id, hidden: sec.hidden === true });
    setError("");
    setFormSeq(seq => seq + 1);
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
      const saved = await res.json().catch(() => ({})) as { _id?: string; hidden?: boolean };
      await syncMenuHidden(seccionForm.editingId || saved._id, saved.hidden === true, seccionForm.hidden);
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
  const schedulingSummary = itemForm.offerScheduled
    ? itemForm.availabilityScheduled ? "Oferta y disponibilidad programadas" : "Oferta programada"
    : itemForm.availabilityScheduled ? "Disponibilidad programada" : "Sin programación";
  const availabilitySummary = `${itemForm.available ? "Disponible" : "Pausado"} · ${itemForm.hidden ? "Oculto" : "Visible"}`;

  // Cerrar el panel, abrir otro producto o crear algo nuevo pasa por acá: con
  // cambios sin guardar se pide confirmación y la acción queda en espera.
  const runGuarded = (action: () => void) => {
    if (view === "item-form" && imageUploading) {
      setError("Esperá a que termine de subir la imagen antes de salir.");
      return;
    }
    if (itemFormDirty) {
      pendingLeaveRef.current = action;
      setDiscardModalOpen(true);
      return;
    }
    action();
  };

  const requestCloseItemForm = () => runGuarded(() => setView("menu"));

  const cancelDiscard = () => {
    pendingLeaveRef.current = null;
    setDiscardModalOpen(false);
  };

  const confirmDiscard = () => {
    const pending = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setDiscardModalOpen(false);
    if (pending) pending(); else setView("menu");
  };

  // Versión estable de runGuarded: las filas del tablero están memorizadas y
  // no deberían volver a renderizarse con cada tecla del formulario abierto.
  const runGuardedRef = useRef(runGuarded);
  useLayoutEffect(() => { runGuardedRef.current = runGuarded; });
  const guarded = useCallback((action: () => void) => runGuardedRef.current(action), []);

  const editItemFromBoard = useCallback(
    (item: Item, cat: Categoria) => guarded(() => openEditItem(item, cat)), [guarded, openEditItem]);
  const newItemFromBoard = useCallback(
    (cat: Categoria) => guarded(() => openNewItem(cat)), [guarded, openNewItem]);
  const editCategoriaFromBoard = useCallback(
    (cat: Categoria) => guarded(() => openEditCategoria(cat)), [guarded, openEditCategoria]);
  const deleteCategoriaFromBoard = useCallback(
    (cat: Categoria) => setDeleteModal({ type: "categoria", id: cat._id, name: cat.title }), []);
  const duplicateItemFromBoard = useCallback(
    (item: Item, cat: Categoria) => void duplicateItem(item, cat), [duplicateItem]);
  const editSeccionFromBoard = useCallback(
    (sec: Seccion) => guarded(() => openEditSeccion(sec)), [guarded, openEditSeccion]);
  // "+ categoría" de una sección: la nueva categoría ya va a esa sección.
  const newCategoriaInSection = useCallback(
    (secId: string) => guarded(() => openNewCategoria(secId)), [guarded, openNewCategoria]);
  // Menú sin secciones ni categorías: crear está en el tablero, junto a
  // "Elegir desde plantilla" (emptyMenuState), y no en el encabezado ni en el
  // menú de acciones.
  const menuIsEmpty = !!menuData && menuData.secciones.length === 0 && menuData.sinSeccion.length === 0;

  const workspaceCounts = useMemo(() => countWorkspaceItems(menuData), [menuData]);
  // Secciones ocultas: sus categorías tampoco se ven en la carta.
  const hiddenSectionIds = useMemo(
    () => new Set((menuData?.secciones ?? []).filter(sec => sec.hidden).map(sec => sec._id)),
    [menuData]);

  // Un solo cálculo por menú y filtro: con "Todos" cada categoría conserva la
  // misma referencia de items, así las tarjetas memorizadas no se recalculan.
  const filteredItems = useMemo(() => {
    const byCategoria = new Map<string, Item[]>();
    if (!menuData) return byCategoria;
    const categorias = [...menuData.secciones.flatMap(seccion => seccion.categorias), ...menuData.sinSeccion];
    for (const categoria of categorias) {
      byCategoria.set(categoria._id, statusFilter === "all"
        ? categoria.items
        : (categoria.items ?? []).filter(item => matchesWorkspaceFilter(item, statusFilter)));
    }
    return byCategoria;
  }, [menuData, statusFilter]);

  const categoryCount = menuData
    ? menuData.sinSeccion.length + menuData.secciones.reduce((total, seccion) => total + seccion.categorias.length, 0)
    : 0;

  // ── Plegar secciones y categorías (escritorio) ─────────────────────────

  const toggleSeccionCollapsed = useCallback((secId: string) => setCollapsedSecs(prev => toggleInSet(prev, secId)), []);
  const toggleCategoriaCollapsed = useCallback((cat: Categoria) => setCollapsedCats(prev => toggleInSet(prev, cat._id)), []);

  const collapseAll = useCallback(() => {
    if (!menuData) return;
    setCollapsedSecs(new Set(menuData.secciones.map(sec => sec._id)));
    setCollapsedCats(new Set(allCategories(menuData).map(cat => cat._id)));
  }, [menuData]);

  const expandAll = useCallback(() => {
    setCollapsedSecs(new Set());
    setCollapsedCats(new Set());
  }, []);

  // Despliega una categoría y su sección (para mostrar algo que está adentro).
  // Devuelve si había algo plegado.
  const revealCategory = useCallback((catId: string) => {
    const sectionKey = menuData ? findCategory(menuData, catId)?.sectionKey : undefined;
    const wasHidden = collapsedCats.has(catId) || (sectionKey != null && collapsedSecs.has(sectionKey));
    unfoldCategory(catId, sectionKey);
    return wasHidden;
  }, [menuData, collapsedCats, collapsedSecs, unfoldCategory]);

  const scrollToCategory = useCallback((catId: string) => {
    setFocusedCatId(catId);
    setSearchQuery("");
    // Mientras dura el desplazamiento, el observador no pisa la categoría
    // elegida (al final de la página la de arriba nunca es la buscada).
    jumpLockRef.current = Date.now() + 900;
    // Plegada (ella o su sección): se despliega. Si no, y el filtro la dejó
    // fuera del tablero, se vuelve a "Todos" para poder mostrarla.
    const wasFolded = revealCategory(catId);
    if (!wasFolded && !document.getElementById(`ws-cat-${catId}`)) setStatusFilter("all");
    // Dos cuadros: el primero deja que se dibuje lo recién desplegado.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`ws-cat-${catId}`)?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }));
  }, [revealCategory]);

  // Categoría "actual" del tablero: la primera visible bajo el encabezado.
  useEffect(() => {
    if (!isDesktop || searchActive) return;
    const board = boardRef.current;
    if (!board) return;
    const cards = Array.from(board.querySelectorAll<HTMLElement>("[data-cat-id]"));
    if (cards.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.catId;
        if (!id) continue;
        if (entry.isIntersecting) visible.add(id); else visible.delete(id);
      }
      if (Date.now() < jumpLockRef.current) return;
      const first = cards.find(card => visible.has(card.dataset.catId ?? ""));
      if (first?.dataset.catId) setFocusedCatId(first.dataset.catId);
    }, { rootMargin: "-160px 0px -55% 0px" });

    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [isDesktop, searchActive, menuData, statusFilter, view]);

  // Producto recién guardado: se resalta un momento y se trae a la vista.
  // Quien lo marca despliega antes su categoría si estaba plegada (ver
  // unfoldCategory).
  useEffect(() => {
    if (!flashItemId) return;
    boardRef.current
      ?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(flashItemId)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    const timer = window.setTimeout(() => setFlashItemId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [flashItemId]);

  // Atajos del espacio de trabajo: guardar, cerrar el panel y buscar.
  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isDesktop || event.defaultPrevented) return;
    if (menuSheetOpen || discardModalOpen || deleteModal || bulkDeleteConfirmOpen || upgradeReason) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    const typing = !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    const panelOpen = view === "item-form" || view === "categoria-form" || view === "seccion-form";

    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
      if (!panelOpen) return;
      event.preventDefault();
      if (saving || imageUploading) return;
      if (view === "item-form") void saveItem();
      else if (view === "categoria-form") void saveCategoria();
      else void saveSeccion();
      return;
    }

    if (event.key === "Escape" && panelOpen && target !== searchInputRef.current) {
      event.preventDefault();
      if (view === "item-form") requestCloseItemForm();
      else setView("menu");
      return;
    }

    if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      searchInputRef.current?.focus();
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleShortcut(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  // ── Vista image-manager ──────────────────────────────────────────────────

  if (view === "image-manager") {
    return <ImageManager onBack={() => setView("menu")} onSuccess={refetch} />;
  }

  // ── Vista template-picker ─────────────────────────────────────────────────

  if (view === "template-picker") {
    return <MenuTemplatePicker onBack={() => setView("menu")} onSuccess={refetch} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loading && limits?.canEditMenu === false) {
    return <main className={styles.me}><p>El editor de menú no está incluido en tu plan actual.</p></main>;
  }

  const panelOpen = view === "item-form" || view === "categoria-form" || view === "seccion-form";
  const errorBanner = error ? <div className={styles.errorBanner} role="alert">{error}</div> : null;
  const publicMenuUrl = user?.slug ? `/${user.slug}/menu` : null;

  // Manijas para ordenar: con un backend que sabe ordenar y fuera de la
  // selección múltiple. Con un filtro se ven pero no arrastran: no hay forma
  // de saber dónde quedarían los productos que el filtro esconde.
  const reorderAvailable = limits?.canReorder === true && !selectionMode;
  const reorderDisabledReason = statusFilter !== "all" ? "Quitá el filtro para cambiar el orden." : null;
  const draggingKind = reorder.active?.kind ?? null;

  // ── Bloques compartidos por el flujo móvil y el de escritorio ─────────────

  const searchResultsSection = (
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
                onClick={() => guarded(() => openEditItem(item, categoria))}
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
  );

  const emptyMenuState = menuIsEmpty && (
    <div className={styles.emptyState}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#272420" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="12" y2="16" />
      </svg>
      <p>Tu menú está vacío.</p>
      <p className={styles.emptySub}>Creá una sección o categoría para empezar a agregar productos.</p>
      {/* Mientras el menú está vacío, crear categoría/sección vive acá (no en
          el encabezado ni en el menú de acciones). */}
      <div className={styles.emptyActions}>
      
      <button
        type="button"
        className={styles.sheetOption}
        onClick={() => guarded(openNewSeccion)}
      >
        <span className={styles.sheetOptionIcon}>{icons.layers}</span>
        <span className={styles.sheetOptionText}>
          <span className={styles.sheetOptionTitle}>Nueva sección</span>
          <span className={styles.sheetOptionDesc}>Agrupa categorías, ej: Comidas</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.sheetOption}
        onClick={() => guarded(() => openNewCategoria())}
      >
        <span className={styles.sheetOptionIcon}>{icons.folder}</span>
        <span className={styles.sheetOptionText}>
          <span className={styles.sheetOptionTitle}>Nueva categoría</span>
          <span className={styles.sheetOptionDesc}>Agrupa productos, ej: Pizzas</span>
        </span>
      </button>
      <button
        type="button"
        className={`${styles.sheetOption} ${!limits?.canUseTemplates ? styles.sheetOptionLocked : ""}`}
        onClick={() => {
          if (!limits?.canUseTemplates) { setUpgradeReason("templates"); return; }
          setView("template-picker");
        }}
      >
        <span className={styles.sheetOptionIcon}>
          {limits?.canUseTemplates ? icons.sparkles : icons.lock}
        </span>
        <span className={styles.sheetOptionText}>
          <span className={styles.sheetOptionTitle}>
            Elegir desde plantilla
            {!limits?.canUseTemplates && <span className={styles.sheetOptionPro}>VER PLANES</span>}
          </span>
          <span className={styles.sheetOptionDesc}>Cargá productos ya armados y editalos después</span>
        </span>
      </button>
      </div>
    </div>
  );

  const menuSheet = menuSheetOpen && (
    <div
      className={styles.modalOverlay}
      onClick={() => setMenuSheetOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-sheet-title"
    >
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <p id="menu-sheet-title" className={styles.sheetTitle}>Agregar al menú</p>

        {!menuIsEmpty && <>
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
        </>}

        <button
          className={`${styles.sheetOption} ${!limits?.canUseTemplates ? styles.sheetOptionLocked : ""}`}
          type="button"
          onClick={() => {
            setMenuSheetOpen(false);
            if (!limits?.canUseTemplates) { setUpgradeReason("templates"); return; }
            setView("template-picker");
          }}
        >
          <span className={styles.sheetOptionIcon}>
            {limits?.canUseTemplates ? icons.sparkles : icons.lock}
          </span>
          <span className={styles.sheetOptionText}>
            <span className={styles.sheetOptionTitle}>
              Elegir desde plantilla
              {!limits?.canUseTemplates && <span className={styles.sheetOptionPro}>VER PLANES</span>}
            </span>
            <span className={styles.sheetOptionDesc}>Cargá productos ya armados y editalos después</span>
          </span>
        </button>

        <button
          className={`${styles.sheetOption} ${!limits?.canUseImageManager ? styles.sheetOptionLocked : ""}`}
          type="button"
          onClick={() => {
            setMenuSheetOpen(false);
            if (!limits?.canUseImageManager) { setUpgradeReason("images"); return; }
            setView("image-manager");
          }}
        >
          <span className={styles.sheetOptionIcon}>
            {limits?.canUseImageManager ? icons.images : icons.lock}
          </span>
          <span className={styles.sheetOptionText}>
            <span className={styles.sheetOptionTitle}>
              Gestor de imágenes
              {!limits?.canUseImageManager && <span className={styles.sheetOptionPro}>VER PLANES</span>}
            </span>
            <span className={styles.sheetOptionDesc}>Subí varias fotos y asignalas a tus productos</span>
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
  );

  /* Móvil: portal a document.body, mismo motivo que UpgradeModal — sin esto
     el dock de navegación mobile (position:fixed a nivel raíz del layout)
     tapa esta barra pese al z-index.
     Escritorio: va dentro del editor, pegada debajo de su encabezado (ver
     .bulkBarDocked); así ocupa solo el ancho del editor y no pisa la barra
     lateral del panel. */
  // "Seleccionar todo": todo el menú (secciones, categorías y productos), sin
  // importar filtros ni qué esté plegado (mismo criterio que la casilla de
  // sección).
  const allGroup = menuData
    ? categoriesGroup(allCategories(menuData))
    : { menuIds: [] as string[], itemIds: [] as string[] };
  if (menuData && canSelectMenus) allGroup.menuIds.unshift(...menuData.secciones.map(sec => sec._id));
  const allSelected = groupCheckState(selection, allGroup.menuIds, allGroup.itemIds).checked;
  const hasSelection = selectedIds.size > 0 || selectedMenuIds.size > 0;
  // Hay algo para seleccionar: productos o, con canSelectMenus, secciones o
  // categorías aunque todavía no tengan productos.
  const canStartSelection = totalItems > 0
    || (canSelectMenus && (categoryCount > 0 || (menuData?.secciones.length ?? 0) > 0));
  const selectionParts = [
    bulkDeletePlan.sectionIds.length > 0 && countLabel(bulkDeletePlan.sectionIds.length, "sección", "secciones"),
    bulkDeletePlan.categoryIds.length > 0 && countLabel(bulkDeletePlan.categoryIds.length, "categoría", "categorías"),
    selectedIds.size > 0 && countLabel(selectedIds.size, "producto", "productos"),
  ].filter(Boolean);
  const selectionSummary = selectionParts.join(" · ") || "Nada seleccionado";

  const bulkBarToolbar = selectionMode && (
    <div
      className={`${styles.bulkBar} ${isDesktop ? ws.bulkBarDocked : ""}`}
      role="toolbar"
      aria-label="Acciones sobre lo seleccionado"
    >
      <div className={styles.bulkBarLead}>
        <span className={styles.bulkBarCount}>{selectionSummary}</span>
        {(allGroup.menuIds.length > 0 || allGroup.itemIds.length > 0) && (
          <button
            type="button"
            className={styles.bulkBarBtn}
            disabled={bulkBusy}
            onClick={() => toggleSelectGroup(allGroup.menuIds, allGroup.itemIds)}
          >
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
        )}
      </div>
      <div className={styles.bulkBarActions}>
        <button
          type="button"
          className={styles.bulkBarBtn}
          disabled={selectedIds.size === 0 || bulkBusy}
          onClick={() => bulkSetAvailable(true)}
        >
          Activar
        </button>
        <button
          type="button"
          className={styles.bulkBarBtn}
          disabled={selectedIds.size === 0 || bulkBusy}
          onClick={() => bulkSetAvailable(false)}
        >
          Pausar
        </button>
        <button
          type="button"
          className={styles.bulkBarBtn}
          disabled={!hasSelection || bulkBusy}
          onClick={() => bulkSetHidden(false)}
        >
          Mostrar
        </button>
        <button
          type="button"
          className={styles.bulkBarBtn}
          disabled={!hasSelection || bulkBusy}
          onClick={() => bulkSetHidden(true)}
        >
          Ocultar
        </button>
        <button
          type="button"
          className={`${styles.bulkBarBtn} ${styles.bulkBarBtnDanger}`}
          disabled={!hasSelection || bulkBusy || limits?.disableMenuDelete === true}
          title={limits?.disableMenuDelete ? "Eliminar deshabilitado desde Configuración" : undefined}
          onClick={() => setBulkDeleteConfirmOpen(true)}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
  const bulkBar = bulkBarToolbar && (isDesktop ? bulkBarToolbar : createPortal(bulkBarToolbar, document.body));

  const dialogs = (
    <>
      {/* ══ MODAL: DESCARTAR CAMBIOS DEL PRODUCTO ══ */}
      {discardModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={cancelDiscard}
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
              <button className={styles.modalCancel} onClick={cancelDiscard} type="button" autoFocus>
                Seguir editando
              </button>
              <button
                className={styles.modalConfirm}
                onClick={confirmDiscard}
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
                : limits?.deleteMenusWithContent
                  ? deleteModal.type === "categoria"
                    ? "La categoría se eliminará de forma permanente, con todos sus productos. Esta acción no se puede deshacer."
                    : "La sección se eliminará de forma permanente, con todas sus categorías y productos. Esta acción no se puede deshacer."
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

      {/* ══ MODAL: ELIMINAR PRODUCTOS SELECCIONADOS ══ */}
      {bulkDeleteConfirmOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => !bulkBusy && setBulkDeleteConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-modal-title"
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p id="bulk-delete-modal-title" className={styles.modalTitle}>
              {bulkDeletePlan.blocked ? "No se puede eliminar" : "¿Eliminar lo seleccionado?"}
            </p>
            <p className={styles.modalDesc}>
              {bulkDeletePlan.blocked
                ? "Algunas de las secciones o categorías seleccionadas tienen contenido, y solo se pueden eliminar vacías. Para eliminarlas con todo lo que tienen adentro, activá \"Eliminar secciones y categorías con contenido\" en Configuración."
                : `Se va a eliminar de forma permanente: ${selectionParts.join(", ")}. Esta acción no se puede deshacer.`}
            </p>
            <div className={styles.modalBtns}>
              <button
                className={styles.modalCancel}
                onClick={() => setBulkDeleteConfirmOpen(false)}
                type="button"
                disabled={bulkBusy}
                autoFocus={bulkDeletePlan.blocked}
              >
                {bulkDeletePlan.blocked ? "Entendido" : "Cancelar"}
              </button>
              {!bulkDeletePlan.blocked && (
                <button className={styles.modalConfirm} onClick={bulkDelete} type="button" disabled={bulkBusy} autoFocus>
                  {bulkBusy ? <><Spinner /> Eliminando...</> : "Eliminar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DE UPGRADE (límite de productos / importador Excel / gestor de imágenes) ══ */}
      {upgradeReason && (
        <UpgradeModal
          currentPlan={effectiveSubscription}
          minPlan={upgradeReason === "images" ? "pro" : "basic"}
          requiredFeature={
            upgradeReason === "excel" ? "carga_masiva_excel"
            : upgradeReason === "pdf" ? "menu_pdf"
            : upgradeReason === "images" ? "image_manager"
            : upgradeReason === "templates" ? "menu_templates"
            : upgradeReason === "items" ? undefined
            : "programacion_productos"
          }
          minimumItems={upgradeReason === "items" ? (limits?.itemCount ?? totalItems) + 1 : undefined}
          title={upgradeReason === "items" ? `Llegaste al límite de ${limits?.itemLimit ?? "tu plan"} productos` : "Esta función no está incluida en tu plan"}
          description="Consultá los planes disponibles con esta capacidad. Los precios y beneficios corresponden al catálogo vigente."
          onClose={() => setUpgradeReason(null)}
        />
      )}
    </>
  );

  const itemFormBody = view === "item-form" && (
    <>
      {/* En el panel de escritorio, el encabezado ya dice "Nuevo producto":
          el resumen solo aporta al editar uno existente. */}
      {(!isDesktop || activeItem) && (
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
      )}

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
        <label htmlFor="item-code">
          Código interno {!limits?.autoGenerateCodes && <span className={styles.requiredMark} aria-hidden="true">*</span>}
        </label>
        <input
          id="item-code"
          type="text"
          placeholder={limits?.autoGenerateCodes ? "Se genera solo si lo dejás vacío" : "Ej: pizza-napo"}
          value={itemForm.code}
          onChange={e => {
            setItemForm(f => ({ ...f, code: e.target.value }));
            setItemFieldErrors(previous => ({ ...previous, code: undefined }));
          }}
          required={!limits?.autoGenerateCodes}
          aria-invalid={Boolean(itemFieldErrors.code)}
          aria-describedby={itemFieldErrors.code ? "item-code-error" : "item-code-hint"}
        />
        {itemFieldErrors.code
          ? <span id="item-code-error" className={styles.fieldError}>{itemFieldErrors.code}</span>
          : <span id="item-code-hint" className={styles.fieldHint}>
              {limits?.autoGenerateCodes
                ? "Dejalo vacío para que se genere uno automáticamente, o escribí el tuyo."
                : "Usalo para identificar el producto dentro del editor."}
            </span>}
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
        title="Programación del producto"
        summary={schedulingSummary}
        expanded={openItemSections.has("scheduling")}
        onToggle={() => toggleItemSection("scheduling")}
      >
      <p className={styles.emptyHint}>
        Cargá el horario una sola vez y prendé los días en los que se aplica.
        Si además querés acotarlo a una temporada, agregá un rango de fechas.
      </p>

      {/* Oferta programada */}
      <section className={styles.scheduleCard} aria-labelledby="offer-schedule-title">
        <div className={styles.scheduleHeader}>
          <div>
            <div className={styles.scheduleTitleRow}>
              <p id="offer-schedule-title" className={styles.toggleLabel}>Programar oferta</p>
              {!canScheduleOffers && <span className={styles.schedulePlan}>VER PLANES</span>}
            </div>
            <p className={styles.toggleDesc}>El precio de oferta se activa y se desactiva solo, en los días y horarios que elijas.</p>
          </div>
          <Toggle
            checked={itemForm.offerScheduled}
            onChange={() => {
              if (!canScheduleOffers && !itemForm.offerScheduled) {
                setUpgradeReason("offer");
                return;
              }
              setItemForm(f => ({
                ...f,
                offerScheduled: !f.offerScheduled,
                offerWeek: !f.offerScheduled && !hasAnyRange(f.offerWeek) ? defaultWeekRanges() : f.offerWeek,
              }));
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
          <>
            {!itemForm.offerPrice && (
              <p className={styles.scheduleInactive}>
                Falta el precio de oferta: cargalo en «Variantes y promociones» para que la programación tenga efecto.
              </p>
            )}
            <WeeklySchedule
              key={"offer-week-" + (activeItem?._id ?? "nuevo")}
              value={itemForm.offerWeek}
              onChange={next => setItemForm(f => ({ ...f, offerWeek: next }))}
              idPrefix="offer-week"
              timeLabel="Horario de la oferta"
              emptyLabel="Elegí al menos un día para la oferta."
            />
            <ScheduleDateRange
              value={itemForm.offerRange}
              onChange={next => setItemForm(f => ({ ...f, offerRange: next }))}
              idPrefix="offer"
              hint="Opcional. Sin fechas, la oferta se repite todas las semanas en esos días y horarios."
            />
            <p className={styles.scheduleHint}>
              Horario de Argentina. Fuera de la programación se muestra el precio original.
            </p>
          </>
        )}
      </section>

      {/* Disponibilidad programada */}
      <section className={styles.scheduleCard} aria-labelledby="item-schedule-title">
        <div className={styles.scheduleHeader}>
          <div>
            <div className={styles.scheduleTitleRow}>
              <p id="item-schedule-title" className={styles.toggleLabel}>Programar disponibilidad</p>
              {!canScheduleItems && <span className={styles.schedulePlan}>VER PLANES</span>}
            </div>
            <p className={styles.toggleDesc}>Mostrá el producto solo en los días y horarios que elijas.</p>
          </div>
          <Toggle
            checked={itemForm.availabilityScheduled}
            onChange={() => {
              if (!canScheduleItems && !itemForm.availabilityScheduled) {
                setUpgradeReason("schedule");
                return;
              }
              setItemForm(f => ({
                ...f,
                availabilityScheduled: !f.availabilityScheduled,
                availabilityWeek: !f.availabilityScheduled && !hasAnyRange(f.availabilityWeek)
                  ? defaultWeekRanges()
                  : f.availabilityWeek,
              }));
            }}
            label="Programar disponibilidad"
          />
        </div>

        {itemForm.availabilityScheduled && !canScheduleItems && (
          <p className={styles.scheduleInactive}>
            El horario guardado está inactivo con el plan Free. Podés desactivarlo o mejorar el plan para volver a usarlo.
          </p>
        )}

        {itemForm.availabilityScheduled && canScheduleItems && (
          <>
            <WeeklySchedule
              key={"availability-week-" + (activeItem?._id ?? "nuevo")}
              value={itemForm.availabilityWeek}
              onChange={next => setItemForm(f => ({ ...f, availabilityWeek: next }))}
              idPrefix="availability-week"
              timeLabel="Horario disponible"
              emptyLabel="Elegí al menos un día para la disponibilidad."
            />
            <ScheduleDateRange
              value={itemForm.availabilityRange}
              onChange={next => setItemForm(f => ({ ...f, availabilityRange: next }))}
              idPrefix="availability"
              hint="Opcional. Sin fechas, la disponibilidad se repite todas las semanas."
            />
            <p className={styles.scheduleHint}>
              Horario de Argentina. Fuera de la programación el producto aparece como no disponible.
            </p>
          </>
        )}
      </section>
      </FormSection>

      <FormSection
        number={4}
        title="Disponibilidad y visibilidad"
        summary={availabilitySummary}
        expanded={openItemSections.has("availability")}
        onToggle={() => toggleItemSection("availability")}
      >
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

      {/* En escritorio los resultados siguen a la vista en el tablero. */}
      {searchActive && !isDesktop && (
        <button className={styles.backToResults} type="button" onClick={requestCloseItemForm}>
          Volver a resultados
        </button>
      )}

      <div className={`${styles.formBtns} ${isDesktop && !activeItem ? styles.formBtnsTriple : ""}`}>
        <button
          className={styles.cancelBtn}
          type="button"
          onClick={requestCloseItemForm}
          disabled={saving || imageUploading}
        >
          Cancelar
        </button>
        {/* Cargar una carta entera es el caso más pesado del editor: en
            escritorio, crear y seguir con el siguiente producto de la misma
            categoría evita volver al tablero en cada alta. */}
        {isDesktop && !activeItem && (
          <button
            className={styles.saveNextBtn}
            type="button"
            disabled={saving || imageUploading}
            onClick={() => void saveItem({ andNew: true })}
          >
            Crear y seguir
          </button>
        )}
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
          {/* En escritorio se duplica desde la fila del tablero. La copia sale
              de lo guardado: con cambios pendientes se pide confirmar antes. */}
          {!isDesktop && (
            <button
              className={styles.duplicateBtn}
              type="button"
              disabled={saving || imageUploading || duplicatingId === activeItem._id}
              aria-busy={duplicatingId === activeItem._id}
              onClick={() => runGuarded(() => void duplicateItem(activeItem, activeCategoria, { openCopy: true }))}
            >
              {duplicatingId === activeItem._id ? <><Spinner /> Duplicando...</> : "Duplicar producto"}
            </button>
          )}
          <button
            className={styles.deleteBtn}
            type="button"
            disabled={limits?.disableMenuDelete === true}
            title={limits?.disableMenuDelete ? "Eliminar deshabilitado desde Configuración" : undefined}
            onClick={() => setDeleteModal({ type: "item", id: activeItem._id, name: activeItem.title })}
          >
            {limits?.disableMenuDelete ? "Eliminar deshabilitado desde Configuración" : "Eliminar producto"}
          </button>
        </div>
      )}
      </form>
    </>
  );

  const categoriaFormFields = view === "categoria-form" && (
    <>
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
          placeholder={limits?.autoGenerateCodes ? "Se genera solo si lo dejás vacío" : "Ej: pizzas"}
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
      <div className={styles.toggleGroup}>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Ocultar</p>
            <p className={styles.toggleDesc}>La categoría y sus productos no aparecen en la carta pública</p>
          </div>
          <Toggle
            checked={categoriaForm.hidden}
            onChange={() => setCategoriaForm(f => ({ ...f, hidden: !f.hidden }))}
            label="Ocultar categoría"
          />
        </div>
      </div>
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
    </>
  );

  const seccionFormFields = view === "seccion-form" && (
    <>
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
          placeholder={limits?.autoGenerateCodes ? "Se genera solo si lo dejás vacío" : "Ej: comidas"}
          value={seccionForm.code}
          onChange={e => setSeccionForm(f => ({ ...f, code: e.target.value }))}
        />
      </div>
      <div className={styles.toggleGroup}>
        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Ocultar</p>
            <p className={styles.toggleDesc}>La sección, sus categorías y productos no aparecen en la carta pública</p>
          </div>
          <Toggle
            checked={seccionForm.hidden}
            onChange={() => setSeccionForm(f => ({ ...f, hidden: !f.hidden }))}
            label="Ocultar sección"
          />
        </div>
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
    </>
  );

  // ── Escritorio: estructura, tablero y panel de edición a la vez ───────────

  if (isDesktop) {
    const panelTitle = view === "item-form"
      ? (activeItem ? "Editar producto" : "Nuevo producto")
      : view === "categoria-form"
        ? (categoriaForm.editingId ? "Editar categoría" : "Nueva categoría")
        : view === "seccion-form"
          ? (seccionForm.editingId ? "Editar sección" : "Nueva sección")
          : "Resumen del menú";

    const visibleCategorias = (categorias: Categoria[]) => categorias.filter(
      cat => statusFilter === "all" || (filteredItems.get(cat._id)?.length ?? 0) > 0);

    // Menú vacío (sin secciones, categorías ni productos): no hay columna de
    // estructura ni resumen del menú, solo el tablero, y el panel cuando se
    // abre un formulario (crear una sección o una categoría). Aparecen con la
    // primera sección o categoría.
    const menuEmpty = !menuData || (menuData.secciones.length === 0 && menuData.sinSeccion.length === 0);

    // Sin la columna de estructura, las secciones y categorías se ordenan en
    // el tablero.
    const structureOnBoard = !isWideDesktop || menuEmpty;

    const renderCategoria = (cat: Categoria, sectionKey: string) => {
      const props = {
        cat,
        sectionKey,
        sectionHidden: hiddenSectionIds.has(sectionKey),
        items: filteredItems.get(cat._id) ?? cat.items,
        activeItemId: view === "item-form" ? activeItem?._id ?? null : null,
        flashItemId,
        editing: view === "categoria-form" && categoriaForm.editingId === cat._id,
        atItemLimit,
        deleteDisabled: limits?.disableMenuDelete === true,
        selectionMode,
        selectedIds,
        catSelection: categorySelectionState(cat),
        onEditCat: editCategoriaFromBoard,
        onDeleteCat: deleteCategoriaFromBoard,
        onToggleCatHidden: toggleCategoriaHidden,
        onNewItem: newItemFromBoard,
        onEditItem: editItemFromBoard,
        onToggleAvailable: toggleItemAvailable,
        onToggleHidden: toggleItemHidden,
        onDuplicateItem: duplicateItemFromBoard,
        duplicatingId,
        onToggleSelectItem: toggleSelectItem,
        onToggleSelectAllInCat: toggleSelectAllInCat,
        collapsed: collapsedCats.has(cat._id),
        onToggleCollapsed: toggleCategoriaCollapsed,
      };
      return structureOnBoard
        ? <SortableWorkspaceCategory key={cat._id} {...props} />
        : <WorkspaceCategory key={cat._id} {...props} />;
    };

    const looseCategorias = menuData ? visibleCategorias(menuData.sinSeccion) : [];
    // "Sin sección" aparece también vacía mientras se arrastra una categoría
    // en el tablero, para poder sacarla de su sección.
    const showLooseGroup = looseCategorias.length > 0 || (structureOnBoard && draggingKind === "category");
    const nothingMatchesFilter = statusFilter !== "all" && totalItems > 0 && workspaceCounts[statusFilter] === 0;

    // Categoría que se está arrastrando en el tablero: si entra a una sección
    // plegada se sigue dibujando (sola), porque dnd-kit necesita su nodo
    // hasta que se suelta.
    const draggingCatId = structureOnBoard && reorder.active?.kind === "category" ? reorder.active.id : null;

    const boardSections = menuData?.secciones.map(sec => {
      const collapsed = collapsedSecs.has(sec._id);
      const visibles = visibleCategorias(sec.categorias)
        .filter(cat => !collapsed || cat._id === draggingCatId);
      return (
        <BoardSection
          key={sec._id}
          seccion={sec}
          title={sec.title}
          categoryCount={sec.categorias.length}
          categoryIds={visibles.map(cat => cat._id)}
          structure={structureOnBoard}
          showHeader
          emptyText={!collapsed && sec.categorias.length === 0 ? (
            <button type="button" className={ws.addButton} onClick={() => newCategoriaInSection(sec._id)}>
              <FolderPlus size={15} strokeWidth={1.8} aria-hidden="true" /> Categoría
            </button>
          ) : null}
          onAddCategory={() => newCategoriaInSection(sec._id)}
          collapsed={collapsed}
          onToggleCollapsed={() => toggleSeccionCollapsed(sec._id)}
          selection={groupSelection(sec.categorias, sec._id)}
          onToggleHidden={() => toggleSeccionHidden(sec)}
          onEdit={() => editSeccionFromBoard(sec)}
          onDelete={() => setDeleteModal({ type: "seccion", id: sec._id, name: sec.title })}
          deleteDisabled={limits?.disableMenuDelete === true}
        >
          {visibles.map(cat => renderCategoria(cat, sec._id))}
        </BoardSection>
      );
    });

    return (
      <MenuReorderProvider reorder={reorder} available={reorderAvailable} disabledReason={reorderDisabledReason}>
      <div className={`${styles.me} ${styles.meWide} ${ws.shell} ${selectionMode ? ws.shellBulk : ""}`}>
        <header className={ws.header}>
          <div className={ws.headerTitle}>
            <h1>Menú</h1>
            <span>
              {totalItems} producto{totalItems !== 1 ? "s" : ""}
              {limits?.itemLimit != null ? ` de ${limits.itemLimit}` : ""}
              {" · "}{categoryCount} categoría{categoryCount !== 1 ? "s" : ""}
            </span>
          </div>

          <div className={ws.search} role="search">
            <Search size={17} strokeWidth={1.8} className={ws.searchIcon} aria-hidden="true" />
            <label className="sr-only" htmlFor="menu-search-desktop">Buscar en el menú</label>
            <input
              ref={searchInputRef}
              id="menu-search-desktop"
              className={ws.searchInput}
              type="search"
              placeholder="Buscar producto, categoría o código"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              autoComplete="off"
            />
            {searchQuery
              ? (
                <button
                  type="button"
                  className={ws.searchClear}
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                >
                  Limpiar
                </button>
              )
              : <kbd className={ws.searchKbd} aria-hidden="true">/</kbd>}
          </div>

          <div className={ws.headerActions}>
            {canStartSelection && (
              <button
                type="button"
                className={ws.headerButton}
                aria-pressed={selectionMode}
                onClick={() => guarded(() => { setView("menu"); toggleSelectionMode(); })}
                title={selectionMode ? "Cancelar selección" : "Seleccionar varios"}
              >
                <CheckSquare size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className={ws.buttonLabel}>{selectionMode ? "Cancelar selección" : "Seleccionar"}</span>
              </button>
            )}
            {/* Con el menú vacío, crear está en el tablero (emptyMenuState). */}
            {!menuIsEmpty && <>
            <button
              type="button"
              className={ws.headerButton}
              onClick={() => guarded(openNewSeccion)}
              title="Nueva sección"
            >
              <Layers size={17} strokeWidth={1.8} aria-hidden="true" />
              <span className={ws.buttonLabel}>Sección</span>
            </button>
            <button
              type="button"
              className={`${ws.headerButton} ${ws.headerButtonPrimary}`}
              onClick={() => guarded(() => openNewCategoria())}
              title="Nueva categoría"
            >
              <FolderPlus size={17} strokeWidth={1.8} aria-hidden="true" />
              <span className={ws.buttonLabel}>Categoría</span>
            </button>
            </>}
            <button
              type="button"
              className={ws.headerButton}
              onClick={() => setMenuSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuSheetOpen}
              title="Plantillas, imágenes, Excel y PDF"
            >
              <SlidersHorizontal size={17} strokeWidth={1.8} aria-hidden="true" />
              <span className={ws.buttonLabel}>Herramientas</span>
            </button>
          </div>
        </header>

        {bulkBar}

        <div className={`${ws.workspace} ${menuEmpty ? (panelOpen ? ws.workspaceBarePanel : ws.workspaceBare) : ""}`}>
          {/* Solo desde 1280px: más angosto el CSS la ocultaba igual, y sus
              secciones y categorías arrastrables chocarían con las del tablero.
              Sin productos no se muestra (ni el resumen): no hay nada que ver. */}
          {menuData && isWideDesktop && !menuEmpty && (
            <WorkspaceNav
              menu={menuData}
              activeCatId={focusedCatId}
              editingCatId={view === "categoria-form" ? categoriaForm.editingId || null : null}
              onSelectCat={scrollToCategory}
              onEditSeccion={editSeccionFromBoard}
            />
          )}

          <div className={ws.board} ref={boardRef}>
            {!panelOpen && errorBanner}

            {searchActive ? searchResultsSection : (
              <>
                {(totalItems > 0 || categoryCount > 0) && (
                  <div className={ws.boardTools}>
                    <div className={ws.boardToolsRow}>
                      {totalItems > 0 && (
                        <WorkspaceFilters counts={workspaceCounts} value={statusFilter} onChange={setStatusFilter} />
                      )}
                      <WorkspaceFoldControls
                        canCollapse={menuData != null && (
                          menuData.secciones.some(sec => !collapsedSecs.has(sec._id))
                          || allCategories(menuData).some(cat => !collapsedCats.has(cat._id)))}
                        canExpand={menuData != null && (
                          menuData.secciones.some(sec => collapsedSecs.has(sec._id))
                          || allCategories(menuData).some(cat => collapsedCats.has(cat._id)))}
                        onCollapseAll={collapseAll}
                        onExpandAll={expandAll}
                      />
                    </div>
                    {menuData && (
                      <WorkspaceJumpBar menu={menuData} activeCatId={focusedCatId} onSelectCat={scrollToCategory} />
                    )}
                  </div>
                )}

                {structureOnBoard ? (
                  <SortableContext
                    items={(menuData?.secciones ?? []).map(sec => sectionDndId(sec._id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {boardSections}
                  </SortableContext>
                ) : boardSections}

                {showLooseGroup && (
                  <BoardSection
                    seccion={null}
                    title="Sin sección"
                    categoryCount={menuData?.sinSeccion.length ?? 0}
                    categoryIds={looseCategorias.map(cat => cat._id)}
                    structure={structureOnBoard}
                    showHeader={(menuData?.secciones.length ?? 0) > 0}
                    emptyText={null}
                    selection={groupSelection(menuData?.sinSeccion ?? [])}
                  >
                    {looseCategorias.map(cat => renderCategoria(cat, LOOSE_SECTION))}
                  </BoardSection>
                )}

                {nothingMatchesFilter && (
                  <div className={ws.boardEmpty}>
                    Ningún producto coincide con este filtro.
                    <button type="button" className={ws.boardEmptyButton} onClick={() => setStatusFilter("all")}>
                      Ver todos
                    </button>
                  </div>
                )}

                {emptyMenuState}
              </>
            )}
          </div>

          {(panelOpen || !menuEmpty) && <WorkspacePanel
            title={panelTitle}
            subtitle={view === "item-form" ? itemFormBreadcrumb || undefined : undefined}
            status={view === "item-form" && itemFormDirty ? "Sin guardar" : undefined}
            onClose={panelOpen ? (view === "item-form" ? requestCloseItemForm : () => setView("menu")) : undefined}
            bodyKey={`${view}-${formSeq}`}
          >
            {panelOpen ? (
              <div className={styles.panelForm}>
                {errorBanner && <div className={styles.panelError}>{errorBanner}</div>}
                {itemFormBody}
                {categoriaFormFields && <div className={styles.panelFields}>{categoriaFormFields}</div>}
                {seccionFormFields && <div className={styles.panelFields}>{seccionFormFields}</div>}
              </div>
            ) : (
              <WorkspaceOverview
                counts={workspaceCounts}
                categoryCount={categoryCount}
                itemLimit={limits?.itemLimit ?? null}
                filter={statusFilter}
                onFilter={setStatusFilter}
                publicMenuUrl={publicMenuUrl}
              />
            )}
          </WorkspacePanel>}
        </div>

        {menuSheet}
        {dialogs}
      </div>
      </MenuReorderProvider>
    );
  }

  // ── Móvil: una vista por vez ──────────────────────────────────────────────

  const renderAcordeon = (cat: Categoria, sectionKey: string) => (
    <CategoriaAcordeon
      key={cat._id}
      cat={cat}
      sectionKey={sectionKey}
      sectionHidden={hiddenSectionIds.has(sectionKey)}
      expanded={expandedCats.has(cat._id)}
      atItemLimit={atItemLimit}
      deleteDisabled={limits?.disableMenuDelete === true}
      onToggle={() => toggleCat(cat._id)}
      onEditCat={() => openEditCategoria(cat)}
      onDeleteCat={() => setDeleteModal({ type: "categoria", id: cat._id, name: cat.title })}
      onNewItem={() => openNewItem(cat)}
      onEditItem={item => openEditItem(item, cat)}
      onToggleAvailable={toggleItemAvailable}
      selectionMode={selectionMode}
      selectedIds={selectedIds}
      catSelection={categorySelectionState(cat)}
      onToggleSelectItem={toggleSelectItem}
      onToggleSelectAllInCat={toggleSelectAllInCat}
    />
  );

  return (
    <MenuReorderProvider reorder={reorder} available={reorderAvailable} disabledReason={reorderDisabledReason}>
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
              {canStartSelection && (
                <button
                  className={styles.backBtn}
                  onClick={toggleSelectionMode}
                  title={selectionMode ? "Cancelar selección" : "Seleccionar varios"}
                  aria-label={selectionMode ? "Cancelar selección" : "Seleccionar varios"}
                  aria-pressed={selectionMode}
                >
                  {selectionMode ? icons.close : icons.checkSquare}
                </button>
              )}
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

            <div className={`${styles.content} ${selectionMode ? styles.contentBulkPad : ""}`}>
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

              {searchActive ? searchResultsSection : (
                <>
              {/* Secciones */}
              <SortableContext
                items={(menuData?.secciones ?? []).map(sec => sectionDndId(sec._id))}
                strategy={verticalListSortingStrategy}
              >
                {menuData?.secciones.map(sec => (
                  <MobileSeccionBlock
                    key={sec._id}
                    seccion={sec}
                    deleteDisabled={limits?.disableMenuDelete === true}
                    selection={groupSelection(sec.categorias, sec._id)}
                    onAddCategory={() => openNewCategoria(sec._id)}
                    onEdit={() => openEditSeccion(sec)}
                    onDelete={() => setDeleteModal({ type: "seccion", id: sec._id, name: sec.title })}
                  >
                    <MobileCategoryList
                      sectionKey={sec._id}
                      title={sec.title}
                      categorias={sec.categorias}
                      emptyText={
                        <div className={styles.emptyAdd}>
                          <button className={styles.addItemBtn} type="button" onClick={() => openNewCategoria(sec._id)}>
                            + Agregar categoría
                          </button>
                        </div>
                      }
                      renderCategoria={renderAcordeon}
                    />
                  </MobileSeccionBlock>
                ))}
              </SortableContext>

              {/* Categorías sin sección: también vacía mientras se arrastra una
                  categoría, para poder sacarla de su sección. */}
              {((menuData?.sinSeccion?.length ?? 0) > 0 || draggingKind === "category") && (
                <div className={styles.seccionBlock}>
                  <div className={styles.seccionRow}>
                    <div className={styles.seccionLeft}>
                      {(() => {
                        const selection = groupSelection(menuData?.sinSeccion ?? []);
                        return selection && <GroupCheckbox selection={selection} title="las categorías sin sección" />;
                      })()}
                      <span className={`${styles.seccionBadge} ${styles.seccionBadgeDark}`}>
                        Sin sección
                      </span>
                    </div>
                  </div>
                  <MobileCategoryList
                    sectionKey={LOOSE_SECTION}
                    title="Sin sección"
                    categorias={menuData?.sinSeccion ?? []}
                    emptyText={null}
                    renderCategoria={renderAcordeon}
                  />
                </div>
              )}

              {/* Estado vacío */}
              {emptyMenuState}
                </>
              )}
            </div>

            {menuSheet}
            {bulkBar}
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
              {errorBanner}
              {itemFormBody}
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
            <div className={`${styles.content} ${styles.formContent} ${styles.formContentPadded}`}>
              {errorBanner}
              {categoriaFormFields}
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
            <div className={`${styles.content} ${styles.formContent} ${styles.formContentPadded}`}>
              {errorBanner}
              {seccionFormFields}
            </div>
          </>
        )}

        {dialogs}

      </div>
    </MenuReorderProvider>
  );
}
