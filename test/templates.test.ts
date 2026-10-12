import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEMPLATES, templateName, resolveTemplate } from "../src/lib/templates.ts";
import { VISUAL_FAMILIES } from "../src/lib/menuStyles.ts";

const css = readFileSync(new URL("../src/styles/globals.css", import.meta.url), "utf8");

// Tokens del bloque `[data-template="N"] { ... }` de cada paleta.
function paletteBlocks(): Map<number, Record<string, string>> {
  const blocks = new Map<number, Record<string, string>>();
  for (const match of css.matchAll(/^\[data-template="(\d+)"\] \{([^}]*)\}/gm)) {
    const tokens: Record<string, string> = {};
    for (const line of match[2].split(";")) {
      const [name, ...value] = line.split(":");
      if (value.length > 0) tokens[name.trim()] = value.join(":").trim();
    }
    blocks.set(Number(match[1]), tokens);
  }
  return blocks;
}

// Sumar una paleta son dos pasos (fila + bloque de CSS). Si falta uno, el
// panel la ofrece y la carta sale sin tokens, o queda CSS que nadie puede elegir.
test("cada paleta del catálogo tiene su bloque de CSS, y cada bloque su fila", () => {
  const blocks = paletteBlocks();
  const ids = TEMPLATES.map(template => template.id);
  assert.equal(new Set(ids).size, ids.length, "hay IDs de paleta repetidos");
  assert.deepEqual([...blocks.keys()].sort((a, b) => a - b), [...ids].sort((a, b) => a - b));

  for (const template of TEMPLATES) {
    assert.ok(Number.isSafeInteger(template.id) && template.id >= 1, `ID inválido: ${template.id}`);
    assert.ok(template.name, `la paleta ${template.id} no tiene nombre`);
    const tokens = blocks.get(template.id)!;
    // La muestra del panel se pinta con estos dos colores: tienen que ser los de la carta.
    assert.equal(template.color, tokens["--t-bg"], `${template.name}: color no coincide con --t-bg`);
    assert.equal(template.accent, tokens["--t-accent"], `${template.name}: accent no coincide con --t-accent`);
    for (const token of ["--t-surface", "--t-surface-2", "--t-border", "--t-border-md", "--t-text", "--t-title",
      "--t-muted", "--t-accent-soft", "--t-accent-glow", "--t-btn-text", "--t-hero-grad"]) {
      assert.ok(tokens[token], `${template.name}: falta ${token}`);
    }
  }
});

test("una paleta desconocida se pinta con la primera en vez de quedar sin tokens", () => {
  assert.equal(resolveTemplate(6).name, "Aurora");
  for (const value of [undefined, null, 0, 9999, "6", {}]) {
    assert.equal(resolveTemplate(value).id, TEMPLATES[0].id);
  }
  assert.equal(templateName(6), "Aurora");
  assert.equal(templateName(9999), "Diseño 9999");
});

// Mismo criterio para los diseños: una familia sin tokens en globals.css se
// puede elegir en el panel pero se ve como Clásico.
test("cada familia visual tiene sus tokens en globals.css", () => {
  for (const family of VISUAL_FAMILIES) {
    assert.ok(css.includes(`[data-menu-family="${family.id}"] {`), `${family.id} no tiene bloque [data-menu-family]`);
  }
});
