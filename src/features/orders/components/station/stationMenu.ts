import { Bell, BellOff, Check, Flame, LogOut, Maximize, Minimize, Printer, RotateCcw, Usb } from "lucide-react";
import type { ContextMenuItem } from "../../../contextMenu/types";
import type { Ticket, TicketStatus } from "../../types";

// Clic derecho en la pantalla de comandas (pensada para pantallas táctiles,
// pero en una PC con mouse ayuda): una comanda activa, una comanda lista de
// "Listas y anuladas" y el fondo. Desvincular el equipo confirma.

export interface TicketMenuContext {
  ticket: Ticket;
  busy: boolean;
  canPrint: boolean;
  actions: { setStatus: (status: TicketStatus) => Promise<void>; print: () => Promise<void> };
}

const BUSY = "Se está actualizando esta comanda";

export function buildTicketMenu(): ContextMenuItem<TicketMenuContext>[] {
  return [
    {
      id: "preparing",
      label: "Preparando",
      icon: Flame,
      visible: ({ ticket }) => ticket.status === "new",
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.setStatus("preparing"),
    },
    {
      id: "done",
      label: "Lista",
      icon: Check,
      visible: ({ ticket }) => ticket.status === "new" || ticket.status === "preparing",
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.setStatus("done"),
    },
    {
      id: "back-to-new",
      label: "Volver a nuevas",
      icon: RotateCcw,
      visible: ({ ticket }) => ticket.status === "preparing",
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.setStatus("new"),
    },
    {
      id: "undo",
      label: "Deshacer (volver a preparación)",
      icon: RotateCcw,
      visible: ({ ticket }) => ticket.status === "done",
      disabled: ({ busy }) => busy && BUSY,
      run: ({ actions }) => actions.setStatus("preparing"),
    },
    {
      id: "print",
      label: ({ ticket }) => (ticket.printedAt ? "Reimprimir" : "Imprimir"),
      icon: Printer,
      visible: ({ ticket, canPrint }) => canPrint && ticket.status !== "done",
      run: ({ actions }) => actions.print(),
    },
  ];
}

export interface StationBoardMenuContext {
  sound: boolean;
  /** null: el sector no imprime. */
  autoPrint: boolean | null;
  canConnectPrinter: boolean;
  fullscreen: { available: boolean; active: boolean };
  /** Equipo vinculado con código (con la sesión del dueño no se desvincula). */
  paired: boolean;
  actions: {
    toggleSound: () => void;
    toggleAutoPrint: () => void;
    connectPrinter: () => Promise<void>;
    toggleFullscreen: () => void;
    unpair: () => Promise<void>;
  };
}

export function buildStationBoardMenu(): ContextMenuItem<StationBoardMenuContext>[] {
  return [
    { id: "mute", label: "Silenciar", icon: BellOff, visible: ({ sound }) => sound, run: ({ actions }) => actions.toggleSound() },
    { id: "unmute", label: "Activar sonido", icon: Bell, visible: ({ sound }) => !sound, run: ({ actions }) => actions.toggleSound() },
    {
      id: "auto-print",
      label: ({ autoPrint }) => (autoPrint ? "Pasar a impresión manual" : "Imprimir solo las nuevas"),
      icon: Printer,
      visible: ({ autoPrint }) => autoPrint !== null,
      run: ({ actions }) => actions.toggleAutoPrint(),
    },
    {
      id: "printer",
      label: "Conectar comandera",
      icon: Usb,
      visible: ({ canConnectPrinter }) => canConnectPrinter,
      run: ({ actions }) => actions.connectPrinter(),
    },
    { type: "separator" },
    {
      id: "fullscreen",
      label: "Pantalla completa",
      icon: Maximize,
      visible: ({ fullscreen }) => fullscreen.available && !fullscreen.active,
      run: ({ actions }) => actions.toggleFullscreen(),
    },
    {
      id: "exit-fullscreen",
      label: "Salir de pantalla completa",
      icon: Minimize,
      visible: ({ fullscreen }) => fullscreen.available && fullscreen.active,
      run: ({ actions }) => actions.toggleFullscreen(),
    },
    { type: "separator" },
    {
      id: "unpair",
      label: "Desvincular este equipo",
      icon: LogOut,
      danger: true,
      visible: ({ paired }) => paired,
      confirm: {
        title: "¿Desvincular este equipo?",
        message: "Deja de mostrar las comandas del sector. Para volver a usarlo hay que vincularlo con un código nuevo desde el panel.",
        confirmLabel: "Desvincular",
        danger: true,
      },
      run: ({ actions }) => actions.unpair(),
    },
  ];
}
