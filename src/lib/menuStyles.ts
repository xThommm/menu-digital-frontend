// Catálogo de diseños de carta. Todos se eligen de la misma lista; lo único
// que los separa es el plan: Clásico y Bistró están en todos, las familias
// visuales requieren la feature menu_styles.
//
// `palettes` son IDs de paleta en orden de preferencia, no nombres: el plan
// del local decide cuáles puede usar, así que el selector filtra la lista y
// recién ahí resuelve los nombres (ver lib/templates.ts). Guardar IDs también
// deja que la muestra sea la primera paleta DISPONIBLE en vez de una fija que
// podía quedar bloqueada. Este archivo no importa la tabla de paletas a
// propósito: lo consumen la portada y la carta públicas, que no la necesitan.

// Los dos diseños originales. Siguen abiertos a todos los planes porque ya
// había cuentas gratuitas usándolos; quitárselos sería degradarles la carta.
// Espejo de LEGACY_MENU_STYLES en el backend (config/menuStyles.js), que es
// quien realmente decide.
export const LEGACY_STYLES = [
  { id: "classic", name: "Clásico", description: "Carta en lista, con fotos al costado y lectura compacta.", palettes: [1, 2, 5] },
  { id: "bistro", name: "Bistró", description: "Tarjetas redondeadas, fotos circulares y platos protagonistas.", palettes: [6, 15, 3] },
] as const;

// La familia define composición y tipografía; template conserva la paleta.
export const VISUAL_FAMILIES = [
  { id: "coffee", name: "Cafetería", description: "Títulos con serif, fotos cálidas y una carta de lectura tranquila.", palettes: [6, 3, 10] },
  { id: "fast-food", name: "Fast food", description: "Títulos contundentes, productos grandes y un pedido bien visible.", palettes: [9, 4, 1] },
  { id: "grill", name: "Parrilla / Restaurante", description: "Fotografía protagonista, detalles sobrios y platos con presencia.", palettes: [1, 7, 10] },
  { id: "premium", name: "Bistró / Premium", description: "Serif elegante, composición editorial y más espacio entre platos.", palettes: [5, 12, 7] },
  { id: "bakery", name: "Pastelería / Bakery", description: "Formas suaves, fotos generosas y una presentación cercana.", palettes: [15, 6, 10] },
] as const;

export type LegacyStyle = typeof LEGACY_STYLES[number];
export type VisualFamily = typeof VISUAL_FAMILIES[number];
export type MenuStyle = LegacyStyle["id"] | VisualFamily["id"];

// Lo que se ofrece en el selector, en el orden en que se muestra: primero lo
// que cualquier plan puede usar, después lo que se desbloquea.
export const MENU_STYLE_OPTIONS = [...LEGACY_STYLES, ...VISUAL_FAMILIES];
export const LEGACY_MENU_STYLES = LEGACY_STYLES.map(style => style.id) as readonly MenuStyle[];

export function isLegacyMenuStyle(value: MenuStyle): boolean {
  return LEGACY_MENU_STYLES.includes(value);
}

export function getVisualFamily(value: unknown): VisualFamily | undefined {
  return VISUAL_FAMILIES.find(family => family.id === value);
}

// Cuerpo del PATCH de apariencia. `menuStyle` viaja SOLO cuando el dueño
// eligió un diseño: un cambio de paleta no debe reenviarlo.
//
// El estado del panel se siembra con lo que devuelve la API, y la API recorta
// a "classic" cuando el plan no incluye las familias. Reenviar ese valor
// escribiría "classic" sobre la familia guardada en MongoDB y destruiría lo
// único que el recorte de lectura promete devolver al renovar. Omitir la clave
// deja que el backend conserve lo guardado (ver useTemplate).
export function buildAppearanceBody(template: number, menuStyle?: MenuStyle) {
  return menuStyle === undefined ? { template } : { template, menuStyle };
}

// Ausente en cuentas y backends anteriores: conservar el diseño original.
export function resolveMenuStyle(value: unknown): MenuStyle {
  return MENU_STYLE_OPTIONS.find(style => style.id === value)?.id ?? "classic";
}
