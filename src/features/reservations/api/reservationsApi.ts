import apiClient from "../../../api/client";
import { apiFetch } from "../../../api/apiClient";
import type {
  CustomerReservation, NewReservationInput, OwnerAction, OwnerActionBody, OwnerReservation, ReservationConfig,
  ReservationSettings,
} from "../types";

// ── Cliente (landing, sin cuenta) ──
// Van con apiFetch y NO con apiClient: su interceptor manda el JWT del dueño
// y ante un 401 redirige a /login.

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

const publicBase = (slug: string) => `/api/reservations/public/${encodeURIComponent(slug)}`;

interface CustomerResponse {
  reservation: CustomerReservation;
  businessName: string;
}

export const getReservationConfig = (slug: string, signal?: AbortSignal) =>
  apiFetch<ReservationConfig>(`${publicBase(slug)}/config`, { signal });

export const createReservation = (slug: string, input: NewReservationInput) =>
  apiFetch<CustomerResponse>(`${publicBase(slug)}/reservations`, { ...post(input), timeoutMs: 15_000 });

export const getReservation = (slug: string, code: string, signal?: AbortSignal) =>
  apiFetch<CustomerResponse>(`${publicBase(slug)}/reservations/${encodeURIComponent(code)}`, { signal });

export const acceptAlternative = (slug: string, code: string) =>
  apiFetch<CustomerResponse>(`${publicBase(slug)}/reservations/${encodeURIComponent(code)}/accept-alternative`, post());

export const cancelReservation = (slug: string, code: string) =>
  apiFetch<CustomerResponse>(`${publicBase(slug)}/reservations/${encodeURIComponent(code)}/cancel`, post());

// ── Panel del dueño (JWT vía apiClient) ──
export interface SettingsResponse {
  settings: ReservationSettings;
  slug: string;
  pendingCount?: number;
}

export const getReservationSettings = async (): Promise<SettingsResponse> =>
  (await apiClient.get<SettingsResponse>("/reservations/settings")).data;

export const updateReservationSettings = async (data: Partial<ReservationSettings>): Promise<SettingsResponse> =>
  (await apiClient.put<SettingsResponse>("/reservations/settings", data)).data;

export interface ReservationList {
  reservations: OwnerReservation[];
  // Desde qué fecha se cargaron (YYYY-MM-DD). Siempre incluye las que esperan respuesta.
  from: string;
  // true si hay más reservas que el tope del listado (hay que acotar la fecha).
  truncated: boolean;
  pendingCount: number;
}

export const listReservations = async (from?: string): Promise<ReservationList> =>
  (await apiClient.get<ReservationList>("/reservations", { params: from ? { from } : undefined })).data;

export const createManualReservation = async (data: {
  name: string;
  phone?: string;
  partySize: number;
  date: string;
  time: string;
  tableLabel?: string;
  notes?: string;
  internalNotes?: string;
  status?: "confirmed" | "pending";
}): Promise<OwnerReservation> =>
  (await apiClient.post<{ reservation: OwnerReservation }>("/reservations", data)).data.reservation;

export const runReservationAction = async (id: number, action: OwnerAction, body: OwnerActionBody = {}): Promise<OwnerReservation> =>
  (await apiClient.post<{ reservation: OwnerReservation }>(`/reservations/${id}/${action}`, body)).data.reservation;

export const updateReservation = async (id: number, data: Partial<{
  name: string; phone: string; partySize: number; date: string; time: string; tableLabel: string; internalNotes: string;
}>): Promise<OwnerReservation> =>
  (await apiClient.patch<{ reservation: OwnerReservation }>(`/reservations/${id}`, data)).data.reservation;
