import type { AdminItem as Item, AdminMenuData as MenuData } from "../../../../../types";

// Filtros rápidos del espacio de trabajo de escritorio. Son solo de vista:
// no cambian datos ni se guardan, y la búsqueda sigue funcionando aparte.
export type WorkspaceFilter = "all" | "active" | "paused" | "hidden" | "noImage" | "offer";

export const WORKSPACE_FILTERS: { key: WorkspaceFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "paused", label: "Pausados" },
  { key: "hidden", label: "Ocultos" },
  { key: "noImage", label: "Sin foto" },
  { key: "offer", label: "En oferta" },
];

export function matchesWorkspaceFilter(item: Item, filter: WorkspaceFilter): boolean {
  switch (filter) {
    case "active": return item.available && !item.hidden;
    case "paused": return !item.available;
    case "hidden": return item.hidden;
    case "noImage": return !item.image;
    case "offer": return item.offerPrice != null;
    default: return true;
  }
}

export type WorkspaceCounts = Record<WorkspaceFilter, number>;

export function countWorkspaceItems(menu: MenuData | null): WorkspaceCounts {
  const counts: WorkspaceCounts = { all: 0, active: 0, paused: 0, hidden: 0, noImage: 0, offer: 0 };
  if (!menu) return counts;
  const categorias = [...menu.secciones.flatMap(section => section.categorias), ...menu.sinSeccion];
  for (const categoria of categorias) {
    for (const item of categoria.items ?? []) {
      for (const { key } of WORKSPACE_FILTERS) {
        if (matchesWorkspaceFilter(item, key)) counts[key] += 1;
      }
    }
  }
  return counts;
}

export const formatPrice = (value: number) => `$${value.toLocaleString("es-AR")}`;
