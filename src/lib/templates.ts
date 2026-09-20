// Apariencia de las paletas implementadas; sus permisos vienen del catálogo
// de planes (features.templateIds), nunca de esta tabla.
//
// Vive en lib/ y no en el editor porque ahora tiene dos consumidores: el grid
// de paletas del panel y el selector de familias, que necesita resolver el
// nombre de las paletas que sugiere.
export interface TemplateOption {
  id: number;
  name: string;
  color: string;
  accent: string;
}

export const TEMPLATES: TemplateOption[] = [
  { id: 1,  name: "Clásico",    color: "#0b0a08", accent: "#c9a84c" },
  { id: 2,  name: "Moderno",    color: "#0d1117", accent: "#58a6ff" },
  { id: 3,  name: "Natural",    color: "#f2f6ef", accent: "#2e7d32" },
  { id: 4,  name: "Rojo",       color: "#110606", accent: "#e05555" },
  { id: 5,  name: "Minimal",    color: "#ffffff", accent: "#111111" },
  { id: 6,  name: "Aurora",     color: "#efddc9", accent: "#a8703f" },
  { id: 7,  name: "Noir Gold",  color: "#08070a", accent: "#d4af37" },
  { id: 8,  name: "Coastal",    color: "#f4f8fb", accent: "#2a91c4" },
  { id: 9,  name: "Charcoal",   color: "#1a1a1c", accent: "#ff6b5c" },
  { id: 10, name: "Terracotta", color: "#f7ede3", accent: "#c2571f" },
  { id: 11, name: "Lavender",   color: "#f6f3fa", accent: "#8256c4" },
  { id: 12, name: "Forest",     color: "#0c1410", accent: "#86c397" },
  { id: 13, name: "Platinum",   color: "#0a0b0d", accent: "#b8c2cf" },
  { id: 14, name: "Ocean",      color: "#071b26", accent: "#36c2b4" },
  { id: 15, name: "Rosé",       color: "#fff6f3", accent: "#b64f68" },
];

export function templateName(id: number): string {
  return TEMPLATES.find(template => template.id === id)?.name ?? `Diseño ${id}`;
}
