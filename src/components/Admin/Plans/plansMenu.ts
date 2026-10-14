import { Save, Undo2, Users } from "lucide-react";
import type { MenuEnv } from "../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../features/contextMenu/types";

// Clic derecho en una tarjeta de Planes y precios: guardar, deshacer la
// edición (confirma: se pierde lo que se cambió) y ver las cuentas del plan
// en el CRM.

export interface PlanMenuContext {
  plan: { name: string; label: string };
  dirty: boolean;
  busy: boolean;
  /** El plan cambió en otro lado: hay que cargar la versión vigente antes. */
  conflict: boolean;
  actions: { save: () => void; reset: () => void };
}

const blocked = ({ busy, conflict, dirty }: PlanMenuContext) =>
  busy ? "Se está guardando" : conflict ? "Primero cargá la versión vigente" : !dirty && "No hay cambios sin guardar";

export function buildPlanMenu(env: MenuEnv): ContextMenuItem<PlanMenuContext>[] {
  return [
    { id: "save", label: ({ plan }) => `Guardar ${plan.label}`, icon: Save, disabled: blocked, run: ({ actions }) => actions.save() },
    {
      id: "reset",
      label: "Deshacer edición",
      icon: Undo2,
      danger: true,
      disabled: blocked,
      confirm: ({ plan }) => ({
        title: `¿Deshacer la edición de ${plan.label}?`,
        message: "Se pierden los cambios sin guardar y vuelve a lo publicado.",
        confirmLabel: "Deshacer",
        danger: true,
      }),
      run: ({ actions }) => actions.reset(),
    },
    { type: "separator" },
    {
      id: "crm",
      label: "Ver cuentas con este plan en el CRM",
      icon: Users,
      run: ({ plan }) => env.navigate(`/sellers/crm?plan=${encodeURIComponent(plan.name)}`),
    },
  ];
}
