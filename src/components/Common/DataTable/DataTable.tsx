import { Fragment, useMemo, useState, type ReactNode } from "react";
import Spinner from "../Spinner";
import s from "./DataTable.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de datos del panel admin.
//
// Qué resuelve: la estructura repetida en CRM, pagos y vendedores — el wrapper
// con scroll horizontal, la barra de filtros, el orden por encabezado, las
// filas desplegables y los estados de carga/error/vacío.
//
// Qué NO resuelve a propósito: el filtrado que no sea la búsqueda de texto, y
// la paginación. En pagos ambos son del lado del servidor (los filtros viajan
// a la API y devuelve una página), así que si el componente se los apropiara
// no serviría para esa pantalla. Cada tabla arma sus propios controles y los
// pasa por `filters`; acá solo se les da lugar y estilo.
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
  search?: { accessor: (row: T) => string; placeholder?: string; label?: string };
  /** Selects o chips propios de cada pantalla. */
  filters?: ReactNode;
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

  const visibleRows = useMemo(() => {
    const normalized = normalizeSearch(term);

    const filtered = search && normalized
      ? rows.filter((row) => normalizeSearch(search.accessor(row)).includes(normalized))
      : rows;

    const column = columns.find((c) => c.id === sortId && c.sortValue);
    if (!column?.sortValue) return filtered;

    const sortValue = column.sortValue;
    return [...filtered].sort((a, b) => compareValues(sortValue(a), sortValue(b), direction));
  }, [rows, columns, search, term, sortId, direction]);

  const toggleSort = (columnId: string) => {
    if (sortId === columnId) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortId(columnId);
    setDirection(columns.find((c) => c.id === columnId)?.initialDirection ?? "asc");
  };

  const totalColumns = columns.length + (expandable ? 1 : 0);
  const hasToolbar = Boolean(search || filters || actions || countLabel);

  return (
    <>
      {hasToolbar && (
        <section className={s.toolbar} aria-label={`Filtros de ${caption}`}>
          {search && (
            <label className={s.searchField}>
              {search.label ?? "Buscar"}
              <input
                type="search"
                value={term}
                placeholder={search.placeholder}
                onChange={(event) => setTerm(event.target.value)}
              />
            </label>
          )}
          {filters}
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
      ) : rows.length === 0 ? (
        <div className={s.empty} role="status">{emptyMessage}</div>
      ) : visibleRows.length === 0 ? (
        <div className={s.empty} role="status">{noResultsMessage}</div>
      ) : (
        <div className={s.tableWrap}>
          <table
            className={[s.table, layout === "fixed" ? s.tableFixed : ""].join(" ").trim()}
            style={minWidth ? { minWidth } : undefined}
          >
            <caption className={s.srOnly}>{caption}</caption>
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
                      scope="col"
                      className={column.align === "right" ? s.numeric : undefined}
                      style={column.width ? { width: column.width } : undefined}
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
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
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
                            aria-controls={`datatable-panel-${id}`}
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
                          <div id={`datatable-panel-${id}`} className={s.panel}>
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
    </>
  );
}
