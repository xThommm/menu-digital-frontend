import apiClient from "../../../api/client";
import type {
  BoardResponse, Order, OrderLineInput, OrderSettings, OrderStatus, SettingsResponse, Shift, ShiftSummary, Waiter,
} from "../types";

// API del panel del dueño (JWT del panel vía apiClient). Ver
// src/orders/routes.js del backend.

// ── Configuración ──
export const getOrderSettings = async (): Promise<SettingsResponse> =>
  (await apiClient.get<SettingsResponse>("/orders/settings")).data;

export const updateOrderSettings = async (
  data: Partial<Omit<OrderSettings, "generalQrToken" | "updatedAt">>
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
  from?: string;
  to?: string;
  table?: number;
  page?: number;
}

export const listOrders = async (params: OrdersQuery) =>
  (await apiClient.get<{ orders: Order[]; total: number; page: number; pageSize: number }>("/orders/orders", { params })).data;

export const createPanelOrder = async (data: {
  items: OrderLineInput[];
  tableNumber?: number | null;
  waiterId?: number | null;
  notes?: string;
}): Promise<Order> => (await apiClient.post<{ order: Order }>("/orders/orders", data)).data.order;

export const updateOrderStatus = async (id: number, status: OrderStatus): Promise<Order> =>
  (await apiClient.patch<{ order: Order }>(`/orders/orders/${id}/status`, { status })).data.order;

export const assignOrderWaiter = async (id: number, waiterId: number | null): Promise<Order> =>
  (await apiClient.patch<{ order: Order }>(`/orders/orders/${id}/waiter`, { waiterId })).data.order;

// ── Turnos y caja ──
export const listShifts = async (page = 1) =>
  (await apiClient.get<{ shifts: Shift[]; total: number; page: number; pageSize: number }>("/orders/shifts", { params: { page } })).data;

export const openShift = async (): Promise<Shift> =>
  (await apiClient.post<{ shift: Shift }>("/orders/shifts")).data.shift;

export const getShiftSummary = async (id: number | "current") =>
  (await apiClient.get<{ shift: Shift | null; summary: ShiftSummary | null }>(`/orders/shifts/${id}/summary`)).data;

export const closeShift = async (data: { cashCounted?: number | null; notes?: string; force?: boolean }): Promise<Shift> =>
  (await apiClient.post<{ shift: Shift }>("/orders/shifts/current/close", data)).data.shift;

// ── Mozos ──
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

export const revokeWaiterSessions = async (id: number): Promise<void> => {
  await apiClient.delete(`/orders/waiters/${id}/sessions`);
};
