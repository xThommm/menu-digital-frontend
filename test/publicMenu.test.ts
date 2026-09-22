import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMenuTabs,
  categoryKey,
  isItemUnavailable,
  tabHasItems,
} from "../src/lib/publicMenu.ts";
import type { PublicMenuData, PublicMenuItem } from "../src/types/index.ts";

const item = (overrides: Partial<PublicMenuItem> = {}): PublicMenuItem => ({
  _id: "pizza",
  title: "Pizza",
  price: 1000,
  ...overrides,
});

test("isItemUnavailable: solo un available en false explícito lo marca como no disponible", () => {
  assert.equal(isItemUnavailable(item({ available: false })), true);
  assert.equal(isItemUnavailable(item({ available: true })), false);
});

test("isItemUnavailable: v2 nunca manda available, y ausente no es no disponible", () => {
  // Regresión que motivó el helper: con `!item.available` este producto (la
  // forma normal en v2) aparecería como "No disponible" y sin botón de pedir.
  assert.equal(isItemUnavailable(item()), false);
  assert.equal(isItemUnavailable({ available: undefined }), false);
});

test("categoryKey es posicional y no se repite entre pestañas ni entre categorías", () => {
  assert.equal(categoryKey(0, 0), "0:0");
  assert.equal(categoryKey(2, 5), "2:5");

  const keys = [0, 1, 2].flatMap(tab => [0, 1, 2].map(cat => categoryKey(tab, cat)));
  assert.equal(new Set(keys).size, keys.length);
  // "1:11" y "11:1" no se confunden por concatenar índices sin separador.
  assert.notEqual(categoryKey(1, 11), categoryKey(11, 1));
});

const menu: PublicMenuData = {
  secciones: [
    { title: "Cafetería", categorias: [{ title: "Cafés", items: [item({ _id: "espresso" })] }] },
    { title: "Cocina", categorias: [{ title: "Sándwiches", items: [item({ _id: "tostado" })] }] },
  ],
  sinSeccion: [{ title: "Bebidas", items: [item({ _id: "agua" })] }],
};

test("buildMenuTabs arma una pestaña por sección y una última 'Otros' con lo sin sección", () => {
  assert.deepEqual(buildMenuTabs(menu).map(tab => tab.label), ["Cafetería", "Cocina", "Otros"]);
  assert.deepEqual(buildMenuTabs(menu)[2].categorias, menu.sinSeccion);
});

test("buildMenuTabs no agrega 'Otros' si no hay categorías sin sección, y sin carta no hay pestañas", () => {
  assert.deepEqual(buildMenuTabs({ ...menu, sinSeccion: [] }).map(tab => tab.label), ["Cafetería", "Cocina"]);
  assert.deepEqual(buildMenuTabs({ secciones: [], sinSeccion: [] }), []);
  assert.deepEqual(buildMenuTabs(null), []);
});

test("tabHasItems: una pestaña sin productos (legacy) no cuenta como visible", () => {
  assert.equal(tabHasItems({ label: "Cocina", categorias: menu.secciones[1].categorias }), true);
  assert.equal(tabHasItems({ label: "Vacía", categorias: [] }), false);
  assert.equal(tabHasItems({ label: "Vacía", categorias: [{ title: "Sin nada", items: [] }] }), false);
  // Basta con una categoría con productos entre categorías vacías.
  assert.equal(
    tabHasItems({
      label: "Mixta",
      categorias: [{ title: "Sin nada", items: [] }, { title: "Con algo", items: [item()] }],
    }),
    true,
  );
});
