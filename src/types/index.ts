// ─────────────────────────────────────────────
// Tipos espejo de los Mongoose schemas del backend
// ─────────────────────────────────────────────

// ── Literales / enums ──────────────────────────────────────────────────────

// Niveles de plan. Espejo de PLAN_ORDER en el backend (config/plans.js).
// "free" es el piso (sin pagar); basic/pro son los pagos.
export type Subscription = "free" | "basic" | "pro"

// Contrato del catálogo MongoDB. Los valores vienen de la API, nunca del nombre del plan.
export interface PlanFeatures {
  menu_editor: boolean
  qr: boolean
  pedido_whatsapp: boolean
  landing_page: boolean
  sin_publicidad: boolean
  carga_masiva_excel: boolean
  programacion_productos: boolean
  menu_pdf: boolean
  estadisticas: boolean
  item_limit: number | null
  templateIds: number[]
}
export type BooleanPlanFeature = Exclude<keyof PlanFeatures, "item_limit" | "templateIds">

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
  reservationMessage?: string
}

export interface Media {
  pictures: string[]
  backgroundPicture: string
}

// Horario de atención del negocio: un DayHours fijo por día de la semana.
// `open`/`close` son horas locales del negocio en formato "HH:mm" (ej:
// "09:00"); se ignoran cuando `enabled` es false. Opcional en `User` porque
// los negocios creados antes de esta funcionalidad no lo tienen guardado
// todavía — el front (UserEditor/UserHome) debe tratar su ausencia como
// "sin horario cargado", no como "cerrado todos los días".
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export interface DayHours {
  enabled: boolean
  open: string
  close: string
}

export interface TimeRange {
  from: string
  to: string
}

export interface ItemAvailabilitySchedule {
  enabled: boolean
  mon: TimeRange[]
  tue: TimeRange[]
  wed: TimeRange[]
  thu: TimeRange[]
  fri: TimeRange[]
  sat: TimeRange[]
  sun: TimeRange[]
}

export type Schedule = Record<DayKey, DayHours>

export interface User {
  features?: PlanFeatures
  _id: string
  username: string
  slug: string
  active: boolean
  admin: boolean
  subscription: Subscription   // ✅ antes era `string`, ahora tipado estricto
  subscriptionExpiresAt?: string | null
  menu: boolean
  hasDelivery: boolean
  template: number
  contactInfo: ContactInfo
  media: Media
  schedule?: Schedule
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
  subscriptionExpiresAt?: string | null
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
  availabilitySchedule?: ItemAvailabilitySchedule
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
  subscriptionExpiresAt?: string | null
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
  offerRange?: { from: string | null; to: string | null }
  options: Record<string, number>
  image: string
  available: boolean
  availabilitySchedule?: ItemAvailabilitySchedule
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

export interface TopItemStat {
  itemID: string
  title: string
  image: string
  totalViews: number
}

export interface ItemStatsData {
  topItems: TopItemStat[]
  windowDays: number
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

// ── CRM interno (panel del CEO) ─────────────────────────────────────────────
// Espejo de los modelos del backend (CrmProfile). Solo lo consume el panel
// admin — estos datos nunca vienen en respuestas públicas de usuario.

export type CrmStage = "lead" | "onboarding" | "activo" | "en_riesgo" | "baja"
export type CrmAttentionCode =
  | "payment_issue"
  | "subscription_expired"
  | "subscription_expiring"
  | "subscription_missing_expiry"
  | "follow_up_overdue"
  | "onboarding_incomplete"

// kind distingue notas manuales ("note") de eventos que loguea el sistema
// solo ("event": cambio de plan, activar/desactivar, cambio de template).
export interface CrmNote {
  _id: string
  text: string
  kind: "note" | "event"
  createdAt: string
  author?: { _id: string; username: string } | null
}

export interface CrmProfile {
  stage: CrmStage
  tags: string[]
  nextFollowUp: string | null
  notes: CrmNote[]
}

// Fila del listado del CRM: datos del local + resumen de su CRM.
export interface CrmClient {
  _id: string
  username: string
  businessName: string
  slug: string
  subscription: Subscription
  subscriptionExpiresAt?: string | null
  active: boolean
  createdAt: string
  contactInfo?: Pick<ContactInfo, "mail" | "number">
  stage: CrmStage
  tags: string[]
  nextFollowUp: string | null
  onboarding?: CrmOnboardingStatus
  lastPayment?: {
    status: string | null
    entitlementStatus: "pending" | "not_applied" | "applied"
    amount: number | null
    currency: string | null
    createdAt: string | null
  } | null
  paymentAttentionCount?: number
  attention?: CrmAttentionCode[]
}

export interface CrmAttentionSummary {
  clients: number
  paymentIssues: number
  expiredSubscriptions: number
  expiringSubscriptions: number
  missingExpirySubscriptions: number
  overdueFollowUps: number
  incompleteOnboarding: number
}

export interface CrmClientDetailUser {
  _id: string
  username: string
  slug: string
  subscription: Subscription
  subscriptionExpiresAt: string | null
  active: boolean
  hasDelivery: boolean
  createdAt: string
  contactInfo: Pick<ContactInfo, "businessName" | "mail" | "number" | "address">
}

export interface CrmOnboardingStatus {
  businessInfo: boolean
  contactChannel: boolean
  schedule: boolean
  branding: boolean
  menuStructure: boolean
  products: boolean
  publicMenu: boolean
  completedCount: number
  total: number
  completed: boolean
}

export interface CrmClientDetail {
  user: CrmClientDetailUser
  crm: CrmProfile
  activity: { categoryCount: number; sectionCount: number; itemCount: number }
  // Opcional durante un despliegue escalonado: el backend debe publicarse
  // antes, pero el drawer no debe romperse si responde una versión anterior.
  onboarding?: CrmOnboardingStatus
}

// ── Pagos internos (panel del CEO) ─────────────────────────────────────────

export type AdminPaymentOperation = "registration" | "upgrade" | "renewal" | "unknown"
export type AdminPaymentEntitlement = "pending" | "not_applied" | "applied"
export type AdminPaymentCheckoutValidation = "strict" | "legacy" | "failed"

export interface AdminPaymentCustomer {
  id: string | null
  username: string
  businessName: string
  slug: string
}

export interface AdminPayment {
  id: string | null
  paymentID: string
  preferenceId: string | null
  operation: AdminPaymentOperation
  planId: string | null
  months: number | null
  amount: number | null
  refundedAmount: number | null
  currency: string | null
  status: string | null
  statusDetail: string | null
  liveMode: boolean | null
  paymentCreatedAt: string | null
  paymentApprovedAt: string | null
  paymentUpdatedAt: string | null
  lastWebhookAt: string
  entitlementStatus: AdminPaymentEntitlement
  entitlementReason: string | null
  entitlementAppliedAt: string | null
  checkoutValidation: AdminPaymentCheckoutValidation
  checkoutValidationReason: string | null
  appliedPlanId: string | null
  appliedMonths: number | null
  subscriptionExpiresAtAfter: string | null
  createdAt: string
  checkout: { id: string | null; status: string | null } | null
  customer: AdminPaymentCustomer | null
}

export interface AdminPaymentsSummary {
  total: number
  approved: number
  pending: number
  failed: number
  refunded: number
  applied: number
  attention: number
  appliedAmount: number
  currency: string
}

export interface AdminPaymentsResponse {
  payments: AdminPayment[]
  summary: AdminPaymentsSummary
  pagination: { page: number; limit: number; total: number; pages: number }
}
