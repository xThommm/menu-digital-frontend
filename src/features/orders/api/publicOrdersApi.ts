import { apiFetch } from "../../../api/apiClient";
import type { PublicMenuPayload } from "../../../types";
import type {
  CustomerOrderReceipt, Order, OrderLineInput, VenueContext, WaiterSessionInfo,
} from "../types";

// Llamadas sin la sesión del panel: el comensal (token del QR) y el mozo
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

// ── Mozo ──
const waiterAuth = (token: string) => ({ Authorization: `Waiter ${token}` });

export const pairWaiterDevice = (code: string) =>
  apiFetch<WaiterSessionInfo & { token: string }>("/api/orders/waiter/pair", json({ code }));

export const getWaiterSession = (token: string, signal?: AbortSignal) =>
  apiFetch<WaiterSessionInfo>("/api/orders/waiter/me", { headers: waiterAuth(token), signal });

export const logoutWaiter = (token: string) =>
  apiFetch<void>("/api/orders/waiter/logout", { method: "POST", headers: waiterAuth(token), parseJson: false });

export const getWaiterOrders = (token: string, signal?: AbortSignal) =>
  apiFetch<{ orders: Order[] }>("/api/orders/waiter/orders", { headers: waiterAuth(token), signal });

export const sendWaiterOrder = (token: string, body: {
  tableNumber: number;
  items: OrderLineInput[];
  notes?: string;
  clientRequestId: string;
}) => apiFetch<{ order: Order; duplicate: boolean }>("/api/orders/waiter/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...waiterAuth(token) },
  body: JSON.stringify(body),
  timeoutMs: 15_000,
});

// Carta liviana (v2) para el selector de productos del mozo y del panel.
// track=0: no cuenta como visita en las estadísticas.
export const fetchMenuForOrdering = (slug: string, signal?: AbortSignal) =>
  apiFetch<PublicMenuPayload>(`/api/users/${encodeURIComponent(slug)}/menu?v=2&track=0`, { signal });
