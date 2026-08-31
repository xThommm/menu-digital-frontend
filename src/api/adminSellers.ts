import apiClient from "./client";

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

export async function listAdminSellers(signal?: AbortSignal): Promise<Seller[]> {
  const response = await apiClient.get<Seller[]>("/admin/sellers", { signal, timeout: 10000 });
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