import { Bell, BellRing, Palette } from "lucide-react";
import type { ContextMenuItem } from "../../../features/contextMenu/types";

// Clic derecho en la barra lateral del panel CEO. Sobre un ítem de navegación
// se suman solas, arriba, "Abrir en pestaña nueva" y "Copiar dirección del
// enlace" (son links: ver lib/linkMenu.ts). Acá van los avisos de este
// dispositivo y la apariencia (la barra tiene su propio menú, así que el
// global no aparece).

export interface AdminSidebarMenuContext {
  push: {
    /** Ya se sabe si este navegador puede recibir avisos. */
    known: boolean;
    available: boolean;
    active: boolean;
    busy: boolean;
    /** Por qué no se puede (navegador, permisos, configuración). */
    help: string | null;
  };
  actions: { togglePush: () => void; sendTest: () => void; openAppearance: () => void };
}

export function buildAdminSidebarMenu(): ContextMenuItem<AdminSidebarMenuContext>[] {
  return [
    {
      id: "push-test",
      label: "Probar notificación",
      icon: BellRing,
      visible: ({ push }) => push.available && push.active,
      run: ({ actions }) => actions.sendTest(),
    },
    {
      id: "push-toggle",
      label: ({ push }) => (push.active ? "Desactivar notificaciones" : "Activar notificaciones"),
      icon: Bell,
      visible: ({ push }) => push.known,
      disabled: ({ push }) => (push.busy ? "Un momento…" : !push.active && !push.available && (push.help ?? "No se pueden activar en este navegador")),
      run: ({ actions }) => actions.togglePush(),
    },
    { type: "separator" },
    { id: "appearance", label: "Apariencia del panel…", icon: Palette, run: ({ actions }) => actions.openAppearance() },
  ];
}
