import { ExternalLink, ImagePlus, Images, Link2Off, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { openUrlItem, type MenuEnv } from "../../../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../../../features/contextMenu/types";

// Clic derecho en el gestor de imágenes: una imagen y el fondo. Asignar y
// quitar cambian la imagen en pantalla (se guardan con "Guardar cambios",
// como desde los buscadores). Eliminar usa el modal de confirmación de
// siempre.

export interface ImageTileMenuActions {
  assign: () => void;
  unassign: (rowIndex: number) => void;
  remove: () => void;
}

export interface ImageTileMenuContext {
  imageUrl: string;
  isPreset: boolean;
  /** Lista para usar (ni subiendo, ni eliminándose, ni con error). */
  ready: boolean;
  /** Productos elegidos para la imagen (con su fila en el tile). */
  assigned: { rowIndex: number; title: string }[];
  actions: ImageTileMenuActions;
}

export function buildImageTileMenu(env: MenuEnv): ContextMenuItem<ImageTileMenuContext>[] {
  return [
    {
      id: "assign",
      label: ({ assigned }) => (assigned.length > 0 ? "Asignar a otro producto" : "Asignar a un producto"),
      icon: Plus,
      visible: ({ ready }) => ready,
      run: ({ actions }) => actions.assign(),
    },
    {
      type: "submenu",
      id: "unassign",
      label: "Quitar del producto",
      icon: Link2Off,
      visible: ({ ready, assigned }) => ready && assigned.length > 0,
      items: ({ assigned }) => assigned.map(({ rowIndex, title }): ContextMenuItem<ImageTileMenuContext> => ({
        id: String(rowIndex),
        label: title,
        run: ({ actions }) => actions.unassign(rowIndex),
      })),
    },
    openUrlItem<ImageTileMenuContext>(env, { id: "open", label: "Abrir en pestaña nueva", icon: ExternalLink, url: ({ imageUrl }) => imageUrl }),
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar imagen",
      icon: Trash2,
      danger: true,
      visible: ({ ready, isPreset }) => ready && !isPreset,
      // Abre el modal de confirmación del gestor (salvo que se haya elegido no volver a preguntar).
      run: ({ actions }) => actions.remove(),
    },
  ];
}

export interface ImageManagerMenuActions {
  addImages: () => void;
  setView: (view: "mine" | "presets") => void;
  save: () => void;
}

export interface ImageManagerMenuContext {
  view: "mine" | "presets";
  /** Imágenes con cambios sin guardar. */
  pending: number;
  saving: boolean;
  actions: ImageManagerMenuActions;
}

export function buildImageManagerMenu(): ContextMenuItem<ImageManagerMenuContext>[] {
  return [
    { id: "add", label: "Agregar imágenes", icon: ImagePlus, run: ({ actions }) => actions.addImages() },
    {
      id: "mine",
      label: "Mis imágenes",
      icon: Images,
      disabled: ({ view }) => view === "mine" && "Es la vista actual",
      run: ({ actions }) => actions.setView("mine"),
    },
    {
      id: "presets",
      label: "Imágenes prediseñadas",
      icon: Sparkles,
      disabled: ({ view }) => view === "presets" && "Es la vista actual",
      run: ({ actions }) => actions.setView("presets"),
    },
    { type: "separator" },
    {
      id: "save",
      label: ({ pending }) => `Guardar cambios (${pending})`,
      icon: Save,
      visible: ({ pending }) => pending > 0,
      disabled: ({ saving }) => saving && "Guardando",
      run: ({ actions }) => actions.save(),
    },
  ];
}
