import { memo, type CSSProperties, type ReactNode } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowUpRight, Clock, EyeOff, Eye, MousePointerClick, Pencil, Plus, Star, Trash2, X,
} from "lucide-react";
import type {
  AdminItem as Item,
  AdminCategoria as Categoria,
  AdminSeccion as Seccion,
  AdminMenuData as MenuData,
} from "../../../../../types";
import { WORKSPACE_FILTERS, formatPrice, type WorkspaceCounts, type WorkspaceFilter } from "./workspaceFilters";
import DragHandle from "../Reorder/DragHandle";
import { LOOSE_SECTION, categoryDndId, itemDndId, sectionDndId } from "../Reorder/menuReorder";
import { useReorderState } from "../Reorder/reorderContext";
import { useReorderList, useReorderSortable, type ReorderSortable } from "../Reorder/useReorderSortable";
import rs from "../Reorder/Reorder.module.css";
import ws from "./MenuWorkspace.module.css";

// Piezas del editor de menú en escritorio: estructura (izquierda), tablero
// de categorías (centro) y panel de edición (derecha). El estado y las
// llamadas a la API siguen viviendo en MenuEditor; acá solo hay vista.
//
// Ordenar arrastrando: los productos se arrastran en el tablero. Las
// secciones y las categorías, en la columna de estructura cuando se ve (desde
// 1280px); sin ella, en el tablero (`structure`). Nunca en los dos a la vez:
// dnd-kit necesita un solo elemento por id.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const ICON = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

// Lo que usa un nodo que a veces se arrastra y a veces no.
const NOT_SORTABLE: {
  setNode: undefined;
  style: CSSProperties | undefined;
  isDragging: boolean;
  isOver: boolean;
} = { setNode: undefined, style: undefined, isDragging: false, isOver: false };

// ── Estructura del menú ─────────────────────────────────────────────────────
// Secciones y categorías se ordenan desde su manija; un producto soltado sobre
// una categoría va al final de esa categoría.

interface NavListProps {
  activeCatId: string | null;
  editingCatId: string | null;
  onSelectCat: (catId: string) => void;
}

interface WorkspaceNavProps extends NavListProps {
  menu: MenuData;
  onEditSeccion: (seccion: Seccion) => void;
}

export function WorkspaceNav({ menu, activeCatId, editingCatId, onSelectCat, onEditSeccion }: WorkspaceNavProps) {
  const { activeKind } = useReorderState();
  const listProps = { activeCatId, editingCatId, onSelectCat };
  const empty = menu.secciones.length === 0 && menu.sinSeccion.length === 0;
  // Con una categoría en el aire se muestra también "Sin sección", aunque esté
  // vacía, para poder sacarla de su sección.
  const showLoose = menu.sinSeccion.length > 0 || activeKind === "category";

  return (
    <nav className={ws.nav} aria-label="Estructura del menú">
      <p className={ws.navHeading}>
        Estructura
        {activeKind === "item" && <span className={ws.navHint}>Soltá sobre una categoría</span>}
      </p>
      <div className={ws.navScroll}>
        {empty && <p className={ws.navEmpty}>Todavía no hay categorías.</p>}
        <SortableContext items={menu.secciones.map(seccion => sectionDndId(seccion._id))} strategy={verticalListSortingStrategy}>
          {menu.secciones.map(seccion => (
            <NavSection key={seccion._id} seccion={seccion} onEditSeccion={onEditSeccion} {...listProps} />
          ))}
        </SortableContext>
        {showLoose && (
          <div className={ws.navGroup}>
            <div className={ws.navGroupHeader}>
              <span className={ws.navGroupTitle}>Sin sección</span>
            </div>
            <NavCategoryList sectionKey={LOOSE_SECTION} title="Sin sección" categorias={menu.sinSeccion} {...listProps} />
          </div>
        )}
      </div>
    </nav>
  );
}

function NavSection({ seccion, onEditSeccion, ...listProps }: NavListProps & {
  seccion: Seccion;
  onEditSeccion: (seccion: Seccion) => void;
}) {
  const sortable = useReorderSortable({ kind: "section", id: seccion._id, title: seccion.title, pinned: true });
  const { setNode, style, isDragging } = sortable;

  return (
    <div ref={setNode} style={style} className={cx(ws.navGroup, isDragging && rs.placeholder)}>
      <div className={ws.navGroupHeader}>
        <DragHandle sortable={sortable} label={`Mover la sección ${seccion.title}`} className={ws.navHandle} iconSize={14} />
        <span className={ws.navGroupTitle}>{seccion.title}</span>
        <button
          type="button"
          className={ws.navGroupEdit}
          onClick={() => onEditSeccion(seccion)}
          aria-label={`Editar la sección ${seccion.title}`}
          title="Editar sección"
        >
          <Pencil {...ICON} size={13} />
        </button>
      </div>
      <NavCategoryList sectionKey={seccion._id} title={seccion.title} categorias={seccion.categorias} {...listProps} />
    </div>
  );
}

function NavCategoryList({ sectionKey, title, categorias, ...listProps }: NavListProps & {
  sectionKey: string;
  title: string;
  categorias: Categoria[];
}) {
  const { activeKind } = useReorderState();
  const { setNode, isOver } = useReorderList({ kind: "category-list", sectionKey, title, pinned: true });

  return (
    <div ref={setNode} className={ws.navList}>
      <SortableContext items={categorias.map(cat => categoryDndId(cat._id))} strategy={verticalListSortingStrategy}>
        {categorias.map(cat => (
          <NavCategory key={cat._id} cat={cat} sectionKey={sectionKey} {...listProps} />
        ))}
      </SortableContext>
      {categorias.length === 0 && (activeKind === "category"
        ? <p className={cx(rs.dropZone, isOver && rs.dropZoneOver)}>Soltá la categoría acá</p>
        : <p className={ws.navEmpty}>Sin categorías</p>)}
    </div>
  );
}

function NavCategory({ cat, sectionKey, activeCatId, editingCatId, onSelectCat }: NavListProps & {
  cat: Categoria;
  sectionKey: string;
}) {
  const { activeKind } = useReorderState();
  const sortable = useReorderSortable({ kind: "category", id: cat._id, sectionKey, title: cat.title, pinned: true });
  const { setNode, style, isDragging, isOver } = sortable;
  const active = activeCatId === cat._id;

  return (
    <div ref={setNode} style={style} className={cx(ws.navItemRow, isDragging && rs.placeholder)}>
      <DragHandle sortable={sortable} label={`Mover la categoría ${cat.title}`} className={ws.navHandle} iconSize={14} />
      <button
        type="button"
        className={cx(
          ws.navItem,
          active && ws.navItemActive,
          editingCatId === cat._id && ws.navItemEditing,
          isOver && activeKind === "item" && ws.navItemDrop,
        )}
        onClick={() => onSelectCat(cat._id)}
        aria-current={active ? "location" : undefined}
      >
        <span className={ws.navItemName}>{cat.title}</span>
        {cat.hidden && <EyeOff {...ICON} size={13} className={ws.navItemHidden} />}
        <span className={ws.navItemCount}>{cat.items?.length ?? 0}</span>
      </button>
    </div>
  );
}

// Versión compacta para anchos intermedios (sin columna de estructura).
export function WorkspaceJumpBar({ menu, activeCatId, onSelectCat }: {
  menu: MenuData;
  activeCatId: string | null;
  onSelectCat: (catId: string) => void;
}) {
  const categorias = [...menu.secciones.flatMap(seccion => seccion.categorias), ...menu.sinSeccion];
  if (categorias.length < 2) return null;

  return (
    <nav className={ws.jumpBar} aria-label="Ir a una categoría">
      {categorias.map(cat => (
        <button
          key={cat._id}
          type="button"
          className={cx(ws.jumpChip, activeCatId === cat._id && ws.jumpChipActive)}
          onClick={() => onSelectCat(cat._id)}
          aria-current={activeCatId === cat._id ? "location" : undefined}
        >
          {cat.title}
        </button>
      ))}
    </nav>
  );
}

// ── Filtros rápidos ─────────────────────────────────────────────────────────

export function WorkspaceFilters({ counts, value, onChange }: {
  counts: WorkspaceCounts;
  value: WorkspaceFilter;
  onChange: (filter: WorkspaceFilter) => void;
}) {
  return (
    <div className={ws.filters} role="group" aria-label="Filtrar productos">
      {WORKSPACE_FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={cx(ws.filterChip, value === key && ws.filterChipActive)}
          aria-pressed={value === key}
          onClick={() => onChange(value === key && key !== "all" ? "all" : key)}
        >
          {label}
          <span className={ws.filterCount}>{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Título de sección dentro del tablero ────────────────────────────────────

export function WorkspaceSection({ title, categoryCount, onEdit, onDelete, deleteDisabled, handle }: {
  title: string;
  categoryCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  handle?: ReactNode;
}) {
  return (
    <div className={ws.section}>
      {handle}
      <h2 className={ws.sectionTitle}>{title}</h2>
      <span className={ws.sectionMeta}>
        {categoryCount === 0 ? "Sin categorías" : `${categoryCount} categoría${categoryCount !== 1 ? "s" : ""}`}
      </span>
      {(onEdit || onDelete) && (
        <div className={ws.sectionActions}>
          {onEdit && (
            <button type="button" className={ws.iconButton} onClick={onEdit} aria-label={`Editar la sección ${title}`} title="Editar sección">
              <Pencil {...ICON} size={15} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={cx(ws.iconButton, ws.iconButtonDanger)}
              onClick={onDelete}
              disabled={deleteDisabled}
              aria-label={`Eliminar la sección ${title}`}
              title={deleteDisabled ? "Eliminar deshabilitado desde Configuración" : "Eliminar sección"}
            >
              <Trash2 {...ICON} size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sección del tablero con sus categorías ──────────────────────────────────
// Con `structure` (sin la columna de estructura) la sección y sus categorías
// se ordenan acá. `seccion` null es el grupo "Sin sección".

interface BoardSectionProps {
  seccion: Seccion | null;
  title: string;
  categoryCount: number;
  // Las categorías que se dibujan, en orden.
  categoryIds: string[];
  structure: boolean;
  showHeader: boolean;
  emptyText: string | null;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  children: ReactNode;
}

export function BoardSection(props: BoardSectionProps) {
  return props.structure && props.seccion
    ? <SortableBoardSection {...props} seccion={props.seccion} />
    : <BoardSectionBody {...props} sortable={null} />;
}

function SortableBoardSection(props: BoardSectionProps & { seccion: Seccion }) {
  const sortable = useReorderSortable({ kind: "section", id: props.seccion._id, title: props.seccion.title });
  return <BoardSectionBody {...props} sortable={sortable} />;
}

function BoardSectionBody({
  seccion, title, categoryCount, categoryIds, structure, showHeader, emptyText,
  onEdit, onDelete, deleteDisabled, children, sortable,
}: BoardSectionProps & { sortable: ReorderSortable | null }) {
  const { setNode, style, isDragging } = sortable ?? NOT_SORTABLE;
  const sectionKey = seccion?._id ?? LOOSE_SECTION;

  return (
    <div ref={setNode} style={style} className={cx(ws.sectionGroup, isDragging && rs.placeholder)}>
      {showHeader && (
        <WorkspaceSection
          title={title}
          categoryCount={categoryCount}
          onEdit={onEdit}
          onDelete={onDelete}
          deleteDisabled={deleteDisabled}
          handle={sortable && (
            <DragHandle sortable={sortable} label={`Mover la sección ${title}`} className={ws.sectionHandle} />
          )}
        />
      )}
      {structure ? (
        <BoardCategoryList sectionKey={sectionKey} title={title} categoryIds={categoryIds} emptyText={emptyText}>
          {children}
        </BoardCategoryList>
      ) : (
        <>
          {children}
          {categoryIds.length === 0 && emptyText && <p className={ws.boardEmpty}>{emptyText}</p>}
        </>
      )}
    </div>
  );
}

function BoardCategoryList({ sectionKey, title, categoryIds, emptyText, children }: {
  sectionKey: string;
  title: string;
  categoryIds: string[];
  emptyText: string | null;
  children: ReactNode;
}) {
  const { activeKind } = useReorderState();
  const { setNode, isOver } = useReorderList({ kind: "category-list", sectionKey, title });

  return (
    <div ref={setNode} className={ws.sectionCategories}>
      <SortableContext items={categoryIds.map(categoryDndId)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {categoryIds.length === 0 && (activeKind === "category"
        ? <p className={cx(rs.dropZone, isOver && rs.dropZoneOver)}>Soltá la categoría acá</p>
        : emptyText && <p className={ws.boardEmpty}>{emptyText}</p>)}
    </div>
  );
}

// ── Categoría con sus productos ─────────────────────────────────────────────

interface WorkspaceCategoryProps {
  cat: Categoria;
  // Sección donde está (o LOOSE_SECTION): la necesita la categoría arrastrable.
  sectionKey: string;
  items: Item[];
  activeItemId: string | null;
  flashItemId: string | null;
  editing: boolean;
  atItemLimit: boolean;
  deleteDisabled: boolean;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onEditCat: (cat: Categoria) => void;
  onDeleteCat: (cat: Categoria) => void;
  onNewItem: (cat: Categoria) => void;
  onEditItem: (item: Item, cat: Categoria) => void;
  onToggleAvailable: (item: Item) => void;
  onToggleHidden: (item: Item) => void;
  onToggleSelectItem: (id: string) => void;
  onToggleSelectAllInCat: (cat: Categoria) => void;
}

const itemTags = (item: Item) => {
  const tags: string[] = [];
  const variants = Object.keys(item.options || {}).length;
  if (variants > 0) tags.push(`${variants} variante${variants !== 1 ? "s" : ""}`);
  if (item.offerSchedule?.enabled) tags.push("Oferta programada");
  if (item.availabilitySchedule?.enabled) tags.push("Horario programado");
  return tags;
};

function ItemPrice({ item }: { item: Item }) {
  if (item.price == null) {
    return <span className={ws.priceMuted}>{Object.keys(item.options || {}).length > 0 ? "Con variantes" : "Sin precio"}</span>;
  }
  if (item.offerPrice != null) {
    return (
      <>
        <s className={ws.priceOld}>{formatPrice(item.price)}</s>
        <span className={ws.priceOffer}>{formatPrice(item.offerPrice)}</span>
      </>
    );
  }
  return <span className={ws.price}>{formatPrice(item.price)}</span>;
}

// La tarjeta quieta (con la columna de estructura a la vista)...
export const WorkspaceCategory = memo(function WorkspaceCategory(props: WorkspaceCategoryProps) {
  return <WorkspaceCategoryCard {...props} sortable={null} />;
});

// ...y la que se arrastra desde su encabezado (sin la columna).
export const SortableWorkspaceCategory = memo(function SortableWorkspaceCategory(props: WorkspaceCategoryProps) {
  const sortable = useReorderSortable({
    kind: "category", id: props.cat._id, sectionKey: props.sectionKey, title: props.cat.title,
  });
  return <WorkspaceCategoryCard {...props} sortable={sortable} />;
});

// Rendimiento: mientras se arrastra, dnd-kit vuelve a renderizar cada
// elemento arrastrable cada vez que cambia el destino (con una carta grande,
// cientos de filas). Por eso los componentes con hooks de arrastre son una
// envoltura fina, y lo pesado (encabezado de la tarjeta, cuerpo de la fila)
// va en componentes memorizados que en ese momento no cambian.

function WorkspaceCategoryCard({
  cat, items, activeItemId, flashItemId, editing, atItemLimit, deleteDisabled,
  selectionMode, selectedIds, sortable,
  onEditCat, onDeleteCat, onNewItem, onEditItem, onToggleAvailable, onToggleHidden,
  onToggleSelectItem, onToggleSelectAllInCat,
}: WorkspaceCategoryProps & { sortable: ReorderSortable | null }) {
  const { activeKind } = useReorderState();
  const { setNode, style, isDragging, isOver } = sortable ?? NOT_SORTABLE;

  const total = cat.items?.length ?? 0;
  const allSelected = total > 0 && cat.items.every(item => selectedIds.has(item._id));
  const someSelected = cat.items.some(item => selectedIds.has(item._id));
  const titleId = `ws-cat-title-${cat._id}`;
  const meta = [
    total === 0 ? "Sin productos" : `${total} producto${total !== 1 ? "s" : ""}`,
    items.length !== total ? `${items.length} con el filtro` : "",
    cat.hidden ? "Oculta en la carta" : "",
  ].filter(Boolean).join(" · ");

  return (
    <section
      ref={setNode}
      style={style}
      id={`ws-cat-${cat._id}`}
      data-cat-id={cat._id}
      className={cx(
        ws.category,
        // Un producto sobre el encabezado de la tarjeta arrastrable: va al final.
        isOver && activeKind === "item" && ws.categoryDrop,
        editing && ws.categoryEditing,
        isDragging && rs.placeholder,
      )}
      aria-labelledby={titleId}
    >
      <header className={ws.categoryHeader}>
        {sortable && !selectionMode && (
          <DragHandle sortable={sortable} label={`Mover la categoría ${cat.title}`} className={ws.categoryHandle} />
        )}
        {selectionMode && total > 0 && (
          <label className={ws.check}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={() => onToggleSelectAllInCat(cat)}
              aria-label={allSelected ? `Deseleccionar los productos de ${cat.title}` : `Seleccionar los productos de ${cat.title}`}
            />
          </label>
        )}
        <CategoryHeaderMain
          cat={cat}
          titleId={titleId}
          meta={meta}
          atItemLimit={atItemLimit}
          deleteDisabled={deleteDisabled}
          onEditCat={onEditCat}
          onDeleteCat={onDeleteCat}
          onNewItem={onNewItem}
        />
      </header>

      {cat.description && <p className={ws.categoryDescription}>{cat.description}</p>}

      <CategoryItems
        cat={cat}
        items={items}
        total={total}
        activeItemId={activeItemId}
        flashItemId={flashItemId}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onEditItem={onEditItem}
        onToggleAvailable={onToggleAvailable}
        onToggleHidden={onToggleHidden}
        onToggleSelectItem={onToggleSelectItem}
      />
    </section>
  );
}

const CategoryHeaderMain = memo(function CategoryHeaderMain({
  cat, titleId, meta, atItemLimit, deleteDisabled, onEditCat, onDeleteCat, onNewItem,
}: {
  cat: Categoria;
  titleId: string;
  meta: string;
  atItemLimit: boolean;
  deleteDisabled: boolean;
  onEditCat: (cat: Categoria) => void;
  onDeleteCat: (cat: Categoria) => void;
  onNewItem: (cat: Categoria) => void;
}) {
  return (
    <>
      <div className={ws.categoryHeading}>
        <h3 id={titleId} className={ws.categoryTitle}>{cat.title}</h3>
        <span className={ws.categoryMeta}>{meta}</span>
      </div>
      <div className={ws.categoryActions}>
        <button
          type="button"
          className={cx(ws.addButton, atItemLimit && ws.addButtonLimit)}
          onClick={() => onNewItem(cat)}
          title={atItemLimit ? "Llegaste al límite de productos de tu plan" : "Agregar un producto a esta categoría"}
        >
          <Plus {...ICON} />
          {atItemLimit ? "Mejorar plan" : "Producto"}
        </button>
        <button
          type="button"
          className={ws.iconButton}
          onClick={() => onEditCat(cat)}
          aria-label={`Editar ${cat.title}`}
          title="Editar categoría"
        >
          <Pencil {...ICON} size={15} />
        </button>
        <button
          type="button"
          className={cx(ws.iconButton, ws.iconButtonDanger)}
          onClick={() => onDeleteCat(cat)}
          disabled={deleteDisabled}
          aria-label={`Eliminar ${cat.title}`}
          title={deleteDisabled ? "Eliminar deshabilitado desde Configuración" : "Eliminar categoría"}
        >
          <Trash2 {...ICON} size={15} />
        </button>
      </div>
    </>
  );
});

// Los productos de la tarjeta: la lista que recibe lo que se suelta en su
// margen o, vacía, en su lugar. Con un producto encima, la tarjeta se resalta
// (ver .category:has(> .itemsDropTarget) en el CSS).
function CategoryItems({
  cat, items, total, activeItemId, flashItemId, selectionMode, selectedIds,
  onEditItem, onToggleAvailable, onToggleHidden, onToggleSelectItem,
}: {
  cat: Categoria;
  items: Item[];
  total: number;
  activeItemId: string | null;
  flashItemId: string | null;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onEditItem: (item: Item, cat: Categoria) => void;
  onToggleAvailable: (item: Item) => void;
  onToggleHidden: (item: Item) => void;
  onToggleSelectItem: (id: string) => void;
}) {
  const { activeKind } = useReorderState();
  const { setNode, isOver } = useReorderList({ kind: "item-list", catId: cat._id, title: cat.title });

  return (
    <div ref={setNode} className={cx(isOver && activeKind === "item" && ws.itemsDropTarget)}>
      {items.length > 0 ? (
        <div className={ws.rows} role="list" aria-label={`Productos de ${cat.title}`}>
          <SortableContext items={items.map(item => itemDndId(item._id))} strategy={verticalListSortingStrategy}>
            {items.map(item => (
              <WorkspaceItemRow
                key={item._id}
                item={item}
                cat={cat}
                active={activeItemId === item._id}
                flash={flashItemId === item._id}
                selected={selectedIds.has(item._id)}
                selectionMode={selectionMode}
                onEditItem={onEditItem}
                onToggleAvailable={onToggleAvailable}
                onToggleHidden={onToggleHidden}
                onToggleSelectItem={onToggleSelectItem}
              />
            ))}
          </SortableContext>
        </div>
      ) : (
        <p className={ws.categoryEmpty}>
          {total === 0
            ? "Todavía no hay productos. Creá el primero o arrastrá uno desde otra categoría."
            : "Ningún producto de esta categoría coincide con el filtro."}
        </p>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  cat: Categoria;
  active: boolean;
  flash: boolean;
  selected: boolean;
  selectionMode: boolean;
  onEditItem: (item: Item, cat: Categoria) => void;
  onToggleAvailable: (item: Item) => void;
  onToggleHidden: (item: Item) => void;
  onToggleSelectItem: (id: string) => void;
}

// La envoltura arrastrable de la fila (ver la nota de rendimiento de arriba).
const WorkspaceItemRow = memo(function WorkspaceItemRow({
  item, cat, active, flash, selected, selectionMode,
  onEditItem, onToggleAvailable, onToggleHidden, onToggleSelectItem,
}: ItemRowProps) {
  const sortable = useReorderSortable({ kind: "item", id: item._id, catId: cat._id, title: item.title });
  const { setNode, style, isDragging } = sortable;

  return (
    <div
      ref={setNode}
      style={style}
      role="listitem"
      data-item-id={item._id}
      className={cx(
        ws.row,
        active && ws.rowActive,
        flash && ws.rowFlash,
        selected && ws.rowSelected,
        isDragging && ws.rowDragging,
        !item.available && ws.rowPaused,
      )}
    >
      {selectionMode ? (
        <label className={ws.check}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelectItem(item._id)}
            aria-label={`Seleccionar ${item.title}`}
          />
        </label>
      ) : (
        <DragHandle sortable={sortable} label={`Mover ${item.title}`} className={ws.rowHandle} />
      )}
      <WorkspaceItemBody
        item={item}
        cat={cat}
        active={active}
        selectionMode={selectionMode}
        onEditItem={onEditItem}
        onToggleAvailable={onToggleAvailable}
        onToggleHidden={onToggleHidden}
        onToggleSelectItem={onToggleSelectItem}
      />
    </div>
  );
});

const WorkspaceItemBody = memo(function WorkspaceItemBody({
  item, cat, active, selectionMode, onEditItem, onToggleAvailable, onToggleHidden, onToggleSelectItem,
}: Omit<ItemRowProps, "flash" | "selected">) {
  const tags = itemTags(item);

  return (
    <>
      <button
        type="button"
        className={ws.rowMain}
        onClick={() => selectionMode ? onToggleSelectItem(item._id) : onEditItem(item, cat)}
        aria-current={active ? "true" : undefined}
      >
        <span className={ws.thumb}>
          {item.image
            ? <img src={item.image} alt="" loading="lazy" />
            : <span className={ws.thumbEmpty} aria-hidden="true">{item.title.trim().charAt(0) || "·"}</span>}
        </span>
        <span className={ws.rowText}>
          <span className={ws.rowTitle}>
            <span className={ws.rowTitleText}>{item.title}</span>
            {item.recommended && (
              <>
                <Star {...ICON} size={13} className={ws.rowStar} />
                <span className="sr-only">Recomendado</span>
              </>
            )}
          </span>
          {item.description && <span className={ws.rowDescription}>{item.description}</span>}
          {(tags.length > 0 || item.hidden || item.code) && (
            <span className={ws.rowTags}>
              {item.hidden && <span className={cx(ws.tag, ws.tagHidden)}><EyeOff {...ICON} size={12} /> Oculto</span>}
              {tags.map(tag => (
                <span key={tag} className={ws.tag}>
                  {tag.includes("programad") && <Clock {...ICON} size={12} />}
                  {tag}
                </span>
              ))}
              {item.code && <span className={cx(ws.tag, ws.tagCode)}>{item.code}</span>}
            </span>
          )}
        </span>
        <span className={ws.rowPrice}><ItemPrice item={item} /></span>
      </button>

      {!selectionMode && (
        <div className={ws.rowActions}>
          <button
            type="button"
            className={cx(ws.iconButton, ws.visibilityButton)}
            onClick={() => onToggleHidden(item)}
            aria-pressed={item.hidden}
            aria-label={item.hidden ? `Mostrar ${item.title} en la carta` : `Ocultar ${item.title} de la carta`}
            title={item.hidden ? "Mostrar en la carta" : "Ocultar de la carta"}
          >
            {item.hidden ? <EyeOff {...ICON} size={15} /> : <Eye {...ICON} size={15} />}
          </button>
          <button
            type="button"
            className={cx(ws.statusPill, item.available ? ws.statusOn : ws.statusOff)}
            onClick={() => onToggleAvailable(item)}
            aria-label={item.available ? `Pausar ${item.title}` : `Activar ${item.title}`}
            title={item.available ? "Pausar (sin stock)" : "Volver a activar"}
          >
            {item.available ? "Activo" : "Pausado"}
          </button>
        </div>
      )}
    </>
  );
});

// ── Panel lateral ───────────────────────────────────────────────────────────

export function WorkspacePanel({ title, subtitle, status, onClose, bodyKey, children }: {
  title: string;
  subtitle?: string;
  status?: string;
  onClose?: () => void;
  bodyKey?: string;
  children: ReactNode;
}) {
  return (
    <aside className={ws.panel} aria-label={title}>
      <header className={ws.panelHeader}>
        <div className={ws.panelHeading}>
          <h2 className={ws.panelTitle}>{title}</h2>
          {subtitle && <p className={ws.panelSubtitle}>{subtitle}</p>}
        </div>
        {status && <span className={ws.panelStatus} role="status">{status}</span>}
        {onClose && (
          <button type="button" className={ws.panelClose} onClick={onClose} aria-label="Cerrar el panel" title="Cerrar (Esc)">
            <X {...ICON} size={17} />
          </button>
        )}
      </header>
      <div key={bodyKey} className={ws.panelBody}>
        {children}
      </div>
    </aside>
  );
}

const OVERVIEW_STATS: { key: Exclude<WorkspaceFilter, "all">; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "paused", label: "Pausados" },
  { key: "hidden", label: "Ocultos" },
  { key: "noImage", label: "Sin foto" },
  { key: "offer", label: "En oferta" },
];

export function WorkspaceOverview({ counts, categoryCount, itemLimit, filter, onFilter, publicMenuUrl }: {
  counts: WorkspaceCounts;
  categoryCount: number;
  itemLimit: number | null;
  filter: WorkspaceFilter;
  onFilter: (filter: WorkspaceFilter) => void;
  publicMenuUrl: string | null;
}) {
  return (
    <div className={ws.overview}>
      <div className={ws.overviewHero}>
        <span className={ws.overviewIcon}><MousePointerClick {...ICON} size={20} /></span>
        <p className={ws.overviewTitle}>Elegí un producto para editarlo</p>
        <p className={ws.overviewText}>
          El formulario se abre en este panel, sin perder de vista la carta.
          Arrastrá desde la manija para cambiar el orden de productos,
          categorías y secciones, o para pasar un producto a otra categoría.
        </p>
      </div>

      <section aria-labelledby="ws-overview-summary">
        <p id="ws-overview-summary" className={ws.overviewHeading}>Resumen</p>
        <div className={ws.statTotal}>
          <strong>{counts.all}</strong>
          <span>
            producto{counts.all !== 1 ? "s" : ""}{itemLimit != null ? ` de ${itemLimit}` : ""}
            {" · "}{categoryCount} categoría{categoryCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className={ws.statGrid}>
          {OVERVIEW_STATS.map(stat => (
            <button
              key={stat.key}
              type="button"
              className={cx(ws.stat, filter === stat.key && ws.statActive)}
              aria-pressed={filter === stat.key}
              onClick={() => onFilter(filter === stat.key ? "all" : stat.key)}
              title={`Ver solo ${stat.label.toLowerCase()}`}
            >
              <strong>{counts[stat.key]}</strong>
              <span>{stat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {publicMenuUrl && (
        <a className={ws.publicLink} href={publicMenuUrl} target="_blank" rel="noopener noreferrer">
          Ver la carta pública
          <ArrowUpRight {...ICON} />
        </a>
      )}

      <section aria-labelledby="ws-overview-shortcuts">
        <p id="ws-overview-shortcuts" className={ws.overviewHeading}>Atajos de teclado</p>
        <dl className={ws.shortcuts}>
          <div><dt><kbd>/</kbd></dt><dd>Buscar en el menú</dd></div>
          <div><dt><kbd>Ctrl</kbd> <kbd>S</kbd></dt><dd>Guardar el formulario</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>Cerrar el panel</dd></div>
        </dl>
      </section>
    </div>
  );
}
