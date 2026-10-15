import { Check, ExternalLink, KeyRound, Monitor, Pencil, Plus, Printer, Star, Trash2, Unplug } from "lucide-react";
import { copyLinkItem, openUrlItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import type { PrintMode, Sector } from "../../types";

// Clic derecho en Sectores y comandas: un sector de la lista y el fondo de la
// pantalla. Lo mismo que los botones del sector, más el modo de impresión y
// el link de su pantalla. Desvincular un equipo y eliminar confirman.

export const PRINT_MODE_LABEL: Record<PrintMode, string> = {
  none: "Solo pantalla",
  browser: "Impresora del equipo",
  escpos: "Comandera directa (experimental)",
};

/** Pantalla de comandas (de un sector o la general). */
export const stationUrl = (origin: string, sectorId?: number) =>
  `${origin}/comandas${sectorId ? `?sector=${sectorId}` : ""}`;

export interface SectorMenuContext {
  sector: Sector;
  /** Link de la pantalla de este sector. */
  screenUrl: string;
  actions: {
    rename: () => void;
    makeDefault: () => Promise<void>;
    pair: () => void;
    setPrintMode: (mode: PrintMode) => Promise<void>;
    unpair: (sessionId: number) => Promise<void>;
    remove: () => Promise<void>;
  };
}

export function buildSectorMenu(env: MenuEnv): ContextMenuItem<SectorMenuContext>[] {
  return [
    { id: "rename", label: "Renombrar", icon: Pencil, run: ({ actions }) => actions.rename() },
    {
      id: "default",
      label: "Hacer por defecto",
      icon: Star,
      visible: ({ sector }) => !sector.isDefault,
      run: ({ actions }) => actions.makeDefault(),
      successMessage: ({ sector }) => `${sector.name} es el sector por defecto.`,
      errorMessage: "No se pudo cambiar el sector por defecto.",
    },
    {
      type: "submenu",
      id: "print",
      label: "Impresión",
      icon: Printer,
      items: ({ sector }) => (Object.keys(PRINT_MODE_LABEL) as PrintMode[]).map((mode): ContextMenuItem<SectorMenuContext> => ({
        id: `print-${mode}`,
        label: PRINT_MODE_LABEL[mode],
        icon: mode === sector.printMode ? Check : undefined,
        disabled: () => mode === sector.printMode && "Es la impresión actual",
        run: ({ actions }) => actions.setPrintMode(mode),
        errorMessage: "No se pudo guardar la impresión.",
      })),
    },
    { type: "separator" },
    { id: "pair", label: "Vincular equipo", icon: KeyRound, run: ({ actions }) => actions.pair() },
    {
      type: "submenu",
      id: "unpair",
      label: "Desvincular equipo",
      icon: Unplug,
      visible: ({ sector }) => sector.sessions.length > 0,
      items: ({ sector }) => sector.sessions.map((session): ContextMenuItem<SectorMenuContext> => {
        const device = session.deviceLabel ?? "Equipo";
        return {
          id: `session-${session.id}`,
          label: device,
          icon: Monitor,
          confirm: {
            title: `¿Desvincular ${device} de ${sector.name}?`,
            message: "Ese equipo deja de mostrar las comandas hasta que se vuelva a vincular con un código.",
            confirmLabel: "Desvincular",
            danger: true,
          },
          run: ({ actions }) => actions.unpair(session.id),
          successMessage: "Equipo desvinculado.",
          errorMessage: "No se pudo desvincular el equipo.",
        };
      }),
    },
    openUrlItem<SectorMenuContext>(env, { id: "screen", label: "Ver pantalla", icon: ExternalLink, url: ({ screenUrl }) => screenUrl }),
    copyLinkItem<SectorMenuContext>(env, { id: "copy-screen", label: "Copiar link de la pantalla", url: ({ screenUrl }) => screenUrl }),
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      confirm: ({ sector }) => ({
        title: `¿Eliminar el sector ${sector.name}?`,
        message: "Se desvinculan sus equipos y lo que tenía asignado en el menú pasa a heredar. Sus comandas quedan en el historial.",
        confirmLabel: "Eliminar",
        danger: true,
      }),
      run: ({ actions }) => actions.remove(),
      successMessage: ({ sector }) => `Sector ${sector.name} eliminado.`,
      errorMessage: "No se pudo eliminar el sector.",
    },
  ];
}

export interface SectorsPageMenuContext {
  /** Link de la pantalla de comandas general. */
  screenUrl: string;
  actions: { add: () => void };
}

export function buildSectorsPageMenu(env: MenuEnv): ContextMenuItem<SectorsPageMenuContext>[] {
  return [
    { id: "add", label: "Agregar sector", icon: Plus, run: ({ actions }) => actions.add() },
    openUrlItem<SectorsPageMenuContext>(env, { id: "screen", label: "Abrir pantalla de comandas", url: ({ screenUrl }) => screenUrl }),
  ];
}
