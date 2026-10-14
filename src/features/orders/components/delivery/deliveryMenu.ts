import { Eye, KeyRound, MapPin, PackageCheck, UserMinus, UserPlus } from "lucide-react";
import { copySubmenu, openUrlItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import { mapsUrl } from "../../lib/delivery.ts";
import type { Courier, DeliveryAssignment, Order } from "../../types";

// Clic derecho en un pedido de Entregas en curso: asignarlo (submenú con los
// repartidores en vez del selector), reasignarlo, quitárselo al repartidor, el
// código y la entrega, y los datos del cliente. Con el pedido en camino, el
// motivo que se pide al reasignar o quitar es la confirmación; antes de salir,
// quitar el repartidor confirma acá.

export interface DeliveryMenuContext {
  order: Order;
  /** null: todavía no tiene repartidor. */
  assignment: DeliveryAssignment | null;
  /** Repartidores activos. */
  couriers: Courier[];
  /** El delivery con repartidores está activo (si no, no se asigna ni reasigna). */
  enabled: boolean;
  canComplete: boolean;
  busy: boolean;
  actions: {
    detail: () => void;
    /** Asignar o reasignar; en camino abre la ventana del motivo y no devuelve la promesa. */
    assign: (courier: Courier) => unknown;
    unassign: () => unknown;
    revealCode: () => Promise<void>;
    complete: () => void;
  };
}

const BUSY = "Hay una acción en curso en este pedido";
const onTheRoad = ({ assignment }: DeliveryMenuContext) => assignment?.status === "picked_up";
const courierLabel = (courier: Courier) => `${courier.name}${courier.available ? "" : " (no disponible)"}`;

const courierItems = (context: DeliveryMenuContext): ContextMenuItem<DeliveryMenuContext>[] => {
  const others = context.couriers.filter((courier) => courier.id !== context.assignment?.courierId);
  if (others.length === 0) {
    return [{ id: "none", label: "No hay otro repartidor activo", disabled: () => true, run: () => undefined }];
  }
  return others.map((courier) => ({
    id: `courier-${courier.id}`,
    label: `${courierLabel(courier)}${onTheRoad(context) ? "…" : ""}`,
    run: ({ actions }) => actions.assign(courier),
    errorMessage: "No se pudo asignar el pedido.",
  }));
};

export function buildDeliveryMenu(env: MenuEnv): ContextMenuItem<DeliveryMenuContext>[] {
  return [
    {
      id: "detail",
      label: "Detalle",
      icon: Eye,
      visible: ({ assignment }) => assignment !== null,
      run: ({ actions }) => actions.detail(),
    },
    {
      type: "submenu",
      id: "assign",
      label: ({ assignment }) => (assignment ? "Reasignar a" : "Asignar a"),
      icon: UserPlus,
      visible: ({ enabled }) => enabled,
      disabled: ({ busy }) => busy && BUSY,
      items: courierItems,
    },
    {
      id: "unassign",
      label: (context) => (onTheRoad(context) ? "Quitar repartidor…" : "Quitar repartidor"),
      icon: UserMinus,
      danger: true,
      visible: ({ assignment }) => assignment !== null,
      disabled: ({ busy }) => busy && BUSY,
      confirm: (context) => (onTheRoad(context) ? null : {
        title: `¿Quitarle el pedido #${context.order.number} a ${context.assignment?.courierName}?`,
        message: "El pedido vuelve a quedar sin repartidor.",
        confirmLabel: "Quitar repartidor",
        danger: true,
      }),
      run: ({ actions }) => actions.unassign(),
      errorMessage: "No se pudo quitar el pedido al repartidor.",
    },
    { type: "separator" },
    {
      id: "code",
      label: "Ver código de entrega",
      icon: KeyRound,
      visible: onTheRoad,
      run: ({ actions }) => actions.revealCode(),
    },
    {
      id: "complete",
      label: "Marcar entregado…",
      icon: PackageCheck,
      visible: ({ canComplete }) => canComplete,
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.complete(),
    },
    { type: "separator" },
    copySubmenu<DeliveryMenuContext>(env, [
      { id: "number", label: "Número de pedido", value: ({ order }) => `#${order.number}`, done: "Número de pedido copiado." },
      { id: "address", label: "Dirección", value: ({ order }) => order.deliveryAddress, done: "Dirección copiada." },
      { id: "phone", label: "Teléfono del cliente", value: ({ order }) => order.customerPhone, done: "Teléfono copiado." },
    ]),
    openUrlItem<DeliveryMenuContext>(env, {
      id: "maps",
      label: "Abrir dirección en mapas",
      icon: MapPin,
      url: ({ order }) => (order.deliveryAddress?.trim() ? mapsUrl(order.deliveryAddress) : null),
    }),
  ];
}

