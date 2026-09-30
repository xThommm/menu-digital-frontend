import apiClient from "../../../api/client";
import type {
  BoardResponse, CashRegister, CashSession, Order, OrderLineInput, OrderOptions, OrderSettings, OrderStatus,
  PaperWidth, PrintMode, Sector, SectorAssignment, SectorTargetType, SectorTicketsResponse, ServiceInput,
  ServiceType, SettingsResponse, Shift, ShiftSummary, TableSession, Ticket, TicketStatus, Waiter,
  WaiterDeviceSession,
} from "../types";

// API del panel del dueño (JWT del panel vía apiClient). Ver
// src/orders/routes.js del backend.

// ── Configuración ──
export const getOrderSettings = async (): Promise<SettingsResponse> =>
  (await apiClient.get<SettingsResponse>("/orders/settings")).data;

export const updateOrderSettings = async (
  data: Partial<Omit<OrderSettings, "generalQrToken" | "updatedAt" | "options">> & { options?: Partial<OrderOptions> }
): Promise<SettingsResponse> => (await apiClient.put<SettingsResponse>("/orders/settings", data)).data;

// target: "general" | "all" | número de mesa
export const regenerateQr = async (target: string): Promise<SettingsResponse> =>
  (await apiClient.post<SettingsResponse>("/orders/settings/regenerate-qr", { target })).data;

// ── Pedidos ──
export const getBoard = async (): Promise<BoardResponse> =>
  (await apiClient.get<BoardResponse>("/orders/board")).data;

export interface OrdersQuery {
  shiftId?: number;
  status?: OrderStatus;
  serviceType?: ServiceType;
  from?: string;
  to?: string;
  table?: number;
  page?: number;
}

export const listOrders = async (params: OrdersQuery) =>
  (await apiClient.get<{ orders: Order[]; total: number; page: number; pageSize: number }>("/orders/orders", { params })).data;

export const createPanelOrder = async (data: ServiceInput & {
  items: OrderLineInput[];
  waiterId?: number | null;
  notes?: string;
  clientRequestId: string;
}): Promise<Order> => (await apiClient.post<{ order: Order }>("/orders/orders", data)).data.order;

// reason: motivo de la anulación o devolución (opcional).
export const updateOrderStatus = async (id: number, status: OrderStatus, reason?: string): Promise<Order> =>
  (await apiClient.patch<{ order: Order }>(`/orders/orders/${id}/status`, { status, reason })).data.order;

export const assignOrderWaiter = async (id: number, waiterId: number | null): Promise<Order> =>
  (await apiClient.patch<{ order: Order }>(`/orders/orders/${id}/waiter`, { waiterId })).data.order;

// ── Sesiones de mesa ──
export const listTableSessions = async (status: "open" | "closed", page = 1) =>
  (await apiClient.get<{ sessions: TableSession[]; total: number; page: number; pageSize: number }>(
    "/orders/table-sessions", { params: { status, page } }
  )).data;

export const getTableSession = async (id: number): Promise<TableSession> =>
  (await apiClient.get<{ session: TableSession }>(`/orders/table-sessions/${id}`)).data.session;

export const closeTableSession = async (id: number, force = false): Promise<TableSession> =>
  (await apiClient.post<{ session: TableSession }>(`/orders/table-sessions/${id}/close`, { force })).data.session;

export const setTableGuests = async (id: number, guests: number | null): Promise<TableSession> =>
  (await apiClient.patch<{ session: TableSession }>(`/orders/table-sessions/${id}`, { guests })).data.session;

// ── Turnos ──
export const listShifts = async (page = 1) =>
  (await apiClient.get<{ shifts: Shift[]; total: number; page: number; pageSize: number }>("/orders/shifts", { params: { page } })).data;

export const openShift = async (): Promise<Shift> =>
  (await apiClient.post<{ shift: Shift }>("/orders/shifts")).data.shift;

export const getShiftSummary = async (id: number | "current") =>
  (await apiClient.get<{ shift: Shift | null; summary: ShiftSummary | null }>(`/orders/shifts/${id}/summary`)).data;

export const closeShift = async (data: { notes?: string; force?: boolean }): Promise<Shift> =>
  (await apiClient.post<{ shift: Shift }>("/orders/shifts/current/close", data)).data.shift;

// ── Caja (independiente del turno) ──
export const listCashRegisters = async (): Promise<CashRegister[]> =>
  (await apiClient.get<{ registers: CashRegister[] }>("/orders/cash/registers")).data.registers;

export const createCashRegister = async (name: string): Promise<CashRegister> =>
  (await apiClient.post<{ register: CashRegister }>("/orders/cash/registers", { name })).data.register;

export const updateCashRegister = async (id: number, data: { name?: string; active?: boolean }): Promise<CashRegister> =>
  (await apiClient.put<{ register: CashRegister }>(`/orders/cash/registers/${id}`, data)).data.register;

export const listOpenCash = async (): Promise<CashSession[]> =>
  (await apiClient.get<{ sessions: CashSession[] }>("/orders/cash/sessions/open")).data.sessions;

export const listClosedCash = async (page = 1) =>
  (await apiClient.get<{ sessions: CashSession[]; total: number; page: number; pageSize: number }>(
    "/orders/cash/sessions", { params: { page } }
  )).data;

export const getCashSession = async (id: number): Promise<CashSession> =>
  (await apiClient.get<{ session: CashSession }>(`/orders/cash/sessions/${id}`)).data.session;

export const openCash = async (data: { registerId?: number; cashierName?: string; openingAmount?: number | null }): Promise<CashSession> =>
  (await apiClient.post<{ session: CashSession }>("/orders/cash/sessions", data)).data.session;

export const updateCash = async (id: number, data: { cashierName?: string; openingAmount?: number | null }): Promise<CashSession> =>
  (await apiClient.patch<{ session: CashSession }>(`/orders/cash/sessions/${id}`, data)).data.session;

export const closeCash = async (id: number, data: { cashCounted?: number | null; notes?: string }): Promise<CashSession> =>
  (await apiClient.post<{ session: CashSession }>(`/orders/cash/sessions/${id}/close`, data)).data.session;

// ── Operadores (en la API: waiters) ──
export const listWaiters = async (): Promise<Waiter[]> =>
  (await apiClient.get<{ waiters: Waiter[] }>("/orders/waiters")).data.waiters;

export const createWaiter = async (data: { name: string; phone?: string; notes?: string }): Promise<Waiter> =>
  (await apiClient.post<{ waiter: Waiter }>("/orders/waiters", data)).data.waiter;

export const updateWaiter = async (
  id: number,
  data: Partial<{ name: string; phone: string; notes: string; active: boolean }>
): Promise<Waiter> => (await apiClient.put<{ waiter: Waiter }>(`/orders/waiters/${id}`, data)).data.waiter;

export const deleteWaiter = async (id: number): Promise<void> => {
  await apiClient.delete(`/orders/waiters/${id}`);
};

export const issuePairingCode = async (id: number) =>
  (await apiClient.post<{ code: string; expiresAt: string }>(`/orders/waiters/${id}/pairing-code`)).data;

export const listWaiterSessions = async (id: number): Promise<WaiterDeviceSession[]> =>
  (await apiClient.get<{ sessions: WaiterDeviceSession[] }>(`/orders/waiters/${id}/sessions`)).data.sessions;

export const revokeWaiterSessions = async (id: number): Promise<void> => {
  await apiClient.delete(`/orders/waiters/${id}/sessions`);
};

export const revokeWaiterSession = async (id: number, sessionId: number): Promise<void> => {
  await apiClient.delete(`/orders/waiters/${id}/sessions/${sessionId}`);
};

// ── Sectores y comandas ──
export const listSectors = async () =>
  (await apiClient.get<{ sectors: Sector[]; assignments: SectorAssignment[] }>("/orders/sectors")).data;

export const createSector = async (name: string): Promise<Sector> =>
  (await apiClient.post<{ sector: Sector }>("/orders/sectors", { name })).data.sector;

export const updateSector = async (
  id: number,
  data: Partial<{ name: string; isDefault: true; printMode: PrintMode; paperWidth: PaperWidth; printCopies: number }>
): Promise<Sector> => (await apiClient.put<{ sector: Sector }>(`/orders/sectors/${id}`, data)).data.sector;

export const deleteSector = async (id: number): Promise<void> => {
  await apiClient.delete(`/orders/sectors/${id}`);
};

// sectorId null: el elemento vuelve a heredar el sector de lo que lo contiene.
export const setSectorAssignment = async (targetType: SectorTargetType, targetId: string, sectorId: number | null) =>
  (await apiClient.put<{ assignment: { targetType: SectorTargetType; targetId: string; sectorId: number | null } }>(
    "/orders/sectors/assignments", { targetType, targetId, sectorId }
  )).data.assignment;

export const issueSectorPairingCode = async (id: number) =>
  (await apiClient.post<{ code: string; expiresAt: string }>(`/orders/sectors/${id}/pairing-code`)).data;

export const revokeSectorSession = async (id: number, sessionId: number): Promise<void> => {
  await apiClient.delete(`/orders/sectors/${id}/sessions/${sessionId}`);
};

// Pantalla de un sector abierta con la sesión del dueño.
export const getOwnerSectorTickets = async (id: number): Promise<SectorTicketsResponse> =>
  (await apiClient.get<SectorTicketsResponse>(`/orders/sectors/${id}/tickets`)).data;

export const updateOwnerTicketStatus = async (sectorId: number, ticketId: number, status: TicketStatus): Promise<Ticket> =>
  (await apiClient.patch<{ ticket: Ticket }>(`/orders/sectors/${sectorId}/tickets/${ticketId}/status`, { status })).data.ticket;

export const markOwnerTicketPrinted = async (sectorId: number, ticketId: number): Promise<Ticket> =>
  (await apiClient.post<{ ticket: Ticket }>(`/orders/sectors/${sectorId}/tickets/${ticketId}/printed`)).data.ticket;
