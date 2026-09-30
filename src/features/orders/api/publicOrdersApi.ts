import { apiFetch } from "../../../api/apiClient";
import type { PublicMenuPayload } from "../../../types";
import type {
  CustomerOrderReceipt, Order, OrderLineInput, SectorTicketsResponse, ServiceInput, StationSessionInfo, TableSession,
  Ticket, TicketStatus, VenueContext, WaiterSessionInfo,
} from "../types";

// Llamadas sin la sesión del panel: el comensal (token del QR) y el operador
// (token de su dispositivo). Van con fetch/apiFetch y NO con apiClient: su
// interceptor manda el JWT del dueño y ante un 401 redirige a /login.

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ── Comensal ──
export const getVenueContext = (slug: string, token: string, signal?: AbortSignal) =>
  apiFetch<VenueContext>(`/api/orders/public/${encodeURIComponent(slug)}/context?t=${encodeURIComponent(token)}`, { signal });

export const sendCustomerOrder = (slug: string, body: {
  token: string;
  tableNumber?: number | null;
  items: OrderLineInput[];
  clientRequestId: string;
  deviceId: string;
}) => apiFetch<{ order: CustomerOrderReceipt; duplicate: boolean }>(
  `/api/orders/public/${encodeURIComponent(slug)}/orders`,
  { ...json(body), timeoutMs: 15_000 },
);

// ── Operador ──
const waiterAuth = (token: string) => ({ Authorization: `Waiter ${token}` });
const waiterJson = (token: string, body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...waiterAuth(token) },
  body: JSON.stringify(body),
});

export const pairWaiterDevice = (code: string) =>
  apiFetch<WaiterSessionInfo & { token: string }>("/api/orders/waiter/pair", json({ code }));

export const getWaiterSession = (token: string, signal?: AbortSignal) =>
  apiFetch<WaiterSessionInfo>("/api/orders/waiter/me", { headers: waiterAuth(token), signal });

export const logoutWaiter = (token: string) =>
  apiFetch<void>("/api/orders/waiter/logout", { method: "POST", headers: waiterAuth(token), parseJson: false });

export const getWaiterOrders = (token: string, signal?: AbortSignal) =>
  apiFetch<{ orders: Order[] }>("/api/orders/waiter/orders", { headers: waiterAuth(token), signal });

export const sendWaiterOrder = (token: string, body: ServiceInput & {
  items: OrderLineInput[];
  notes?: string;
  clientRequestId: string;
}) => apiFetch<{ order: Order; duplicate: boolean }>("/api/orders/waiter/orders", {
  ...waiterJson(token, body),
  timeoutMs: 15_000,
});

// "Mis mesas": mesas abiertas del operador (y las que no tomó nadie), con sus pedidos.
export const getWaiterTables = (token: string, signal?: AbortSignal) =>
  apiFetch<{ sessions: TableSession[] }>("/api/orders/waiter/tables", { headers: waiterAuth(token), signal });

export const closeWaiterTable = (token: string, id: number, force = false) =>
  apiFetch<{ session: TableSession }>(`/api/orders/waiter/tables/${id}/close`, waiterJson(token, { force }));

export const setWaiterTableGuests = (token: string, id: number, guests: number | null) =>
  apiFetch<{ session: TableSession }>(`/api/orders/waiter/tables/${id}`, waiterJson(token, { guests }, "PATCH"));

// Historial: mesas que atendió y ya se cerraron.
export const getWaiterHistory = (token: string, page = 1, signal?: AbortSignal) =>
  apiFetch<{ sessions: TableSession[]; total: number; page: number; pageSize: number }>(
    `/api/orders/waiter/history?page=${page}`, { headers: waiterAuth(token), signal }
  );

// ── Pantalla de un sector (equipo vinculado con código) ──
const stationAuth = (token: string) => ({ Authorization: `Station ${token}` });

export const pairStation = (code: string) =>
  apiFetch<StationSessionInfo & { token: string }>("/api/orders/station/pair", json({ code }));

export const getStationSession = (token: string, signal?: AbortSignal) =>
  apiFetch<StationSessionInfo>("/api/orders/station/me", { headers: stationAuth(token), signal });

export const logoutStation = (token: string) =>
  apiFetch<void>("/api/orders/station/logout", { method: "POST", headers: stationAuth(token), parseJson: false });

export const getStationTickets = (token: string, signal?: AbortSignal) =>
  apiFetch<SectorTicketsResponse>("/api/orders/station/tickets", { headers: stationAuth(token), signal });

export const updateStationTicketStatus = (token: string, id: number, status: TicketStatus) =>
  apiFetch<{ ticket: Ticket }>(`/api/orders/station/tickets/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...stationAuth(token) },
    body: JSON.stringify({ status }),
  });

export const markStationTicketPrinted = (token: string, id: number) =>
  apiFetch<{ ticket: Ticket }>(`/api/orders/station/tickets/${id}/printed`, {
    method: "POST", headers: stationAuth(token),
  });

// Carta liviana (v2) para el selector de productos del operador y del panel.
// track=0: no cuenta como visita en las estadísticas.
export const fetchMenuForOrdering = (slug: string, signal?: AbortSignal) =>
  apiFetch<PublicMenuPayload>(`/api/users/${encodeURIComponent(slug)}/menu?v=2&track=0`, { signal });
