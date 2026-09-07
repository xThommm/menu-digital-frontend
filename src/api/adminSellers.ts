import apiClient from "./client";

export interface Seller {
  _id: string;
  name: string;
  dni: string;
  code: string;
  mail: string;
  number: number | null;
  active: boolean;
  admin: boolean;
  startDate: string | null;
  profilePicture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerCreatePayload {
  name: string;
  dni: string;
  password: string;
  mail: string;
  number?: number | null;
  startDate?: string | null;
  active?: boolean;
  admin?: boolean;
}

export interface SellerUpdatePayload {
  name?: string;
  dni?: string;
  mail?: string;
  number?: number | null;
  startDate?: string | null;
  active?: boolean;
  admin?: boolean;
}

export async function listAdminSellers(
  includeInactive: boolean,
  signal?: AbortSignal,
): Promise<Seller[]> {
  const response = await apiClient.get<Seller[]>("/admin/sellers", {
    signal,
    timeout: 10000,
    params: includeInactive ? { includeInactive: "true" } : undefined,
  });
  return response.data;
}

export async function createAdminSeller(payload: SellerCreatePayload): Promise<Seller> {
  const response = await apiClient.post<{ seller: Seller }>("/admin/sellers", payload, { timeout: 10000 });
  return response.data.seller;
}

export async function updateAdminSeller(id: string, payload: SellerUpdatePayload): Promise<Seller> {
  const response = await apiClient.put<{ seller: Seller }>(`/admin/sellers/${id}`, payload, { timeout: 10000 });
  return response.data.seller;
}

// Baja lógica (el backend pasa active:false, no borra el registro).
export async function deactivateAdminSeller(id: string): Promise<Seller> {
  const response = await apiClient.delete<{ seller: Seller }>(`/admin/sellers/${id}`, { timeout: 10000 });
  return response.data.seller;
}

export async function resetAdminSellerPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.patch(`/admin/sellers/${id}/password`, { newPassword }, { timeout: 10000 });
}
