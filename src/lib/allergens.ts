import {
  Bean, Carrot, Droplet, Egg, Fish, Leaf, Milk, Nut, Shrimp, Snail, Sprout, Vegan, Wheat, WheatOff, Wine,
  type LucideIcon,
} from "lucide-react";
import type { PublicMenuTab } from "../types/index.ts";

// ──────────────────────────────────────────────
// Alérgenos y etiquetas dietarias de los productos.
//
// Espejo del catálogo fijo del backend (utils/allergens.js, también en
// GET /api/items/allergens): los productos guardan solo los CÓDIGOS y acá
// están el nombre, el ícono y el orden. Un código que el front todavía no
// conozca se muestra con el código tal cual (labelOfAllergen), nunca se
// pierde. Si se suma uno en el backend, agregarlo también acá.
// Los íconos son de apoyo: siempre van con el nombre al lado.
// ──────────────────────────────────────────────

export interface AllergenInfo {
  code: string;
  label: string;
  Icon: LucideIcon;
}

export interface DietaryInfo extends AllergenInfo {
  // Alérgenos que el producto no puede tener (ni como traza) con esta etiqueta.
  excludes: string[];
}

export const ALLERGENS: AllergenInfo[] = [
  { code: "gluten", label: "Gluten", Icon: Wheat },
  { code: "crustaceos", label: "Crustáceos", Icon: Shrimp },
  { code: "huevo", label: "Huevo", Icon: Egg },
  { code: "pescado", label: "Pescado", Icon: Fish },
  { code: "mani", label: "Maní", Icon: Nut },
  { code: "soja", label: "Soja", Icon: Bean },
  { code: "lacteos", label: "Lácteos", Icon: Milk },
  { code: "frutos_secos", label: "Frutos secos", Icon: Nut },
  { code: "apio", label: "Apio", Icon: Carrot },
  { code: "mostaza", label: "Mostaza", Icon: Droplet },
  { code: "sesamo", label: "Sésamo", Icon: Sprout },
  { code: "sulfitos", label: "Sulfitos", Icon: Wine },
  { code: "altramuces", label: "Altramuces", Icon: Bean },
  { code: "moluscos", label: "Moluscos", Icon: Snail },
];

export const DIETARY: DietaryInfo[] = [
  { code: "sin_tacc", label: "Sin TACC", Icon: WheatOff, excludes: ["gluten"] },
  { code: "vegetariano", label: "Vegetariano", Icon: Leaf, excludes: ["pescado", "crustaceos", "moluscos"] },
  { code: "vegano", label: "Vegano", Icon: Vegan, excludes: ["pescado", "crustaceos", "moluscos", "huevo", "lacteos"] },
];

const allergenByCode = new Map(ALLERGENS.map(a => [a.code, a]));
const dietaryByCode = new Map(DIETARY.map(d => [d.code, d]));

export const allergenInfo = (code: string): AllergenInfo | undefined => allergenByCode.get(code);
export const dietaryInfo = (code: string): DietaryInfo | undefined => dietaryByCode.get(code);
export const labelOfAllergen = (code: string): string => allergenByCode.get(code)?.label ?? code;
export const labelOfDietary = (code: string): string => dietaryByCode.get(code)?.label ?? code;

// Ordena según el catálogo (los desconocidos al final) y saca repetidos.
export const sortAllergenCodes = (codes: string[]): string[] => {
  const order = (code: string) => {
    const index = ALLERGENS.findIndex(a => a.code === code);
    return index === -1 ? ALLERGENS.length : index;
  };
  return [...new Set(codes)].sort((a, b) => order(a) - order(b));
};
export const sortDietaryCodes = (codes: string[]): string[] => {
  const order = (code: string) => {
    const index = DIETARY.findIndex(d => d.code === code);
    return index === -1 ? DIETARY.length : index;
  };
  return [...new Set(codes)].sort((a, b) => order(a) - order(b));
};

// ── Editor ─────────────────────────────────────

export interface AllergenSelection {
  allergens: string[];
  mayContain: string[];
  dietary: string[];
}

// Etiqueta dietaria que impide marcar este alérgeno (como "contiene" o como
// traza), o null. Mismo criterio que validateAllergenFields del backend.
export const blockingDietary = (allergen: string, dietary: string[]): DietaryInfo | null =>
  dietary.map(dietaryInfo).find(d => d?.excludes.includes(allergen)) ?? null;

// Alérgeno marcado que impide elegir esta etiqueta, o null.
export const blockingAllergen = (dietaryCode: string, selection: AllergenSelection): string | null => {
  const excludes = dietaryInfo(dietaryCode)?.excludes ?? [];
  return excludes.find(a => selection.allergens.includes(a) || selection.mayContain.includes(a)) ?? null;
};

// Marca o desmarca un alérgeno en "contiene" o "puede contener". Marcarlo
// en uno lo saca del otro: un producto no contiene y "puede contener" lo
// mismo a la vez.
export const toggleAllergen = (
  selection: AllergenSelection, field: "allergens" | "mayContain", code: string,
): AllergenSelection => {
  const other = field === "allergens" ? "mayContain" : "allergens";
  const has = selection[field].includes(code);
  return {
    ...selection,
    [field]: has ? selection[field].filter(c => c !== code) : sortAllergenCodes([...selection[field], code]),
    [other]: has ? selection[other] : selection[other].filter(c => c !== code),
  };
};

export const toggleDietary = (selection: AllergenSelection, code: string): AllergenSelection => ({
  ...selection,
  dietary: selection.dietary.includes(code)
    ? selection.dietary.filter(c => c !== code)
    : sortDietaryCodes([...selection.dietary, code]),
});

// ── Carta pública: filtro ──────────────────────

export interface MenuDietFilter {
  // Solo productos con TODAS estas etiquetas (ej. Sin TACC y Vegano).
  dietary: string[];
  // Fuera los productos que contengan (o puedan contener) alguno de estos.
  avoid: string[];
}

export const EMPTY_DIET_FILTER: MenuDietFilter = { dietary: [], avoid: [] };

export const isDietFilterActive = (filter: MenuDietFilter): boolean =>
  filter.dietary.length > 0 || filter.avoid.length > 0;

interface DietAwareItem {
  allergens?: string[];
  mayContain?: string[];
  dietary?: string[];
}

export const itemHasDietInfo = (item: DietAwareItem): boolean =>
  (item.allergens?.length ?? 0) > 0 || (item.mayContain?.length ?? 0) > 0 || (item.dietary?.length ?? 0) > 0;

// Evitar un alérgeno saca también los que "pueden contener" trazas: para
// alguien alérgico, una traza es tan riesgosa como el ingrediente.
// Un producto SIN ningún dato cargado no pasa el filtro: "no tiene
// alérgenos cargados" no es lo mismo que "no tiene alérgenos", y mostrarlo
// como apto podría ser peligroso.
export const matchesDietFilter = (item: DietAwareItem, filter: MenuDietFilter): boolean => {
  if (!isDietFilterActive(filter)) return true;
  if (!itemHasDietInfo(item)) return false;
  const dietary = item.dietary ?? [];
  if (!filter.dietary.every(code => dietary.includes(code))) return false;
  const present = [...(item.allergens ?? []), ...(item.mayContain ?? [])];
  return !filter.avoid.some(code => present.includes(code));
};

// Pestañas con los productos filtrados. Se conserva la estructura (mismas
// pestañas y categorías en la misma posición) porque las claves de
// categoría son posicionales (categoryKey); las que quedan vacías ya las
// saltea la carta.
export const filterMenuTabs = (tabs: PublicMenuTab[], filter: MenuDietFilter): PublicMenuTab[] => {
  if (!isDietFilterActive(filter)) return tabs;
  return tabs.map(tab => ({
    ...tab,
    categorias: tab.categorias.map(cat => ({ ...cat, items: cat.items.filter(item => matchesDietFilter(item, filter)) })),
  }));
};

// ¿La carta tiene algún dato de alérgenos? Sin datos no se ofrece el filtro:
// filtrar una carta sin cargar mostraría todo como "apto".
export const menuHasDietInfo = (tabs: PublicMenuTab[]): boolean =>
  tabs.some(tab => tab.categorias.some(cat => cat.items.some(itemHasDietInfo)));

// Códigos que aparecen en la carta, en el orden del catálogo: el filtro solo
// ofrece opciones que cambian algo.
export const dietCodesInMenu = (tabs: PublicMenuTab[]): { dietary: string[]; allergens: string[] } => {
  const dietary = new Set<string>();
  const allergens = new Set<string>();
  for (const tab of tabs) {
    for (const cat of tab.categorias) {
      for (const item of cat.items) {
        item.dietary?.forEach(code => dietary.add(code));
        item.allergens?.forEach(code => allergens.add(code));
        item.mayContain?.forEach(code => allergens.add(code));
      }
    }
  }
  return { dietary: sortDietaryCodes([...dietary]), allergens: sortAllergenCodes([...allergens]) };
};
