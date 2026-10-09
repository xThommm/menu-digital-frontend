import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  DollarSign,
  Inbox,
  Mail,
  MailOpen,
  Settings2,
  Trash2,
  Undo2,
  UserPlus,
} from "lucide-react";
import {
  bulkUpdateAdminNotifications,
  deleteAdminNotification,
  listAdminNotifications,
  markAllAdminNotificationsRead,
  openAdminNotification,
  updateAdminNotification,
  type AdminNotification,
  type AdminNotificationBox,
  type AdminNotificationBulkAction,
  type AdminNotificationStatus,
  type AdminNotificationsResponse,
  type AdminNotificationType,
} from "../../../api/adminNotifications";
import { useNotifications } from "../../../context/useNotifications";
import { ADMIN_NOTIFICATIONS_KEY, adminNotificationsUnreadKey } from "../../../hooks/useAdminNotifications";
import { extractServerMessage } from "../../../lib/apiErrors";
import { formatDateAR } from "../../../lib/dates";
import PushSettings from "./PushSettings";
import s from "./AdminNotifications.module.css";

const PAGE_SIZE = 20;

const TYPE_META: Record<AdminNotificationType, { label: string; icon: ReactNode }> = {
  registration: { label: "Registro", icon: <UserPlus size={18} strokeWidth={1.5} /> },
  payment: { label: "Pago", icon: <DollarSign size={18} strokeWidth={1.5} /> },
  payment_failed: { label: "Pago rechazado", icon: <CircleAlert size={18} strokeWidth={1.5} /> },
  refund: { label: "Reembolso", icon: <Undo2 size={18} strokeWidth={1.5} /> },
  subscription: { label: "Suscripción", icon: <CalendarClock size={18} strokeWidth={1.5} /> },
  test: { label: "Prueba", icon: <BellRing size={18} strokeWidth={1.5} /> },
  other: { label: "Aviso", icon: <Bell size={18} strokeWidth={1.5} /> },
};

// Texto del botón que lleva a la sección del aviso.
const LINK_LABEL: Record<string, string> = {
  "/admin": "Ir al panel",
  "/admin/payments": "Ver pagos",
};

const STATUS_OPTIONS: { value: AdminNotificationStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "No leídas" },
  { value: "read", label: "Leídas" },
];

const formatShortDate = (iso: string) => formatDateAR(iso, {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatLongDate = (iso: string | null) => formatDateAR(iso, {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AdminNotifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useNotifications();
  const [box, setBox] = useState<AdminNotificationBox>("inbox");
  const [status, setStatus] = useState<AdminNotificationStatus>("all");
  const [page, setPage] = useState(1);
  const [openID, setOpenID] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const listKey = [...ADMIN_NOTIFICATIONS_KEY, "list", box, status, page] as const;
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => listAdminNotifications({ box, status, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const notifications = list.data?.notifications ?? [];
  const pagination = list.data?.pagination;
  const unreadCount = list.data?.unreadCount ?? 0;
  const allSelected = notifications.length > 0 && notifications.every((n) => selected.has(n.id));

  const resetView = () => {
    setPage(1);
    setOpenID(null);
    setSelected(new Set());
  };

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ADMIN_NOTIFICATIONS_KEY });

  // Si una acción saca de la vista todo lo que había en esta página (no la
  // primera), volver a la anterior en vez de quedar en una página vacía.
  const afterRemoving = (count: number) => {
    if (page > 1 && count >= notifications.length) setPage(page - 1);
  };

  // Cambio local inmediato en la página visible + contador; lo que haga falta
  // reordenar o sacar de la lista llega con el refetch.
  const patchLocal = (ids: string[], changes: Partial<AdminNotification>, unread?: number) => {
    queryClient.setQueryData<AdminNotificationsResponse>(listKey, (current) => current && {
      ...current,
      unreadCount: unread ?? current.unreadCount,
      notifications: current.notifications.map((n) => (ids.includes(n.id) ? { ...n, ...changes } : n)),
    });
    if (unread !== undefined) queryClient.setQueryData(adminNotificationsUnreadKey, unread);
  };

  const run = async (action: () => Promise<unknown>, errorMessage: string) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(extractServerMessage(err, errorMessage));
    } finally {
      setBusy(false);
    }
  };

  // Abrir = expandir el detalle; el backend la marca como leída. No se
  // refetchea la lista para que no desaparezca si el filtro es "No leídas".
  const toggleOpen = async (notification: AdminNotification) => {
    if (openID === notification.id) {
      setOpenID(null);
      return;
    }
    setOpenID(notification.id);
    if (notification.read) return;

    patchLocal([notification.id], { read: true, readAt: new Date().toISOString() }, Math.max(0, unreadCount - 1));
    try {
      const updated = await openAdminNotification(notification.id);
      patchLocal([notification.id], updated);
    } catch {
      // Si falló, el contador real vuelve con el próximo refetch.
    } finally {
      void queryClient.invalidateQueries({ queryKey: adminNotificationsUnreadKey });
    }
  };

  const setRead = (notification: AdminNotification, read: boolean) => run(async () => {
    await updateAdminNotification(notification.id, { read });
    patchLocal(
      [notification.id],
      { read, readAt: read ? new Date().toISOString() : null },
      notification.archived ? undefined : Math.max(0, unreadCount + (read ? -1 : 1)),
    );
    void refreshAll();
  }, "No se pudo actualizar la notificación.");

  const setArchived = (notification: AdminNotification, archived: boolean) => run(async () => {
    await updateAdminNotification(notification.id, { archived });
    if (openID === notification.id) setOpenID(null);
    afterRemoving(1);
    toast.info(archived ? "Notificación archivada" : "Notificación movida a la bandeja");
    await refreshAll();
  }, "No se pudo archivar la notificación.");

  const remove = (notification: AdminNotification) => {
    if (!window.confirm(`¿Eliminar "${notification.title}"? No se puede deshacer.`)) return;
    return run(async () => {
      await deleteAdminNotification(notification.id);
      if (openID === notification.id) setOpenID(null);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
      afterRemoving(1);
      toast.info("Notificación eliminada");
      await refreshAll();
    }, "No se pudo eliminar la notificación.");
  };

  const applyBulk = (action: AdminNotificationBulkAction) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !window.confirm(
      `¿Eliminar ${ids.length} notificación(es)? No se puede deshacer.`
    )) return;

    return run(async () => {
      await bulkUpdateAdminNotifications(ids, action);
      setSelected(new Set());
      const leavesView = (action !== "read" && action !== "unread") || status !== "all";
      if (leavesView) {
        setOpenID(null);
        afterRemoving(ids.length);
      }
      await refreshAll();
    }, "No se pudo aplicar la acción a la selección.");
  };

  const markAllRead = () => run(async () => {
    await markAllAdminNotificationsRead();
    await refreshAll();
  }, "No se pudieron marcar como leídas.");

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(notifications.map((n) => n.id)));
  };

  const emptyText = box === "archived"
    ? "No hay notificaciones archivadas."
    : status === "unread"
      ? "No tenés notificaciones sin leer."
      : status === "read"
        ? "No hay notificaciones leídas."
        : "Todavía no hay notificaciones. Acá vas a ver los registros, los pagos y los vencimientos de planes.";

  return (
    <div className={s.wrap}>
      <header className={s.topBar}>
        <div className={s.topBarInner}>
          <div>
            <p className={s.eyebrow}>Avisos del sistema</p>
            <h1 className={s.title}>Notificaciones</h1>
          </div>
          {unreadCount > 0 && (
            // La key reinicia el "pop" del badge cada vez que cambia el número.
            <span key={unreadCount} className={s.unreadBadge}>{unreadCount} sin leer</span>
          )}
          <button
            type="button"
            className={s.ghostButton}
            onClick={markAllRead}
            disabled={busy || unreadCount === 0}
          >
            <CheckCheck size={16} strokeWidth={1.75} aria-hidden />
            <span>Marcar todas como leídas</span>
          </button>
          <button
            type="button"
            className={`${s.ghostButton} ${s.ghostButtonNext} ${settingsOpen ? s.ghostButtonActive : ""}`}
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-controls="push-settings"
          >
            <Settings2 size={16} strokeWidth={1.75} aria-hidden />
            <span>Dispositivos y avisos</span>
          </button>
        </div>
      </header>

      <main className={s.content}>
        {settingsOpen && <PushSettings />}

        <div className={s.toolbar}>
          <div className={s.tabs} role="tablist" aria-label="Carpeta">
            <button
              type="button"
              role="tab"
              aria-selected={box === "inbox"}
              className={`${s.tab} ${box === "inbox" ? s.tabActive : ""}`}
              onClick={() => { setBox("inbox"); resetView(); }}
            >
              <Inbox size={16} strokeWidth={1.75} aria-hidden /> Bandeja
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={box === "archived"}
              className={`${s.tab} ${box === "archived" ? s.tabActive : ""}`}
              onClick={() => { setBox("archived"); resetView(); }}
            >
              <Archive size={16} strokeWidth={1.75} aria-hidden /> Archivadas
            </button>
          </div>

          <div className={s.chips} role="group" aria-label="Filtrar por estado">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${s.chip} ${status === option.value ? s.chipActive : ""}`}
                aria-pressed={status === option.value}
                onClick={() => { setStatus(option.value); resetView(); }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <section className={s.panel} aria-busy={list.isFetching}>
          {list.isFetching && !list.isPending && <div className={s.fetchBar} aria-hidden />}
          <div className={s.panelHeader}>
            <label className={s.checkboxLabel}>
              <input
                type="checkbox" className="md-check"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }}
                onChange={toggleSelectAll}
                disabled={notifications.length === 0}
                aria-label="Seleccionar todas las de esta página"
              />
            </label>

            {selected.size > 0 ? (
              <div className={s.bulkBar} role="group" aria-label="Acciones sobre la selección">
                <span className={s.bulkCount}>{selected.size} seleccionada(s)</span>
                <button type="button" onClick={() => applyBulk("read")} disabled={busy}>
                  <MailOpen size={15} strokeWidth={1.75} aria-hidden /> Marcar leídas
                </button>
                <button type="button" onClick={() => applyBulk("unread")} disabled={busy}>
                  <Mail size={15} strokeWidth={1.75} aria-hidden /> Marcar no leídas
                </button>
                {box === "inbox" ? (
                  <button type="button" onClick={() => applyBulk("archive")} disabled={busy}>
                    <Archive size={15} strokeWidth={1.75} aria-hidden /> Archivar
                  </button>
                ) : (
                  <button type="button" onClick={() => applyBulk("unarchive")} disabled={busy}>
                    <ArchiveRestore size={15} strokeWidth={1.75} aria-hidden /> A la bandeja
                  </button>
                )}
                <button type="button" className={s.danger} onClick={() => applyBulk("delete")} disabled={busy}>
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden /> Eliminar
                </button>
              </div>
            ) : (
              <span className={s.panelHint}>
                {pagination ? `${pagination.total} notificación(es)` : "Cargando…"}
              </span>
            )}
          </div>

          {list.isError && (
            <div className={s.errorBanner}>
              {extractServerMessage(list.error, "No se pudieron cargar las notificaciones.")}
            </div>
          )}

          {list.isPending ? (
            <div className={s.loadingState}><div className="pageLoaderRing" /></div>
          ) : notifications.length === 0 ? (
            <div className={s.emptyState}>
              <span className={s.emptyIcon} aria-hidden>
                {box === "archived" ? <Archive size={26} strokeWidth={1.5} /> : <Inbox size={26} strokeWidth={1.5} />}
              </span>
              <p>{emptyText}</p>
            </div>
          ) : (
            // La key repite la entrada escalonada al cambiar de carpeta, filtro
            // o página, pero no en los refetch de fondo.
            <ul key={`${box}-${status}-${page}`} className={s.list}>
              {notifications.map((notification, index) => {
                const open = openID === notification.id;
                const meta = TYPE_META[notification.type] ?? TYPE_META.other;
                const detailID = `notification-detail-${notification.id}`;
                return (
                  <li
                    key={notification.id}
                    className={`${s.row} ${notification.read ? "" : s.rowUnread} ${open ? s.rowOpen : ""} ${selected.has(notification.id) ? s.rowSelected : ""}`}
                    style={{ "--i": Math.min(index, 12) } as CSSProperties}
                  >
                    <div className={s.rowMain}>
                      <label className={s.checkboxLabel}>
                        <input
                          type="checkbox" className="md-check"
                          checked={selected.has(notification.id)}
                          onChange={() => toggleSelected(notification.id)}
                          aria-label={`Seleccionar "${notification.title}"`}
                        />
                      </label>

                      <button
                        type="button"
                        className={s.rowButton}
                        onClick={() => toggleOpen(notification)}
                        aria-expanded={open}
                        aria-controls={detailID}
                      >
                        <span className={`${s.typeIcon} ${s[`type_${notification.type}`] ?? ""}`} aria-hidden>
                          {meta.icon}
                        </span>
                        <span className={s.rowText}>
                          <span className={s.rowTitle}>
                            {!notification.read && (
                              <>
                                <span className={s.unreadDot} aria-hidden />
                                <span className="sr-only">No leída: </span>
                              </>
                            )}
                            {notification.title}
                          </span>
                          {!open && notification.body && <span className={s.rowBody}>{notification.body}</span>}
                        </span>
                        <time className={s.rowDate} dateTime={notification.createdAt}>
                          {formatShortDate(notification.createdAt)}
                        </time>
                      </button>

                      <div className={s.rowActions}>
                        <IconButton
                          label={notification.read ? "Marcar como no leída" : "Marcar como leída"}
                          onClick={() => setRead(notification, !notification.read)}
                          disabled={busy}
                        >
                          {notification.read ? <Mail size={16} strokeWidth={1.75} /> : <MailOpen size={16} strokeWidth={1.75} />}
                        </IconButton>
                        <IconButton
                          label={notification.archived ? "Mover a la bandeja" : "Archivar"}
                          onClick={() => setArchived(notification, !notification.archived)}
                          disabled={busy}
                        >
                          {notification.archived
                            ? <ArchiveRestore size={16} strokeWidth={1.75} />
                            : <Archive size={16} strokeWidth={1.75} />}
                        </IconButton>
                        <IconButton
                          label="Eliminar"
                          onClick={() => remove(notification)}
                          disabled={busy}
                          danger
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    </div>

                    {open && (
                      <div id={detailID} className={s.detail}>
                        {notification.body && <p className={s.detailBody}>{notification.body}</p>}
                        <dl className={s.detailMeta}>
                          <div><dt>Tipo</dt><dd>{meta.label}</dd></div>
                          <div><dt>Recibida</dt><dd>{formatLongDate(notification.createdAt)}</dd></div>
                          {notification.readAt && (
                            <div><dt>Leída</dt><dd>{formatLongDate(notification.readAt)}</dd></div>
                          )}
                        </dl>
                        {notification.url && notification.url !== "/admin/notifications" && (
                          <button
                            type="button"
                            className={s.primaryButton}
                            onClick={() => navigate(notification.url)}
                          >
                            {LINK_LABEL[notification.url] ?? "Ir a la sección"}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {pagination && pagination.pages > 1 && (
            <nav className={s.pagination} aria-label="Paginación de notificaciones">
              <button
                type="button"
                onClick={() => { setPage((current) => current - 1); setSelected(new Set()); setOpenID(null); }}
                disabled={page <= 1 || list.isFetching}
              >
                Anterior
              </button>
              <span>Página {pagination.page} de {pagination.pages}</span>
              <button
                type="button"
                onClick={() => { setPage((current) => current + 1); setSelected(new Set()); setOpenID(null); }}
                disabled={page >= pagination.pages || list.isFetching}
              >
                Siguiente
              </button>
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${s.iconButton} ${danger ? s.iconButtonDanger : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
