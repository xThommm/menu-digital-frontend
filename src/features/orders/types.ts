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
}

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
