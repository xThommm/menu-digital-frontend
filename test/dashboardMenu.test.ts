import test from "node:test";
import assert from "node:assert/strict";
import { buildStorefrontMenu, buildVisitsMenu } from "../src/components/User/Panel/Dashboard/dashboardMenu.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

test("carta en línea: ver, copiar y descargar el QR (según el plan)", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const items = resolve(buildStorefrontMenu(env), {
    url: "https://app/lo-de-lucas", canDownloadQr: true, generatingQr: false, actions: { downloadQr: fn("qr") },
  });
  assert.deepEqual(ids(items), ["open", "copy", "qr-png", "qr-pdf"]);
  await run(action(items, "open"));
  await run(action(items, "copy"));
  await run(action(items, "qr-pdf"));
  assert.deepEqual(log, ["open:https://app/lo-de-lucas", "copy:https://app/lo-de-lucas"]);
  assert.deepEqual(calls, ['qr "pdf"']);

  const free = resolve(buildStorefrontMenu(env), { url: "https://app/x", canDownloadQr: false, generatingQr: false, actions: { downloadQr: fn("qr") } });
  assert.match(action(free, "qr-png").disabledReason ?? "", /no está incluido/);

  assert.deepEqual(ids(resolve(buildStorefrontMenu(env), { url: null, canDownloadQr: true, generatingQr: false, actions: { downloadQr: fn("qr") } })), []);
});

test("visitas: ir a las estadísticas", async () => {
  const { env, log } = fakeEnv();
  const items = resolve(buildVisitsMenu(env), undefined);
  await run(action(items, "stats"));
  assert.deepEqual(log, ["go:/estadisticas"]);
});
