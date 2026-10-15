import { Ban, PencilLine, UserMinus } from "lucide-react";
import type { ContextMenuItem } from "../../../contextMenu/types";
import type { BillGuest, BillPayment } from "../../types";

// Clic derecho en la cuenta de una mesa (BillPanel): un comensal o un pago.
// Las acciones abren las mismas ventanas que los botones: el nombre nuevo, la
// confirmación de quitar y el motivo de la anulación (que es su confirmación).
// No hacen esperar al menú: la ventana es la que espera la respuesta.

export interface BillGuestMenuContext {
  guest: BillGuest;
  /** La cuenta está cerrada o hay una acción en curso. */
  locked: boolean;
  actions: { rename: (guest: BillGuest) => void; remove: (guest: BillGuest) => void };
}

export interface BillPaymentMenuContext {
  payment: BillPayment;
  locked: boolean;
  actions: { voidPayment: (paymentId: number) => void };
}

const LOCKED = "La cuenta está cerrada o hay un cambio en curso";

export function buildBillGuestMenu(): ContextMenuItem<BillGuestMenuContext>[] {
  return [
    {
      id: "rename",
      label: "Cambiar nombre",
      icon: PencilLine,
      disabled: ({ locked }) => locked && LOCKED,
      run: ({ guest, actions }) => { actions.rename(guest); },
    },
    {
      id: "remove",
      label: "Quitar de la cuenta",
      icon: UserMinus,
      danger: true,
      disabled: ({ locked }) => locked && LOCKED,
      run: ({ guest, actions }) => { actions.remove(guest); },
    },
  ];
}

export function buildBillPaymentMenu(): ContextMenuItem<BillPaymentMenuContext>[] {
  return [
    {
      id: "void",
      label: "Anular pago",
      icon: Ban,
      danger: true,
      visible: ({ payment }) => payment.status === "approved",
      disabled: ({ locked }) => locked && LOCKED,
      run: ({ payment, actions }) => { actions.voidPayment(payment.id); },
    },
  ];
}
