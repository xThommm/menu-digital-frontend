import {
  Archive, ArchiveRestore, BellRing, CheckCheck, CheckSquare, ExternalLink, Inbox, Mail, MailOpen, Settings2, Trash2,
} from "lucide-react";
import type { ContextMenuItem } from "../../../features/contextMenu/types";
import type { AdminNotification } from "../../../api/adminNotifications";

// Clic derecho en la bandeja de notificaciones del admin: una notificación,
// las seleccionadas, el fondo y un dispositivo de avisos. Eliminar y quitar
// un dispositivo piden confirmación.

const BUSY = "Hay una acción en curso";

export interface NotificationMenuActions {
  setRead: (notification: AdminNotification, read: boolean) => void;
  setArchived: (notification: AdminNotification, archived: boolean) => void;
  /** Ya confirmado. */
  remove: (notification: AdminNotification) => void;
  openTarget: (notification: AdminNotification) => void;
}

export interface NotificationMenuContext {
  notification: AdminNotification;
  /** Tiene una sección a la que ir (además de la bandeja). */
  hasTarget: boolean;
  busy: boolean;
  actions: NotificationMenuActions;
}

export function buildNotificationMenu(): ContextMenuItem<NotificationMenuContext>[] {
  const idle = ({ busy }: NotificationMenuContext) => busy && BUSY;
  return [
    { id: "open", label: "Abrir destino", icon: ExternalLink, visible: ({ hasTarget }) => hasTarget, run: ({ notification, actions }) => actions.openTarget(notification) },
    {
      id: "read",
      label: ({ notification }) => (notification.read ? "Marcar como no leída" : "Marcar como leída"),
      icon: MailOpen,
      disabled: idle,
      run: ({ notification, actions }) => actions.setRead(notification, !notification.read),
    },
    {
      id: "archive",
      label: ({ notification }) => (notification.archived ? "Mover a la bandeja" : "Archivar"),
      icon: Archive,
      disabled: idle,
      run: ({ notification, actions }) => actions.setArchived(notification, !notification.archived),
    },
    { type: "separator" },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      danger: true,
      disabled: idle,
      confirm: ({ notification }) => ({
        title: `¿Eliminar "${notification.title}"?`,
        message: "No se puede deshacer.",
        confirmLabel: "Eliminar",
        danger: true,
      }),
      run: ({ notification, actions }) => actions.remove(notification),
    },
  ];
}

export type NotificationBulkAction = "read" | "unread" | "archive" | "unarchive" | "delete";

export interface NotificationSelectionMenuContext {
  count: number;
  box: "inbox" | "archived";
  busy: boolean;
  actions: { apply: (action: NotificationBulkAction) => void; clear: () => void };
}

export function buildNotificationSelectionMenu(): ContextMenuItem<NotificationSelectionMenuContext>[] {
  const idle = ({ busy }: NotificationSelectionMenuContext) => busy && BUSY;
  return [
    { id: "read", label: ({ count }) => `Marcar ${count} como leídas`, icon: MailOpen, disabled: idle, run: ({ actions }) => actions.apply("read") },
    { id: "unread", label: ({ count }) => `Marcar ${count} como no leídas`, icon: Mail, disabled: idle, run: ({ actions }) => actions.apply("unread") },
    { id: "archive", label: ({ count }) => `Archivar ${count}`, icon: Archive, visible: ({ box }) => box === "inbox", disabled: idle, run: ({ actions }) => actions.apply("archive") },
    { id: "unarchive", label: ({ count }) => `Mover ${count} a la bandeja`, icon: ArchiveRestore, visible: ({ box }) => box === "archived", disabled: idle, run: ({ actions }) => actions.apply("unarchive") },
    { type: "separator" },
    {
      id: "delete",
      label: ({ count }) => `Eliminar ${count}`,
      icon: Trash2,
      danger: true,
      disabled: idle,
      confirm: ({ count }) => ({
        title: `¿Eliminar ${count} notificación(es)?`,
        message: "No se puede deshacer.",
        confirmLabel: "Eliminar",
        danger: true,
      }),
      run: ({ actions }) => actions.apply("delete"),
    },
    { id: "clear", label: "Deseleccionar", icon: CheckSquare, run: ({ actions }) => actions.clear() },
  ];
}

export interface NotificationsPageMenuContext {
  unreadCount: number;
  hasNotifications: boolean;
  allSelected: boolean;
  box: "inbox" | "archived";
  settingsOpen: boolean;
  busy: boolean;
  actions: {
    markAllRead: () => void;
    toggleSelectAll: () => void;
    setBox: (box: "inbox" | "archived") => void;
    toggleSettings: () => void;
  };
}

export function buildNotificationsPageMenu(): ContextMenuItem<NotificationsPageMenuContext>[] {
  return [
    {
      id: "read-all",
      label: "Marcar todas como leídas",
      icon: CheckCheck,
      disabled: ({ unreadCount, busy }) => (busy ? BUSY : unreadCount === 0 && "No hay notificaciones sin leer"),
      run: ({ actions }) => actions.markAllRead(),
    },
    {
      id: "select-all",
      label: ({ allSelected }) => (allSelected ? "Deseleccionar todas" : "Seleccionar todas"),
      icon: CheckSquare,
      disabled: ({ hasNotifications }) => !hasNotifications && "No hay notificaciones en esta página",
      run: ({ actions }) => actions.toggleSelectAll(),
    },
    { type: "separator" },
    { id: "inbox", label: "Bandeja", icon: Inbox, disabled: ({ box }) => box === "inbox" && "Es la carpeta actual", run: ({ actions }) => actions.setBox("inbox") },
    { id: "archived", label: "Archivadas", icon: Archive, disabled: ({ box }) => box === "archived" && "Es la carpeta actual", run: ({ actions }) => actions.setBox("archived") },
    { type: "separator" },
    {
      id: "settings",
      label: ({ settingsOpen }) => (settingsOpen ? "Ocultar dispositivos y avisos" : "Dispositivos y avisos"),
      icon: Settings2,
      run: ({ actions }) => actions.toggleSettings(),
    },
  ];
}

// ── Un dispositivo de avisos (PushSettings) ──

export interface PushDeviceMenuContext {
  name: string;
  /** Es este navegador y tiene los avisos activos: se puede mandar una prueba. */
  canTest: boolean;
  busy: boolean;
  actions: { sendTest: () => void; remove: () => void };
}

export function buildPushDeviceMenu(): ContextMenuItem<PushDeviceMenuContext>[] {
  return [
    { id: "test", label: "Enviar prueba", icon: BellRing, visible: ({ canTest }) => canTest, run: ({ actions }) => actions.sendTest() },
    {
      id: "remove",
      label: "Quitar dispositivo",
      icon: Trash2,
      danger: true,
      disabled: ({ busy }) => busy && "Se está quitando un dispositivo",
      confirm: ({ name }) => ({
        title: "¿Quitar este dispositivo?",
        message: `Se dejan de mandar avisos a "${name}".`,
        confirmLabel: "Quitar",
        danger: true,
      }),
      run: ({ actions }) => actions.remove(),
    },
  ];
}
