// Tipos de Gestión de pedidos (contrato de /api/orders del backend).

export type OrderStatus = "pending" | "confirmed" | "ready" | "delivered" | "cancelled" | "returned";
export type OrderSource = "customer" | "waiter" | "panel";
export type QrMode = "general" | "per_table";
export type PeriodMode = "shift" | "day";

export interface OrderItem {
  id: number;
  itemId: string;
  title: string;
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
  tableNumber: number | null;
  waiterId: number | null;
  waiterName: string | null;
  notes: string | null;
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

export interface OrderSettings {
  qrMode: QrMode;
  customerOrdering: boolean;
  customerHistory: boolean;
  tableCount: number;
  periodMode: PeriodMode;
  shiftSchedule: ShiftScheduleEntry[];
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

export interface Waiter {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
  activeDevices: number;
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
  byWaiter: (Amount & { name: string })[];
  byTable: (Amount & { tableNumber: number })[];
  topProducts: { title: string; option: string | null; quantity: number; amount: number }[];
  averagePrepMinutes: number | null;
  averageServiceMinutes: number | null;
}

// Línea que se envía al crear un pedido (el precio lo pone el servidor).
export interface OrderLineInput {
  itemId: string;
  option?: string;
  quantity: number;
  notes?: string;
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
}
