// Catálogo único de paletas. No hay tope de cantidad: sumar una es
//   1. agregar UNA fila acá, con el ID siguiente (los IDs no se reusan ni se
//      renumeran: quedan guardados en cada cuenta y en features.templateIds);
//   2. agregar su bloque [data-template="N"] en styles/globals.css.
// Nada más: el panel, el admin de planes, la portada y la carta leen esta
// tabla, y el backend solo valida la forma del ID. test/templates.test.ts
// avisa si una fila quedó sin bloque de CSS (o al revés).
//
// Esta tabla describe la apariencia; los permisos vienen del catálogo de
// planes (features.templateIds), nunca de acá. Una paleta nueva queda
// bloqueada para todos hasta que se la tilda en Admin → Planes.
export interface TemplateOption {
  id: number;
  name: string;
  /** Espejo de --t-bg y --t-accent del bloque de CSS, para la muestra del panel. */
  color: string;
  accent: string;
  // Ajustes de la portada del local con los diseños Clásico y Bistró (las
  // familias visuales traen los suyos). Todos opcionales: sin ellos la portada
  // sale con título serif, fotos con 10px de radio y foto de fondo.
  /** Título y título de galería en sans. */
  sans?: true;
  /** Radio de las fotos de la galería, en px. */
  radius?: number;
  /** Botón "Ver menú →" en vez de "Ver menú". */
  arrow?: true;
  /** Encabezado con avatar en vez de foto de fondo. */
  avatar?: true;
}

export const TEMPLATES: TemplateOption[] = [
  { id: 1,  name: "Clásico",    color: "#0b0a08", accent: "#c9a84c" },
  { id: 2,  name: "Moderno",    color: "#0d1117", accent: "#58a6ff", sans: true, radius: 6, arrow: true, avatar: true },
  { id: 3,  name: "Natural",    color: "#f2f6ef", accent: "#2e7d32", radius: 12 },
  { id: 4,  name: "Rojo",       color: "#110606", accent: "#e05555", radius: 8 },
  { id: 5,  name: "Minimal",    color: "#ffffff", accent: "#111111", sans: true, radius: 8 },
  { id: 6,  name: "Aurora",     color: "#efddc9", accent: "#a8703f", radius: 14 },
  { id: 7,  name: "Noir Gold",  color: "#08070a", accent: "#d4af37", radius: 6 },
  { id: 8,  name: "Coastal",    color: "#f4f8fb", accent: "#2a91c4", sans: true, radius: 12 },
  { id: 9,  name: "Charcoal",   color: "#1a1a1c", accent: "#ff6b5c", sans: true, radius: 8, arrow: true, avatar: true },
  { id: 10, name: "Terracotta", color: "#f7ede3", accent: "#c2571f" },
  { id: 11, name: "Lavender",   color: "#f6f3fa", accent: "#8256c4", radius: 14 },
  { id: 12, name: "Forest",     color: "#0c1410", accent: "#86c397", radius: 8 },
  { id: 13, name: "Platinum",   color: "#0a0b0d", accent: "#b8c2cf", radius: 6 },
  { id: 14, name: "Ocean",      color: "#071b26", accent: "#36c2b4", sans: true, arrow: true, avatar: true },
  { id: 15, name: "Rosé",       color: "#fff6f3", accent: "#b64f68", radius: 14, avatar: true },
  { id: 16, name: "Malbec",     color: "#170a10", accent: "#e39aa9", radius: 8 },
  { id: 17, name: "Mostaza",    color: "#fbf5e4", accent: "#8f6400", radius: 12 },
  { id: 18, name: "Oliva",      color: "#f4f2e9", accent: "#5c6b1e" },
  { id: 19, name: "Índigo",     color: "#0f0c1d", accent: "#a99bf5", radius: 6 },
  { id: 20, name: "Espresso",   color: "#16100c", accent: "#d99a5b" },
  { id: 21, name: "Menta",      color: "#eefaf5", accent: "#0b7a63", sans: true, radius: 14 },
  { id: 22, name: "Marino",     color: "#0a1424", accent: "#d9b36c", radius: 6 },
  { id: 23, name: "Tinta",      color: "#faf7f0", accent: "#24386e", radius: 8 },
  { id: 24, name: "Magenta",    color: "#110a12", accent: "#f062c0", sans: true, radius: 8, arrow: true },
  { id: 25, name: "Cereza",     color: "#fffaf7", accent: "#c0182b", sans: true, radius: 12 },
];

export function templateName(id: number): string {
  return TEMPLATES.find(template => template.id === id)?.name ?? `Diseño ${id}`;
}

// La paleta con la que se pinta una página pública. Un ID que esta versión del
// frontend no conoce (cuenta sin el campo, o una paleta más nueva que la
// pestaña que quedó abierta) cae a la 1: sin un [data-template] que exista no
// hay tokens --t-* y la página se vería rota.
export function resolveTemplate(id: unknown): TemplateOption {
  return TEMPLATES.find(template => template.id === id) ?? TEMPLATES[0];
}
