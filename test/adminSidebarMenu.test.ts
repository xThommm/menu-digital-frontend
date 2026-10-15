import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminSidebarMenu, type AdminSidebarMenuContext } from "../src/components/Admin/Panel/adminSidebarMenu.ts";
import { action, ids, recorder, resolve, run } from "./support/menu.ts";

function menu(push: Partial<AdminSidebarMenuContext["push"]>) {
  const { calls, fn } = recorder();
  const items = resolve(buildAdminSidebarMenu(), {
    push: { known: true, available: true, active: false, busy: false, help: null, ...push },
    actions: { togglePush: fn("toggle"), sendTest: fn("test"), openAppearance: fn("appearance") },
  });
  return { items, calls };
}

test("barra del admin: probar y activar/desactivar los avisos de este dispositivo, y la apariencia", async () => {
  const on = menu({ active: true });
  assert.deepEqual(ids(on.items), ["push-test", "push-toggle", "appearance"]);
  assert.equal(action(on.items, "push-toggle").label, "Desactivar notificaciones");
  await run(action(on.items, "push-test"));
  await run(action(on.items, "appearance"));
  assert.deepEqual(on.calls, ["test", "appearance"]);

  const off = menu({ active: false });
  assert.deepEqual(ids(off.items), ["push-toggle", "appearance"]);

  const blocked = menu({ available: false, help: "Este navegador no recibe avisos." });
  assert.equal(action(blocked.items, "push-toggle").disabledReason, "Este navegador no recibe avisos.");

  assert.deepEqual(ids(menu({ known: false }).items), ["appearance"], "mientras se consulta, nada de avisos");
});
