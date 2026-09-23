import type { PublicMenuData, PublicMenuItem, PublicMenuTab } from "../types/index.ts";

// Helpers puros de la carta pública (contrato v2, con tolerancia al legacy).

// Los productos no disponibles (interruptor manual apagado o fuera de su
// programación) llegan con `available: false` y se muestran con "No
// disponible". El contrato v2 omite la clave en los disponibles, así que la
// pregunta correcta es "¿viene explícitamente apagado?" y no
// `!item.available`: con v2 el campo está ausente (undefined) en los
// disponibles y todos aparecerían como no disponibles.
export const isItemUnavailable = (item: Pick<PublicMenuItem, "available">): boolean =>
  item.available === false;

// Las categorías de la carta pública no traen _id (v2 no los manda), así que
// se identifican por posición: pestaña + categoría dentro de la pestaña. Es
// única entre pestañas — openCats vive en el componente principal y
// sobrevive al cambio de pestaña — y estable mientras la carta cargada no
// cambie; al cargar otra carta se reinicia el estado que la usa.
export const categoryKey = (tabIndex: number, categoryIndex: number): string =>
  `${tabIndex}:${categoryIndex}`;

// Pestañas de la carta: una por sección y, si hay categorías sin sección,
// una última "Otros". El orden del JSON ya es el de la carta.
export function buildMenuTabs(menu: PublicMenuData | null): PublicMenuTab[] {
  if (!menu) return [];
  return [
    ...menu.secciones.map(s => ({ label: s.title, categorias: s.categorias })),
    ...(menu.sinSeccion.length > 0 ? [{ label: "Otros", categorias: menu.sinSeccion }] : []),
  ];
}

// Una pestaña "visible" tiene al menos un producto. v2 ya poda las categorías
// y secciones vacías; el legacy no, y ahí una pestaña puede quedar sin nada.
export const tabHasItems = (tab: PublicMenuTab): boolean =>
  tab.categorias.some(cat => cat.items.length > 0);
