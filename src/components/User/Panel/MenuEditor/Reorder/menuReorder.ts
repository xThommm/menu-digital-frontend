import { arrayMove } from "@dnd-kit/sortable";
import type {
  AdminCategoria as Categoria,
  AdminItem as Item,
  AdminMenuData as MenuData,
} from "../../../../../types";

// Lógica pura de "ordenar el menú arrastrando": qué se arrastra, dónde puede
// caer y cómo queda el menú después. Sin React ni dnd-kit (salvo arrayMove):
// el hook useMenuReorder la usa para las actualizaciones optimistas y para
// armar lo que se guarda.

export type ReorderKind = "section" | "category" | "item";

// Contenedor de las categorías sin sección. Viaja al backend como
// sectionID null (PATCH /api/menus/reorder).
export const LOOSE_SECTION = "loose";

// Lo que cada elemento arrastrable o receptor le cuenta a dnd-kit (su `data`).
// Las listas reciben lo que se suelta en un contenedor vacío o en su margen.
// `title` es para los anuncios del lector de pantalla y la vista previa.
// `pinned`: vive en un contenedor sticky (la columna de estructura), que no se
// mueve cuando scrollea la página (ver collisionDetection en useMenuReorder).
export type SectionData = { kind: "section"; id: string; title: string; pinned?: boolean };
export type CategoryData = { kind: "category"; id: string; sectionKey: string; title: string; pinned?: boolean };
export type ItemData = { kind: "item"; id: string; catId: string; title: string };
export type SortableData = SectionData | CategoryData | ItemData;
export type CategoryListData = { kind: "category-list"; sectionKey: string; title: string; pinned?: boolean };
export type ItemListData = { kind: "item-list"; catId: string; title: string };
export type ReorderData = SortableData | CategoryListData | ItemListData;

// Ids de dnd-kit: únicos entre todo lo que se arrastra y todo lo que recibe.
export const dndId = (data: ReorderData): string => {
  switch (data.kind) {
    case "section": return `section:${data.id}`;
    case "category": return `category:${data.id}`;
    case "item": return `item:${data.id}`;
    case "category-list": return `categories-of:${data.sectionKey}`;
    case "item-list": return `items-of:${data.catId}`;
  }
};

export const sectionDndId = (id: string) => `section:${id}`;
export const categoryDndId = (id: string) => `category:${id}`;
export const itemDndId = (id: string) => `item:${id}`;

// ── Lectura ───────────────────────────────────────────────────────────────

export const categoriesIn = (menu: MenuData, sectionKey: string): Categoria[] =>
  sectionKey === LOOSE_SECTION
    ? menu.sinSeccion
    : menu.secciones.find(seccion => seccion._id === sectionKey)?.categorias ?? [];

export const allCategories = (menu: MenuData): Categoria[] =>
  [...menu.secciones.flatMap(seccion => seccion.categorias), ...menu.sinSeccion];

export const itemsIn = (menu: MenuData, catId: string): Item[] =>
  allCategories(menu).find(categoria => categoria._id === catId)?.items ?? [];

export const findCategory = (menu: MenuData, catId: string) => {
  const inLoose = menu.sinSeccion.findIndex(categoria => categoria._id === catId);
  if (inLoose !== -1) return { sectionKey: LOOSE_SECTION, index: inLoose };
  for (const seccion of menu.secciones) {
    const index = seccion.categorias.findIndex(categoria => categoria._id === catId);
    if (index !== -1) return { sectionKey: seccion._id, index };
  }
  return null;
};

export const findItem = (menu: MenuData, itemId: string) => {
  for (const categoria of allCategories(menu)) {
    const index = (categoria.items ?? []).findIndex(item => item._id === itemId);
    if (index !== -1) return { catId: categoria._id, index };
  }
  return null;
};

// ── Escritura (inmutable) ─────────────────────────────────────────────────
// Solo se crean objetos nuevos para lo que cambia: las tarjetas memorizadas
// de las categorías que no se tocaron conservan su referencia.

const withCategories = (menu: MenuData, sectionKey: string, categorias: Categoria[]): MenuData =>
  sectionKey === LOOSE_SECTION
    ? { ...menu, sinSeccion: categorias }
    : {
        ...menu,
        secciones: menu.secciones.map(seccion =>
          seccion._id === sectionKey ? { ...seccion, categorias } : seccion),
      };

const withItems = (menu: MenuData, catId: string, items: Item[]): MenuData => {
  const location = findCategory(menu, catId);
  if (!location) return menu;
  const categorias = categoriesIn(menu, location.sectionKey).map(categoria =>
    categoria._id === catId ? { ...categoria, items } : categoria);
  return withCategories(menu, location.sectionKey, categorias);
};

const clampIndex = (index: number, length: number) => Math.max(0, Math.min(index, length));

// Mueve un producto a `toIndex` dentro de `toCatId` (su misma categoría u otra).
export const moveItem = (menu: MenuData, itemId: string, toCatId: string, toIndex: number): MenuData => {
  const from = findItem(menu, itemId);
  if (!from) return menu;

  if (from.catId === toCatId) {
    const items = itemsIn(menu, toCatId);
    const index = clampIndex(toIndex, items.length - 1);
    return index === from.index ? menu : withItems(menu, toCatId, arrayMove(items, from.index, index));
  }

  const source = itemsIn(menu, from.catId);
  const item = source[from.index];
  const target = itemsIn(menu, toCatId);
  const index = clampIndex(toIndex, target.length);
  const moved = withItems(menu, from.catId, source.filter(entry => entry._id !== itemId));
  return withItems(moved, toCatId, [...target.slice(0, index), item, ...target.slice(index)]);
};

// Mueve una categoría a `toIndex` dentro de la sección `toSectionKey` (o de
// las sueltas, con LOOSE_SECTION).
export const moveCategory = (menu: MenuData, catId: string, toSectionKey: string, toIndex: number): MenuData => {
  const from = findCategory(menu, catId);
  if (!from) return menu;

  if (from.sectionKey === toSectionKey) {
    const categorias = categoriesIn(menu, toSectionKey);
    const index = clampIndex(toIndex, categorias.length - 1);
    return index === from.index
      ? menu
      : withCategories(menu, toSectionKey, arrayMove(categorias, from.index, index));
  }

  const source = categoriesIn(menu, from.sectionKey);
  const categoria = source[from.index];
  const target = categoriesIn(menu, toSectionKey);
  const index = clampIndex(toIndex, target.length);
  const moved = withCategories(menu, from.sectionKey, source.filter(entry => entry._id !== catId));
  return withCategories(moved, toSectionKey, [...target.slice(0, index), categoria, ...target.slice(index)]);
};

export const moveSection = (menu: MenuData, sectionId: string, toIndex: number): MenuData => {
  const from = menu.secciones.findIndex(seccion => seccion._id === sectionId);
  if (from === -1) return menu;
  const index = clampIndex(toIndex, menu.secciones.length - 1);
  return index === from ? menu : { ...menu, secciones: arrayMove(menu.secciones, from, index) };
};

// ── Lo que se guarda ──────────────────────────────────────────────────────
// Cada pedido manda el contenedor entero en su nuevo orden: el backend lo
// reescribe con 0, 1, 2... y mueve lo que llegó de otro contenedor.

export interface OrderSave {
  // Contenedor: dos guardados del mismo contenedor en cola se juntan en uno.
  key: string;
  url: string;
  body: Record<string, unknown>;
}

export const itemsOrderSave = (menu: MenuData, catId: string): OrderSave => ({
  key: `items:${catId}`,
  url: "/api/items/reorder",
  body: { menuID: catId, itemIds: itemsIn(menu, catId).map(item => item._id) },
});

export const categoriesOrderSave = (menu: MenuData, sectionKey: string): OrderSave => ({
  key: `categories:${sectionKey}`,
  url: "/api/menus/reorder",
  body: {
    sectionID: sectionKey === LOOSE_SECTION ? null : sectionKey,
    categoryIds: categoriesIn(menu, sectionKey).map(categoria => categoria._id),
  },
});

export const sectionsOrderSave = (menu: MenuData): OrderSave => ({
  key: "sections",
  url: "/api/menus/reorder",
  body: { sectionIds: menu.secciones.map(seccion => seccion._id) },
});

const sameIds = (a: { _id: string }[], b: { _id: string }[]) =>
  a.length === b.length && a.every((entry, index) => entry._id === b[index]._id);

// Qué hay que guardar después de soltar `data`: el contenedor donde terminó,
// si su orden cambió respecto de `before` (el menú al empezar a arrastrar).
// El contenedor de origen no se guarda: le queda un hueco en la numeración,
// que no cambia el orden.
export const saveAfterDrop = (before: MenuData, after: MenuData, data: SortableData): OrderSave | null => {
  if (data.kind === "section") {
    return sameIds(before.secciones, after.secciones) ? null : sectionsOrderSave(after);
  }
  if (data.kind === "category") {
    const location = findCategory(after, data.id);
    if (!location) return null;
    return sameIds(categoriesIn(before, location.sectionKey), categoriesIn(after, location.sectionKey))
      ? null
      : categoriesOrderSave(after, location.sectionKey);
  }
  const location = findItem(after, data.id);
  if (!location) return null;
  return sameIds(itemsIn(before, location.catId), itemsIn(after, location.catId))
    ? null
    : itemsOrderSave(after, location.catId);
};
