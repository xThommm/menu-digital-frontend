import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCrmClientMenu, buildCrmPageMenu, followUpDate, type CrmClientMenuActions,
} from "../src/components/Seller/Crm/crmContextMenu.ts";
import type { CrmClient, CrmStage } from "../src/types/index.ts";
import { action, fakeEnv, ids, recorder, resolve, run, submenu } from "./support/menu.ts";

const STAGES: { value: CrmStage; label: string }[] = [
  { value: "lead", label: "Lead" }, { value: "onboarding", label: "Onboarding" }, { value: "activo", label: "Activo" },
];

const client = (overrides: Partial<CrmClient> = {}): CrmClient => ({
  _id: "u1", username: "lodelucas", businessName: "Lo de Lucas", slug: "lo-de-lucas", subscription: "pro", active: true,
  createdAt: "2026-01-01T00:00:00Z", contactInfo: { mail: "lucas@example.com", number: 1123456789 }, stage: "lead", tags: ["vip"],
  nextFollowUp: null, ...overrides,
} as CrmClient);

function menu(target: CrmClient, { isAdmin = false, busy = false } = {}) {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions: CrmClientMenuActions = {
    open: fn("open"),
    setStage: async (c, stage) => { calls.push(`stage #${c._id} ${stage}`); },
    setFollowUp: async (c, date) => { calls.push(`follow #${c._id} ${date}`); },
    pickFollowUp: fn("pick"),
    addNote: fn("note"),
    addTag: async (c, tag) => { calls.push(`tag #${c._id} ${tag}`); },
    newTag: fn("new-tag"),
    assign: async (c, seller) => { calls.push(`assign #${c._id} ${seller}`); },
    setActive: async (c, active) => { calls.push(`active #${c._id} ${active}`); },
  };
  const items = resolve(buildCrmClientMenu(env), {
    client: target, isAdmin, stages: STAGES, knownTags: ["vip", "demo", "pizza"],
    receivers: [{ _id: "s1", name: "Carla" }, { _id: "s2", name: "Tomás" }], busy, origin: "https://app", actions,
  });
  return { items, calls, log };
}

test("seguimiento: mañana, en 3 días y en una semana, en fecha de Buenos Aires", () => {
  const now = new Date("2026-10-14T02:30:00Z"); // 13/10 23:30 en Buenos Aires
  assert.equal(followUpDate(0, now), "2026-10-13");
  assert.equal(followUpDate(1, now), "2026-10-14");
  assert.equal(followUpDate(7, now), "2026-10-20");
});

test("vendedor: ficha, etapa, seguimiento, nota, etiquetas, contacto y copiar; nada de admin", () => {
  const list = ids(menu(client()).items);
  assert.deepEqual(list.filter((id) => !id.includes("/")), ["open", "stage", "follow-up", "note", "tag", "whatsapp", "mail", "menu", "copy"]);
  assert.ok(!list.includes("payments") && !list.includes("deactivate") && !list.includes("assign"));
});

test("etapa: la actual queda deshabilitada y mover avisa", async () => {
  const { items, calls } = menu(client({ stage: "lead" }));
  assert.equal(action(items, "stage/lead").disabled, true);
  const moved = await run(action(items, "stage/activo"));
  assert.deepEqual(moved.notices, ["ok:Cliente movido a Activo."]);
  assert.deepEqual(calls, ["stage #u1 activo"]);

  assert.equal(submenu(menu(client(), { busy: true }).items, "stage").disabled, true);
});

test("seguimiento y etiquetas: atajos, elegir fecha, sacar, y etiquetas que el cliente no tiene", async () => {
  const { items, calls } = menu(client({ nextFollowUp: "2026-10-20" }));
  assert.ok(ids(items).includes("follow-up/clear"));
  await run(action(items, "follow-up/pick"));
  await run(action(items, "follow-up/clear"));
  assert.deepEqual(calls, ["pick #u1", "follow #u1 null"]);

  const tags = submenu(items, "tag").items.filter((entry) => entry.type !== "separator").map((entry) => entry.label);
  assert.deepEqual(tags, ["demo", "pizza", "Nueva etiqueta…"], "vip ya la tiene");
  await run(action(items, "tag/tag-demo"));
  assert.equal(calls.at(-1), "tag #u1 demo");

  assert.ok(!ids(menu(client()).items).includes("follow-up/clear"), "sin seguimiento no hay qué sacar");
});

test("contacto y copiar: WhatsApp, mail, carta y datos", async () => {
  const { items, log } = menu(client());
  await run(action(items, "mail"));
  await run(action(items, "menu"));
  await run(action(items, "copy/menu-link"));
  await run(action(items, "copy/username"));
  assert.deepEqual(log, [
    "open:mailto:lucas@example.com", "open:https://app/lo-de-lucas/menu", "copy:https://app/lo-de-lucas/menu", "copy:lodelucas",
  ]);

  const noContact = ids(menu(client({ contactInfo: { mail: "", number: null } as CrmClient["contactInfo"] })).items);
  assert.ok(!noContact.includes("whatsapp") && !noContact.includes("mail") && !noContact.includes("copy/phone"));
});

test("admin: pagos, reasignar leads de influencer y desactivar con confirmación", async () => {
  const lead = client({ leadSource: "influencer", assignedSeller: { _id: "s1", name: "Carla" } } as Partial<CrmClient>);
  const { items, calls, log } = menu(lead, { isAdmin: true });
  assert.equal(action(items, "assign/s1").disabled, true, "ya es el encargado");
  await run(action(items, "assign/s2"));
  await run(action(items, "payments"));
  assert.deepEqual(log, ["go:/admin/payments?userID=u1"]);

  const deactivate = action(items, "deactivate");
  assert.equal(deactivate.danger, true);
  assert.equal(deactivate.confirm?.danger, true);
  assert.equal((await run(deactivate, { accept: false })).outcome, "cancelled");
  await run(deactivate);
  assert.deepEqual(calls, ["assign #u1 s2", "active #u1 false"]);

  const inactive = menu(client({ active: false }), { isAdmin: true });
  assert.ok(ids(inactive.items).includes("activate") && !ids(inactive.items).includes("deactivate"));
  assert.ok(!ids(inactive.items).includes("assign"), "solo los leads de influencers tienen encargado");
});

test("fondo: exportar (admin), limpiar filtros y cambiar de vista", async () => {
  const { calls, fn } = recorder();
  const actions = { exportExcel: fn("export"), clearFilters: fn("clear"), setView: fn("view") };
  const seller = resolve(buildCrmPageMenu(), { isAdmin: false, view: "list", activeFilters: 0, exporting: false, actions });
  assert.deepEqual(ids(seller), ["clear", "list", "kanban"]);
  assert.equal(action(seller, "clear").disabled, true);
  assert.equal(action(seller, "list").disabled, true);
  await run(action(seller, "kanban"));
  assert.deepEqual(calls, ['view "kanban"']);
});
