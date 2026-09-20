// La familia define composición y tipografía; template conserva la paleta.
// Los dos diseños anteriores siguen siendo válidos para las cuentas existentes.
export const VISUAL_FAMILIES = [
  { id: "coffee", name: "Cafetería", description: "Títulos con serif, fotos cálidas y una carta de lectura tranquila.", palettes: "Aurora, Natural o Terracotta", samplePalette: 6 },
  { id: "fast-food", name: "Fast food", description: "Títulos contundentes, productos grandes y un pedido bien visible.", palettes: "Rojo, Charcoal o Clásico", samplePalette: 9 },
  { id: "grill", name: "Parrilla / Restaurante", description: "Fotografía protagonista, detalles sobrios y platos con presencia.", palettes: "Clásico, Noir Gold o Terracotta", samplePalette: 1 },
  { id: "premium", name: "Bistró / Premium", description: "Serif elegante, composición editorial y más espacio entre platos.", palettes: "Minimal, Forest o Noir Gold", samplePalette: 5 },
  { id: "bakery", name: "Pastelería / Bakery", description: "Formas suaves, fotos generosas y una presentación cercana.", palettes: "Rosé, Aurora o Terracotta", samplePalette: 15 },
] as const;

export type VisualFamily = typeof VISUAL_FAMILIES[number];
export type MenuStyle = "classic" | "bistro" | VisualFamily["id"];

export function getVisualFamily(value: unknown): VisualFamily | undefined {
  return VISUAL_FAMILIES.find(family => family.id === value);
}

// Ausente en cuentas y backends anteriores: conservar el diseño original.
export function resolveMenuStyle(value: unknown): MenuStyle {
  return getVisualFamily(value)?.id ?? (value === "bistro" ? "bistro" : "classic");
}
