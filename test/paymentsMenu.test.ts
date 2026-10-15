import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaymentMenu, buildPaymentsPageMenu, crmClientPath, mercadoPagoActivityUrl,
} from "../src/components/Admin/Payments/paymentsMenu.ts";
import type { AdminPayment } from "../src/types/index.ts";
import { action, fakeEnv, ids, recorder, resolve, run } from "./support/menu.ts";

const payment = (overrides: Partial<AdminPayment> = {}) => ({
  id: "p1", paymentID: "123456789", preferenceId: "pref-1", customer: { id: "u1", username: "lodelucas", businessName: "Lo de Lucas" },
  ...overrides,
} as AdminPayment);

test("pago: detalles, pagos del cliente, CRM, copiar IDs y Mercado Pago", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const items = resolve(buildPaymentMenu(env), {
    payment: payment(), expanded: false, filteredByClient: false, actions: { filterByClient: fn("filter"), toggleDetails: fn("details") },
  });
  assert.deepEqual(ids(items), ["details", "client-payments", "crm", "copy", "copy/payment-id", "copy/preference-id", "mercadopago"]);

  await run(action(items, "client-payments"));
  await run(action(items, "crm"));
  await run(action(items, "copy/preference-id"));
  await run(action(items, "mercadopago"));
  assert.deepEqual(calls, ['filter "u1"']);
  assert.deepEqual(log, [`go:${crmClientPath("u1")}`, "copy:pref-1", `open:${mercadoPagoActivityUrl("123456789")}`]);
  assert.equal(crmClientPath("u1"), "/sellers/crm?client=u1");

  const orphan = resolve(buildPaymentMenu(env), {
    payment: payment({ customer: null, preferenceId: null }), expanded: true, filteredByClient: false,
    actions: { filterByClient: fn("filter"), toggleDetails: fn("details") },
  });
  assert.deepEqual(ids(orphan), ["details", "copy", "copy/payment-id", "mercadopago"]);
  assert.equal(action(orphan, "details").label, "Ocultar detalles");
});

test("fondo: ver todos con el filtro de cliente y limpiar filtros", () => {
  const { fn } = recorder();
  const items = resolve(buildPaymentsPageMenu(), { filteredByClient: false, activeFilters: 0, actions: { showAll: fn("all"), clearFilters: fn("clear") } });
  assert.deepEqual(ids(items), ["clear"]);
  assert.equal(action(items, "clear").disabled, true);
});
