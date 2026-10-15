import { BarChart3, ClipboardCopy, Copy, FileSpreadsheet, ImageDown, Pencil, Wallet, Eye } from "lucide-react";
import { copyItem, type MenuEnv } from "../../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../../features/contextMenu/types";

// Clic derecho en Estadísticas: el fondo (exportar y cambiar de pestaña), un
// producto del ranking y un gráfico por día (copiar el valor de una barra o
// todos, y descargarlo como imagen). Nada de esto modifica datos.

// ── Fondo ──

export type StatsTab = "visits" | "sales" | "cash";

const TAB_ITEMS: { id: StatsTab; label: string; icon: typeof Eye }[] = [
  { id: "visits", label: "Visitas", icon: Eye },
  { id: "sales", label: "Ventas", icon: BarChart3 },
  { id: "cash", label: "Caja", icon: Wallet },
];

export interface StatsPageMenuContext {
  tab: StatsTab;
  actions: { exportExcel: () => void; setTab: (tab: StatsTab) => void };
}

export function buildStatsPageMenu(): ContextMenuItem<StatsPageMenuContext>[] {
  return [
    { id: "export", label: "Exportar a Excel…", icon: FileSpreadsheet, run: ({ actions }) => actions.exportExcel() },
    { type: "separator" },
    ...TAB_ITEMS.map(({ id, label, icon }): ContextMenuItem<StatsPageMenuContext> => ({
      id: `tab-${id}`,
      label,
      icon,
      disabled: ({ tab }) => tab === id && "Ya estás en esta pestaña",
      run: ({ actions }) => actions.setTab(id),
    })),
  ];
}

// ── Producto del ranking ──

export interface RankingItemMenuContext {
  item: { itemID: string; title: string };
}

export function buildRankingItemMenu(env: MenuEnv): ContextMenuItem<RankingItemMenuContext>[] {
  return [
    {
      id: "editor",
      label: "Abrir en el editor de menú",
      icon: Pencil,
      run: ({ item }) => env.navigate(`/menu/editor?producto=${encodeURIComponent(item.itemID)}`),
    },
    copyItem<RankingItemMenuContext>(env, { id: "copy-name", label: "Copiar nombre", icon: Copy, value: ({ item }) => item.title, done: "Nombre copiado." }),
  ];
}

// ── Gráfico por día ──

export interface ChartMenuContext {
  /** La barra bajo el cursor ("Martes 14/10: 123 visitas"); null fuera de las barras. */
  point: string | null;
  /** Todos los valores, uno por línea (día y valor separados por tab: se pegan en Excel). */
  table: string;
  actions: { downloadImage: () => Promise<void> };
}

export function buildChartMenu(env: MenuEnv): ContextMenuItem<ChartMenuContext>[] {
  return [
    copyItem<ChartMenuContext>(env, { id: "copy-value", label: "Copiar valor", icon: Copy, value: ({ point }) => point, done: "Valor copiado." }),
    copyItem<ChartMenuContext>(env, {
      id: "copy-all",
      label: "Copiar todos los valores",
      icon: ClipboardCopy,
      value: ({ table }) => table,
      done: "Valores copiados: se pueden pegar en una planilla.",
    }),
    {
      id: "image",
      label: "Descargar como imagen",
      icon: ImageDown,
      run: ({ actions }) => actions.downloadImage(),
      errorMessage: "No se pudo generar la imagen.",
    },
  ];
}

