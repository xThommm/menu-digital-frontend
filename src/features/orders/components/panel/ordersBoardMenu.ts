import {
  Bell, Bike, Check, ChefHat, CirclePlay, ClipboardList, HandPlatter, History, LayoutGrid, MapPin,
  MessageCircle, Minus, PackageX, Plus, Printer, Receipt, RefreshCw, Undo2, Wallet, X,
} from "lucide-react";
import { buildWaLink } from "../../../../lib/whatsapp.ts";
import { copySubmenu, navigateItem, openUrlItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuAction, ContextMenuItem } from "../../../contextMenu/types";
import { mapsUrl } from "../../lib/delivery.ts";
import { formatMoney } from "../../lib/format.ts";
import { orderFlow } from "../../lib/orderFlow.ts";
import {
  CANCEL_REASONS, canDeliverItems, canRemoveItem, canRestoreItems, ITEM_REMOVE_REASONS, maxRemovable, stockNoticeMessage,
} from "../../lib/orderItems.ts";
import type { Order, OrderItem, OrderStatus, RemovedOrderItem } from "../../types";

// Clic derecho en el tablero de pedidos: una tarjeta, un producto de la
// tarjeta y el fondo. Son las mismas acciones de los botones (OrderCard,
// OrderItemsList, la cabecera) más algunas a mano: copiar datos, mapas,
// reimprimir la comanda e ir a la mesa. Las que no se deshacen piden
// confirmación.
//
// Las acciones de la pantalla viajan en el contexto (`actions`): se arma al
// hacer clic derecho, no durante el render.

const BUSY = "Se está actualizando el pedido";

export interface OrderMenuActions {
  /** El tablero puede devolver pagos online (RefundModal). */
  refunds: boolean;
  /** El tablero registra "Salió el pedido". */
  dispatch: boolean;
  setStatus: (order: Order, status: OrderStatus, reason?: string) => unknown;
  markDispatched: (order: Order) => unknown;
  /** Abre la devolución (RefundModal): ese modal es la confirmación. */
  refund: (order: Order, cancel: boolean, amount?: number) => void;
  reprint: (order: Order) => Promise<void>;
}

export interface OrderMenuContext {
  order: Order;
  busy: boolean;
  actions: OrderMenuActions;
}

// Mesa a la que lleva "Ir a la mesa" (lo lee TablesPage de location.state).
export interface TableFocusState {
  tableSessionId: number;
  bill?: boolean;
}

const idle = <C extends { busy: boolean }>(item: ContextMenuAction<C>): ContextMenuAction<C> => ({
  ...item,
  disabled: (context) => (context.busy ? BUSY : item.disabled?.(context) ?? false),
});

const reasonId = (reason: string) =>
  reason.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "-");

const flowOf = ({ order, actions }: OrderMenuContext) => orderFlow(order, { refunds: actions.refunds, dispatch: actions.dispatch });

const cancelOption = (reason: string | null): ContextMenuAction<OrderMenuContext> => idle({
  id: reason ? reasonId(reason) : "no-reason",
  label: reason ?? "Sin motivo",
  danger: true,
  confirm: ({ order }) => ({
    title: `¿Cancelar el pedido #${order.number}?`,
    message: reason ? `Motivo: ${reason}. El pedido sale del tablero y queda en el historial.` : "El pedido sale del tablero y queda en el historial.",
    confirmLabel: "Cancelar pedido",
    cancelLabel: "Volver",
    danger: true,
  }),
  run: ({ order, actions }) => actions.setStatus(order, "cancelled", reason ?? undefined),
});

const whatsappLink = (order: Order): string | null => {
  if (!order.customerPhone) return null;
  const removed = order.removedItems?.length ?? 0;
  return buildWaLink(order.customerPhone, removed > 0 ? stockNoticeMessage(order) : `¡Hola! Te escribimos por tu pedido #${order.number}.`);
};

const hasTickets = (order: Order) => (order.tickets ?? []).some((ticket) => ticket.status !== "cancelled");

const tableItem = (env: MenuEnv, id: string, label: string, bill: boolean, icon: typeof Receipt): ContextMenuAction<OrderMenuContext> => ({
  ...navigateItem<OrderMenuContext>(env, {
    id,
    label,
    path: "/pedidos/mesas",
    icon,
    state: ({ order }): TableFocusState => ({ tableSessionId: order.tableSessionId ?? 0, ...(bill ? { bill: true } : {}) }),
  }),
  visible: ({ order }) => order.tableSessionId !== null,
});

/** Menú de una tarjeta del tablero. */
export function buildOrderMenu(env: MenuEnv): ContextMenuItem<OrderMenuContext>[] {
  return [
    idle({
      id: "confirm",
      label: "Confirmar",
      icon: Check,
      visible: (context) => flowOf(context).canConfirm,
      run: ({ order, actions }) => actions.setStatus(order, "confirmed"),
    }),
    idle({
      id: "ready",
      label: "Marcar listo",
      icon: ChefHat,
      visible: (context) => flowOf(context).canMarkReady,
      run: ({ order, actions }) => actions.setStatus(order, "ready"),
    }),
    idle({
      id: "dispatch",
      label: "Salió el pedido",
      icon: Bike,
      visible: (context) => flowOf(context).toDispatch,
      run: ({ order, actions }) => actions.markDispatched(order),
    }),
    idle({
      id: "deliver",
      label: "Marcar entregado",
      icon: HandPlatter,
      visible: (context) => flowOf(context).canDeliver,
      run: ({ order, actions }) => actions.setStatus(order, "delivered"),
    }),
    { type: "separator" },
    {
      type: "submenu",
      id: "cancel",
      label: "Cancelar pedido",
      icon: X,
      visible: (context) => !flowOf(context).paid,
      disabled: ({ busy }) => busy && BUSY,
      items: [...CANCEL_REASONS.map(cancelOption), { type: "separator" }, cancelOption(null)],
    },
    idle({
      id: "reject-refund",
      label: "Rechazar y devolver…",
      icon: X,
      danger: true,
      visible: (context) => flowOf(context).paid,
      run: ({ order, actions }) => actions.refund(order, true),
    }),
    idle({
      id: "refund",
      label: "Reembolsar…",
      icon: Undo2,
      visible: (context) => flowOf(context).paid,
      run: ({ order, actions }) => actions.refund(order, false),
    }),
    idle({
      id: "refund-due",
      label: ({ order }) => `Devolver ${formatMoney(order.refundDue ?? 0)}…`,
      icon: Undo2,
      visible: ({ order, actions }) => actions.refunds && (order.refundDue ?? 0) > 0,
      run: ({ order, actions }) => actions.refund(order, false, order.refundDue),
    }),
    { type: "separator" },
    openUrlItem(env, {
      id: "whatsapp",
      label: "Avisar al cliente por WhatsApp",
      icon: MessageCircle,
      url: ({ order }) => whatsappLink(order),
    }),
    copySubmenu<OrderMenuContext>(env, [
      { id: "number", label: "Número de pedido", value: ({ order }) => `#${order.number}`, done: "Número de pedido copiado." },
      { id: "phone", label: "Teléfono del cliente", value: ({ order }) => order.customerPhone, done: "Teléfono copiado." },
      { id: "address", label: "Dirección", value: ({ order }) => order.deliveryAddress, done: "Dirección copiada." },
    ]),
    openUrlItem(env, {
      id: "maps",
      label: "Abrir dirección en mapas",
      icon: MapPin,
      url: ({ order }) => (order.deliveryAddress?.trim() ? mapsUrl(order.deliveryAddress) : null),
    }),
    {
      id: "reprint",
      label: "Reimprimir comanda",
      icon: Printer,
      visible: ({ order }) => order.status !== "pending" && hasTickets(order),
      run: ({ order, actions }) => actions.reprint(order),
      successMessage: "Comanda enviada a la impresora.",
      errorMessage: "No se pudo reimprimir la comanda.",
    },
    { type: "separator" },
    {
      ...navigateItem<OrderMenuContext>(env, { id: "deliveries", label: "Ver entregas en curso", path: "/pedidos/delivery", icon: Bike }),
      visible: (context) => flowOf(context).courierActive,
    },
    tableItem(env, "table", "Ir a la mesa", false, LayoutGrid),
    tableItem(env, "bill", "Abrir la cuenta de la mesa", true, Receipt),
  ];
}

// ── Un producto de la tarjeta ──

export interface OrderItemMenuActions {
  remove: (order: Order, item: OrderItem, data: { quantity?: number; reason?: string }) => unknown;
  restore: (order: Order, item: RemovedOrderItem) => unknown;
  setDelivered: (order: Order, item: OrderItem, delivered: boolean) => unknown;
}

export interface OrderItemMenuContext {
  order: Order;
  /** El producto (si sigue en el pedido) o el que se quitó. */
  item: OrderItem | null;
  removed: RemovedOrderItem | null;
  busy: boolean;
  actions: OrderItemMenuActions;
}

// Un backend anterior no manda `removedItems` ni conoce estas acciones.
const editable = ({ order }: OrderItemMenuContext) => order.removedItems !== undefined;

const removable = (context: OrderItemMenuContext) =>
  editable(context) && context.item !== null && canRemoveItem(context.order, context.item);

const removableCount = ({ order, item }: OrderItemMenuContext) => (item ? maxRemovable(order, item) : 0);

const removeOption = (reason: string, quantity: (context: OrderItemMenuContext) => number): ContextMenuAction<OrderItemMenuContext> => idle({
  id: reasonId(reason),
  label: reason,
  danger: true,
  confirm: (context) => {
    const count = quantity(context);
    const item = context.item!;
    return {
      title: count < item.quantity ? `¿Quitar ${count} de ${item.quantity} ${item.title}?` : `¿Quitar ${item.title} del pedido?`,
      message: `Motivo: ${reason}. Se puede volver a poner mientras el pedido siga en curso.`,
      confirmLabel: "Quitar del pedido",
      danger: true,
    };
  },
  run: (context) => {
    const item = context.item!;
    const count = quantity(context);
    return context.actions.remove(context.order, item, { quantity: count < item.quantity ? count : undefined, reason });
  },
});

/** Menú de un producto dentro de una tarjeta del tablero. */
export function buildOrderItemMenu(): ContextMenuItem<OrderItemMenuContext>[] {
  return [
    idle({
      id: "delivered",
      label: ({ item }) => (item?.deliveredAt ? "Marcar como no entregado" : "Entregar este producto"),
      icon: HandPlatter,
      visible: (context) => editable(context) && context.item !== null && canDeliverItems(context.order),
      run: ({ order, item, actions }) => actions.setDelivered(order, item!, !item!.deliveredAt),
    }),
    {
      type: "submenu",
      id: "remove-one",
      label: "Quitar una unidad",
      icon: Minus,
      visible: (context) => removable(context) && removableCount(context) > 1,
      disabled: ({ busy }) => busy && BUSY,
      items: ITEM_REMOVE_REASONS.map((reason) => removeOption(reason, () => 1)),
    },
    {
      type: "submenu",
      id: "remove",
      label: (context) => (context.item && removableCount(context) < context.item.quantity
        ? `Quitar del pedido (${removableCount(context)})`
        : "Quitar del pedido"),
      icon: PackageX,
      visible: removable,
      disabled: ({ busy }) => busy && BUSY,
      items: ITEM_REMOVE_REASONS.map((reason) => removeOption(reason, removableCount)),
    },
    idle({
      id: "restore",
      label: "Volver a poner en el pedido",
      icon: Undo2,
      visible: (context) => editable(context) && context.removed !== null && canRestoreItems(context.order),
      run: ({ order, removed, actions }) => actions.restore(order, removed!),
    }),
  ];
}

// ── Fondo del tablero ──

export interface BoardMenuActions {
  createOrder: () => void;
  openShift: () => unknown;
  setSound: (on: boolean) => void;
  refresh: () => unknown;
}

export interface BoardMenuContext {
  hasShift: boolean;
  sound: boolean;
  /** La configuración ya cargó (hace falta para cargar un pedido). */
  canCreate: boolean;
  actions: BoardMenuActions;
}

/** Menú del espacio vacío del tablero. */
export function buildBoardMenu(env: MenuEnv): ContextMenuItem<BoardMenuContext>[] {
  return [
    {
      id: "create",
      label: "Nuevo pedido",
      icon: Plus,
      disabled: ({ canCreate }) => !canCreate && "Cargando la configuración",
      run: ({ actions }) => actions.createOrder(),
    },
    {
      id: "shift",
      label: "Abrir turno",
      icon: CirclePlay,
      visible: ({ hasShift }) => !hasShift,
      run: ({ actions }) => actions.openShift(),
    },
    {
      id: "sound",
      label: ({ sound }) => (sound ? "Silenciar avisos de pedidos" : "Activar sonido de pedidos"),
      icon: Bell,
      run: ({ sound, actions }) => actions.setSound(!sound),
    },
    { type: "separator" },
    {
      type: "submenu",
      id: "go",
      label: "Ir a",
      icon: ClipboardList,
      items: [
        navigateItem(env, { id: "tables", label: "Mesas", path: "/pedidos/mesas", icon: LayoutGrid }),
        navigateItem(env, { id: "cash", label: "Caja", path: "/caja", icon: Wallet }),
        navigateItem(env, { id: "history", label: "Historial", path: "/pedidos/historial", icon: History }),
      ],
    },
    { id: "refresh", label: "Actualizar pedidos", icon: RefreshCw, run: ({ actions }) => actions.refresh() },
  ];
}
