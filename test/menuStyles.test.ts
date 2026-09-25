import test from "node:test";
import assert from "node:assert/strict";
import {
  VISUAL_FAMILIES, LEGACY_STYLES, LEGACY_MENU_STYLES, MENU_STYLE_OPTIONS,
  isLegacyMenuStyle, getVisualFamily, resolveMenuStyle, buildAppearanceBody,
  PREMIUM_MENU_STYLES, isPremiumMenuStyle, getMenuStyleFeature,
} from "../src/lib/menuStyles.ts";
import { TEMPLATES } from "../src/lib/templates.ts";

test("las cuentas y los backends sin el campo conservan el diseño original", () => {
  for (const value of [undefined, null, "", "unknown", 7, {}]) {
    assert.equal(resolveMenuStyle(value), "classic");
  }
  assert.equal(resolveMenuStyle("bistro"), "bistro");
  for (const family of VISUAL_FAMILIES) {
    assert.equal(resolveMenuStyle(family.id), family.id);
  }
});

test("familias y diseños anteriores son dos grupos disjuntos", () => {
  for (const style of LEGACY_MENU_STYLES) {
    assert.equal(isLegacyMenuStyle(style), true);
    assert.equal(getVisualFamily(style), undefined);
  }
  for (const family of VISUAL_FAMILIES) {
    assert.equal(isLegacyMenuStyle(family.id), false);
    assert.equal(getVisualFamily(family.id)?.id, family.id);
  }
});

// El selector es una sola grilla: todo lo que se ofrece sale de acá, así que
// un diseño sin paletas sugeridas o con una que no existe se ve roto en el panel.
test("el selector ofrece los dos grupos y cada diseño sugiere paletas del catálogo", () => {
  assert.equal(MENU_STYLE_OPTIONS.length, LEGACY_STYLES.length + VISUAL_FAMILIES.length);
  assert.equal(new Set(MENU_STYLE_OPTIONS.map(style => style.id)).size, MENU_STYLE_OPTIONS.length);
  // Los que cualquier plan puede usar van primero.
  assert.deepEqual(MENU_STYLE_OPTIONS.slice(0, LEGACY_STYLES.length).map(style => style.id), [...LEGACY_MENU_STYLES]);

  const ids = TEMPLATES.map(template => template.id);
  for (const style of MENU_STYLE_OPTIONS) {
    assert.ok(style.name && style.description, `${style.id} sin nombre o descripción`);
    assert.ok(style.palettes.length > 0, `${style.id} sin paletas sugeridas`);
    for (const id of style.palettes) {
      assert.ok(ids.includes(id), `${style.id} sugiere la paleta ${id}, que no está en TEMPLATES`);
    }
    assert.equal(new Set(style.palettes).size, style.palettes.length, `${style.id} repite una paleta`);
  }
});

// Regresión: un cambio de paleta NO debe reenviar el diseño.
//
// El panel siembra su estado con lo que devuelve la API, y la API recorta a
// "classic" cuando el plan no incluye las familias. Si el cuerpo del PATCH
// llevara ese valor recortado, el backend lo escribiría sobre la familia
// guardada en MongoDB y la cuenta perdería para siempre lo que el recorte de
// lectura promete devolverle al renovar la suscripción.
test("el cuerpo del PATCH omite el diseño cuando solo cambia la paleta", () => {
  assert.deepEqual(buildAppearanceBody(3), { template: 3 });
  assert.equal("menuStyle" in buildAppearanceBody(3), false);
});

test("el cuerpo del PATCH lleva el diseño cuando el dueño lo eligió", () => {
  assert.deepEqual(buildAppearanceBody(3, "bakery"), { template: 3, menuStyle: "bakery" });
  // Elegir Clásico a mano sí es una elección explícita: tiene que pisar lo guardado.
  assert.deepEqual(buildAppearanceBody(1, "classic"), { template: 1, menuStyle: "classic" });
});

// Espejo de PREMIUM_MENU_STYLES del backend: si divergen, el selector ofrece
// un diseño que el PATCH rechaza (o candadea uno que el plan ya incluye).
test("los diseños premium son familias con su propia feature", () => {
  assert.deepEqual([...PREMIUM_MENU_STYLES], ["neo-brutalism", "tactile"]);
  for (const style of PREMIUM_MENU_STYLES) {
    assert.equal(isPremiumMenuStyle(style), true);
    assert.equal(getVisualFamily(style)?.id, style);
    assert.equal(getMenuStyleFeature(style), "premium_menu_styles");
  }
  for (const family of VISUAL_FAMILIES.filter(family => !isPremiumMenuStyle(family.id))) {
    assert.equal(getMenuStyleFeature(family.id), "menu_styles");
  }
  for (const style of LEGACY_MENU_STYLES) assert.equal(getMenuStyleFeature(style), null);
});
