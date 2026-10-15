import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAssignmentMenu, buildInfluencerCodeMenu, buildRankingSellerMenu, buildReferralMenu,
} from "../src/components/Seller/sellerPanelMenu.ts";
import { normalizeSellerCode, registerLinkWithCode, rememberSellerCodeFromUrl } from "../src/lib/sellerCodeLink.ts";
import { action, fakeEnv, ids, resolve, run } from "./support/menu.ts";

test("inicio — asignación reciente: ficha, WhatsApp (si hay número), carta y copiar", async () => {
  const { env, log } = fakeEnv();
  const client = { _id: "c1", username: "lodelucas", slug: "lo-de-lucas", contactInfo: { number: 1155550000 } };
  const items = resolve(buildAssignmentMenu(env), { client, origin: "https://app" });
  assert.deepEqual(ids(items), ["crm", "whatsapp", "menu", "copy", "copy/username", "copy/menu-link"]);
  await run(action(items, "crm"));
  await run(action(items, "whatsapp"));
  assert.equal(log[0], "go:/sellers/crm?client=c1");
  assert.match(log[1], /^open:https:\/\/wa\.me\//);

  const bare = resolve(buildAssignmentMenu(env), { client: { _id: "c2", username: "nuevo" }, origin: "https://app" });
  assert.deepEqual(ids(bare), ["crm", "copy", "copy/username"]);
});

test("ranking (admin): ver perfil, comisiones y sus clientes", async () => {
  const { env, log } = fakeEnv();
  const items = resolve(buildRankingSellerMenu(env), { seller: { sellerID: "s1", name: "Ana" } });
  for (const id of ["profile", "commissions", "clients"]) await run(action(items, id));
  assert.deepEqual(log, ["go:/admin/sellers?perfil=s1", "go:/sellers?sellerID=s1", "go:/sellers/crm?seller=s1"]);
});

test("influencer: copiar código y link de registro con el código; referido: nombre y carta", async () => {
  const { env, log } = fakeEnv();
  const code = resolve(buildInfluencerCodeMenu(env), { code: "ANA-123", origin: "https://app" });
  await run(action(code, "code"));
  await run(action(code, "register-link"));
  const referral = resolve(buildReferralMenu(env), { lead: { businessName: "", username: "pizzas", slug: "pizzas-ya" }, origin: "https://app" });
  await run(action(referral, "name"));
  await run(action(referral, "menu"));
  assert.deepEqual(log, [
    "copy:ANA-123",
    "copy:https://app/register?codigo=ANA-123",
    "copy:pizzas",
    "open:https://app/pizzas-ya/menu",
  ]);
});

test("link de registro: el código se normaliza y uno inválido se ignora", () => {
  assert.equal(normalizeSellerCode(" ana-123 "), "ANA-123");
  assert.equal(normalizeSellerCode("ANA123"), null);
  assert.equal(registerLinkWithCode("https://app", "ANA-123"), "https://app/register?codigo=ANA-123");
  // Sin sessionStorage (node) igual devuelve el código: se guarda si se puede.
  assert.equal(rememberSellerCodeFromUrl("?codigo=ana-123&plan=pro"), "ANA-123");
  assert.equal(rememberSellerCodeFromUrl("?codigo=<script>"), null);
});
