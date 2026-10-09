import test from "node:test";
import assert from "node:assert/strict";
import {
  describeDevice,
  describeTestResult,
  detectPushBlocker,
  PUSH_STATUS_HELP,
} from "../src/lib/pushDevices.ts";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

test("en iPhone las push piden instalar el panel en la pantalla de inicio", () => {
  // En una pestaña de Safari (o Chrome de iOS) la API de push no existe.
  for (const userAgent of [UA.iphoneSafari, UA.iphoneChrome]) {
    assert.equal(
      detectPushBlocker({ userAgent, maxTouchPoints: 5, standalone: false, hasPushApi: false }),
      "ios-install",
    );
  }
  // Instalado y con iOS 16.4+: listo.
  assert.equal(
    detectPushBlocker({ userAgent: UA.iphoneSafari, maxTouchPoints: 5, standalone: true, hasPushApi: true }),
    "ready",
  );
  // Instalado pero con un iOS viejo.
  assert.equal(
    detectPushBlocker({ userAgent: UA.iphoneSafari, maxTouchPoints: 5, standalone: true, hasPushApi: false }),
    "ios-outdated",
  );
});

test("un iPad que se presenta como Mac se trata como iOS, una Mac real no", () => {
  assert.equal(
    detectPushBlocker({ userAgent: UA.ipadAsMac, maxTouchPoints: 5, standalone: false, hasPushApi: false }),
    "ios-install",
  );
  assert.equal(
    detectPushBlocker({ userAgent: UA.ipadAsMac, maxTouchPoints: 0, standalone: false, hasPushApi: true }),
    "ready",
  );
});

test("Android y escritorio reciben push desde el navegador, sin instalar", () => {
  assert.equal(
    detectPushBlocker({ userAgent: UA.androidChrome, maxTouchPoints: 5, standalone: false, hasPushApi: true }),
    "ready",
  );
  assert.equal(
    detectPushBlocker({ userAgent: UA.windowsEdge, maxTouchPoints: 0, standalone: false, hasPushApi: true }),
    "ready",
  );
  assert.equal(
    detectPushBlocker({ userAgent: UA.windowsFirefox, maxTouchPoints: 0, standalone: false, hasPushApi: false }),
    "unsupported",
  );
});

test("cada motivo de bloqueo tiene una explicación para el admin", () => {
  for (const status of ["ios-install", "ios-outdated", "unsupported", "not-configured", "server-off", "error"] as const) {
    assert.ok(PUSH_STATUS_HELP[status].length > 20, status);
  }
});

test("describeDevice arma un nombre legible del dispositivo", () => {
  assert.equal(describeDevice(UA.iphoneSafari), "Safari en iPhone");
  assert.equal(describeDevice(UA.iphoneChrome), "Chrome en iPhone");
  assert.equal(describeDevice(UA.androidChrome), "Chrome en Android");
  assert.equal(describeDevice(UA.androidSamsung), "Samsung Internet en Android");
  assert.equal(describeDevice(UA.windowsEdge), "Edge en Windows");
  assert.equal(describeDevice(UA.windowsFirefox), "Firefox en Windows");
  assert.equal(describeDevice(null), "Dispositivo desconocido");
  assert.equal(describeDevice("curl/8.0"), "Dispositivo desconocido");
});

test("describeTestResult cuenta a cuántos dispositivos llegó la prueba", () => {
  assert.deepEqual(
    describeTestResult({ devices: 3, delivered: 3, failed: 0, removed: 0 }),
    { ok: true, message: "Prueba enviada a 3 dispositivos" },
  );
  assert.deepEqual(
    describeTestResult({ devices: 1, delivered: 1, failed: 0, removed: 0 }),
    { ok: true, message: "Prueba enviada a 1 dispositivo" },
  );
  assert.deepEqual(
    describeTestResult({ devices: 3, delivered: 2, failed: 1, removed: 1 }),
    { ok: true, message: "Prueba enviada a 2 de 3 dispositivos (1 con error)" },
  );
  assert.equal(describeTestResult({ devices: 2, delivered: 0, failed: 2, removed: 0 }).ok, false);
  assert.equal(describeTestResult({ devices: 0, delivered: 0, failed: 0, removed: 0 }).ok, false);
  // Backend anterior: responde sin cuerpo.
  assert.equal(describeTestResult(null).ok, true);
});
