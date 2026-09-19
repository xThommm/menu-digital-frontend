import { memo, type DragEvent, type ReactNode } from "react";
import {
  ArrowUpRight, Clock, EyeOff, Eye, GripVertical, MousePointerClick, Pencil, Plus, Star, Trash2, X,
} from "lucide-react";
import type {
  AdminItem as Item,
  AdminCategoria as Categoria,
  AdminSeccion as Seccion,
  AdminMenuData as MenuData,
} from "../../../../../types";
import { WORKSPACE_FILTERS, formatPrice, type WorkspaceCounts, type WorkspaceFilter } from "./workspaceFilters";
import ws from "./MenuWorkspace.module.css";

// Piezas del editor de menú en escritorio: estructura (izquierda), tablero
// de categorías (centro) y panel de edición (derecha). El estado y las
// llamadas a la API siguen viviendo en MenuEditor; acá solo hay vista.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const ICON = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

// ── Estructura del menú ─────────────────────────────────────────────────────

interface NavGroup {
  key: string;
  title: string;
  seccion: Seccion | null;
  categorias: Categoria[];
}

const toNavGroups = (menu: MenuData): NavGroup[] => [
  ...menu.secciones.map(seccion => ({ key: seccion._id, title: seccion.title, seccion, categorias: seccion.categorias })),
  ...(menu.sinSeccion.length > 0
    ? [{ key: "sin-seccion", title: "Sin sección", seccion: null, categorias: menu.sinSeccion }]
    : []),
];

interface WorkspaceNavProps {
  menu: MenuData;
  activeCatId: string | null;
  editingCatId: string | null;
  dragOverCat: string | null;
  dragging: boolean;
  onSelectCat: (catId: string) => void;
  onEditSeccion: (seccion: Seccion) => void;
  onDragOver: (event: DragEvent, catId: string) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent, catId: string) => void;
}

export function WorkspaceNav({
  menu, activeCatId, editingCatId, dragOverCat, dragging,
  onSelectCat, onEditSeccion, onDragOver, onDragLeave, onDrop,
}: WorkspaceNavProps) {
  const groups = toNavGroups(menu);

  return (
    <nav className={ws.nav} aria-label="Estructura del menú">
      <p className={ws.navHeading}>
        Estructura
        {dragging && <span className={ws.navHint}>Soltá sobre una categoría</span>}
      </p>
      <div className={ws.navScroll}>
        {groups.length === 0 && <p className={ws.navEmpty}>Todavía no hay categorías.</p>}
        {groups.map(group => (
          <div key={group.key} className={ws.navGroup}>
            <div className={ws.navGroupHeader}>
              <span className={ws.navGroupTitle}>{group.title}</span>
              {group.seccion && (
                <button
                  type="button"
                  className={ws.navGroupEdit}
                  onClick={() => onEditSeccion(group.seccion!)}
                  aria-label={`Editar la sección ${group.title}`}
                  title="Editar sección"
                >
                  <Pencil {...ICON} size={13} />
                </button>
              )}
            </div>
            {group.categorias.length === 0 && <p className={ws.navEmpty}>Sin categorías</p>}
            {group.categorias.map(cat => {
              const active = activeCatId === cat._id;
              return (
                <button
                  key={cat._id}
                  type="button"
                  className={cx(
                    ws.navItem,
                    active && ws.navItemActive,
                    editingCatId === cat._id && ws.navItemEditing,
                    dragOverCat === cat._id && ws.navItemDrop,
                  )}
                  onClick={() => onSelectCat(cat._id)}
                  aria-current={active ? "location" : undefined}
                  onDragOver={dragging ? event => onDragOver(event, cat._id) : undefined}
                  onDragLeave={dragging ? onDragLeave : undefined}
                  onDrop={dragging ? event => onDrop(event, cat._id) : undefined}
                >
                  <span className={ws.navItemName}>{cat.title}</span>
                  {cat.hidden && <EyeOff {...ICON} size={13} className={ws.navItemHidden} />}
                  <span className={ws.navItemCount}>{cat.items?.length ?? 0}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

// Versión compacta para anchos intermedios (sin columna de estructura).
export function WorkspaceJumpBar({ menu, activeCatId, onSelectCat }: {
  menu: MenuData;
  activeCatId: string | null;
  onSelectCat: (catId: string) => void;
}) {
  const categorias = toNavGroups(menu).flatMap(group => group.categorias);
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

export function WorkspaceSection({ title, categoryCount, onEdit, onDelete, deleteDisabled }: {
  title: string;
  categoryCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div className={ws.section}>
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

// ── Categoría con sus productos ─────────────────────────────────────────────

interface WorkspaceCategoryProps {
  cat: Categoria;
  items: Item[];
  activeItemId: string | null;
  flashItemId: string | null;
  editing: boolean;
  atItemLimit: boolean;
  deleteDisabled: boolean;
  selectionMode: boolean;
  selectedIds: Set<string>;
  dragOver: boolean;
  draggedItem: string | null;
  onEditCat: (cat: Categoria) => void;
  onDeleteCat: (cat: Categoria) => void;
  onNewItem: (cat: Categoria) => void;
  onEditItem: (item: Item, cat: Categoria) => void;
  onToggleAvailable: (item: Item) => void;
  onToggleHidden: (item: Item) => void;
  onToggleSelectItem: (id: string) => void;
  onToggleSelectAllInCat: (cat: Categoria) => void;
  onDragStart: (event: DragEvent, itemId: string) => void;
  onDragOver: (event: DragEvent, catId: string) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent, catId: string) => void;
  onDragEnd: () => void;
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

export const WorkspaceCategory = memo(function WorkspaceCategory({
  cat, items, activeItemId, flashItemId, editing, atItemLimit, deleteDisabled,
  selectionMode, selectedIds, dragOver, draggedItem,
  onEditCat, onDeleteCat, onNewItem, onEditItem, onToggleAvailable, onToggleHidden,
  onToggleSelectItem, onToggleSelectAllInCat, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}: WorkspaceCategoryProps) {
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
      id={`ws-cat-${cat._id}`}
      data-cat-id={cat._id}
      className={cx(ws.category, dragOver && ws.categoryDrop, editing && ws.categoryEditing)}
      aria-labelledby={titleId}
      onDragOver={event => onDragOver(event, cat._id)}
      onDragLeave={onDragLeave}
      onDrop={event => onDrop(event, cat._id)}
    >
      <header className={ws.categoryHeader}>
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
      </header>

      {cat.description && <p className={ws.categoryDescription}>{cat.description}</p>}

      {items.length > 0 ? (
        <div className={ws.rows} role="list" aria-label={`Productos de ${cat.title}`}>
          {items.map(item => {
            const active = activeItemId === item._id;
            const selected = selectedIds.has(item._id);
            const tags = itemTags(item);
            return (
              <div
                key={item._id}
                role="listitem"
                data-item-id={item._id}
                className={cx(
                  ws.row,
                  active && ws.rowActive,
                  flashItemId === item._id && ws.rowFlash,
                  selected && ws.rowSelected,
                  draggedItem === item._id && ws.rowDragging,
                  !item.available && ws.rowPaused,
                )}
                draggable={!selectionMode}
                onDragStart={event => onDragStart(event, item._id)}
                onDragEnd={onDragEnd}
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
                  <span className={ws.grip} aria-hidden="true" title="Arrastrá para mover">
                    <GripVertical {...ICON} />
                  </span>
                )}

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
              </div>
            );
          })}
        </div>
      ) : (
        <p className={ws.categoryEmpty}>
          {total === 0
            ? "Todavía no hay productos. Creá el primero o arrastrá uno desde otra categoría."
            : "Ningún producto de esta categoría coincide con el filtro."}
        </p>
      )}
    </section>
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
          Arrastrá un producto a otra categoría para moverlo.
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
