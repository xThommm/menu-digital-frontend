import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotificationMenu, buildNotificationSelectionMenu, buildNotificationsPageMenu, buildPushDeviceMenu,
} from "../src/components/Admin/Notifications/notificationsMenu.ts";
import type { AdminNotification } from "../src/api/adminNotifications.ts";
import { action, ids, recorder, resolve, run } from "./support/menu.ts";

const notification = (overrides: Partial<AdminNotification> = {}) => ({
  id: "n1", type: "payment", title: "Pago aprobado", body: "", url: "/admin/payments", read: false, readAt: null, archived: false,
  createdAt: "2026-10-14T00:00:00Z", ...overrides,
} as AdminNotification);

test("una notificación: abrir destino, leída/no leída, archivar y eliminar con confirmación", async () => {
  const { calls, fn } = recorder();
  const actions = { setRead: fn("read"), setArchived: fn("archive"), remove: fn("delete"), openTarget: fn("open") };
  const items = resolve(buildNotificationMenu(), { notification: notification(), hasTarget: true, busy: false, actions });
  assert.deepEqual(ids(items), ["open", "read", "archive", "delete"]);
  assert.equal(action(items, "read").label, "Marcar como leída");

  const remove = action(items, "delete");
  assert.equal(remove.confirm?.danger, true);
  assert.equal((await run(remove, { accept: false })).outcome, "cancelled");
  assert.deepEqual(calls, []);
  await run(remove);
  await run(action(items, "read"));
  assert.deepEqual(calls, ["delete #n1", "read #n1 true"]);

  const archived = resolve(buildNotificationMenu(), { notification: notification({ archived: true, read: true }), hasTarget: false, busy: true, actions });
  assert.deepEqual(ids(archived), ["read", "archive", "delete"]);
  assert.equal(action(archived, "archive").label, "Mover a la bandeja");
  assert.equal(action(archived, "delete").disabled, true);
});

test("varias seleccionadas: las acciones en lote según la carpeta; eliminar confirma", async () => {
  const { calls, fn } = recorder();
  const items = resolve(buildNotificationSelectionMenu(), { count: 3, box: "inbox", busy: false, actions: { apply: fn("apply"), clear: fn("clear") } });
  assert.deepEqual(ids(items), ["read", "unread", "archive", "delete", "clear"]);
  assert.equal(action(items, "delete").confirm?.title, "¿Eliminar 3 notificación(es)?");
  await run(action(items, "archive"));
  await run(action(items, "delete"), { accept: false });
  assert.deepEqual(calls, ['apply "archive"']);
});

test("fondo y dispositivo", async () => {
  const { calls, fn } = recorder();
  const page = resolve(buildNotificationsPageMenu(), {
    unreadCount: 0, hasNotifications: true, allSelected: false, box: "archived", settingsOpen: false, busy: false,
    actions: { markAllRead: fn("all"), toggleSelectAll: fn("select"), setBox: fn("box"), toggleSettings: fn("settings") },
  });
  assert.equal(action(page, "read-all").disabled, true);
  assert.equal(action(page, "archived").disabled, true);
  await run(action(page, "inbox"));
  assert.deepEqual(calls, ['box "inbox"']);

  const device = resolve(buildPushDeviceMenu(), { name: "Chrome en Windows", canTest: false, busy: false, actions: { sendTest: fn("test"), remove: fn("remove") } });
  assert.deepEqual(ids(device), ["remove"]);
  assert.match(action(device, "remove").confirm?.message ?? "", /Chrome en Windows/);
});
