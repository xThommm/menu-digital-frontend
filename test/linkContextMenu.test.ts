import test from "node:test";
import assert from "node:assert/strict";
import { resolveMenuItems } from "../src/features/contextMenu/lib/contextMenu.ts";
import { buildLinkMenu, copiedAddress } from "../src/features/contextMenu/lib/linkMenu.ts";
import { action, run } from "./support/menu.ts";

function menu(href: string, web = /^https?:/.test(href)) {
  const log: string[] = [];
  const items = resolveMenuItems(buildLinkMenu({
    openInNewTab: (url) => { log.push(`open:${url}`); },
    writeClipboard: async (text) => { log.push(`copy:${text}`); },
  }), { href, web }, "link/");
  return { items, log };
}

test("un link web: abrir en pestaña nueva y copiar la dirección", async () => {
  const { items, log } = menu("https://app.menudigital.com/lo-de-lucas/menu");
  assert.deepEqual(items.map((item) => item.id), ["link/open", "link/copy"]);
  assert.equal(action(items, "link/copy").label, "Copiar dirección del enlace");
  await run(action(items, "link/open"));
  await run(action(items, "link/copy"));
  assert.deepEqual(log, ["open:https://app.menudigital.com/lo-de-lucas/menu", "copy:https://app.menudigital.com/lo-de-lucas/menu"]);
});

test("mailto y tel: se copia el dato sin el prefijo y no se ofrece abrir", async () => {
  const mail = menu("mailto:lucas@example.com");
  assert.deepEqual(mail.items.map((item) => item.id), ["link/copy"]);
  assert.equal(action(mail.items, "link/copy").label, "Copiar mail");
  await run(action(mail.items, "link/copy"));
  assert.deepEqual(mail.log, ["copy:lucas@example.com"]);

  assert.equal(action(menu("tel:+5491123456789").items, "link/copy").label, "Copiar teléfono");
  assert.equal(copiedAddress("tel:+5491123456789"), "+5491123456789");
});
