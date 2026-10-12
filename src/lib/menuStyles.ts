import type { PageLayout } from "./pageLayouts.ts";

// Catálogo de diseños de carta. Todos se eligen de la misma lista; lo único
// que los separa es el plan: Clásico y Bistró están en todos, las familias
// visuales requieren la feature menu_styles y las premium, premium_menu_styles.
//
// No hay tope de cantidad. Sumar un diseño es:
//   1. agregar UNA fila a VISUAL_FAMILIES (con `premium: true` si va con
//      premium_menu_styles; LEGACY_STYLES no se toca);
//   2. agregar su fila gemela en el backend (config/menuStyles.js), que es
//      quien decide qué plan lo habilita — por eso este paso no se puede evitar;
//   3. su ícono en MenuStylePicker.tsx (no compila si falta);
//   4. sus estilos [data-menu-family="id"] en globals.css y en los módulos de
//      la portada y la carta.
// test/menuStyles.test.ts avisa si una familia quedó sin tokens en globals.css.
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
  { id: "coffee", name: "Cafetería", description: "Títulos con serif, fotos cálidas y una carta de lectura tranquila.", palettes: [6, 3, 10, 20], premium: false },
  { id: "fast-food", name: "Fast food", description: "Títulos contundentes, productos grandes y un pedido bien visible.", palettes: [9, 4, 1, 25], premium: false },
  { id: "grill", name: "Parrilla / Restaurante", description: "Fotografía protagonista, detalles sobrios y platos con presencia.", palettes: [1, 7, 10, 16], premium: false },
  { id: "premium", name: "Bistró / Premium", description: "Serif elegante, composición editorial y más espacio entre platos.", palettes: [5, 12, 7, 23], premium: false },
  { id: "bakery", name: "Pastelería / Bakery", description: "Formas suaves, fotos generosas y una presentación cercana.", palettes: [15, 6, 10, 17], premium: false },
  // Diseños premium (`premium: true`): familias como las de arriba (los colores
  // siguen saliendo de la paleta), pero gateadas con su propia feature.
  { id: "neo-brutalism", name: "Neobrutalismo", description: "Bordes gruesos, sombras duras y colores planos que se leen de lejos.", palettes: [5, 8, 11, 17], premium: true },
  { id: "tactile", name: "Maximalismo táctil", description: "Botones con relieve, texturas y platos que dan ganas de tocar.", palettes: [4, 9, 6, 21], premium: true },
  { id: "retro-diner", name: "Retro diner", description: "Letras de cartel, rayas de toldo y precios en etiqueta, como un diner de los 50.", palettes: [10, 15, 9, 25], premium: true },
  { id: "neon", name: "Neón nocturno", description: "Títulos y contornos que brillan como un cartel luminoso. Luce más en paletas oscuras.", palettes: [2, 14, 9, 24], premium: true },
  { id: "swiss", name: "Editorial suizo", description: "Tipografía enorme, grilla estricta, platos numerados y mucho aire.", palettes: [5, 8, 13, 18], premium: true },
  { id: "art-deco", name: "Art déco", description: "Marcos dobles, mayúsculas espaciadas y ornamentos geométricos de coctelería.", palettes: [7, 1, 12, 22], premium: true },
] as const;

export type LegacyStyle = typeof LEGACY_STYLES[number];
export type VisualFamily = typeof VISUAL_FAMILIES[number];
export type MenuStyle = LegacyStyle["id"] | VisualFamily["id"];

// Lo que se ofrece en el selector, en el orden en que se muestra: primero lo
// que cualquier plan puede usar, después lo que se desbloquea.
export const MENU_STYLE_OPTIONS = [...LEGACY_STYLES, ...VISUAL_FAMILIES];
export const LEGACY_MENU_STYLES = LEGACY_STYLES.map(style => style.id) as readonly MenuStyle[];

// Espejo de PREMIUM_MENU_STYLES en el backend: se habilitan con
// premium_menu_styles en vez de menu_styles (arrancan exclusivos de Pro).
export const PREMIUM_MENU_STYLES: readonly MenuStyle[] = VISUAL_FAMILIES.filter(family => family.premium).map(family => family.id);

export function isPremiumMenuStyle(value: MenuStyle): boolean {
  return PREMIUM_MENU_STYLES.includes(value);
}

// Feature del catálogo que habilita un diseño; null = abierto a todos los planes.
export function getMenuStyleFeature(value: MenuStyle): "menu_styles" | "premium_menu_styles" | null {
  if (isPremiumMenuStyle(value)) return "premium_menu_styles";
  return isLegacyMenuStyle(value) ? null : "menu_styles";
}

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
//
// Lo mismo vale para `pageLayout` (lib/pageLayouts.ts): la API lo recorta a
// "standard" sin la feature, así que solo viaja cuando el dueño eligió una.
export function buildAppearanceBody(template: number, menuStyle?: MenuStyle, pageLayout?: PageLayout) {
  return {
    template,
    ...(menuStyle === undefined ? {} : { menuStyle }),
    ...(pageLayout === undefined ? {} : { pageLayout }),
  };
}

// Ausente en cuentas y backends anteriores: conservar el diseño original.
export function resolveMenuStyle(value: unknown): MenuStyle {
  return MENU_STYLE_OPTIONS.find(style => style.id === value)?.id ?? "classic";
}
