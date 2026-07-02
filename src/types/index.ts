// ─────────────────────────────────────────────
// Tipos espejo de los Mongoose schemas del backend
// ─────────────────────────────────────────────

// ── Literales / enums ──────────────────────────────────────────────────────

export type Subscription = "none" | "monthly" | "semestral" | "annual"

// ✅ Movido desde apiClient.ts — toda la app importa desde acá
export type ApiErrorType =
  | "network"
  | "timeout"
  | "validation"
  | "auth"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "server"
  | "unknown"

// ── Entidades base ─────────────────────────────────────────────────────────

export interface ContactInfo {
  mail: string
  number: number | null
  location: Record<string, unknown>
  address: string
  social: Record<string, string>
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
  subscription: Subscription   // ✅ antes era `string`, ahora tipado estricto
  menu: boolean
  hasDelivery: boolean
  template: number
  contactInfo: ContactInfo
  media: Media
  createdAt: string
  updatedAt: string
}

// Forma normalizada del usuario logueado que vive en AuthContext — distinta
// de User (espejo crudo del schema): sale de adaptar AuthResponse a los
// nombres que usa el resto de la app (id/name/role) al hacer login.
// Antes vivía duplicada como `User` dentro de context/AuthContext.tsx.
export interface AuthUser {
  id: string
  name: string
  role: "admin" | "user"
  slug: string
  subscription: Subscription
}

export interface Menu {
  _id: string
  userID: string
  sectionID: string | null
  code: string
  title: string
  description: string
  image: string
  section: boolean
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export interface Item {
  _id: string
  menuID: string
  code: string
  title: string
  description: string
  price: number | null
  offerPrice: number | null
  offerRange: { from: string | null; to: string | null }
  options: Record<string, number>
  image: string
  available: boolean
  isExtra: boolean
  recommended: boolean
  hidden: boolean
  apt: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ── Respuestas de la API ───────────────────────────────────────────────────

export interface PublicMenuResponse {
  user: User
  menus: Menu[]
}

// ✅ Antes solo tenía _id/username/token — agregados los campos
//    que AuthProvider ya esperaba con un cast inline
export interface AuthResponse {
  _id: string
  username: string
  admin: boolean
  slug: string
  subscription: Subscription
  token: string
}

export interface TemplateResponse {
  template: number
}

export interface HiddenResponse {
  hidden: boolean
}

export interface AvailableResponse {
  available: boolean
}

// ── Menú público agrupado ──────────────────────────────────────────────────

export interface Categoria {
  _id: string
  title: string
  items: Item[]
}

export interface Seccion {
  title: string
  categorias: Categoria[]
}

export interface MenuData {
  secciones: Seccion[]
  sinSeccion: Categoria[]
}

export interface Tab {
  label: string
  categorias: Categoria[]
}

export interface UserMenuResponse {
  user: User
  menu: MenuData
}

// ── Menú del panel del dueño (GET /users/me/menu) ──────────────────────────
// A diferencia de Item/Categoria/Seccion/MenuData de arriba (carta pública,
// sin items ocultos), estos incluyen los campos que solo necesita el editor:
// hidden/code/description/image en cada nivel, y los items ocultos también
// vienen incluidos para poder reactivarlos.

export interface AdminItem {
  _id: string
  title: string
  description: string
  price: number | null
  offerPrice: number | null
  options: Record<string, number>
  image: string
  available: boolean
  hidden: boolean
  recommended: boolean
  code: string
}

export interface AdminCategoria {
  _id: string
  title: string
  description: string | null
  image: string
  hidden: boolean
  code: string
  items: AdminItem[]
}

export interface AdminSeccion {
  _id: string
  title: string
  hidden: boolean
  code: string
  categorias: AdminCategoria[]
}

export interface AdminMenuData {
  secciones: AdminSeccion[]
  sinSeccion: AdminCategoria[]
}

// ── Dashboard y estadísticas del dueño ──────────────────────────────────────

export interface DashData {
  businessName: string
  slug: string
  hasDelivery: boolean
  template: number
  itemCount: number
  categoryCount: number
}

export interface DayCount {
  date: string // "YYYY-MM-DD"
  count: number
}

export interface StatsData {
  totalViews: number
  last30Days: DayCount[]
}

// ── Import masivo (Excel) ──────────────────────────────────────────────────

export interface MassiveRowResult {
  fila: number
  codigo?: string
  titulo?: string
  cambios?: string[]
  razon?: string
}

export interface MassivePreviewResponse {
  resumen: {
    categorias: { crear: MassiveRowResult[]; actualizar: MassiveRowResult[]; errores: MassiveRowResult[] }
    productos:  { crear: MassiveRowResult[]; actualizar: MassiveRowResult[]; errores: MassiveRowResult[] }
  }
  mensaje: string
}

export interface MassiveConfirmResponse {
  resultado: {
    categorias: { creadas: MassiveRowResult[]; actualizadas: MassiveRowResult[]; errores: MassiveRowResult[] }
    productos:  { creados: MassiveRowResult[]; actualizados: MassiveRowResult[]; errores: MassiveRowResult[] }
  }
}

// ── Admin / CEO ────────────────────────────────────────────────────────────────

export interface Plan {
  id: string
  name: string
  price: number
  period: string
  highlight: boolean
  features: string[]
  badge?: string
  monthlyEquiv?: string
}

export interface AdminStats {
  usuarios: {
    total: number
    activos: number
    inactivos: number
    conMenuPublicado: number
    sinMenuPublicado: number
  }
  menus: {
    total: number
    secciones: number
    categorias: number
  }
  items: {
    total: number
    disponibles: number
    ocultos: number
  }
  recientes: {
    _id: string
    username: string
    slug: string
    active: boolean
    menu: boolean
    createdAt: string
  }[]
}