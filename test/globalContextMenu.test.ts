import test from "node:test";
import assert from "node:assert/strict";
import { resolveMenuItems, runMenuAction } from "../src/features/contextMenu/lib/contextMenu.ts";
import { buildGlobalMenu, type GlobalMenuContext } from "../src/features/contextMenu/globalMenu.ts";
import { createThemeStore } from "../src/lib/themeStores.ts";
import type { ResolvedAction, ResolvedItem } from "../src/features/contextMenu/types.ts";

const NO_FULLSCREEN = { available: false, active: false };

function menuFor(context: Omit<GlobalMenuContext, "fullscreen"> & Partial<Pick<GlobalMenuContext, "fullscreen">>) {
  const calls: string[] = [];
  const items = resolveMenuItems(buildGlobalMenu({
    reload: () => { calls.push("reload"); },
    toggleTheme: (area) => { calls.push(`theme:${area}`); },
    openPanelAppearance: () => { calls.push("appearance"); },
    toggleFullscreen: (active) => { calls.push(`fullscreen:${active}`); },
  }), { fullscreen: NO_FULLSCREEN, ...context });
  return { calls, items };
}

const action = (items: ResolvedItem[], id: string) => {
  const found = items.find((item) => item.id === id);
  assert.equal(found?.type, "action", `falta la acción ${id}`);
  return found as ResolvedAction;
};

const deps = {
  confirm: async () => assert.fail("las opciones generales no piden confirmación"),
  notifySuccess: () => assert.fail("las opciones generales no avisan"),
  notifyError: (message: string) => assert.fail(message),
};

test("en las páginas públicas el menú global ofrece Actualizar y el cambio de tema, que nombra el modo al que pasa", () => {
  const dark = menuFor({ themeArea: "public", theme: "dark" }).items;
  assert.deepEqual(dark.map((item) => item.id), ["reload", "theme"]);
  assert.equal(action(dark, "reload").label, "Actualizar");
  assert.equal(action(dark, "theme").label, "Cambiar a modo claro");

  const light = menuFor({ themeArea: "public", theme: "light" }).items;
  assert.equal(action(light, "theme").label, "Cambiar a modo oscuro");
});

test("en los paneles el tema va dentro de Apariencia del panel (con el acento y la letra)", async () => {
  const panel = menuFor({ themeArea: "panel", theme: "dark" });
  assert.deepEqual(panel.items.map((item) => item.id), ["reload", "appearance"]);
  await runMenuAction(action(panel.items, "appearance"), deps);
  assert.deepEqual(panel.calls, ["appearance"]);
});

test("pantalla completa, si el navegador la permite, y salir de ella", async () => {
  const off = menuFor({ themeArea: null, theme: "dark", fullscreen: { available: true, active: false } });
  assert.equal(action(off.items, "fullscreen").label, "Pantalla completa");
  await runMenuAction(action(off.items, "fullscreen"), deps);
  const on = menuFor({ themeArea: null, theme: "dark", fullscreen: { available: true, active: true } });
  assert.equal(action(on.items, "fullscreen").label, "Salir de pantalla completa");
  await runMenuAction(action(on.items, "fullscreen"), deps);
  assert.deepEqual([...off.calls, ...on.calls], ["fullscreen:false", "fullscreen:true"]);
});

test("en pantallas sin tema claro/oscuro (la carta de un local) solo queda Actualizar", () => {
  const { items } = menuFor({ themeArea: null, theme: "dark" });
  assert.deepEqual(items.map((item) => item.id), ["reload"]);
});

test("cada opción ejecuta lo suyo, y el tema cambia el del área donde se hizo clic", async () => {
  const panel = menuFor({ themeArea: "panel", theme: "dark" });
  assert.equal(await runMenuAction(action(panel.items, "reload"), deps), "done");
  assert.deepEqual(panel.calls, ["reload"]);

  const landing = menuFor({ themeArea: "public", theme: "dark" });
  await runMenuAction(action(landing.items, "theme"), deps);
  assert.deepEqual(landing.calls, ["theme:public"]);
});

// ── Preferencia de tema compartida (lib/themeStores.ts) ─────────────────────

function withLocalStorage(t: { after: (fn: () => void) => void }, initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  return data;
}

test("el tema arranca de lo guardado, y cambiarlo lo aplica, lo guarda y avisa a todos los que lo usan", (t) => {
  const data = withLocalStorage(t, { "tema-de-prueba": "light" });
  const applied: string[] = [];
  const store = createThemeStore("tema-de-prueba", (theme) => applied.push(theme));
  let sidebarRenders = 0;
  let menuRenders = 0;
  const unsubscribeSidebar = store.subscribe(() => { sidebarRenders += 1; });
  store.subscribe(() => { menuRenders += 1; });

  assert.equal(store.get(), "light");

  store.toggle();
  assert.equal(store.get(), "dark");
  assert.equal(data.get("tema-de-prueba"), "dark");
  assert.deepEqual(applied, ["dark"]);
  assert.deepEqual([sidebarRenders, menuRenders], [1, 1]);

  unsubscribeSidebar();
  store.set("light");
  assert.equal(store.get(), "light");
  assert.deepEqual([sidebarRenders, menuRenders], [1, 2]);
});

test("sin nada guardado o sin localStorage el tema es oscuro y se puede cambiar igual", (t) => {
  withLocalStorage(t);
  assert.equal(createThemeStore("tema-de-prueba").get(), "dark");

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("localStorage bloqueado"); },
  });
  const store = createThemeStore("tema-de-prueba");
  assert.equal(store.get(), "dark");
  store.toggle();
  assert.equal(store.get(), "light");
});
