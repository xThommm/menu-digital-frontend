import { Lock, QrCode, Send } from "lucide-react";
import { copyLinkItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import { formatMoney } from "../../lib/format.ts";
import type { GroupSession } from "../../types";

// Clic derecho en un pedido grupal abierto (GroupPanel): QR y código, el
// enlace para sumarse, enviarlo y cerrarlo. Cerrarlo pide confirmación.

export interface GroupMenuActions {
  showQr: () => void;
  send: () => void;
  close: () => void;
}

export interface GroupMenuContext {
  group: GroupSession;
  tableNumber: number;
  joinUrl: string;
  busy: boolean;
  actions: GroupMenuActions;
}

const BUSY = "Hay una acción en curso en el pedido grupal";

export function buildGroupMenu(env: MenuEnv): ContextMenuItem<GroupMenuContext>[] {
  return [
    { id: "qr", label: "QR y código", icon: QrCode, run: ({ actions }) => actions.showQr() },
    copyLinkItem<GroupMenuContext>(env, { id: "link", label: "Copiar enlace para sumarse", url: ({ joinUrl }) => joinUrl }),
    { type: "separator" },
    {
      id: "send",
      label: ({ group }) => `Enviar pedido del grupo · ${formatMoney(group.cartTotal)}`,
      icon: Send,
      visible: ({ group }) => group.cart.length > 0,
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.send(),
    },
    {
      id: "close",
      label: "Cerrar pedido grupal",
      icon: Lock,
      danger: true,
      disabled: ({ busy }) => busy && BUSY,
      confirm: ({ group, tableNumber }) => ({
        title: `¿Cerrar el pedido grupal de la mesa ${tableNumber}?`,
        message: `${group.cart.length > 0 ? "Lo que cargaron y no se envió se descarta. " : ""}La mesa sigue abierta.`,
        confirmLabel: "Cerrar pedido grupal",
        danger: true,
      }),
      run: ({ actions }) => actions.close(),
    },
  ];
}
