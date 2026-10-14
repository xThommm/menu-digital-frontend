import { Download, Link2, List, Lock, Plus, Receipt, Users } from "lucide-react";
import { copyItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import { formatMoney } from "../../lib/format.ts";
import type { GroupSession, TableSession } from "../../types";

// Clic derecho en una mesa abierta (Mesas del panel): lo mismo que los botones
// de la tarjeta, más el link y el QR de la mesa. El pedido grupal de la mesa
// tiene su propio menú (shared/groupMenu.ts) y la cuenta, el suyo
// (shared/billMenu.ts). Las acciones llegan en el contexto, que se arma al
// hacer clic derecho.

export interface TableMenuActions {
  toggleOrders: () => void;
  openBill: () => void;
  addOrder: () => void;
  openGroup: () => Promise<unknown>;
  downloadQr: () => Promise<void>;
  closeTable: () => Promise<unknown>;
}

export interface TableMenuContext {
  session: TableSession;
  group: GroupSession | null;
  showingOrders: boolean;
  /** Link de la carta con el QR de esta mesa (o el general); null si todavía no cargó. */
  tableLink: string | null;
  busy: boolean;
  actions: TableMenuActions;
}

const BUSY = "Hay una acción en curso en esta mesa";

export function buildTableMenu(env: MenuEnv): ContextMenuItem<TableMenuContext>[] {
  return [
    {
      id: "orders",
      label: ({ showingOrders }) => (showingOrders ? "Ocultar pedidos" : "Ver pedidos"),
      icon: List,
      run: ({ actions }) => actions.toggleOrders(),
    },
    { id: "bill", label: "Dividir y cobrar", icon: Receipt, run: ({ actions }) => actions.openBill() },
    { id: "add-order", label: "Agregar pedido", icon: Plus, run: ({ actions }) => actions.addOrder() },
    {
      id: "group",
      label: "Abrir pedido grupal",
      icon: Users,
      visible: ({ group }) => group === null,
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.openGroup(),
      errorMessage: "No se pudo abrir el pedido grupal.",
    },
    { type: "separator" },
    copyItem<TableMenuContext>(env, {
      id: "link",
      label: "Copiar link de la mesa",
      icon: Link2,
      value: ({ tableLink }) => tableLink,
      done: "Link de la mesa copiado.",
    }),
    {
      id: "qr",
      label: "Descargar QR de la mesa",
      icon: Download,
      visible: ({ tableLink }) => tableLink !== null,
      run: ({ actions }) => actions.downloadQr(),
      errorMessage: "No se pudo generar el QR.",
    },
    { type: "separator" },
    {
      id: "close",
      label: "Cerrar mesa",
      icon: Lock,
      danger: true,
      disabled: ({ busy }) => busy && BUSY,
      confirm: ({ session }) => ({
        title: `¿Cerrar la mesa ${session.tableNumber}?`,
        message: `Se cierra la cuenta: ${formatMoney(session.totalAmount)} en ${session.ordersCount} pedido(s). La mesa pasa al historial.`,
        confirmLabel: "Cerrar mesa",
        danger: true,
      }),
      run: ({ actions }) => actions.closeTable(),
    },
  ];
}
