import test from "node:test";
import assert from "node:assert/strict";
import { halloweenLevelFor, isHalloweenSeason } from "../src/lib/halloween.ts";

test("la temporada termina el 2 de noviembre inclusive", () => {
  assert.equal(isHalloweenSeason(new Date(2026, 9, 9)), true);
  assert.equal(isHalloweenSeason(new Date(2026, 10, 2, 23, 59)), true);
  assert.equal(isHalloweenSeason(new Date(2026, 10, 3, 0, 0)), false);
});

test("solo landing, auth y paneles llevan adorno", () => {
  assert.equal(halloweenLevelFor("/"), "full");
  assert.equal(halloweenLevelFor("/login"), "full");
  assert.equal(halloweenLevelFor("/register/plans"), "full");
  assert.equal(halloweenLevelFor("/dashboard"), "low");
  assert.equal(halloweenLevelFor("/admin/plans"), "low");
  assert.equal(halloweenLevelFor("/pedidos"), null);
  assert.equal(halloweenLevelFor("/mi-local"), null);
  assert.equal(halloweenLevelFor("/mi-local/menu"), null);
});
