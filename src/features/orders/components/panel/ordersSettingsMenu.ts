import { Download, Plug, Printer, RefreshCw, Save, Trash2, Unplug } from "lucide-react";
import { copyLinkItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import type { ShiftScheduleEntry } from "../../types";

// Clic derecho en Configuración de pedidos: un QR (general o de mesa), el
// fondo de la sección de QR, un turno del horario, la sección de Mercado Pago
// y el fondo de la pantalla. Regenerar, quitar un turno y desconectar
// Mercado Pago confirman.

// ── QR ──

export interface QrMenuContext {
  /** "QR general" o "Mesa 4". */
  label: string;
  /** "general" o el número de mesa. */
  target: string;
  url: string;
  actions: { download: () => void; print: () => void; regenerate: () => Promise<void> };
}

export function buildQrMenu(env: MenuEnv): ContextMenuItem<QrMenuContext>[] {
  return [
    { id: "download", label: "Descargar", icon: Download, run: ({ actions }) => actions.download() },
    { id: "print", label: "Imprimir", icon: Printer, run: ({ actions }) => actions.print() },
    copyLinkItem<QrMenuContext>(env, { id: "copy", label: "Copiar enlace", url: ({ url }) => url }),
    { type: "separator" },
    {
      id: "regenerate",
      label: "Regenerar",
      icon: RefreshCw,
      danger: true,
      confirm: ({ label, target }) => ({
        title: target === "general" ? "¿Regenerar el QR general?" : `¿Regenerar el QR de la ${label}?`,
        message: target === "general"
          ? "Los QR impresos actuales van a dejar de servir para pedir."
          : `El QR impreso de la ${label} va a dejar de servir.`,
        confirmLabel: "Regenerar",
        danger: true,
      }),
      run: ({ actions }) => actions.regenerate(),
      successMessage: "QR regenerado: imprimí el nuevo.",
      errorMessage: "No se pudo regenerar el QR.",
    },
  ];
}

export interface QrSectionMenuContext {
  general: boolean;
  count: number;
  actions: { printAll: () => void; regenerateAll: () => Promise<void> };
}

export function buildQrSectionMenu(): ContextMenuItem<QrSectionMenuContext>[] {
  return [
    {
      id: "print-all",
      label: ({ general }) => (general ? "Imprimir QR" : "Imprimir todos"),
      icon: Printer,
      disabled: ({ count }) => count === 0 && "Todavía se están generando",
      run: ({ actions }) => actions.printAll(),
    },
    {
      id: "regenerate-all",
      label: ({ general }) => (general ? "Regenerar QR" : "Regenerar todos"),
      icon: RefreshCw,
      danger: true,
      confirm: ({ general }) => ({
        title: general ? "¿Regenerar el QR?" : "¿Regenerar los QR?",
        message: "Los QR impresos actuales van a dejar de servir para pedir.",
        confirmLabel: "Regenerar",
        danger: true,
      }),
      run: ({ actions }) => actions.regenerateAll(),
      successMessage: ({ general }) => (general ? "QR regenerado: imprimí el nuevo." : "QR regenerados: imprimí los nuevos."),
      errorMessage: "No se pudieron regenerar los QR.",
    },
  ];
}

// ── Turno del horario ──

export interface ShiftEntryMenuContext {
  entry: ShiftScheduleEntry;
  actions: { remove: () => void };
}

export function buildShiftEntryMenu(): ContextMenuItem<ShiftEntryMenuContext>[] {
  return [
    {
      id: "remove",
      label: "Quitar turno",
      icon: Trash2,
      danger: true,
      confirm: ({ entry }) => ({
        title: entry.name.trim() ? `¿Quitar el turno ${entry.name.trim()}?` : "¿Quitar este turno?",
        message: "Se aplica al guardar los cambios.",
        confirmLabel: "Quitar",
        danger: true,
      }),
      run: ({ actions }) => actions.remove(),
    },
  ];
}

// ── Mercado Pago ──

export interface MpMenuContext {
  connected: boolean;
  needsReconnect: boolean;
  busy: boolean;
  actions: { connect: () => Promise<void>; disconnect: () => Promise<void> };
}

const MP_BUSY = "Hay una acción en curso";

export function buildMpMenu(): ContextMenuItem<MpMenuContext>[] {
  return [
    {
      id: "connect",
      label: ({ connected, needsReconnect }) => (connected || needsReconnect ? "Reconectar cuenta" : "Conectar Mercado Pago"),
      icon: Plug,
      disabled: ({ busy }) => busy && MP_BUSY,
      run: ({ actions }) => actions.connect(),
      errorMessage: "No se pudo iniciar la conexión con Mercado Pago.",
    },
    {
      id: "disconnect",
      label: "Desconectar",
      icon: Unplug,
      danger: true,
      visible: ({ connected }) => connected,
      disabled: ({ busy }) => busy && MP_BUSY,
      confirm: {
        title: "¿Desconectar Mercado Pago?",
        message: "Se desconecta tu cuenta y los clientes dejan de poder pagar online. Para devolver pagos anteriores vas a tener que volver a conectarla.",
        confirmLabel: "Desconectar",
        danger: true,
      },
      run: ({ actions }) => actions.disconnect(),
      errorMessage: "No se pudo desconectar Mercado Pago.",
    },
  ];
}

// ── Fondo ──

export function buildOrdersSettingsPageMenu(): ContextMenuItem<{ dirty: boolean; saving: boolean; actions: { save: () => void } }>[] {
  return [
    {
      id: "save",
      label: "Guardar cambios",
      icon: Save,
      disabled: ({ dirty, saving }) => (saving ? "Guardando…" : !dirty && "No hay cambios sin guardar"),
      run: ({ actions }) => actions.save(),
    },
  ];
}

