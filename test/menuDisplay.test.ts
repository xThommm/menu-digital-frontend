import test from "node:test";
import assert from "node:assert/strict";
import { MENU_DISPLAY_KEYS, resolveMenuDisplay } from "../src/lib/menuDisplay.ts";

test("sin menuDisplay (backend anterior) todas las opciones quedan apagadas", () => {
  for (const value of [undefined, null, {}]) {
    const display = resolveMenuDisplay(value);
    assert.deepEqual(Object.keys(display), MENU_DISPLAY_KEYS);
    assert.ok(Object.values(display).every(v => v === false));
  }
});

test("solo un true explícito activa; las claves faltantes quedan apagadas", () => {
  const display = resolveMenuDisplay({ hidePrices: true, featuredSection: false });
  assert.equal(display.hidePrices, true);
  assert.equal(display.featuredSection, false);
  assert.equal(display.collapsibleCategories, false);
});
