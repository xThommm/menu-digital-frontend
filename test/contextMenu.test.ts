import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ACTION_ERROR, edgeFocusIndex, nextFocusIndex, placeMenu, placeSubmenu,
  resolveMenuItems, runMenuAction, shouldUseNativeMenu,
} from "../src/features/contextMenu/lib/contextMenu.ts";
import type {
  ContextMenuConfirm, ContextMenuItem, ResolvedAction, ResolvedItem,
} from "../src/features/contextMenu/types.ts";

interface Row { name: string; active: boolean; canDelete: boolean }

const row = (overrides: Partial<Row> = {}): Row => ({ name: "Ana", active: true, canDelete: true, ...overrides });

const actionOf = (items: ResolvedItem[], id: string): ResolvedAction => {
  const found = items.find((item) => item.id === id);
  assert.equal(found?.type, "action", `falta la acción ${id}`);
  return found as ResolvedAction;
};

// ── Resolución declarativa ──────────────────────────────────────────────────

test("resuelve textos, visibilidad y estado según el contexto", () => {
  const menu: ContextMenuItem<Row>[] = [
    { id: "open", label: (r) => `Abrir ${r.name}`, run: () => {} },
    { id: "deactivate", label: "Dar de baja", danger: true, visible: (r) => r.active, run: () => {} },
    { id: "reactivate", label: "Deshacer la baja", visible: (r) => !r.active, run: () => {} },
    { id: "delete", label: "Eliminar", disabled: (r) => !r.canDelete && "Sin permiso", run: () => {} },
  ];

  const active = resolveMenuItems(menu, row());
  assert.deepEqual(active.map((item) => item.id), ["open", "deactivate", "delete"]);
  assert.equal(actionOf(active, "open").label, "Abrir Ana");
  assert.equal(actionOf(active, "deactivate").danger, true);
  assert.equal(actionOf(active, "delete").disabled, false);
  assert.equal(actionOf(active, "delete").disabledReason, null);

  const inactive = resolveMenuItems(menu, row({ active: false, canDelete: false }));
  assert.deepEqual(inactive.map((item) => item.id), ["open", "reactivate", "delete"]);
  assert.equal(actionOf(inactive, "delete").disabled, true);
  assert.equal(actionOf(inactive, "delete").disabledReason, "Sin permiso");
});

test("disabled acepta booleano o motivo; un motivo vacío no deshabilita", () => {
  const menu: ContextMenuItem<Row>[] = [
    { id: "a", label: "A", disabled: () => true, run: () => {} },
    { id: "b", label: "B", disabled: () => "  ", run: () => {} },
  ];
  const [a, b] = resolveMenuItems(menu, row());
  assert.deepEqual([a.type !== "separator" && a.disabled, b.type !== "separator" && b.disabled], [true, false]);
});

test("ata cada acción al contexto con el que se abrió el menú", () => {
  const received: Row[] = [];
  const menu: ContextMenuItem<Row>[] = [{ id: "open", label: "Abrir", run: (r) => received.push(r) }];
  const ana = row();
  const beto = row({ name: "Beto" });

  const forAna = resolveMenuItems(menu, ana);
  const forBeto = resolveMenuItems(menu, beto);
  actionOf(forBeto, "open").run();
  actionOf(forAna, "open").run();

  assert.deepEqual(received, [beto, ana]);
});

test("resuelve confirmación y mensajes, fijos o según el contexto", () => {
  const menu: ContextMenuItem<Row>[] = [{
    id: "deactivate",
    label: "Dar de baja",
    confirm: (r) => ({ title: `¿Dar de baja a ${r.name}?`, danger: true }),
    run: () => {},
    successMessage: (r) => `${r.name} dado de baja.`,
    errorMessage: "No se pudo dar de baja.",
  }, { id: "plain", label: "Sin extras", run: () => {} }];

  const items = resolveMenuItems(menu, row());
  const deactivate = actionOf(items, "deactivate");
  assert.deepEqual(deactivate.confirm, { title: "¿Dar de baja a Ana?", danger: true });
  assert.equal(deactivate.successMessage, "Ana dado de baja.");
  assert.equal(deactivate.errorMessage, "No se pudo dar de baja.");

  const plain = actionOf(items, "plain");
  assert.deepEqual([plain.confirm, plain.successMessage, plain.errorMessage], [null, null, null]);
});

test("no deja separadores al principio, al final ni repetidos cuando se ocultan opciones", () => {
  const menu: ContextMenuItem<Row>[] = [
    { type: "separator" },
    { id: "a", label: "A", visible: () => false, run: () => {} },
    { type: "separator" },
    { id: "b", label: "B", run: () => {} },
    { type: "separator" },
    { id: "c", label: "C", visible: () => false, run: () => {} },
    { type: "separator" },
    { id: "d", label: "D", run: () => {} },
    { type: "separator" },
  ];
  const types = resolveMenuItems(menu, row()).map((item) => (item.type === "separator" ? "-" : item.id));
  assert.deepEqual(types, ["b", "-", "d"]);
});

test("un menú sin nada visible queda vacío (el provider deja el menú nativo)", () => {
  const menu: ContextMenuItem<Row>[] = [
    { id: "a", label: "A", visible: () => false, run: () => {} },
    { type: "separator" },
  ];
  assert.deepEqual(resolveMenuItems(menu, row()), []);
});

test("los submenús se resuelven en profundidad y desaparecen si quedan vacíos", () => {
  const menu: ContextMenuItem<Row>[] = [
    {
      type: "submenu",
      id: "copy",
      label: "Copiar",
      items: [
        { id: "name", label: (r) => `Nombre (${r.name})`, run: () => {} },
        { id: "secret", label: "Secreto", visible: () => false, run: () => {} },
      ],
    },
    {
      type: "submenu",
      id: "admin",
      label: "Administrar",
      items: [{ id: "delete", label: "Eliminar", visible: (r) => r.canDelete, run: () => {} }],
    },
  ];

  const full = resolveMenuItems(menu, row());
  assert.deepEqual(full.map((item) => item.id), ["copy", "admin"]);
  const copy = full[0];
  assert.equal(copy.type, "submenu");
  if (copy.type === "submenu") {
    // Los ids llevan la ruta: dos submenús pueden repetir el id de una opción.
    assert.deepEqual(copy.items.map((item) => item.id), ["copy/name"]);
    assert.equal(copy.items[0].type === "action" && copy.items[0].label, "Nombre (Ana)");
  }

  const restricted = resolveMenuItems(menu, row({ canDelete: false }));
  assert.deepEqual(restricted.map((item) => item.id), ["copy"]);
});

// ── Posicionamiento ─────────────────────────────────────────────────────────

const VIEWPORT = { width: 1000, height: 800 };
const MENU = { width: 200, height: 300 };

test("el menú abre hacia abajo y a la derecha del cursor cuando entra", () => {
  assert.deepEqual(placeMenu({ x: 100, y: 100 }, MENU, VIEWPORT), { x: 100, y: 100 });
});

test("el menú se da vuelta cerca del borde derecho o inferior", () => {
  assert.deepEqual(placeMenu({ x: 950, y: 100 }, MENU, VIEWPORT), { x: 750, y: 100 });
  assert.deepEqual(placeMenu({ x: 100, y: 700 }, MENU, VIEWPORT), { x: 100, y: 400 });
  assert.deepEqual(placeMenu({ x: 990, y: 790 }, MENU, VIEWPORT), { x: 790, y: 490 });
});

test("el menú nunca queda fuera de la pantalla, aunque no entre para ningún lado", () => {
  const small = { width: 240, height: 260 };
  for (const anchor of [{ x: 0, y: 0 }, { x: 120, y: 130 }, { x: 239, y: 259 }, { x: 500, y: 900 }]) {
    for (const menu of [{ width: 200, height: 220 }, { width: 400, height: 500 }]) {
      const point = placeMenu(anchor, menu, small);
      assert.ok(point.x >= 8 && point.y >= 8, `margen mínimo para ${JSON.stringify({ anchor, menu })}`);
      if (menu.width + 16 <= small.width) assert.ok(point.x + menu.width <= small.width - 8);
      if (menu.height + 16 <= small.height) assert.ok(point.y + menu.height <= small.height - 8);
    }
  }
});

test("el submenú abre al costado de su opción y cambia de lado si no entra", () => {
  const size = { width: 180, height: 120 };
  assert.deepEqual(placeSubmenu({ left: 100, right: 300, top: 200 }, size, VIEWPORT), { x: 296, y: 200 });
  // Pegado al borde derecho: abre hacia la izquierda del menú padre.
  assert.deepEqual(placeSubmenu({ left: 780, right: 980, top: 200 }, size, VIEWPORT), { x: 604, y: 200 });
  // Cerca del borde inferior: sube lo necesario para entrar.
  assert.deepEqual(placeSubmenu({ left: 100, right: 300, top: 760 }, size, VIEWPORT), { x: 296, y: 672 });
});

// ── Teclado ─────────────────────────────────────────────────────────────────

const KEYBOARD_ITEMS = resolveMenuItems<null>([
  { id: "a", label: "A", disabled: () => true, run: () => {} },
  { id: "b", label: "B", run: () => {} },
  { type: "separator" },
  { id: "c", label: "C", run: () => {} },
  { id: "d", label: "D", disabled: () => "No disponible", run: () => {} },
], null);

test("las flechas saltean separadores y opciones deshabilitadas y dan la vuelta", () => {
  assert.equal(nextFocusIndex(KEYBOARD_ITEMS, -1, 1), 1);
  assert.equal(nextFocusIndex(KEYBOARD_ITEMS, 1, 1), 3);
  assert.equal(nextFocusIndex(KEYBOARD_ITEMS, 3, 1), 1);
  assert.equal(nextFocusIndex(KEYBOARD_ITEMS, -1, -1), 3);
  assert.equal(nextFocusIndex(KEYBOARD_ITEMS, 1, -1), 3);
  assert.equal(edgeFocusIndex(KEYBOARD_ITEMS, "first"), 1);
  assert.equal(edgeFocusIndex(KEYBOARD_ITEMS, "last"), 3);
});

test("sin opciones enfocables no hay foco", () => {
  const allDisabled = resolveMenuItems<null>([{ id: "a", label: "A", disabled: () => true, run: () => {} }], null);
  assert.equal(nextFocusIndex(allDisabled, -1, 1), -1);
  assert.equal(nextFocusIndex([], -1, 1), -1);
});

// ── Menú nativo ─────────────────────────────────────────────────────────────

test("el menú del navegador queda bloqueado con mouse y teclado; solo se respeta en táctil", () => {
  assert.equal(shouldUseNativeMenu("mouse"), false);
  // Tecla de menú contextual o navegadores sin pointerType en el evento.
  assert.equal(shouldUseNativeMenu(""), false);

  assert.equal(shouldUseNativeMenu("touch"), true);
  assert.equal(shouldUseNativeMenu("pen"), true);
});

// ── Ejecución centralizada ──────────────────────────────────────────────────

function runner(confirmAnswer = true) {
  const log: string[] = [];
  const confirms: ContextMenuConfirm[] = [];
  return {
    log,
    confirms,
    deps: {
      confirm: async (confirm: ContextMenuConfirm) => { confirms.push(confirm); log.push("confirm"); return confirmAnswer; },
      notifySuccess: (message: string) => log.push(`success:${message}`),
      notifyError: (message: string) => log.push(`error:${message}`),
      onStart: () => log.push("start"),
      onFinish: () => log.push("finish"),
    },
  };
}

const resolveOne = (item: ContextMenuItem<Row>): ResolvedAction =>
  actionOf(resolveMenuItems([item], row()), "x");

test("una acción simple corre sin confirmar y sin avisos que nadie pidió", async () => {
  const { log, deps } = runner();
  const action = resolveOne({ id: "x", label: "X", run: () => { log.push("run"); } });

  assert.equal(await runMenuAction(action, deps), "done");
  assert.deepEqual(log, ["start", "run", "finish"]);
});

test("una acción sensible espera la confirmación y avisa al terminar", async () => {
  const { log, confirms, deps } = runner(true);
  const action = resolveOne({
    id: "x",
    label: "Dar de baja",
    confirm: (r) => ({ title: `¿Dar de baja a ${r.name}?` }),
    run: async () => { await Promise.resolve(); log.push("run"); },
    successMessage: (r) => `${r.name} dado de baja.`,
  });

  assert.equal(await runMenuAction(action, deps), "done");
  assert.deepEqual(confirms, [{ title: "¿Dar de baja a Ana?" }]);
  assert.deepEqual(log, ["confirm", "start", "run", "success:Ana dado de baja.", "finish"]);
});

test("cancelar la confirmación no ejecuta nada", async () => {
  const { log, deps } = runner(false);
  const action = resolveOne({
    id: "x", label: "X", confirm: { title: "¿Seguro?" }, run: () => { log.push("run"); }, successMessage: "Listo",
  });

  assert.equal(await runMenuAction(action, deps), "cancelled");
  assert.deepEqual(log, ["confirm"]);
});

test("una opción deshabilitada no se ejecuta aunque se la invoque", async () => {
  const { log, deps } = runner();
  const action = resolveOne({ id: "x", label: "X", disabled: () => true, run: () => { log.push("run"); } });

  assert.equal(await runMenuAction(action, deps), "cancelled");
  assert.deepEqual(log, []);
});

test("un error se convierte en aviso: mensaje del servidor, el de la acción o el genérico", async () => {
  const failing = (extra: Partial<ContextMenuItem<Row>> = {}) => resolveOne({
    id: "x", label: "X", run: async () => { throw new Error("boom"); }, successMessage: "Listo", ...extra,
  } as ContextMenuItem<Row>);

  const generic = runner();
  assert.equal(await runMenuAction(failing(), generic.deps), "failed");
  assert.deepEqual(generic.log, ["start", `error:${DEFAULT_ACTION_ERROR}`, "finish"]);

  const own = runner();
  await runMenuAction(failing({ errorMessage: "No se pudo dar de baja." }), own.deps);
  assert.deepEqual(own.log, ["start", "error:No se pudo dar de baja.", "finish"]);

  const server = runner();
  const seen: [unknown, string][] = [];
  await runMenuAction(failing({ errorMessage: "No se pudo dar de baja." }), {
    ...server.deps,
    describeError: (error, fallback) => { seen.push([error, fallback]); return "El vendedor ya no existe"; },
  });
  assert.deepEqual(server.log, ["start", "error:El vendedor ya no existe", "finish"]);
  assert.equal((seen[0][0] as Error).message, "boom");
  assert.equal(seen[0][1], "No se pudo dar de baja.");
});

test("una acción síncrona que falla también se avisa y libera el estado de carga", async () => {
  const { log, deps } = runner();
  const action = resolveOne({ id: "x", label: "X", run: () => { throw new Error("boom"); } });

  assert.equal(await runMenuAction(action, deps), "failed");
  assert.deepEqual(log, ["start", `error:${DEFAULT_ACTION_ERROR}`, "finish"]);
});
