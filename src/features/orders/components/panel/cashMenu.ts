import {
  ArrowLeftRight, ClipboardList, FileSpreadsheet, ListTree, Lock, Pencil, PlayCircle, Plus, Printer, ScrollText,
} from "lucide-react";
import type { MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import type { CashSession, Shift } from "../../types";

// Clic derecho en Caja y turnos: una caja abierta, el turno, una fila del
// historial (caja o turno cerrados) y el fondo. Cerrar la caja abre su arqueo
// (que es la confirmación); cerrar el turno confirma acá.

// ── Caja abierta ──

export type CashPanelName = "movement" | "ledger" | "close";

export interface OpenCashMenuContext {
  session: CashSession;
  actions: {
    editCashier: () => void;
    showPanel: (panel: CashPanelName) => void;
    exportExcel: () => Promise<void>;
    print: () => void;
  };
}

const exportItem = <C extends { actions: { exportExcel: () => Promise<void> } }>(label: string): ContextMenuItem<C> => ({
  id: "export",
  label,
  icon: FileSpreadsheet,
  run: ({ actions }) => actions.exportExcel(),
  successMessage: "Excel descargado.",
  errorMessage: "No se pudo exportar el cierre.",
});

export function buildOpenCashMenu(): ContextMenuItem<OpenCashMenuContext>[] {
  return [
    { id: "cashier", label: "Cajero y fondo", icon: Pencil, run: ({ actions }) => actions.editCashier() },
    { id: "movement", label: "Ingreso, egreso o retiro", icon: ArrowLeftRight, run: ({ actions }) => actions.showPanel("movement") },
    { id: "ledger", label: "Ver movimientos", icon: ScrollText, run: ({ actions }) => actions.showPanel("ledger") },
    { type: "separator" },
    exportItem<OpenCashMenuContext>("Exportar a Excel (hasta ahora)"),
    { id: "print", label: "Imprimir resumen", icon: Printer, run: ({ actions }) => actions.print() },
    { type: "separator" },
    // El arqueo (efectivo contado y lo que se retira) es la confirmación.
    { id: "close", label: "Cerrar caja…", icon: Lock, danger: true, run: ({ actions }) => actions.showPanel("close") },
  ];
}

// ── Turno ──

export interface ShiftMenuContext {
  shift: Shift | null;
  busy: boolean;
  actions: { open: () => Promise<void>; close: () => Promise<void>; showOrders: () => void };
}

export function buildShiftMenu(): ContextMenuItem<ShiftMenuContext>[] {
  return [
    {
      id: "open",
      label: "Abrir turno",
      icon: PlayCircle,
      visible: ({ shift }) => shift === null,
      run: ({ actions }) => actions.open(),
    },
    {
      id: "orders",
      label: "Ver pedidos del turno",
      icon: ClipboardList,
      visible: ({ shift }) => shift !== null,
      run: ({ actions }) => actions.showOrders(),
    },
    {
      id: "close",
      label: "Cerrar turno",
      icon: Lock,
      danger: true,
      visible: ({ shift }) => shift !== null,
      disabled: ({ busy }) => busy && "Se está cerrando el turno",
      confirm: ({ shift }) => ({
        title: shift ? `¿Cerrar el turno ${shift.label}?` : "¿Cerrar el turno?",
        message: "Cerrar el turno no cierra la caja. El próximo pedido abre uno nuevo.",
        confirmLabel: "Cerrar turno",
        danger: true,
      }),
      run: ({ actions }) => actions.close(),
    },
  ];
}

// ── Historial ──

export interface ClosedCashMenuContext {
  session: CashSession;
  actions: { showDetail: () => void; exportExcel: () => Promise<void>; print: () => void };
}

export function buildClosedCashMenu(): ContextMenuItem<ClosedCashMenuContext>[] {
  return [
    { id: "detail", label: "Ver detalle", icon: ListTree, run: ({ actions }) => actions.showDetail() },
    { type: "separator" },
    exportItem<ClosedCashMenuContext>("Exportar cierre a Excel"),
    { id: "print", label: "Imprimir cierre", icon: Printer, run: ({ actions }) => actions.print() },
  ];
}

export interface ClosedShiftMenuContext {
  shift: Shift;
  actions: { showSummary: () => void };
}

export function buildClosedShiftMenu(env: MenuEnv): ContextMenuItem<ClosedShiftMenuContext>[] {
  return [
    { id: "summary", label: "Ver resumen", icon: ListTree, run: ({ actions }) => actions.showSummary() },
    {
      id: "orders",
      label: "Ver pedidos del turno",
      icon: ClipboardList,
      run: ({ shift }) => env.navigate(`/pedidos/historial?turno=${shift.id}`),
    },
  ];
}

// ── Fondo ──

export function buildCashPageMenu(): ContextMenuItem<{ actions: { addRegister: () => void } }>[] {
  return [{ id: "add-register", label: "Agregar otra caja", icon: Plus, run: ({ actions }) => actions.addRegister() }];
}
