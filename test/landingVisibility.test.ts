import test from "node:test";
import assert from "node:assert/strict";
import { LANDING_VISIBILITY_KEYS, resolveLandingVisibility } from "../src/lib/landingVisibility.ts";

test("sin landingVisibility (backend anterior o carta) se muestra todo", () => {
  for (const value of [undefined, null, {}]) {
    const visible = resolveLandingVisibility(value);
    assert.deepEqual(Object.keys(visible), LANDING_VISIBILITY_KEYS);
    assert.ok(Object.values(visible).every(v => v === true));
  }
});

test("solo un false explícito oculta; las claves faltantes quedan visibles", () => {
  const visible = resolveLandingVisibility({ mail: false, phone: true });
  assert.equal(visible.mail, false);
  assert.equal(visible.phone, true);
  assert.equal(visible.facebook, true);
});
