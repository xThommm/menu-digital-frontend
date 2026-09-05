import apiClient from "./client";
import type { Subscription } from "../types";

export interface Seller {
  _id: string;
  name: string;
  dni: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPayload {
  name: string;
  dni: string;
}

export interface SellerMetrics {
  clientsTotal: number;
  activeAccounts: number;
  paidCurrent: number;
  newClients30d: number;
  expiring30d: number;
  expired: number;
  withMenu: number;
  plans: {
    basic: number;
    pro: number;
  };
  lastClientAt: string | null;
  // Métricas de venta. Opcionales porque el backend puede desplegarse después
  // que el frontend: sin ellas se muestra "sin datos", no rompe.
  revenueTotal?: number;
  revenue30d?: number;
  payments?: number;
  renewals?: number;
  payingClients?: number;
}

export interface SellerSummary extends Seller {
  metrics: SellerMetrics;
}

export interface SellerClient {
  _id: string;
  username: string;
  businessName: string;
  slug: string | null;
  active: boolean;
  menu: boolean;
  subscription: Subscription;
  effectiveSubscription: Subscription;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface SellerDetail extends SellerSummary {
  clients: SellerClient[];
}

export async function listAdminSellers(signal?: AbortSignal): Promise<SellerSummary[]> {
  const response = await apiClient.get<SellerSummary[]>("/admin/sellers", {
    signal,
    timeout: 10000,
  });
  return response.data;
}

export async function getAdminSeller(id: string, signal?: AbortSignal): Promise<SellerDetail> {
  const response = await apiClient.get<SellerDetail>(`/admin/sellers/${id}`, {
    signal,
    timeout: 10000,
  });
  return response.data;
}

export async function createAdminSeller(payload: SellerPayload): Promise<Seller> {
  const response = await apiClient.post<Seller>("/admin/sellers", payload, { timeout: 10000 });
  return response.data;
}

export async function updateAdminSeller(id: string, payload: SellerPayload): Promise<Seller> {
  const response = await apiClient.put<Seller>(`/admin/sellers/${id}`, payload, { timeout: 10000 });
  return response.data;
}
