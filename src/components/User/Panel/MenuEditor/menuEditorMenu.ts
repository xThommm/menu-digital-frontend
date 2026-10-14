import {
  CheckSquare, ChevronsDownUp, ChevronsUpDown, Copy, CopyPlus, ExternalLink, Eye, EyeOff, FileDown, FileSpreadsheet, FileUp,
  FolderInput, FolderPlus, ImageMinus, ImagePlus, Images, Layers, Pause, Pencil, Play, Plus, Sparkles, Star, Trash2,
  Wrench, X,
} from "lucide-react";
import { copySubmenu, openUrlItem, type MenuEnv } from "../../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../../features/contextMenu/types";
import type {
  AdminCategoria as Categoria, AdminItem as Item, AdminMenuData as MenuData, AdminSeccion as Seccion,
} from "../../../../types";
import { formatPrice } from "./Workspace/workspaceFilters.ts";

// Clic derecho en el editor de menú de escritorio: un producto, lo
// seleccionado (en selección múltiple), una categoría, una sección y el fondo
// del tablero. Son las acciones de los botones de cada fila y tarjeta, más
// algunas a mano: destacar, quitar la imagen, copiar datos, ver el producto
// en la carta, mover o duplicar una categoría y pausar todos sus productos.
//
// Eliminar abre el mismo modal de confirmación que el botón. Las acciones de
// la pantalla viajan en el contexto (`actions`), que se arma al hacer clic.

const DELETE_DISABLED = "Eliminar está deshabilitado desde Configuración";

// ── Qué se clickeó ──

export interface MenuLocation {
  item: Item | null;
  cat: Categoria | null;
  /** Sección del producto o la categoría (o la clickeada); null: sin sección. */
  section: Seccion | null;
}

/**
 * Busca en el menú lo que marcan los data-* del elemento clickeado (el
 * tablero usa un solo manejador para todo). Un id que ya no está (se borró
 * desde otra pestaña) no encuentra nada.
 */
export function locateInMenu(
  menu: MenuData,
  { itemId, catId, sectionId }: { itemId?: string | null; catId?: string | null; sectionId?: string | null },
): MenuLocation {
  const places = [
    ...menu.secciones.flatMap((section) => section.categorias.map((cat) => ({ cat, section: section as Seccion | null }))),
    ...menu.sinSeccion.map((cat) => ({ cat, section: null as Seccion | null })),
  ];
  if (itemId) {
    for (const place of places) {
      const item = (place.cat.items ?? []).find((entry) => entry._id === itemId);
      if (item) return { item, ...place };
    }
  }
  if (catId) {
    const place = places.find((entry) => entry.cat._id === catId);
    if (place) return { item: null, ...place };
  }
  const section = sectionId ? menu.secciones.find((entry) => entry._id === sectionId) ?? null : null;
  return { item: null, cat: null, section };
}

/** El producto se ve hoy en la carta pública. */
export const visibleInMenu = ({ item, cat, section }: MenuLocation): boolean =>
  item !== null && item.available && !item.hidden && cat?.hidden !== true && section?.hidden !== true;

// ── Producto ──

export interface ItemMenuActions {
  edit: (item: Item, cat: Categoria) => void;
  duplicate: (item: Item, cat: Categoria) => void;
  toggleAvailable: (item: Item) => void;
  toggleHidden: (item: Item) => void;
  toggleRecommended: (item: Item) => Promise<void>;
  changeImage: (item: Item, cat: Categoria) => void;
  removeImage: (item: Item) => Promise<void>;
  select: (item: Item) => void;
  remove: (item: Item) => void;
}

export interface ItemMenuContext {
  item: Item;
  cat: Categoria;
  /** El producto se ve hoy en la carta (ni él, ni su categoría, ni su sección están ocultos, y no está pausado). */
  visibleInMenu: boolean;
  /** Link de la carta pública (sin el producto); null si el local no tiene slug. */
  publicMenuUrl: string | null;
  duplicating: boolean;
  deleteDisabled: boolean;
  actions: ItemMenuActions;
}

export function buildItemMenu(env: MenuEnv): ContextMenuItem<ItemMenuContext>[] {
  return [
    { id: "edit", label: "Editar", icon: Pencil, run: ({ item, cat, actions }) => actions.edit(item, cat) },
    {
      id: "duplicate",
      label: "Duplicar",
      icon: Copy,
      disabled: ({ duplicating }) => duplicating && "Se está duplicando",
      run: ({ item, cat, actions }) => actions.duplicate(item, cat),
    },
    { type: "separator" },
    {
      id: "available",
      label: ({ item }) => (item.available ? "Pausar (sin stock)" : "Activar"),
      icon: Pause,
      run: ({ item, actions }) => actions.toggleAvailable(item),
    },
    {
      id: "hidden",
      label: ({ item }) => (item.hidden ? "Mostrar en la carta" : "Ocultar de la carta"),
      icon: EyeOff,
      run: ({ item, actions }) => actions.toggleHidden(item),
    },
    {
      id: "recommended",
      label: ({ item }) => (item.recommended ? "Quitar de destacados" : "Marcar como destacado"),
      icon: Star,
      run: ({ item, actions }) => actions.toggleRecommended(item),
      successMessage: ({ item }) => (item.recommended ? "Ya no está entre los destacados." : "Producto destacado."),
      errorMessage: "No se pudo cambiar el destacado.",
    },
    { type: "separator" },
    {
      id: "image",
      label: ({ item }) => (item.image ? "Cambiar imagen" : "Agregar imagen"),
      icon: ImagePlus,
      run: ({ item, cat, actions }) => actions.changeImage(item, cat),
    },
    {
      id: "remove-image",
      label: "Quitar imagen",
      icon: ImageMinus,
      danger: true,
      visible: ({ item }) => Boolean(item.image),
      confirm: ({ item }) => ({
        title: `¿Quitar la imagen de ${item.title}?`,
        message: "El producto queda sin foto en la carta. Podés volver a subir una cuando quieras.",
        confirmLabel: "Quitar imagen",
        danger: true,
      }),
      run: ({ item, actions }) => actions.removeImage(item),
      successMessage: "Imagen quitada.",
      errorMessage: "No se pudo quitar la imagen.",
    },
    copySubmenu<ItemMenuContext>(env, [
      { id: "name", label: "Nombre", value: ({ item }) => item.title, done: "Nombre copiado." },
      { id: "price", label: "Precio", value: ({ item }) => (item.price == null ? null : formatPrice(item.price)), done: "Precio copiado." },
      { id: "code", label: "Código", value: ({ item }) => item.code, done: "Código copiado." },
    ]),
    {
      ...openUrlItem<ItemMenuContext>(env, {
        id: "public",
        label: "Ver en la carta pública",
        icon: ExternalLink,
        url: ({ item, publicMenuUrl }) => (publicMenuUrl ? `${publicMenuUrl}?producto=${encodeURIComponent(item._id)}` : null),
      }),
      disabled: ({ visibleInMenu }) => !visibleInMenu && "No se ve en la carta: está oculto o pausado",
    },
    { id: "select", label: "Seleccionar", icon: CheckSquare, run: ({ item, actions }) => actions.select(item) },
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      disabled: ({ deleteDisabled }) => deleteDisabled && DELETE_DISABLED,
      // Abre el modal de confirmación del editor.
      run: ({ item, actions }) => actions.remove(item),
    },
  ];
}

// ── Selección múltiple ──

export interface SelectionMenuActions {
  toggleItem: (item: Item) => void;
  setAvailable: (available: boolean) => void;
  setHidden: (hidden: boolean) => void;
  remove: () => void;
  cancel: () => void;
}

export interface SelectionMenuContext {
  /** Producto sobre el que se hizo clic, si fue sobre uno. */
  item: Item | null;
  itemSelected: boolean;
  /** Productos marcados (activar y pausar valen solo para productos). */
  selectedItems: number;
  /** Algo marcado: productos, categorías o secciones. */
  hasSelection: boolean;
  busy: boolean;
  deleteDisabled: boolean;
  actions: SelectionMenuActions;
}

const BULK_BUSY = "Se está aplicando un cambio a la selección";
const NOTHING = "No hay nada seleccionado";

export function buildSelectionMenu(): ContextMenuItem<SelectionMenuContext>[] {
  const disabledFor = (needsItems: boolean) => (context: SelectionMenuContext) => {
    if (context.busy) return BULK_BUSY;
    if (needsItems ? context.selectedItems === 0 : !context.hasSelection) return needsItems ? "No hay productos seleccionados" : NOTHING;
    return false;
  };
  return [
    {
      id: "toggle",
      label: ({ itemSelected }) => (itemSelected ? "Deseleccionar este producto" : "Seleccionar este producto"),
      icon: CheckSquare,
      visible: ({ item }) => item !== null,
      run: ({ item, actions }) => actions.toggleItem(item!),
    },
    { type: "separator" },
    { id: "activate", label: "Activar", icon: Play, disabled: disabledFor(true), run: ({ actions }) => actions.setAvailable(true) },
    { id: "pause", label: "Pausar", icon: Pause, disabled: disabledFor(true), run: ({ actions }) => actions.setAvailable(false) },
    { id: "show", label: "Mostrar", icon: Eye, disabled: disabledFor(false), run: ({ actions }) => actions.setHidden(false) },
    { id: "hide", label: "Ocultar", icon: EyeOff, disabled: disabledFor(false), run: ({ actions }) => actions.setHidden(true) },
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar…",
      icon: Trash2,
      danger: true,
      disabled: (context) => (context.deleteDisabled ? DELETE_DISABLED : disabledFor(false)(context)),
      // Abre el modal de confirmación de la eliminación en lote.
      run: ({ actions }) => actions.remove(),
    },
    { id: "cancel", label: "Cancelar selección", icon: X, run: ({ actions }) => actions.cancel() },
  ];
}

// ── Categoría ──

export interface CategoryMenuActions {
  addItem: (cat: Categoria) => void;
  edit: (cat: Categoria) => void;
  toggleHidden: (cat: Categoria) => void;
  setAllAvailable: (cat: Categoria, available: boolean) => Promise<void>;
  move: (cat: Categoria, sectionId: string | null) => Promise<void>;
  duplicate: (cat: Categoria) => Promise<void>;
  selectAll: (cat: Categoria) => void;
  toggleCollapsed: (cat: Categoria) => void;
  remove: (cat: Categoria) => void;
}

export interface CategoryMenuContext {
  cat: Categoria;
  /** Sección donde está (null: sin sección). */
  sectionId: string | null;
  sections: Pick<Seccion, "_id" | "title">[];
  collapsed: boolean;
  atItemLimit: boolean;
  deleteDisabled: boolean;
  actions: CategoryMenuActions;
}

export function buildCategoryMenu(): ContextMenuItem<CategoryMenuContext>[] {
  const items = ({ cat }: CategoryMenuContext) => cat.items ?? [];
  return [
    {
      id: "add-item",
      label: ({ atItemLimit }) => (atItemLimit ? "Agregar producto (mejorar plan)" : "Agregar producto"),
      icon: Plus,
      run: ({ cat, actions }) => actions.addItem(cat),
    },
    { id: "edit", label: "Editar", icon: Pencil, run: ({ cat, actions }) => actions.edit(cat) },
    {
      id: "hidden",
      label: ({ cat }) => (cat.hidden ? "Mostrar en la carta" : "Ocultar de la carta"),
      icon: EyeOff,
      run: ({ cat, actions }) => actions.toggleHidden(cat),
    },
    { type: "separator" },
    {
      id: "pause-all",
      label: "Pausar todos sus productos",
      icon: Pause,
      visible: (context) => items(context).some((item) => item.available),
      run: ({ cat, actions }) => actions.setAllAvailable(cat, false),
      errorMessage: "No se pudieron pausar los productos.",
    },
    {
      id: "activate-all",
      label: "Activar todos sus productos",
      icon: Play,
      visible: (context) => items(context).some((item) => !item.available),
      run: ({ cat, actions }) => actions.setAllAvailable(cat, true),
      errorMessage: "No se pudieron activar los productos.",
    },
    {
      id: "select-all",
      label: "Seleccionar todos sus productos",
      icon: CheckSquare,
      visible: (context) => items(context).length > 0,
      run: ({ cat, actions }) => actions.selectAll(cat),
    },
    {
      type: "submenu",
      id: "move",
      label: "Mover a otra sección",
      icon: FolderInput,
      items: ({ sections, sectionId }) => [
        ...sections.filter((section) => section._id !== sectionId).map((section): ContextMenuItem<CategoryMenuContext> => ({
          id: section._id,
          label: section.title,
          run: ({ cat, actions }) => actions.move(cat, section._id),
          successMessage: ({ cat }) => `${cat.title} pasó a ${section.title}.`,
          errorMessage: "No se pudo mover la categoría.",
        })),
        ...(sectionId !== null ? [
          { type: "separator" } as const,
          {
            id: "none",
            label: "Sin sección",
            run: ({ cat, actions }: CategoryMenuContext) => actions.move(cat, null),
            successMessage: ({ cat }: CategoryMenuContext) => `${cat.title} quedó sin sección.`,
            errorMessage: "No se pudo mover la categoría.",
          },
        ] : []),
      ],
    },
    {
      id: "duplicate",
      label: "Duplicar con sus productos",
      icon: CopyPlus,
      run: ({ cat, actions }) => actions.duplicate(cat),
      successMessage: ({ cat }) => `Categoría duplicada: "Copia de ${cat.title}".`,
      errorMessage: "No se pudo duplicar la categoría.",
    },
    {
      id: "collapse",
      label: ({ collapsed }) => (collapsed ? "Expandir" : "Contraer"),
      icon: ChevronsDownUp,
      run: ({ cat, actions }) => actions.toggleCollapsed(cat),
    },
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      disabled: ({ deleteDisabled }) => deleteDisabled && DELETE_DISABLED,
      run: ({ cat, actions }) => actions.remove(cat),
    },
  ];
}

// ── Sección ──

export interface SectionMenuActions {
  addCategory: (sec: Seccion) => void;
  edit: (sec: Seccion) => void;
  toggleHidden: (sec: Seccion) => void;
  toggleCollapsed: (sec: Seccion) => void;
  remove: (sec: Seccion) => void;
}

export interface SectionMenuContext {
  sec: Seccion;
  collapsed: boolean;
  deleteDisabled: boolean;
  actions: SectionMenuActions;
}

export function buildSectionMenu(): ContextMenuItem<SectionMenuContext>[] {
  return [
    { id: "add-category", label: "Agregar categoría", icon: FolderPlus, run: ({ sec, actions }) => actions.addCategory(sec) },
    { id: "edit", label: "Editar", icon: Pencil, run: ({ sec, actions }) => actions.edit(sec) },
    {
      id: "hidden",
      label: ({ sec }) => (sec.hidden ? "Mostrar en la carta" : "Ocultar de la carta"),
      icon: EyeOff,
      run: ({ sec, actions }) => actions.toggleHidden(sec),
    },
    {
      id: "collapse",
      label: ({ collapsed }) => (collapsed ? "Expandir" : "Contraer"),
      icon: ChevronsDownUp,
      run: ({ sec, actions }) => actions.toggleCollapsed(sec),
    },
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      disabled: ({ deleteDisabled }) => deleteDisabled && DELETE_DISABLED,
      run: ({ sec, actions }) => actions.remove(sec),
    },
  ];
}

// ── Fondo del tablero ──

export interface EditorBoardActions {
  newSection: () => void;
  newCategory: () => void;
  newItem: () => void;
  collapseAll: () => void;
  expandAll: () => void;
  openTemplates: () => void;
  openImageManager: () => void;
  importExcel: () => void;
  exportExcel: () => void;
  exportPdf: () => void;
}

export interface EditorBoardContext {
  hasCategories: boolean;
  canCollapse: boolean;
  canExpand: boolean;
  /** Herramientas que incluye el plan (sin ellas, la opción ofrece mejorar el plan). */
  tools: { templates: boolean; images: boolean; excel: boolean; pdf: boolean };
  /** Exportando a Excel o a PDF. */
  exporting: boolean;
  publicMenuUrl: string | null;
  actions: EditorBoardActions;
}

const locked = (included: boolean, label: string) => (included ? label : `${label} (ver planes)`);

export function buildEditorBoardMenu(env: MenuEnv): ContextMenuItem<EditorBoardContext>[] {
  return [
    { id: "new-section", label: "Nueva sección", icon: Layers, run: ({ actions }) => actions.newSection() },
    { id: "new-category", label: "Nueva categoría", icon: FolderPlus, run: ({ actions }) => actions.newCategory() },
    {
      id: "new-item",
      label: "Nuevo producto",
      icon: Plus,
      disabled: ({ hasCategories }) => !hasCategories && "Primero creá una categoría",
      run: ({ actions }) => actions.newItem(),
    },
    { type: "separator" },
    {
      id: "collapse-all",
      label: "Contraer todo",
      icon: ChevronsDownUp,
      disabled: ({ canCollapse }) => !canCollapse && "Ya está todo contraído",
      run: ({ actions }) => actions.collapseAll(),
    },
    {
      id: "expand-all",
      label: "Expandir todo",
      icon: ChevronsUpDown,
      disabled: ({ canExpand }) => !canExpand && "Ya está todo expandido",
      run: ({ actions }) => actions.expandAll(),
    },
    { type: "separator" },
    {
      type: "submenu",
      id: "tools",
      label: "Herramientas",
      icon: Wrench,
      items: [
        { id: "templates", label: ({ tools }) => locked(tools.templates, "Elegir desde plantilla"), icon: Sparkles, run: ({ actions }) => actions.openTemplates() },
        { id: "images", label: ({ tools }) => locked(tools.images, "Gestor de imágenes"), icon: Images, run: ({ actions }) => actions.openImageManager() },
        { id: "import", label: ({ tools }) => locked(tools.excel, "Importar desde Excel"), icon: FileUp, run: ({ actions }) => actions.importExcel() },
        {
          id: "export",
          label: ({ tools }) => locked(tools.excel, "Exportar a Excel"),
          icon: FileSpreadsheet,
          disabled: ({ exporting }) => exporting && "Exportando",
          run: ({ actions }) => actions.exportExcel(),
        },
        {
          id: "pdf",
          label: ({ tools }) => locked(tools.pdf, "Descargar PDF"),
          icon: FileDown,
          disabled: ({ exporting }) => exporting && "Exportando",
          run: ({ actions }) => actions.exportPdf(),
        },
      ],
    },
    openUrlItem<EditorBoardContext>(env, { id: "public", label: "Ver la carta pública", url: ({ publicMenuUrl }) => publicMenuUrl }),
  ];
}
