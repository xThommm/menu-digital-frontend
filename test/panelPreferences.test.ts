import test from "node:test";
import assert from "node:assert/strict";
import {
  PANEL_ACCENTS, PANEL_FONT_SIZES, DEFAULT_PANEL_PREFERENCES,
  resolvePanelAccent, resolvePanelFontSize, panelPreferenceAttributes,
} from "../src/lib/panelPreferences.ts";

test("un valor guardado inválido cae al default del panel", () => {
  for (const value of [undefined, null, "", "violeta", 3, {}]) {
    assert.equal(resolvePanelAccent(value), "orange");
    assert.equal(resolvePanelFontSize(value), "md");
  }
  for (const accent of PANEL_ACCENTS) assert.equal(resolvePanelAccent(accent.id), accent.id);
  for (const size of PANEL_FONT_SIZES) assert.equal(resolvePanelFontSize(size.id), size.id);
});

test("se ofrecen los cuatro acentos, cada uno con muestra para los dos temas", () => {
  assert.deepEqual(PANEL_ACCENTS.map(accent => accent.id), ["orange", "gold", "blue", "light"]);
  for (const accent of PANEL_ACCENTS) {
    assert.match(accent.swatch.dark, /^#[0-9A-F]{6}$/i);
    assert.match(accent.swatch.light, /^#[0-9A-F]{6}$/i);
  }
});

// Quien no tocó las preferencias no debe recibir ningún atributo: el panel
// sigue con los tokens de siempre.
test("las preferencias por defecto no escriben atributos", () => {
  assert.deepEqual(panelPreferenceAttributes(DEFAULT_PANEL_PREFERENCES), {
    "data-panel-accent": null,
    "data-panel-font": null,
  });
  assert.deepEqual(panelPreferenceAttributes({ accent: "blue", fontSize: "lg" }), {
    "data-panel-accent": "blue",
    "data-panel-font": "lg",
  });
});
