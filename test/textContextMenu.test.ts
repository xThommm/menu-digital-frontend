import test from "node:test";
import assert from "node:assert/strict";
import { resolveMenuItems, runMenuAction } from "../src/features/contextMenu/lib/contextMenu.ts";
import {
  buildTextMenu, type TextField, type TextMenuContext,
} from "../src/features/contextMenu/lib/textMenu.ts";
import type { ResolvedAction, ResolvedItem } from "../src/features/contextMenu/types.ts";

function setup(context: TextMenuContext, clipboard: { text?: string; denied?: boolean } = {}) {
  const calls: string[] = [];
  const items = resolveMenuItems(buildTextMenu({
    writeClipboard: async (text) => { calls.push(`write:${text}`); },
    readClipboard: async () => {
      if (clipboard.denied) throw new Error("NotAllowedError");
      return clipboard.text ?? "";
    },
  }), context, "text/");
  return { calls, items };
}

function field(overrides: Partial<TextField> = {}) {
  const calls: string[] = [];
  const value: TextField = {
    editable: true,
    insert: (text) => { calls.push(`insert:${text}`); },
    deleteSelection: () => { calls.push("delete"); },
    undo: () => { calls.push("undo"); },
    canUndo: false,
    selectAll: () => { calls.push("select-all"); },
    ...overrides,
  };
  return { calls, value };
}

const action = (items: ResolvedItem[], id: string) => {
  const found = items.find((item) => item.id === id);
  assert.equal(found?.type, "action", `falta la acción ${id}`);
  return found as ResolvedAction;
};

function runner() {
  const notices: string[] = [];
  return {
    notices,
    deps: {
      confirm: async () => assert.fail("las opciones de texto no piden confirmación"),
      notifySuccess: (message: string) => notices.push(`ok:${message}`),
      notifyError: (message: string) => notices.push(`error:${message}`),
    },
  };
}

test("sin texto seleccionado y fuera de un campo no hay opciones de texto", () => {
  assert.deepEqual(setup({ selectedText: "", field: null }).items, []);
});

test("con texto seleccionado aparece Copiar y copia exactamente ese texto", async () => {
  const { calls, items } = setup({ selectedText: "ABC-123", field: null });
  assert.deepEqual(items.map((item) => item.id), ["text/copy"]);

  const { notices, deps } = runner();
  assert.equal(await runMenuAction(action(items, "text/copy"), deps), "done");
  assert.deepEqual(calls, ["write:ABC-123"]);
  assert.deepEqual(notices, []);
});

test("sobre un campo de texto aparecen Pegar y Seleccionar todo; Cortar y Copiar solo si hay selección", () => {
  const empty = setup({ selectedText: "", field: field().value });
  assert.deepEqual(empty.items.map((item) => item.id), ["text/paste", "text/select-all"]);

  const selected = setup({ selectedText: "hola", field: field().value });
  assert.deepEqual(selected.items.map((item) => item.id), ["text/cut", "text/copy", "text/paste", "text/select-all"]);
});

test("Pegar inserta en el campo lo que hay en el portapapeles", async () => {
  const target = field();
  const { items } = setup({ selectedText: "", field: target.value }, { text: "carla@example.com" });

  assert.equal(await runMenuAction(action(items, "text/paste"), runner().deps), "done");
  assert.deepEqual(target.calls, ["insert:carla@example.com"]);
});

test("Pegar con el portapapeles vacío no toca el campo", async () => {
  const target = field();
  const { items } = setup({ selectedText: "", field: target.value }, { text: "" });

  assert.equal(await runMenuAction(action(items, "text/paste"), runner().deps), "done");
  assert.deepEqual(target.calls, []);
});

test("si el navegador niega el portapapeles, Pegar avisa y sugiere el teclado", async () => {
  const target = field();
  const { items } = setup({ selectedText: "", field: target.value }, { denied: true });

  const { notices, deps } = runner();
  assert.equal(await runMenuAction(action(items, "text/paste"), deps), "failed");
  assert.deepEqual(target.calls, []);
  assert.deepEqual(notices, ["error:No se pudo leer el portapapeles. Probá con Ctrl + V."]);
});

test("en un campo de solo lectura Pegar queda deshabilitado, pero se puede seleccionar todo y copiar", async () => {
  const target = field({ editable: false });
  const { calls, items } = setup({ selectedText: "solo lectura", field: target.value }, { text: "x" });

  assert.equal(action(items, "text/paste").disabled, true);
  assert.equal(action(items, "text/paste").disabledReason, "Este campo no se puede editar");
  assert.equal(await runMenuAction(action(items, "text/paste"), runner().deps), "cancelled");

  await runMenuAction(action(items, "text/select-all"), runner().deps);
  await runMenuAction(action(items, "text/copy"), runner().deps);
  assert.deepEqual(target.calls, ["select-all"]);
  assert.deepEqual(calls, ["write:solo lectura"]);
});

test("Cortar: con texto seleccionado en un campo editable copia y borra; después se ofrece Deshacer", async () => {
  const input = field();
  const { calls, items } = setup({ selectedText: "hola", field: input.value });
  assert.deepEqual(items.map((item) => item.id), ["text/cut", "text/copy", "text/paste", "text/select-all"]);
  const { deps } = runner();
  await runMenuAction(action(items, "text/cut"), deps);
  assert.deepEqual(calls, ["write:hola"]);
  assert.deepEqual(input.calls, ["delete"]);

  const afterCut = field({ canUndo: true });
  const again = setup({ selectedText: "", field: afterCut.value });
  assert.deepEqual(again.items.map((item) => item.id), ["text/paste", "text/undo", "text/select-all"]);
  await runMenuAction(action(again.items, "text/undo"), deps);
  assert.deepEqual(afterCut.calls, ["undo"]);

  const readOnly = setup({ selectedText: "hola", field: field({ editable: false }).value });
  assert.ok(!readOnly.items.some((item) => item.id === "text/cut"), "en solo lectura no se corta");
});
