// Tipos de Gestión de pedidos (contrato de /api/orders del backend).
// En la interfaz los "mozos" se llaman "operadores"; la API sigue usando
// waiter/waiters.

export type OrderStatus = "pending" | "confirmed" | "ready" | "delivered" | "cancelled" | "returned";
export type OrderSource = "customer" | "waiter" | "panel";
// Dónde se sirve: en una mesa, en la barra, para llevar o con envío.
export type ServiceType = "table" | "counter" | "takeaway" | "delivery";
export type QrMode = "general" | "per_table";
export type PeriodMode = "shift" | "day";

export interface OrderItem {
  id: number;
  itemId: string;
  title: string;
  categoryName: string | null;
  option: string | null;
  unitPrice: number;
  quantity: number;
  notes: string | null;
  // Sector de la comanda a la que fue la línea (sin sectores: null o ausente).
  sectorName?: string | null;
}

// ── Sectores y comandas ──
export type TicketStatus = "new" | "preparing" | "done" | "cancelled";
// none: solo pantalla · browser: impresora del sistema · escpos: comandera directa (experimental).
export type PrintMode = "none" | "browser" | "escpos";
export type PaperWidth = 58 | 80;

// Comanda de un pedido, resumida (lo que ve el panel de pedidos).
export interface OrderTicketSummary {
  id: number;
  sectorId: number;
  sectorName: string;
  status: TicketStatus;
  doneAt: string | null;
}

export interface Sector {
  id: number;
  name: string;
  isDefault: boolean;
  position: number;
  printMode: PrintMode;
  paperWidth: PaperWidth;
  printCopies: number;
  activeDevices: number;
  sessions: WaiterDeviceSession[];
  createdAt: string;
}

export type SectorTargetType = "section" | "category" | "item";

export interface SectorAssignment {
  targetType: SectorTargetType;
  targetId: string;
  sectorId: number;
}

// Comanda completa: lo que ve (e imprime) el sector. Sin precios.
export interface Ticket {
  id: number;
  orderId: number;
  sectorId: number;
  sectorName: string;
  status: TicketStatus;
  createdAt: string;
  startedAt: string | null;
  doneAt: string | null;
  cancelledAt: string | null;
  printedAt: string | null;
  printCount: number;
  order: {
    number: number;
    status: OrderStatus;
    serviceType: ServiceType;
    tableNumber: number | null;
    customerName: string | null;
    waiterName: string | null;
    notes: string | null;
    createdAt: string;
  };
  items: { title: string; option: string | null; quantity: number; notes: string | null }[];
}

export interface SectorTicketsResponse {
  sector: Sector;
  tickets: Ticket[];
  recent: Ticket[];
  serverTime: string;
}

export interface StationSessionInfo {
  sector: Sector;
  business: { slug: string; name: string };
}

export type PaymentMode = "none" | "mercadopago";
export type PaymentStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export interface Order {
  id: number;
  shiftId: number;
  number: number;
  source: OrderSource;
  status: OrderStatus;
  serviceType: ServiceType;
  tableNumber: number | null;
  tableSessionId: number | null;
  cashSessionId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  waiterId: number | null;
  waiterName: string | null;
  notes: string | null;
  statusReason: string | null;
  // Pago online (Mercado Pago), aparte del estado del pedido. Ausentes con un backend anterior.
  paymentMode?: PaymentMode;
  paymentStatus?: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  returnedAt: string | null;
  items: OrderItem[];
  // Una por sector (vacío sin sectores; ausente con un backend anterior).
  tickets?: OrderTicketSummary[];
}

export interface Shift {
  id: number;
  label: string;
  openedAt: string;
  closedAt: string | null;
  // Solo en turnos viejos (cuando el cierre de caja cerraba el turno).
  cashCounted: number | null;
  closingNotes: string | null;
  ordersCount: number | null;
  totalAmount: number | null;
}

export interface ShiftScheduleEntry {
  name: string;
  from: string;
  to: string;
}

// Opciones extensibles del local (order_settings.options).
export interface OrderOptions {
  requireTableNumber: boolean;
  customerOrderCooldownSeconds: number;
  // Take away / delivery pagados online con Mercado Pago desde la carta.
  onlineOrdering: boolean;
  // Con el pago online activo, saca «Pedir por WhatsApp» del carrito.
  hideWhatsappOrder: boolean;
  // Tiempo estimado de preparación de los pedidos online, en minutos (0 = sin estimación).
  prepMinMinutes: number;
  prepMaxMinutes: number;
}

// Pedido de take away / delivery pagado online (carta pública).
export type OnlineServiceType = "takeaway" | "delivery";

// Tiempo estimado de preparación que cargó el local, en minutos.
export interface OnlineEstimate {
  minMinutes: number;
  maxMinutes: number;
}

export interface OnlineOrderingConfig {
  enabled: boolean;
  modes: OnlineServiceType[];
  estimate: OnlineEstimate | null;
  // El local sacó «Pedir por WhatsApp» del carrito (solo si el pago online funciona).
  hideWhatsapp: boolean;
}

export interface OnlineCheckout {
  ref: string;
  status: Exclude<PaymentStatus, "NOT_REQUIRED">;
  // Solo mientras el pago está pendiente.
  checkoutUrl: string | null;
  total: number;
  expiresAt: string;
}

export interface OnlineCheckoutStatus {
  status: Exclude<PaymentStatus, "NOT_REQUIRED">;
  expired: boolean;
  total: number;
  serviceType: OnlineServiceType | null;
  // Se completa cuando el pago se aprueba y el pedido llega al local.
  orderNumber: number | null;
  orderStatus: OrderStatus | null;
  // Etapas del pedido, para seguirlo.
  createdAt: string | null;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  // Si ya se devolvió el dinero (el local rechazó o canceló el pedido).
  refund: "none" | "partial" | "full";
  estimate: OnlineEstimate | null;
}

// Cuenta de Mercado Pago del local (nunca incluye tokens).
export interface MpConnection {
  configured: boolean;
  connected: boolean;
  status: "active" | "error" | "revoked" | "disconnected";
  mpUserId?: string;
  liveMode?: boolean;
  connectedAt?: string;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
}

export type RefundStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface OrderRefund {
  id: number;
  amount: number;
  isPartial: boolean;
  reason: string | null;
  status: RefundStatus;
  failureDetail: string | null;
  requestedByName: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface OrderPaymentInfo {
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  // Lo que todavía se puede devolver.
  refundable: number;
  canRefund: boolean;
}

export interface OrderPaymentResponse {
  payment: OrderPaymentInfo | null;
  refunds: OrderRefund[];
}

export interface RefundResult extends OrderPaymentResponse {
  outcome: "completed" | "pending" | "failed";
  orderCancelled: boolean;
  message: string | null;
}

export interface OrderSettings {
  qrMode: QrMode;
  customerOrdering: boolean;
  customerHistory: boolean;
  tableCount: number;
  periodMode: PeriodMode;
  shiftSchedule: ShiftScheduleEntry[];
  options: OrderOptions;
  generalQrToken: string;
  updatedAt: string;
}

export interface OrderTable {
  number: number;
  qrToken: string;
}

export interface SettingsResponse {
  settings: OrderSettings;
  tables: OrderTable[];
  slug: string;
  openShift?: Shift | null;
}

export interface BoardResponse {
  orders: Order[];
  openShift: Shift | null;
  serverTime: string;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

// Dispositivo vinculado de un operador.
export interface WaiterDeviceSession {
  id: number;
  deviceLabel: string | null;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  endedReason: "logout" | "revoked" | "paused" | "deleted" | null;
}

export interface Waiter {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
  activeDevices: number;
  sessions: WaiterDeviceSession[];
  createdAt: string;
}

export interface Amount {
  count: number;
  amount: number;
}

export interface ShiftSummary {
  ordersCount: number;
  totalAmount: number;
  averageTicket: number;
  pendingDelivery: number;
  byStatus: Partial<Record<OrderStatus, Amount>>;
  bySource: (Amount & { source: OrderSource })[];
  byServiceType?: (Amount & { serviceType: ServiceType })[];
  byWaiter: (Amount & { name: string })[];
  byTable: (Amount & { tableNumber: number })[];
  topProducts: { title: string; option: string | null; quantity: number; amount: number }[];
  averagePrepMinutes: number | null;
  averageServiceMinutes: number | null;
}

// ── Sesiones de mesa ──
export interface TableSession {
  id: number;
  tableNumber: number;
  shiftId: number | null;
  waiterId: number | null;
  waiterName: string | null;
  guests: number | null;
  openedAt: string;
  closedAt: string | null;
  closedByType: "waiter" | "panel" | null;
  closedByName: string | null;
  ordersCount: number;
  totalAmount: number;
  activeOrders: number;
  orders?: Order[];
}

// ── Caja ──
export interface CashRegister {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface CashSummary {
  ordersCount: number;
  salesCount: number;
  salesAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
  returnedCount: number;
  returnedAmount: number;
  discountsAmount: number;
  netAmount: number;
  expectedCash: number;
  paymentsBreakdown: { method: string; kind: string; count: number; amount: number }[];
  pendingCount: number;
}

export interface CashSession {
  id: number;
  registerId: number;
  registerName: string;
  shiftId: number | null;
  cashierName: string | null;
  openingAmount: number;
  openedAt: string;
  closedAt: string | null;
  cashCounted: number | null;
  difference: number | null;
  closingNotes: string | null;
  summary: CashSummary | null;
}

// Línea que se envía al crear un pedido (el precio lo pone el servidor).
export interface OrderLineInput {
  itemId: string;
  option?: string;
  quantity: number;
  notes?: string;
}

// Dónde se sirve y, para take away / delivery, los datos de quien retira o recibe.
export interface ServiceInput {
  serviceType: ServiceType;
  tableNumber?: number | null;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
}

// ── Carta pública ──
export type VenueContext =
  | { inVenue: false }
  | {
      inVenue: true;
      ordering: boolean;
      history: boolean;
      tableNumber: number | null;
      tableCount: number;
      // false: con el QR general se puede pedir sin mesa (va a la barra).
      requireTable?: boolean;
    };

export interface CustomerOrderReceipt {
  number: number;
  tableNumber: number | null;
  total: number;
  createdAt: string;
  items: { title: string; option: string | null; quantity: number; notes: string | null; unitPrice: number }[];
}

// ── Tomador de pedidos ──
export interface WaiterSessionInfo {
  waiter: { id: number; name: string };
  business: { slug: string; name: string };
  tableCount: number | null;
  sessionStartedAt?: string | null;
}
