import { Fragment, useId, useMemo, useRef, useState, type ReactNode, type PointerEvent } from "react";
import Spinner from "../Spinner";
import s from "./DataTable.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de datos del panel admin.
//
// Qué resuelve: la estructura repetida en CRM, pagos y vendedores — el wrapper
// con scroll horizontal, la barra de filtros, el orden por encabezado, las
// filas desplegables y los estados de carga/error/vacío.
//
// Los filtros con accessor operan sobre las filas cargadas. Los controlados
// sin accessor permiten mantener consultas al servidor y otras vistas (kanban)
// en la pantalla de origen. La paginación sigue siendo responsabilidad del módulo.
// ─────────────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Si está, la columna se puede ordenar haciendo clic en su encabezado. */
  sortValue?: (row: T) => string | number | null | undefined;
  /**
   * Dirección del primer clic en esta columna. Por defecto ascendente, que es
   * lo esperable en texto; en cantidades, plata y fechas casi siempre se busca
   * lo más alto o lo más reciente, así que ahí conviene "desc".
   */
  initialDirection?: SortDirection;
  align?: "left" | "right";
  width?: string;
  minWidth?: number;
  resizable?: boolean;
  filter?: {
    /** Sin accessor, la pantalla aplica el filtro (por ejemplo en el servidor). */
    accessor?: (row: T) => string;
    options?: { value: string; label: string }[];
    value?: string;
    onChange?: (value: string) => void;
    label?: string;
    placeholder?: string;
  };
  /** Para columnas cuyo encabezado es un ícono o va vacío. */
  headerLabel?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Descripción de la tabla para lectores de pantalla. */
  caption: string;

  defaultSort?: { columnId: string; direction?: SortDirection };
  /** Búsqueda de texto en memoria sobre lo que devuelva el accessor. */
  search?: { accessor: (row: T) => string; placeholder?: string; label?: string; value?: string; onChange?: (value: string) => void };
  /** Selects o chips propios de cada pantalla. */
  filters?: ReactNode;
  /** Restablece filtros controlados por la pantalla, además de los internos. */
  onClearFilters?: () => void;
  activeFilterCount?: number;
  /** Acciones al final de la barra (links, botón de alta, exportar). */
  actions?: ReactNode;
  countLabel?: (visible: number, total: number) => string;

  expandable?: {
    renderPanel: (row: T) => ReactNode;
    label?: (row: T) => string;
  };
  rowClassName?: (row: T) => string | undefined;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  emptyMessage?: ReactNode;
  noResultsMessage?: ReactNode;

  /** Ancho mínimo antes de scrollear en horizontal. */
  minWidth?: number;
  /**
   * "fixed" reparte el ancho según el `width` de cada columna y lo respeta
   * aunque el contenido no entre — necesario cuando son muchas columnas y una
   * celda larga (un email, un nombre de negocio) desacomodaría el resto. Con
   * layout fijo los encabezados pueden partirse en dos líneas.
   */
  layout?: "auto" | "fixed";
  footer?: ReactNode;
}

// Busca ignorando acentos y mayúsculas: escribir "toscana" tiene que
// encontrar "Pizzería La Toscana".
function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("es-AR");
}

// Los vacíos van siempre al final, en las dos direcciones: "sin datos" no es
// ni el mayor ni el menor, y mezclarlos entre los valores reales hace ruido.
// Por eso la dirección se aplica acá adentro y no invirtiendo el array: dar
// vuelta el resultado ya ordenado mandaría los vacíos arriba y además rompería
// la estabilidad del orden entre iguales.
function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "es-AR", { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

export default function DataTable<T>({
  rows,
  columns,
  getRowId,
  caption,
  defaultSort,
  search,
  filters,
  onClearFilters,
  activeFilterCount = 0,
  actions,
  countLabel,
  expandable,
  rowClassName,
  loading = false,
  error = null,
  onRetry,
  retrying = false,
  emptyMessage = "No hay datos para mostrar.",
  noResultsMessage = "No hay resultados para esta búsqueda.",
  minWidth,
  layout = "auto",
  footer,
}: DataTableProps<T>) {
  const [term, setTerm] = useState("");
  const [sortId, setSortId] = useState(defaultSort?.columnId ?? null);
  const [direction, setDirection] = useState<SortDirection>(defaultSort?.direction ?? "asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const resizing = useRef<{ id: string; x: number; width: number } | null>(null);
  const tableId = useId();
  const searchTerm = search?.value ?? term;
  const filterCount = activeFilterCount + columns.filter(c => !c.filter?.onChange && columnFilters[c.id]).length;
  const hasColumnFilters = columns.some(c => c.filter);

  const measureWidths = () => Object.fromEntries(
    columns.map(column => [column.id, tableRef.current?.querySelector<HTMLElement>(`[data-column-id="${column.id}"]`)?.getBoundingClientRect().width || Number.parseFloat(column.width || "160")]),
  );
  const clampWidth = (id: string, value: number) => Math.min(640, Math.max(columns.find(c => c.id === id)?.minWidth ?? 88, Math.round(value)));
  const startResize = (event: PointerEvent<HTMLSpanElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const measured = measureWidths();
    setWidths(measured);
    resizing.current = { id, x: event.clientX, width: measured[id] };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const clearFilters = () => {
    setTerm("");
    search?.onChange?.("");
    setColumnFilters({});
    if (onClearFilters) onClearFilters();
    else columns.forEach(column => column.filter?.onChange?.(""));
  };

  const visibleRows = useMemo(() => {
    const normalized = normalizeSearch(searchTerm);

    const searched = search && normalized
      ? rows.filter((row) => normalizeSearch(search.accessor(row)).includes(normalized))
      : rows;
    const filtered = searched.filter(row => columns.every(column => {
      const filter = column.filter;
      const value = filter?.value ?? columnFilters[column.id] ?? "";
      if (!filter?.accessor || !value) return true;
      const actual = filter.accessor(row);
      return filter.options ? actual === value : normalizeSearch(actual).includes(normalizeSearch(value));
    }));

    const column = columns.find((c) => c.id === sortId && c.sortValue);
    if (!column?.sortValue) return filtered;

    const sortValue = column.sortValue;
    return [...filtered].sort((a, b) => compareValues(sortValue(a), sortValue(b), direction));
  }, [rows, columns, search, searchTerm, columnFilters, sortId, direction]);

  const toggleSort = (columnId: string) => {
    if (sortId === columnId) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortId(columnId);
    setDirection(columns.find((c) => c.id === columnId)?.initialDirection ?? "asc");
  };

  const totalColumns = columns.length + (expandable ? 1 : 0);
  const hasToolbar = Boolean(search || filters || actions || countLabel || hasColumnFilters || columns.some(c => c.resizable !== false));
  const resized = Object.keys(widths).length > 0;
  const tableWidth = columns.reduce((sum, column) => sum + (widths[column.id] || Number.parseFloat(column.width || "160")), expandable ? 44 : 0);

  return (
    <div className={s.root}>
      {hasToolbar && (
        <section className={s.toolbar} aria-label={`Filtros de ${caption}`}>
          {search && (
            <label className={s.searchField}>
              {search.label ?? "Buscar"}
              <input
                type="search"
                value={searchTerm}
                placeholder={search.placeholder}
                onChange={(event) => search?.onChange ? search.onChange(event.target.value) : setTerm(event.target.value)}
              />
            </label>
          )}
          {filters}
          {(filterCount > 0 || searchTerm) && <button className={s.toolButton} type="button" onClick={clearFilters}>Limpiar filtros{filterCount > 0 ? ` (${filterCount})` : ""}</button>}
          {resized && <button className={s.toolButton} type="button" onClick={() => setWidths({})}>Restaurar anchos</button>}
          {countLabel && (
            <p className={s.count} aria-live="polite">
              {countLabel(visibleRows.length, rows.length)}
            </p>
          )}
          {actions && <div className={s.actions}>{actions}</div>}
        </section>
      )}

      {loading ? (
        <div className={s.loading}><Spinner size={28} label={`Cargando ${caption}`} /></div>
      ) : error ? (
        <div className={s.error} role="alert">
          <p>{error}</p>
          {onRetry && (
            <button className={s.retryButton} type="button" onClick={onRetry} disabled={retrying}>
              {retrying ? "Reintentando…" : "Reintentar"}
            </button>
          )}
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table
            ref={tableRef}
            className={[s.table, layout === "fixed" || resized ? s.tableFixed : ""].join(" ").trim()}
            style={resized ? { width: tableWidth, minWidth: tableWidth } : minWidth ? { minWidth } : undefined}
          >
            <caption className={s.srOnly}>{caption}</caption>
            <colgroup>
              {expandable && <col style={{ width: 44 }} />}
              {columns.map(column => <col key={column.id} style={{ width: widths[column.id] ?? column.width }} />)}
            </colgroup>
            <thead>
              <tr>
                {expandable && (
                  <th scope="col" className={s.chevronCell}>
                    <span className={s.srOnly}>Desplegar</span>
                  </th>
                )}
                {columns.map((column) => {
                  const active = sortId === column.id;
                  return (
                    <th
                      key={column.id}
                      data-column-id={column.id}
                      scope="col"
                      className={column.align === "right" ? s.numeric : undefined}
                      aria-sort={
                        column.sortValue
                          ? active
                            ? direction === "asc" ? "ascending" : "descending"
                            : "none"
                          : undefined
                      }
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          className={s.sortButton}
                          onClick={() => toggleSort(column.id)}
                        >
                          {column.header}
                          <span aria-hidden>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
                        </button>
                      ) : (
                        column.header || <span className={s.srOnly}>{column.headerLabel}</span>
                      )}
                      {column.resizable !== false && (
                        <span
                          className={s.resizeHandle}
                          role="separator"
                          tabIndex={0}
                          aria-orientation="vertical"
                          aria-label={`Ajustar ancho de ${column.headerLabel || column.header}`}
                          aria-valuemin={column.minWidth ?? 88}
                          aria-valuemax={640}
                          aria-valuenow={Math.round(widths[column.id] || Number.parseFloat(column.width || "160"))}
                          title="Arrastrá para ajustar. Con teclado: flechas izquierda y derecha."
                          onPointerDown={event => startResize(event, column.id)}
                          onPointerMove={event => {
                            const drag = resizing.current;
                            if (drag?.id === column.id) setWidths(current => ({ ...current, [column.id]: clampWidth(column.id, drag.width + event.clientX - drag.x) }));
                          }}
                          onPointerUp={() => { resizing.current = null; }}
                          onPointerCancel={() => { resizing.current = null; }}
                          onLostPointerCapture={() => { resizing.current = null; }}
                          onKeyDown={event => {
                            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                            event.preventDefault();
                            const measured = measureWidths();
                            setWidths({ ...measured, [column.id]: clampWidth(column.id, measured[column.id] + (event.key === "ArrowRight" ? 16 : -16)) });
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
              {hasColumnFilters && <tr className={s.filterRow}>
                {expandable && <td />}
                {columns.map(column => <td key={column.id}>
                  {column.filter && (() => {
                    const filter = column.filter;
                    const value = filter.value ?? columnFilters[column.id] ?? "";
                    const change = (next: string) => filter.onChange ? filter.onChange(next) : setColumnFilters(current => ({ ...current, [column.id]: next }));
                    const label = filter.label || `Filtrar ${column.headerLabel || column.header}`;
                    return filter.options ? (
                      <select aria-label={label} value={value} onChange={event => change(event.target.value)}>
                        <option value="">Todos</option>
                        {filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : <input type="search" aria-label={label} placeholder={filter.placeholder || "Filtrar…"} value={value} onChange={event => change(event.target.value)} />;
                  })()}
                </td>)}
              </tr>}
            </thead>
            <tbody>
              {visibleRows.length === 0 && <tr><td colSpan={totalColumns}><div className={s.empty} role="status">{rows.length === 0 ? emptyMessage : noResultsMessage}</div></td></tr>}
              {visibleRows.map((row) => {
                const id = getRowId(row);
                const open = expandedId === id;
                return (
                  <Fragment key={id}>
                    <tr className={[open ? s.rowOpen : "", rowClassName?.(row) ?? ""].join(" ").trim() || undefined}>
                      {expandable && (
                        <td className={s.chevronCell}>
                          <button
                            className={s.chevronButton}
                            type="button"
                            aria-expanded={open}
                            aria-controls={`${tableId}-panel-${id}`}
                            aria-label={expandable.label?.(row) ?? "Ver detalle"}
                            onClick={() => setExpandedId(open ? null : id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                              className={open ? s.chevronOpen : undefined}>
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </td>
                      )}
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={column.align === "right" ? s.numeric : undefined}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                    {expandable && open && (
                      <tr className={s.panelRow}>
                        <td colSpan={totalColumns}>
                          <div id={`${tableId}-panel-${id}`} className={s.panel}>
                            {expandable.renderPanel(row)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {footer}
        </div>
      )}
    </div>
  );
}
