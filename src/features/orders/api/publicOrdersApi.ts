import { apiFetch } from "../../../api/apiClient";
import type { PublicMenuPayload } from "../../../types";
import type {
  Bill, BillApi, GroupLineInput, GroupMemberView, GroupSession, GroupStaffApi,
  CourierOrder, CourierPanel, CourierSessionInfo, CustomerDeliveryInfo,
  CustomerOrderReceipt, OccupiedTable, OnlineCheckout, OnlineCheckoutStatus, OnlineOrderingConfig, OnlineServiceType, Order, OrderLineInput, SectorTicketsResponse, ServiceInput, StationSessionInfo, TableSession,
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

// ── Pedido grupal (comensales de una mesa) ──
// Abrirlo pide el QR del local; sumarse, el código o el QR / enlace del grupo.
// Después cada celular se identifica con su token de integrante.
type GroupJoined = { memberToken: string; group: GroupSession };
const groupAuth = (token: string) => ({ Authorization: `Group ${token}` });
const groupJson = (token: string, body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...groupAuth(token) },
  body: JSON.stringify(body),
});

export const openVenueGroup = (slug: string, body: { token: string; tableNumber?: number | null; name: string }) =>
  apiFetch<GroupJoined>(`/api/orders/public/${encodeURIComponent(slug)}/group`, json(body));

export const joinGroup = (slug: string, body: { code?: string; joinToken?: string; name: string }) =>
  apiFetch<GroupJoined>(`/api/orders/public/${encodeURIComponent(slug)}/group/join`, json(body));

export const getMyGroup = (token: string, signal?: AbortSignal) =>
  apiFetch<GroupMemberView>("/api/orders/group/me", { headers: groupAuth(token), signal });

export const addGroupItems = (token: string, items: GroupLineInput[]) =>
  apiFetch<{ group: GroupSession }>("/api/orders/group/items", { ...groupJson(token, { items }), timeoutMs: 15_000 });

export const updateGroupItem = (token: string, id: number, body: { quantity?: number; notes?: string | null; shared?: boolean }) =>
  apiFetch<{ group: GroupSession }>(`/api/orders/group/items/${id}`, groupJson(token, body, "PATCH"));

export const removeGroupItem = (token: string, id: number) =>
  apiFetch<{ group: GroupSession }>(`/api/orders/group/items/${id}`, { method: "DELETE", headers: groupAuth(token) });

export const sendGroupOrder = (token: string, clientRequestId: string) =>
  apiFetch<{ order: { number: number; tableNumber: number | null; total: number; createdAt: string }; duplicate: boolean; group: GroupSession }>(
    "/api/orders/group/send", { ...groupJson(token, { clientRequestId }), timeoutMs: 15_000 },
  );

export const leaveGroup = (token: string) =>
  apiFetch<void>("/api/orders/group/leave", { method: "POST", headers: groupAuth(token), parseJson: false });

// ── Pedidos online con pago (take away / delivery, sin QR del local) ──
export const getOnlineOrdering = (slug: string, signal?: AbortSignal) =>
  apiFetch<OnlineOrderingConfig>(`/api/orders/public/${encodeURIComponent(slug)}/online-ordering`, { signal });

// Crea el checkout: el precio lo calcula el servidor. Devuelve el link de Mercado Pago.
export const createOnlineCheckout = (slug: string, body: {
  serviceType: OnlineServiceType;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  notes?: string;
  items: OrderLineInput[];
  clientRequestId: string;
}) => apiFetch<OnlineCheckout>(
  `/api/orders/public/${encodeURIComponent(slug)}/online-checkout`,
  { ...json(body), timeoutMs: 20_000 },
);

export const getOnlineCheckoutStatus = (slug: string, ref: string, signal?: AbortSignal) =>
  apiFetch<OnlineCheckoutStatus>(
    `/api/orders/public/${encodeURIComponent(slug)}/online-checkout/${encodeURIComponent(ref)}`, { signal },
  );

// Envío del pedido: si ya salió y el código de entrega que le da al repartidor.
export const getCustomerDelivery = (slug: string, ref: string, signal?: AbortSignal) =>
  apiFetch<CustomerDeliveryInfo>(
    `/api/orders/public/${encodeURIComponent(slug)}/online-checkout/${encodeURIComponent(ref)}/delivery`, { signal },
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

// Salón: mesas abiertas del operador (y las que no tomó nadie), con sus pedidos.
export const getWaiterTables = (token: string, signal?: AbortSignal) =>
  // occupied: ausente con un backend anterior.
  apiFetch<{ sessions: TableSession[]; occupied?: OccupiedTable[] }>("/api/orders/waiter/tables", { headers: waiterAuth(token), signal });

export const closeWaiterTable = (token: string, id: number, force = false) =>
  apiFetch<{ session: TableSession }>(`/api/orders/waiter/tables/${id}/close`, waiterJson(token, { force }));

export const setWaiterTableGuests = (token: string, id: number, guests: number | null) =>
  apiFetch<{ session: TableSession }>(`/api/orders/waiter/tables/${id}`, waiterJson(token, { guests }, "PATCH"));

// Cuenta de una de sus mesas: dividirla y registrar pagos.
export const waiterBillApi = (token: string): BillApi => {
  const url = (sessionId: number, rest = "") => `/api/orders/waiter/tables/${sessionId}/bill${rest}`;
  const bill = async (path: string, init?: RequestInit) => (await apiFetch<{ bill: Bill }>(path, init)).bill;
  const send = (path: string, body: unknown, method = "POST") => bill(path, waiterJson(token, body, method));
  return {
    get: sessionId => bill(url(sessionId), { headers: waiterAuth(token) }),
    addGuests: (sessionId, body) => send(url(sessionId, "/guests"), body),
    renameGuest: (sessionId, guestId, name) => send(url(sessionId, `/guests/${guestId}`), { name }, "PATCH"),
    removeGuest: (sessionId, guestId) => bill(url(sessionId, `/guests/${guestId}`), { method: "DELETE", headers: waiterAuth(token) }),
    setSplit: (sessionId, body) => send(url(sessionId, "/split"), body, "PUT"),
    setItemShares: (sessionId, itemId, shares) => send(url(sessionId, `/items/${itemId}/shares`), { shares }, "PUT"),
    recordPayment: (sessionId, body) => send(url(sessionId, "/payments"), body),
    voidPayment: (sessionId, paymentId, reason) => send(url(sessionId, `/payments/${paymentId}/void`), { reason }),
  };
};

// Pedidos grupales de las mesas.
export const waiterGroupApi = (token: string): GroupStaffApi => {
  const base = "/api/orders/waiter/groups";
  return {
    list: async () => (await apiFetch<{ groups: GroupSession[] }>(base, { headers: waiterAuth(token) })).groups,
    open: async tableNumber => (await apiFetch<{ group: GroupSession }>(base, waiterJson(token, { tableNumber }))).group,
    send: (groupId, clientRequestId) =>
      apiFetch<{ order: Order; group: GroupSession }>(`${base}/${groupId}/send`, { ...waiterJson(token, { clientRequestId }), timeoutMs: 15_000 }),
    removeItem: async (groupId, itemId) =>
      (await apiFetch<{ group: GroupSession }>(`${base}/${groupId}/items/${itemId}`, { method: "DELETE", headers: waiterAuth(token) })).group,
    close: async groupId => (await apiFetch<{ group: GroupSession }>(`${base}/${groupId}/close`, waiterJson(token, {}))).group,
  };
};

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

// ── Repartidor (dispositivo vinculado con el QR del local) ──
const courierAuth = (token: string) => ({ Authorization: `Courier ${token}` });
const courierJson = (token: string, body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...courierAuth(token) },
  body: JSON.stringify(body),
});

export const pairCourierDevice = (code: string) =>
  apiFetch<CourierSessionInfo & { token: string }>("/api/orders/courier/pair", json({ code }));

export const getCourierSession = (token: string, signal?: AbortSignal) =>
  apiFetch<CourierSessionInfo>("/api/orders/courier/me", { headers: courierAuth(token), signal });

export const logoutCourier = (token: string) =>
  apiFetch<void>("/api/orders/courier/logout", { method: "POST", headers: courierAuth(token), parseJson: false });

export const setCourierAvailability = (token: string, available: boolean) =>
  apiFetch<{ available: boolean }>("/api/orders/courier/availability", courierJson(token, { available }, "PUT"));

// Pendientes de retirar, en camino y pedidos disponibles: la fuente de verdad del panel.
export const getCourierPanel = (token: string, signal?: AbortSignal) =>
  apiFetch<CourierPanel>("/api/orders/courier/panel", { headers: courierAuth(token), signal });

export const getCourierHistory = (token: string, page = 1, signal?: AbortSignal) =>
  apiFetch<{ deliveries: CourierOrder[]; total: number; page: number; pageSize: number }>(
    `/api/orders/courier/history?page=${page}`, { headers: courierAuth(token), signal },
  );

export const claimCourierOrder = (token: string, id: number) =>
  apiFetch<{ order: CourierOrder }>(`/api/orders/courier/orders/${id}/claim`, courierJson(token, {}));

export const pickupCourierOrder = (token: string, id: number) =>
  apiFetch<{ order: CourierOrder; repeated: boolean }>(`/api/orders/courier/orders/${id}/pickup`, courierJson(token, {}));

export const deliverCourierOrder = (token: string, id: number, code: string) =>
  apiFetch<{ delivered: boolean; repeated: boolean; deliveredAt: string | null }>(
    `/api/orders/courier/orders/${id}/deliver`, courierJson(token, { code }),
  );

// Carta liviana (v2) para el selector de productos del operador y del panel.
// track=0: no cuenta como visita en las estadísticas.
export const fetchMenuForOrdering = (slug: string, signal?: AbortSignal) =>
  apiFetch<PublicMenuPayload>(`/api/users/${encodeURIComponent(slug)}/menu?v=2&track=0`, { signal });
