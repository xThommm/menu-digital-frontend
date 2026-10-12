import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAGE_LAYOUT_OPTIONS, getPageLayoutFeature, resolvePageLayout, pageLayoutName,
} from "../src/lib/pageLayouts.ts";
import { buildAppearanceBody } from "../src/lib/menuStyles.ts";
import { BOOLEAN_FEATURES, normalizePlanFeatures } from "../src/lib/plans.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("las cuentas y los backends sin el campo conservan la plantilla Estándar", () => {
  for (const value of [undefined, null, "", "unknown", 7, {}]) {
    assert.equal(resolvePageLayout(value), "standard");
  }
  for (const option of PAGE_LAYOUT_OPTIONS) {
    assert.equal(resolvePageLayout(option.id), option.id);
    assert.equal(pageLayoutName(option.id), option.name);
  }
});

// Espejo de PAGE_LAYOUT_CATALOG del backend: si divergen, el selector ofrece
// una plantilla que el PATCH rechaza (o candadea una que el plan ya incluye).
test("Estándar es la única plantilla abierta a todos los planes", () => {
  assert.deepEqual(PAGE_LAYOUT_OPTIONS.map(option => option.id), ["standard", "immersive"]);
  assert.equal(getPageLayoutFeature("standard"), null);
  for (const option of PAGE_LAYOUT_OPTIONS.filter(option => option.id !== "standard")) {
    assert.equal(getPageLayoutFeature(option.id), "page_layouts");
  }
});

// Una plantilla sin reglas se vería como Estándar, pero con el encabezado
// propio sin estilos: avisa antes de que llegue a producción.
test("cada plantilla tiene sus estilos en la portada y en la carta", () => {
  const home = read("../src/components/User/Home/Home/UserHome.module.css");
  const menu = read("../src/components/User/Home/Menu/UserMenu.module.css");
  for (const option of PAGE_LAYOUT_OPTIONS.filter(option => option.id !== "standard")) {
    const selector = `[data-page-layout="${option.id}"]`;
    assert.ok(home.includes(selector), `la portada no tiene estilos para ${option.id}`);
    assert.ok(menu.includes(selector), `la carta no tiene estilos para ${option.id}`);
  }
});

// Misma regresión que con el diseño: la API recorta la plantilla a "standard"
// sin la feature, así que reenviarla en un cambio de paleta pisaría la guardada.
test("el cuerpo del PATCH lleva la plantilla solo cuando el dueño la eligió", () => {
  assert.equal("pageLayout" in buildAppearanceBody(3), false);
  assert.equal("pageLayout" in buildAppearanceBody(3, "bakery"), false);
  assert.deepEqual(buildAppearanceBody(3, undefined, "immersive"), { template: 3, pageLayout: "immersive" });
  // Volver a Estándar a mano es una elección explícita: tiene que viajar.
  assert.deepEqual(buildAppearanceBody(3, undefined, "standard"), { template: 3, pageLayout: "standard" });
  assert.deepEqual(buildAppearanceBody(3, "grill", "immersive"), { template: 3, menuStyle: "grill", pageLayout: "immersive" });
});

const catalogFeatures = () => ({
  ...Object.fromEntries(BOOLEAN_FEATURES.map(key => [key, true])),
  item_limit: null,
  templateIds: [1, 2],
});

test("un catálogo de un backend anterior a las plantillas se completa con la feature apagada", () => {
  const previous: Record<string, unknown> = catalogFeatures();
  delete previous.page_layouts;
  assert.deepEqual(normalizePlanFeatures(previous), { ...previous, page_layouts: false });
  // Si el backend ya la manda, se respeta lo que diga.
  assert.deepEqual(normalizePlanFeatures(catalogFeatures()), catalogFeatures());
});

test("una feature más nueva que este frontend se descarta en vez de invalidar el catálogo", () => {
  assert.deepEqual(normalizePlanFeatures({ ...catalogFeatures(), feature_del_futuro: true }), catalogFeatures());
});

test("lo que no es una feature booleana conocida se deja pasar para que el validador lo rechace", () => {
  const roto = { ...catalogFeatures(), extra: "texto" };
  assert.deepEqual(normalizePlanFeatures(roto), roto);
  for (const value of [undefined, null, "features", 3, []]) {
    assert.equal(normalizePlanFeatures(value), value);
  }
  // Una clave conocida que falta (y no es opcional) sigue faltando.
  const sinQr: Record<string, unknown> = catalogFeatures();
  delete sinQr.qr;
  assert.equal("qr" in (normalizePlanFeatures(sinQr) as object), false);
});
