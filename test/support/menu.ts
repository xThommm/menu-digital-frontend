// Ayudas para probar menús contextuales con node --test (no es un test: no
// termina en .test.ts).

import assert from "node:assert/strict";
import { resolveMenuItems, runMenuAction, type ActionOutcome } from "../../src/features/contextMenu/lib/contextMenu.ts";
import type { MenuEnv } from "../../src/features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem, ResolvedAction, ResolvedItem, ResolvedSubmenu } from "../../src/features/contextMenu/types.ts";

export const flatten = (items: ResolvedItem[]): ResolvedItem[] =>
  items.flatMap((item) => (item.type === "submenu" ? [item, ...flatten(item.items)] : [item]));

/** Ids visibles (sin separadores), con los de los submenús como "padre/hijo". */
export const ids = (items: ResolvedItem[]) =>
  flatten(items).filter((item) => item.type !== "separator").map((item) => item.id);

export const action = (items: ResolvedItem[], id: string): ResolvedAction => {
  const found = flatten(items).find((item) => item.id === id);
  assert.equal(found?.type, "action", `falta la acción ${id}`);
  return found as ResolvedAction;
};

export const submenu = (items: ResolvedItem[], id: string): ResolvedSubmenu => {
  const found = flatten(items).find((item) => item.id === id);
  assert.equal(found?.type, "submenu", `falta el submenú ${id}`);
  return found as ResolvedSubmenu;
};

export const resolve = <C>(menu: ContextMenuItem<C>[], context: C) => resolveMenuItems(menu, context);

/** Entorno de mentira: anota lo que se copió, abrió y navegó. */
export function fakeEnv() {
  const log: string[] = [];
  const env: MenuEnv = {
    copy: async (text) => { log.push(`copy:${text}`); },
    openUrl: (url) => { log.push(`open:${url}`); },
    navigate: (path, state) => { log.push(`go:${path}${state === undefined ? "" : ` ${JSON.stringify(state)}`}`); },
  };
  return { env, log };
}

/** Corre una acción como el menú: `accept` responde la confirmación. */
export async function run(item: ResolvedAction, { accept = true } = {}) {
  const notices: string[] = [];
  const confirms: string[] = [];
  const outcome: ActionOutcome = await runMenuAction(item, {
    confirm: async (confirm) => { confirms.push(confirm.title); return accept; },
    notifySuccess: (message) => notices.push(`ok:${message}`),
    notifyError: (message) => notices.push(`error:${message}`),
    describeError: (error, fallback) => (error instanceof Error && error.name === "MenuActionError" ? error.message : fallback),
  });
  return { outcome, notices, confirms };
}

/** Registro de llamadas: `calls.fn("nombre")` devuelve una función que anota sus argumentos. */
export function recorder() {
  const calls: string[] = [];
  const fn = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args.map((arg) => {
      if (arg === undefined) return "undefined";
      if (typeof arg === "object" && arg !== null && "id" in arg) return `#${(arg as { id: unknown }).id}`;
      if (typeof arg === "object" && arg !== null && "_id" in arg) return `#${(arg as { _id: unknown })._id}`;
      return JSON.stringify(arg);
    })].join(" "));
  };
  return { calls, fn };
}
