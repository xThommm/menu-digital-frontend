// Catálogo de plantillas de página: la COMPOSICIÓN de la portada y la carta
// en escritorio. Es el tercer eje de la apariencia y no se pisa con los otros
// dos: la paleta (lib/templates.ts) pone los colores y el diseño de carta
// (lib/menuStyles.ts) la tipografía y las formas. La plantilla solo decide
// dónde va cada cosa, así que cualquier combinación de los tres es válida.
//
// En el celular todas las plantillas se ven como Estándar: no hay ancho para
// otra composición (ver PAGE_LAYOUT_MIN_WIDTH).
//
// Sumar una plantilla es:
//   1. agregar UNA fila acá;
//   2. agregar su fila gemela en el backend (config/pageLayouts.js), que es
//      quien decide qué plan la habilita;
//   3. su miniatura en PageLayoutPicker.tsx (no compila si falta);
//   4. sus estilos [data-page-layout="id"] en los módulos de la portada y la
//      carta.
// test/pageLayouts.test.ts avisa si una plantilla quedó sin estilos.
export const PAGE_LAYOUT_OPTIONS = [
  {
    id: "standard",
    name: "Estándar",
    description: "Foto y datos lado a lado en la portada; carta en una columna central.",
    gated: false,
  },
  {
    id: "immersive",
    name: "Inmersiva",
    description: "La foto de portada a pantalla completa con el nombre encima; carta con cabecera fotográfica y categorías siempre a mano.",
    gated: true,
  },
  {
    id: "split",
    name: "Partida",
    description: "El nombre y los botones a un lado y la foto de portada al otro, enmarcada; la carta abre con la misma cabecera partida.",
    gated: true,
  },
] as const;

export type PageLayout = typeof PAGE_LAYOUT_OPTIONS[number]["id"];

// Ancho desde el que una plantilla cambia la composición. Mismo corte que el
// resto del escritorio de la portada y la carta (min-width: 1024px).
export const PAGE_LAYOUT_MIN_WIDTH = 1024;

// Feature del catálogo que habilita una plantilla; null = abierta a todos los
// planes. Espejo de getPageLayoutFeature en el backend.
export function getPageLayoutFeature(value: PageLayout): "page_layouts" | null {
  return PAGE_LAYOUT_OPTIONS.find(option => option.id === value)?.gated ? "page_layouts" : null;
}

// Ausente en cuentas y backends anteriores: la composición de siempre.
export function resolvePageLayout(value: unknown): PageLayout {
  return PAGE_LAYOUT_OPTIONS.find(option => option.id === value)?.id ?? "standard";
}

export function pageLayoutName(value: PageLayout): string {
  return PAGE_LAYOUT_OPTIONS.find(option => option.id === value)?.name ?? "Estándar";
}
