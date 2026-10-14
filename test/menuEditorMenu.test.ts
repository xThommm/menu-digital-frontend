import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCategoryMenu, buildEditorBoardMenu, buildItemMenu, buildSectionMenu, buildSelectionMenu, locateInMenu, visibleInMenu,
  type CategoryMenuActions, type ItemMenuActions,
} from "../src/components/User/Panel/MenuEditor/menuEditorMenu.ts";
import { buildImageManagerMenu, buildImageTileMenu } from "../src/components/User/Panel/MenuEditor/ImageManager/imageManagerMenu.ts";
import type { AdminCategoria, AdminItem, AdminMenuData, AdminSeccion } from "../src/types/index.ts";
import { action, fakeEnv, ids, recorder, resolve, run, submenu } from "./support/menu.ts";

const item = (id: string, overrides: Partial<AdminItem> = {}): AdminItem => ({
  _id: id, title: `Producto ${id}`, description: "", price: 1500, offerPrice: null, options: {}, image: "", available: true,
  hidden: false, recommended: false, code: "", ...overrides,
});
const cat = (id: string, items: AdminItem[], overrides: Partial<AdminCategoria> = {}): AdminCategoria => ({
  _id: id, title: `Categoría ${id}`, description: null, image: "", hidden: false, code: "", items, ...overrides,
});
const section = (id: string, categorias: AdminCategoria[], overrides: Partial<AdminSeccion> = {}): AdminSeccion => ({
  _id: id, title: `Sección ${id}`, hidden: false, code: "", categorias, ...overrides,
});

const menu: AdminMenuData = {
  secciones: [section("s1", [cat("c1", [item("i1"), item("i2", { available: false })])], { hidden: true }), section("s2", [])],
  sinSeccion: [cat("c9", [item("i9", { image: "https://x/img.jpg", code: "MUZ" })])],
};

test("ubicar lo clickeado: producto, categoría o sección, con su sección", () => {
  const onItem = locateInMenu(menu, { itemId: "i9", catId: "c9" });
  assert.equal(onItem.item?._id, "i9");
  assert.equal(onItem.cat?._id, "c9");
  assert.equal(onItem.section, null);

  const onCat = locateInMenu(menu, { catId: "c1", sectionId: "s1" });
  assert.equal(onCat.item, null);
  assert.equal(onCat.section?._id, "s1");

  assert.equal(locateInMenu(menu, { sectionId: "s2" }).section?._id, "s2");
  assert.deepEqual(locateInMenu(menu, { itemId: "borrado" }), { item: null, cat: null, section: null });

  assert.equal(visibleInMenu(locateInMenu(menu, { itemId: "i9" })), true);
  assert.equal(visibleInMenu(locateInMenu(menu, { itemId: "i1" })), false, "su sección está oculta");
});

function itemMenu(target: AdminItem, overrides: { deleteDisabled?: boolean; visible?: boolean } = {}) {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions: ItemMenuActions = {
    edit: fn("edit"), duplicate: fn("duplicate"), toggleAvailable: fn("available"), toggleHidden: fn("hidden"),
    toggleRecommended: async (i) => { calls.push(`recommended #${i._id}`); },
    changeImage: fn("image"), removeImage: async (i) => { calls.push(`remove-image #${i._id}`); },
    select: fn("select"), remove: fn("delete"),
  };
  const items = resolve(buildItemMenu(env), {
    item: target, cat: cat("c9", [target]), visibleInMenu: overrides.visible ?? true, publicMenuUrl: "https://app/local/menu",
    duplicating: false, deleteDisabled: overrides.deleteDisabled ?? false, actions,
  });
  return { items, calls, log };
}

test("producto: las acciones de la fila más destacar, imagen, copiar y ver en la carta", async () => {
  const { items, calls, log } = itemMenu(item("i9", { image: "https://x/img.jpg", code: "MUZ" }));
  assert.deepEqual(ids(items), [
    "edit", "duplicate", "available", "hidden", "recommended", "image", "remove-image",
    "copy", "copy/name", "copy/price", "copy/code", "public", "select", "delete",
  ]);
  assert.equal(action(items, "available").label, "Pausar (sin stock)");
  assert.equal(action(items, "image").label, "Cambiar imagen");

  await run(action(items, "copy/price"));
  await run(action(items, "public"));
  assert.deepEqual(log, ["copy:$1.500", "open:https://app/local/menu?producto=i9"]);

  const star = await run(action(items, "recommended"));
  assert.deepEqual(star.notices, ["ok:Producto destacado."]);
  assert.deepEqual(calls, ["recommended #i9"]);
});

test("producto: quitar la imagen confirma; eliminar respeta la configuración", async () => {
  const { items, calls } = itemMenu(item("i9", { image: "https://x/img.jpg" }));
  const removeImage = action(items, "remove-image");
  assert.equal(removeImage.confirm?.danger, true);
  assert.equal((await run(removeImage, { accept: false })).outcome, "cancelled");
  assert.deepEqual(calls, []);

  const blocked = itemMenu(item("i1"), { deleteDisabled: true, visible: false });
  assert.equal(action(blocked.items, "delete").disabled, true);
  assert.match(action(blocked.items, "public").disabledReason ?? "", /oculto o pausado/);
  assert.ok(!ids(blocked.items).includes("remove-image"), "sin foto no hay qué quitar");
  assert.equal(action(blocked.items, "image").label, "Agregar imagen");
});

test("selección: activar y pausar solo con productos marcados; eliminar abre su modal", async () => {
  const { calls, fn } = recorder();
  const actions = { toggleItem: fn("toggle"), setAvailable: fn("available"), setHidden: fn("hidden"), remove: fn("delete"), cancel: fn("cancel") };
  const onlyMenus = resolve(buildSelectionMenu(), {
    item: null, itemSelected: false, selectedItems: 0, hasSelection: true, busy: false, deleteDisabled: false, actions,
  });
  assert.equal(action(onlyMenus, "pause").disabled, true);
  assert.equal(action(onlyMenus, "hide").disabled, false);
  assert.ok(!ids(onlyMenus).includes("toggle"));

  const onItem = resolve(buildSelectionMenu(), {
    item: item("i1"), itemSelected: true, selectedItems: 2, hasSelection: true, busy: false, deleteDisabled: false, actions,
  });
  assert.equal(action(onItem, "toggle").label, "Deseleccionar este producto");
  await run(action(onItem, "pause"));
  await run(action(onItem, "delete"));
  await run(action(onItem, "cancel"));
  assert.deepEqual(calls, ["available false", "delete", "cancel"]);
});

function categoryMenu(target: AdminCategoria, sectionId: string | null) {
  const { calls, fn } = recorder();
  const actions: CategoryMenuActions = {
    addItem: fn("add"), edit: fn("edit"), toggleHidden: fn("hidden"),
    setAllAvailable: async (c, available) => { calls.push(`all #${c._id} ${available}`); },
    move: async (c, to) => { calls.push(`move #${c._id} ${to}`); },
    duplicate: async (c) => { calls.push(`duplicate #${c._id}`); },
    selectAll: fn("select"), toggleCollapsed: fn("collapse"), remove: fn("delete"),
  };
  const items = resolve(buildCategoryMenu(), {
    cat: target, sectionId, sections: menu.secciones.map((s) => ({ _id: s._id, title: s.title })), collapsed: false,
    atItemLimit: false, deleteDisabled: false, actions,
  });
  return { items, calls };
}

test("categoría: pausar/activar todo según sus productos, mover a otra sección y duplicar", async () => {
  const mixed = cat("c1", [item("i1"), item("i2", { available: false })]);
  const { items, calls } = categoryMenu(mixed, "s1");
  assert.ok(ids(items).includes("pause-all") && ids(items).includes("activate-all"));
  assert.deepEqual(submenu(items, "move").items.filter((entry) => entry.type !== "separator").map((entry) => entry.label), ["Sección s2", "Sin sección"]);

  const moved = await run(action(items, "move/s2"));
  assert.deepEqual(moved.notices, ["ok:Categoría c1 pasó a Sección s2."]);
  await run(action(items, "move/none"));
  const copied = await run(action(items, "duplicate"));
  assert.deepEqual(copied.notices, ['ok:Categoría duplicada: "Copia de Categoría c1".']);
  await run(action(items, "pause-all"));
  assert.deepEqual(calls, ["move #c1 s2", "move #c1 null", "duplicate #c1", "all #c1 false"]);

  const loose = categoryMenu(cat("c9", [item("i9")]), null);
  assert.deepEqual(submenu(loose.items, "move").items.map((entry) => entry.label), ["Sección s1", "Sección s2"], "ya está sin sección");
  assert.ok(!ids(loose.items).includes("activate-all"), "están todos activos");

  const empty = categoryMenu(cat("c0", []), null);
  assert.ok(!ids(empty.items).includes("select-all") && !ids(empty.items).includes("pause-all"));
});

test("sección y fondo: agregar, plegar, herramientas con su plan y la carta pública", async () => {
  const { calls, fn } = recorder();
  const sectionItems = resolve(buildSectionMenu(), {
    sec: menu.secciones[0], collapsed: true, deleteDisabled: true,
    actions: { addCategory: fn("add"), edit: fn("edit"), toggleHidden: fn("hidden"), toggleCollapsed: fn("collapse"), remove: fn("delete") },
  });
  assert.equal(action(sectionItems, "hidden").label, "Mostrar en la carta");
  assert.equal(action(sectionItems, "collapse").label, "Expandir");
  assert.equal(action(sectionItems, "delete").disabled, true);

  const { env, log } = fakeEnv();
  const boardActions = {
    newSection: fn("section"), newCategory: fn("category"), newItem: fn("item"), collapseAll: fn("collapse"), expandAll: fn("expand"),
    openTemplates: fn("templates"), openImageManager: fn("images"), importExcel: fn("import"), exportExcel: fn("export"), exportPdf: fn("pdf"),
  };
  const board = resolve(buildEditorBoardMenu(env), {
    hasCategories: false, canCollapse: true, canExpand: false, tools: { templates: true, images: false, excel: true, pdf: false },
    exporting: false, publicMenuUrl: "https://app/local/menu", actions: boardActions,
  });
  assert.equal(action(board, "new-item").disabled, true);
  assert.equal(action(board, "expand-all").disabled, true);
  assert.equal(action(board, "tools/images").label, "Gestor de imágenes (ver planes)");
  assert.equal(action(board, "tools/templates").label, "Elegir desde plantilla");
  await run(action(board, "tools/pdf"));
  await run(action(board, "public"));
  assert.deepEqual(calls, ["pdf"]);
  assert.deepEqual(log, ["open:https://app/local/menu"]);
});

test("gestor de imágenes: asignar, quitar de un producto, abrir y eliminar (no las prediseñadas)", async () => {
  const { env, log } = fakeEnv();
  const { calls, fn } = recorder();
  const actions = { assign: fn("assign"), unassign: fn("unassign"), remove: fn("delete") };
  const tile = resolve(buildImageTileMenu(env), {
    imageUrl: "https://x/a.jpg", isPreset: false, ready: true, assigned: [{ rowIndex: 0, title: "Muzza" }, { rowIndex: 1, title: "Fugazza" }], actions,
  });
  assert.deepEqual(ids(tile), ["assign", "unassign", "unassign/0", "unassign/1", "open", "delete"]);
  assert.equal(action(tile, "assign").label, "Asignar a otro producto");
  await run(action(tile, "unassign/1"));
  await run(action(tile, "open"));
  assert.deepEqual(calls, ["unassign 1"]);
  assert.deepEqual(log, ["open:https://x/a.jpg"]);

  const preset = resolve(buildImageTileMenu(env), { imageUrl: "https://x/p.jpg", isPreset: true, ready: true, assigned: [], actions });
  assert.deepEqual(ids(preset), ["assign", "open"]);

  const page = resolve(buildImageManagerMenu(), {
    view: "mine", pending: 2, saving: false,
    actions: { addImages: fn("add"), setView: fn("view"), save: fn("save") },
  });
  assert.equal(action(page, "mine").disabled, true);
  assert.equal(action(page, "save").label, "Guardar cambios (2)");
});
