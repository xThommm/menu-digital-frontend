// La familia define composición y tipografía; template conserva la paleta.
// Los dos diseños anteriores siguen siendo válidos para las cuentas existentes.
//
// `palettes` son IDs de paleta en orden de preferencia, no nombres: el plan
// del local decide cuáles puede usar, así que el selector filtra la lista y
// recién ahí resuelve los nombres (ver lib/templates.ts). Guardar IDs también
// deja que la muestra sea la primera paleta DISPONIBLE en vez de una fija que
// podía quedar bloqueada. Este archivo no importa la tabla de paletas a
// propósito: lo consumen la portada y la carta públicas, que no la necesitan.
export const VISUAL_FAMILIES = [
  { id: "coffee", name: "Cafetería", description: "Títulos con serif, fotos cálidas y una carta de lectura tranquila.", palettes: [6, 3, 10] },
  { id: "fast-food", name: "Fast food", description: "Títulos contundentes, productos grandes y un pedido bien visible.", palettes: [9, 4, 1] },
  { id: "grill", name: "Parrilla / Restaurante", description: "Fotografía protagonista, detalles sobrios y platos con presencia.", palettes: [1, 7, 10] },
  { id: "premium", name: "Bistró / Premium", description: "Serif elegante, composición editorial y más espacio entre platos.", palettes: [5, 12, 7] },
  { id: "bakery", name: "Pastelería / Bakery", description: "Formas suaves, fotos generosas y una presentación cercana.", palettes: [15, 6, 10] },
] as const;

export type VisualFamily = typeof VISUAL_FAMILIES[number];
export type MenuStyle = "classic" | "bistro" | VisualFamily["id"];

// Diseños previos al gating: siguen abiertos a todos los planes porque ya
// había cuentas gratuitas usándolos. Espejo de LEGACY_MENU_STYLES en el
// backend (config/menuStyles.js), que es quien realmente decide.
export const LEGACY_MENU_STYLES = ["classic", "bistro"] as const;

export function isLegacyMenuStyle(value: MenuStyle): boolean {
  return (LEGACY_MENU_STYLES as readonly string[]).includes(value);
}

export function getVisualFamily(value: unknown): VisualFamily | undefined {
  return VISUAL_FAMILIES.find(family => family.id === value);
}

// Ausente en cuentas y backends anteriores: conservar el diseño original.
export function resolveMenuStyle(value: unknown): MenuStyle {
  return getVisualFamily(value)?.id ?? (value === "bistro" ? "bistro" : "classic");
}
