import { History, Link2, LogOut, Pause, Pencil, Play, QrCode, Smartphone, Trash2, Truck, UserPlus } from "lucide-react";
import type { MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import type { WaiterDeviceSession } from "../../types";

// Clic derecho en un operador (Operadores) o un repartidor (Delivery ▸
// Repartidores): lo mismo que los botones de la fila, más copiar el enlace de
// acceso (el del QR: sirve una vez y vence a los 2 minutos). Cerrar sesiones,
// pausar con dispositivos conectados y eliminar confirman. Un repartidor con
// entregas sin resolver no confirma acá: la ventana para pasárselas a otro
// (la de siempre) es la confirmación.

export interface StaffMember {
  id: number;
  name: string;
  active: boolean;
  sessions: WaiterDeviceSession[];
  /** Solo repartidores: entregas asignadas o en camino. */
  activeDeliveries?: number;
}

export interface StaffMenuContext<M extends StaffMember = StaffMember> {
  member: M;
  actions: {
    edit: () => void;
    showQr: () => void;
    /** Pide un código de acceso nuevo y devuelve el enlace. */
    accessLink: () => Promise<string>;
    showSessions: () => void;
    /** Solo repartidores: su historial de envíos. */
    showDeliveries?: () => void;
    /** Pausar puede abrir la ventana de reasignar (no devuelve la promesa en ese caso). */
    setActive: (active: boolean) => unknown;
    closeSession: (sessionId: number) => Promise<void>;
    closeAllSessions: () => Promise<void>;
    remove: () => unknown;
  };
}

export type StaffKind = "waiter" | "courier";

const NOUN: Record<StaffKind, string> = { waiter: "operador", courier: "repartidor" };
const PAUSED: Record<StaffKind, string> = { waiter: "El operador está pausado", courier: "El repartidor está pausado" };
const devices = (count: number) => (count === 1 ? "1 dispositivo conectado" : `${count} dispositivos conectados`);
const pending = ({ member }: StaffMenuContext) => (member.activeDeliveries ?? 0) > 0;

export function buildStaffMenu(env: MenuEnv, kind: StaffKind): ContextMenuItem<StaffMenuContext>[] {
  const noun = NOUN[kind];
  return [
    { id: "edit", label: "Editar", icon: Pencil, run: ({ actions }) => actions.edit() },
    {
      id: "qr",
      label: "QR de acceso",
      icon: QrCode,
      disabled: ({ member }) => !member.active && PAUSED[kind],
      run: ({ actions }) => actions.showQr(),
    },
    {
      id: "access-link",
      label: "Copiar enlace de acceso",
      icon: Link2,
      disabled: ({ member }) => !member.active && PAUSED[kind],
      run: async ({ actions }) => env.copy(await actions.accessLink()),
      successMessage: "Enlace copiado: sirve una sola vez y vence a los 2 minutos.",
      errorMessage: "No se pudo generar el enlace de acceso.",
    },
    { type: "separator" },
    { id: "sessions", label: "Sesiones", icon: History, run: ({ actions }) => actions.showSessions() },
    {
      id: "deliveries",
      label: "Ver sus entregas",
      icon: Truck,
      visible: ({ actions }) => actions.showDeliveries !== undefined,
      run: ({ actions }) => actions.showDeliveries?.(),
    },
    {
      type: "submenu",
      id: "close-session",
      label: "Cerrar sesión en",
      icon: Smartphone,
      visible: ({ member }) => member.sessions.length > 0,
      items: ({ member }) => member.sessions.map((session): ContextMenuItem<StaffMenuContext> => {
        const device = session.deviceLabel ?? "Dispositivo";
        return {
          id: `session-${session.id}`,
          label: device,
          confirm: {
            title: `¿Cerrar la sesión de ${member.name} en ${device}?`,
            message: "Ese dispositivo queda afuera hasta que vuelva a escanear el QR.",
            confirmLabel: "Cerrar sesión",
            danger: true,
          },
          run: ({ actions }) => actions.closeSession(session.id),
          successMessage: "Sesión cerrada.",
          errorMessage: "No se pudo cerrar la sesión.",
        };
      }),
    },
    {
      id: "close-all",
      label: "Cerrar todas las sesiones",
      icon: LogOut,
      danger: true,
      visible: ({ member }) => member.sessions.length > 1,
      confirm: ({ member }) => ({
        title: `¿Cerrar todas las sesiones de ${member.name}?`,
        message: `Se cierran ${devices(member.sessions.length)}. Para volver a entrar tiene que escanear el QR de nuevo.`,
        confirmLabel: "Cerrar todas",
        danger: true,
      }),
      run: ({ actions }) => actions.closeAllSessions(),
      successMessage: "Sesiones cerradas.",
      errorMessage: "No se pudieron cerrar las sesiones.",
    },
    { type: "separator" },
    {
      id: "pause",
      label: "Pausar",
      icon: Pause,
      visible: ({ member }) => member.active,
      // Pausar cierra sus sesiones: si hay alguna abierta, confirma.
      confirm: (context) => (context.member.sessions.length === 0 || pending(context) ? null : {
        title: `¿Pausar a ${context.member.name}?`,
        message: `Se cierran sus sesiones (${devices(context.member.sessions.length)}) y queda sin acceso hasta que lo actives.`,
        confirmLabel: "Pausar",
        danger: true,
      }),
      run: ({ actions }) => actions.setActive(false),
      errorMessage: `No se pudo pausar el ${noun}.`,
    },
    {
      id: "activate",
      label: "Activar",
      icon: Play,
      visible: ({ member }) => !member.active,
      run: ({ actions }) => actions.setActive(true),
      errorMessage: `No se pudo activar el ${noun}.`,
    },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      confirm: (context) => (pending(context) ? null : {
        title: `¿Eliminar a ${context.member.name}?`,
        message: `Se cierran sus sesiones${context.member.sessions.length ? ` (${devices(context.member.sessions.length)})` : ""}. ${kind === "waiter" ? "Sus pedidos y mesas conservan" : "Sus entregas conservan"} el nombre.`,
        confirmLabel: "Eliminar",
        danger: true,
      }),
      run: ({ actions }) => actions.remove(),
      errorMessage: `No se pudo eliminar el ${noun}.`,
    },
  ];
}

export function buildStaffPageMenu(kind: StaffKind): ContextMenuItem<{ actions: { add: () => void } }>[] {
  return [{ id: "add", label: `Agregar ${NOUN[kind]}`, icon: UserPlus, run: ({ actions }) => actions.add() }];
}
