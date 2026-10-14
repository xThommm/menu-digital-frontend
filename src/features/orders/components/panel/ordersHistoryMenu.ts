import { History, ListTree, PanelTopOpen, Repeat, RotateCcw, Undo2, Undo } from "lucide-react";
import { copySubmenu, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import { isRefundable } from "../../lib/payment.ts";
import type { Order } from "../../types";

// Clic derecho en el historial de pedidos: un pedido y el fondo. Reabrir un
// cancelado confirma acá; marcarlo devuelto abre la ventana del motivo (que
// es su confirmación) y reembolsar, el modal de devolución.

export interface HistoryOrderMenuActions {
  toggleDetails: (order: Order) => void;
  reopen: (order: Order) => Promise<void>;
  markReturned: (order: Order) => void;
  refund: (order: Order) => void;
  repeat: (order: Order) => void;
}

export interface HistoryOrderMenuContext {
  order: Order;
  expanded: boolean;
  busy: boolean;
  actions: HistoryOrderMenuActions;
}

const BUSY = "Se está actualizando el pedido";

/** Los datos del cliente en texto, para pegarlos en un chat o una nota. */
export function customerSummary(order: Order): string {
  return [order.customerName, order.customerPhone, order.deliveryAddress, order.deliveryNotes]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n");
}

export function buildHistoryOrderMenu(env: MenuEnv): ContextMenuItem<HistoryOrderMenuContext>[] {
  return [
    {
      id: "details",
      label: ({ expanded }) => (expanded ? "Ocultar detalle" : "Ver detalle"),
      icon: PanelTopOpen,
      run: ({ order, actions }) => actions.toggleDetails(order),
    },
    { type: "separator" },
    {
      id: "reopen",
      label: "Reabrir pedido",
      icon: RotateCcw,
      visible: ({ order }) => order.status === "cancelled",
      disabled: ({ busy }) => busy && BUSY,
      confirm: ({ order }) => ({
        title: `¿Reabrir el pedido #${order.number}?`,
        message: "Vuelve al tablero como pedido sin confirmar.",
        confirmLabel: "Reabrir pedido",
      }),
      run: ({ order, actions }) => actions.reopen(order),
      successMessage: "Pedido reabierto.",
      errorMessage: "No se pudo reabrir el pedido.",
    },
    {
      id: "returned",
      label: "Marcar como devuelto…",
      icon: Undo,
      danger: true,
      visible: ({ order }) => order.status === "delivered",
      disabled: ({ busy }) => busy && BUSY,
      run: ({ order, actions }) => { actions.markReturned(order); },
    },
    {
      id: "refund",
      label: "Reembolsar…",
      icon: Undo2,
      visible: ({ order }) => isRefundable(order),
      run: ({ order, actions }) => actions.refund(order),
    },
    {
      id: "repeat",
      label: "Repetir pedido",
      icon: Repeat,
      visible: ({ order }) => order.items.length > 0,
      run: ({ order, actions }) => actions.repeat(order),
    },
    { type: "separator" },
    copySubmenu<HistoryOrderMenuContext>(env, [
      { id: "number", label: "Número de pedido", value: ({ order }) => `#${order.number}`, done: "Número de pedido copiado." },
      { id: "customer", label: "Datos del cliente", value: ({ order }) => customerSummary(order), done: "Datos del cliente copiados." },
    ]),
  ];
}

export interface HistoryPageMenuContext {
  /** "shift": turno actual o último; "all": todo; "param": un turno puntual del link. */
  scope: "shift" | "all" | "param";
  shiftLabel: string;
  actions: { showCurrent: () => void; showAll: () => void };
}

export function buildHistoryPageMenu(): ContextMenuItem<HistoryPageMenuContext>[] {
  return [
    {
      id: "current",
      label: ({ shiftLabel }) => shiftLabel,
      icon: History,
      disabled: ({ scope }) => scope === "shift" && "Es la vista actual",
      run: ({ actions }) => actions.showCurrent(),
    },
    {
      id: "all",
      label: "Ver todo",
      icon: ListTree,
      disabled: ({ scope }) => scope === "all" && "Es la vista actual",
      run: ({ actions }) => actions.showAll(),
    },
  ];
}
