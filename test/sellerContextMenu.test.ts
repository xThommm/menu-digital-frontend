import test from "node:test";
import assert from "node:assert/strict";
import { resolveMenuItems, runMenuAction } from "../src/features/contextMenu/lib/contextMenu.ts";
import type { ResolvedAction, ResolvedItem } from "../src/features/contextMenu/types.ts";
import {
  buildSellerMenu, buildSellersPageMenu, type SellerMenuHandlers,
} from "../src/components/Admin/Sellers/sellerContextMenu.ts";
import {
  generateTestPassword, isValidTestUsername, suggestTestUsername,
} from "../src/components/Admin/Sellers/sellerTestUser.ts";
import type { Seller } from "../src/api/adminSellers.ts";

const seller = (overrides: Partial<Seller> = {}): Seller => ({
  _id: "64f000000000000000000401",
  name: "Carla",
  dni: "30111222",
  code: "CAR-401",
  mail: "carla@example.com",
  number: 1123456789,
  active: true,
  admin: false,
  influencer: false,
  receivesLeads: false,
  startDate: null,
  profilePicture: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

function handlers() {
  const calls: string[] = [];
  const value: SellerMenuHandlers = {
    viewProfile: (s) => { calls.push(`profile:${s.name}`); },
    createTestUser: (s) => { calls.push(`test-user:${s.name}`); },
    deactivate: async (s) => { calls.push(`deactivate:${s._id}`); },
    reactivate: async (s) => { calls.push(`reactivate:${s._id}`); },
  };
  return { calls, value };
}

const flatten = (items: ResolvedItem[]): ResolvedItem[] =>
  items.flatMap((item) => (item.type === "submenu" ? [item, ...flatten(item.items)] : [item]));

const ids = (items: ResolvedItem[]) => flatten(items).filter((item) => item.type !== "separator").map((item) => item.id);

const action = (items: ResolvedItem[], id: string): ResolvedAction => {
  const found = flatten(items).find((item) => item.id === id);
  assert.equal(found?.type, "action", `falta la acción ${id}`);
  return found as ResolvedAction;
};

function runner(accept = true) {
  const notices: string[] = [];
  return {
    notices,
    deps: {
      confirm: async () => accept,
      notifySuccess: (message: string) => notices.push(`ok:${message}`),
      notifyError: (message: string) => notices.push(`error:${message}`),
    },
  };
}

test("un vendedor activo ofrece perfil, copiar, usuario de prueba y dar de baja", () => {
  const { value } = handlers();
  const items = resolveMenuItems(buildSellerMenu(value), seller());

  assert.deepEqual(ids(items), [
    "profile", "copy", "copy/code", "copy/mail", "copy/number", "test-user", "deactivate",
  ]);
  assert.equal(action(items, "test-user").disabled, false);
  assert.equal(action(items, "deactivate").danger, true);
});

test("un vendedor dado de baja ofrece deshacer la baja y no deja crearle usuario de prueba", () => {
  const { value } = handlers();
  const items = resolveMenuItems(buildSellerMenu(value), seller({ active: false, number: null }));

  assert.deepEqual(ids(items), ["profile", "copy", "copy/code", "copy/mail", "test-user", "reactivate"]);
  assert.equal(action(items, "test-user").disabled, true);
  assert.equal(action(items, "test-user").disabledReason, "El vendedor está dado de baja");
});

test("ver perfil y crear usuario de prueba abren su pantalla con el vendedor clickeado, sin confirmar ni avisar", async () => {
  const { calls, value } = handlers();
  const items = resolveMenuItems(buildSellerMenu(value), seller());
  const { notices, deps } = runner();

  assert.equal(action(items, "profile").confirm, null);
  assert.equal(await runMenuAction(action(items, "profile"), deps), "done");
  assert.equal(await runMenuAction(action(items, "test-user"), deps), "done");

  assert.deepEqual(calls, ["profile:Carla", "test-user:Carla"]);
  assert.deepEqual(notices, []);
});

test("dar de baja pide confirmación destructiva y recién después llama a la operación", async () => {
  const { calls, value } = handlers();
  const deactivate = action(resolveMenuItems(buildSellerMenu(value), seller()), "deactivate");

  assert.equal(deactivate.confirm?.title, "¿Dar de baja a Carla?");
  assert.equal(deactivate.confirm?.danger, true);

  const cancelled = runner(false);
  assert.equal(await runMenuAction(deactivate, cancelled.deps), "cancelled");
  assert.deepEqual(calls, []);

  const accepted = runner(true);
  assert.equal(await runMenuAction(deactivate, accepted.deps), "done");
  assert.deepEqual(calls, ["deactivate:64f000000000000000000401"]);
  assert.deepEqual(accepted.notices, ["ok:Carla dado de baja."]);
});

test("deshacer la baja confirma, reactiva y avisa; si el backend falla muestra el error", async () => {
  const { calls, value } = handlers();
  const inactive = seller({ active: false });
  const reactivate = action(resolveMenuItems(buildSellerMenu(value), inactive), "reactivate");

  assert.equal(reactivate.confirm?.title, "¿Deshacer la baja de Carla?");
  assert.notEqual(reactivate.confirm?.danger, true);

  const ok = runner();
  assert.equal(await runMenuAction(reactivate, ok.deps), "done");
  assert.deepEqual(calls, ["reactivate:64f000000000000000000401"]);
  assert.deepEqual(ok.notices, ["ok:Carla vuelve a estar activo."]);

  const failing = action(resolveMenuItems(buildSellerMenu({
    ...value,
    reactivate: async () => { throw new Error("500"); },
  }), inactive), "reactivate");
  const failed = runner();
  assert.equal(await runMenuAction(failing, failed.deps), "failed");
  assert.deepEqual(failed.notices, ["error:No se pudo deshacer la baja."]);
});

test("el menú general crea, actualiza y cambia la vista, marcando la vista actual", async () => {
  const calls: string[] = [];
  const menu = buildSellersPageMenu({
    createSeller: () => { calls.push("create"); },
    refresh: async () => { calls.push("refresh"); },
    setStatusFilter: (value) => { calls.push(`status:${value}`); },
  });

  const items = resolveMenuItems(menu, { statusFilter: "active" });
  assert.deepEqual(ids(items), ["create", "status", "status/active", "status/inactive", "status/all", "refresh"]);
  assert.equal(action(items, "status/active").disabled, true);
  assert.equal(action(items, "status/inactive").disabled, false);

  const { deps } = runner();
  await runMenuAction(action(items, "create"), deps);
  await runMenuAction(action(items, "status/inactive"), deps);
  await runMenuAction(action(items, "status/all"), deps);
  await runMenuAction(action(items, "status/active"), deps); // deshabilitada: no corre
  await runMenuAction(action(items, "refresh"), deps);
  assert.deepEqual(calls, ["create", "status:inactive", "status:", "refresh"]);

  const all = resolveMenuItems(menu, { statusFilter: "" });
  assert.equal(action(all, "status/all").disabled, true);
});

test("el usuario de prueba sugerido es válido para el backend (sin guiones)", () => {
  assert.equal(suggestTestUsername("CAR-401"), "democar401");
  assert.equal(isValidTestUsername(suggestTestUsername("CAR-401")), true);
  assert.equal(isValidTestUsername("demo-car"), false);
  assert.equal(isValidTestUsername("   "), false);
});

test("la contraseña sugerida cumple el mínimo y no se repite", () => {
  const passwords = new Set(Array.from({ length: 20 }, generateTestPassword));
  assert.equal(passwords.size, 20);
  for (const password of passwords) assert.match(password, /^[a-zA-Z2-9]{10}$/);
});
