import test from "node:test";
import assert from "node:assert/strict";
import { buildIndicatorMenu, buildRecentClientMenu, INDICATOR } from "../src/components/Admin/Panel/dashboardAdminMenu.ts";
import { buildPlanMenu, type PlanMenuContext } from "../src/components/Admin/Plans/plansMenu.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

test("plan: guardar y deshacer solo con cambios (deshacer confirma); ver sus cuentas en el CRM", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const context = (overrides: Partial<PlanMenuContext> = {}): PlanMenuContext => ({
    plan: { name: "pro", label: "Pro" }, dirty: true, busy: false, conflict: false,
    actions: { save: fn("save"), reset: fn("reset") }, ...overrides,
  });
  const items = resolve(buildPlanMenu(env), context());
  assert.deepEqual(ids(items), ["save", "reset", "crm"]);
  assert.equal(action(items, "save").label, "Guardar Pro");
  const reset = action(items, "reset");
  assert.equal(reset.confirm?.title, "¿Deshacer la edición de Pro?");
  assert.equal((await run(reset, { accept: false })).outcome, "cancelled");
  await run(reset);
  await run(action(items, "save"));
  await run(action(items, "crm"));
  assert.deepEqual(calls, ["reset", "save"]);
  assert.deepEqual(log, ["go:/sellers/crm?plan=pro"]);

  assert.equal(action(resolve(buildPlanMenu(env), context({ dirty: false })), "save").disabledReason, "No hay cambios sin guardar");
  assert.equal(action(resolve(buildPlanMenu(env), context({ conflict: true })), "reset").disabledReason, "Primero cargá la versión vigente");
});

test("dashboard — cliente reciente: abrir en el CRM, ver carta y copiar usuario", async () => {
  const { env, log } = fakeEnv();
  const items = resolve(buildRecentClientMenu(env), { client: { _id: "u1", username: "lodelucas", slug: "lo-de-lucas" }, origin: "https://app" });
  assert.deepEqual(ids(items), ["crm", "menu", "copy", "copy/username", "copy/menu-link"]);
  await run(action(items, "crm"));
  await run(action(items, "menu"));
  await run(action(items, "copy/username"));
  assert.deepEqual(log, ["go:/sellers/crm?client=u1", "open:https://app/lo-de-lucas/menu", "copy:lodelucas"]);

  const noSlug = resolve(buildRecentClientMenu(env), { client: { _id: "u2", username: "nuevo", slug: null }, origin: "https://app" });
  assert.deepEqual(ids(noSlug), ["crm", "copy", "copy/username"]);
});

test("dashboard — indicador: ir al detalle (CRM filtrado, pagos o planes)", async () => {
  const { env, log } = fakeEnv();
  const plan = resolve(buildIndicatorMenu(env), { targets: INDICATOR.plan("basic") });
  assert.deepEqual(ids(plan), ["go-0", "go-1"]);
  assert.equal(action(plan, "go-0").label, "Ver clientes con este plan en el CRM");
  await run(action(plan, "go-0"));
  await run(action(plan, "go-1"));

  const attention = resolve(buildIndicatorMenu(env), { targets: INDICATOR.attention("payment_issue") });
  assert.deepEqual(ids(attention), ["go-0"]);
  await run(action(attention, "go-0"));
  assert.deepEqual(log, ["go:/sellers/crm?plan=basic", "go:/admin/plans", "go:/sellers/crm?attention=payment_issue"]);
});
