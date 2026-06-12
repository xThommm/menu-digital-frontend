// ─────────────────────────────────────────────
// Tipos espejo de los Mongoose schemas del backend
// Cada campo mapea 1:1 con los modelos User, Menu e Item
// ─────────────────────────────────────────────

export interface ContactInfo {
  mail: string
  number: number | null
  location: Record<string, unknown>
  address: string
  social: Record<string, string>   // { instagram: "", facebook: "" }
  businessName: string
}

export interface Media {
  pictures: string[]
  backgroundPicture: string
}

export interface User {
  _id: string
  username: string
  slug: string
  active: boolean
  admin: boolean
  menu: boolean           // true si ya creó al menos una categoría
  hasDelivery: boolean
  template: number        // número de template visual (1..N)
  contactInfo: ContactInfo
  media: Media
  createdAt: string
  updatedAt: string
}

// Menu = categoría/sección del menú de un local
export interface Menu {
  _id: string
  userID: string
  sectionID: string | null
  code: string
  title: string
  description: string
  image: string
  section: boolean        // true = es contenedor de secciones, false = tiene items
  hidden: boolean
  createdAt: string
  updatedAt: string
}

// Item = producto individual dentro de una categoría
export interface Item {
  _id: string
  menuID: string
  code: string
  title: string
  description: string
  price: number | null
  offerPrice: number | null
  offerDate: string | null
  options: Record<string, number>   // { "Tamaño chico": 800, "Grande": 1200 }
  image: string
  available: boolean
  isExtra: boolean
  recommended: boolean
  hidden: boolean
  apt: Record<string, unknown>      // { "alérgenos": "gluten", "calorias": 450 }
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────
// Respuestas de la API
// ─────────────────────────────────────────────

// GET /api/menus/public/:slug
export interface PublicMenuResponse {
  user: User
  menus: Menu[]
}

// POST /api/users/login | register
export interface AuthResponse {
  _id: string
  username: string
  token: string
}

// PATCH /api/users/template
export interface TemplateResponse {
  template: number
}

// PATCH /api/items/:itemID/hidden
export interface HiddenResponse {
  hidden: boolean
}

// PATCH /api/items/:itemID/available
export interface AvailableResponse {
  available: boolean
}

// ─────────────────────────────────────────────
// Tipos para el menú público agrupado
// Usados en UserMenu.tsx — respuesta de GET /api/users/:slug/menu
// ─────────────────────────────────────────────

// Categoría con sus items ya populados (versión pública)
export interface Categoria {
  _id: string
  title: string
  items: Item[]
}

// Sección contenedora de categorías
export interface Seccion {
  title: string
  categorias: Categoria[]
}

// Estructura que devuelve el endpoint /api/users/:slug/menu
export interface MenuData {
  secciones: Seccion[]
  sinSeccion: Categoria[]
}

// Tab de navegación (construido en el frontend a partir de MenuData)
export interface Tab {
  label: string
  categorias: Categoria[]
}

// GET /api/users/:slug/menu
export interface UserMenuResponse {
  user: User
  menu: MenuData
}