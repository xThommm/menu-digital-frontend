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
  influencer: boolean;
  receivesLeads: boolean;
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
  influencer?: boolean;
  receivesLeads?: boolean;
}

export interface SellerUpdatePayload {
  name?: string;
  dni?: string;
  mail?: string;
  number?: number | null;
  startDate?: string | null;
  active?: boolean;
  admin?: boolean;
  influencer?: boolean;
  receivesLeads?: boolean;
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

export interface SellerTestUser {
  _id: string;
  username: string;
  mail: string;
  number: number | null;
  subscription: string;
  subscriptionExpiresAt: string | null;
  sellerID: string;
}

// Cuenta de comercio (no de vendedor) para las demos: plan Pro sin
// vencimiento, con el mail, el teléfono y el sellerID del vendedor.
export async function createAdminSellerTestUser(
  id: string,
  credentials: { username: string; password: string },
): Promise<SellerTestUser> {
  const response = await apiClient.post<{ user: SellerTestUser }>(
    `/admin/sellers/${id}/test-user`,
    credentials,
    { timeout: 10000 },
  );
  return response.data.user;
}

// Usuarios de prueba del vendedor (para verlos y darlos de baja).
export interface SellerTestUserSummary {
  _id: string;
  username: string;
  slug: string | null;
  mail: string;
  number: number | null;
  subscription: string;
  subscriptionExpiresAt: string | null;
  active: boolean;
  createdAt: string;
}

export async function listAdminSellerTestUsers(id: string): Promise<SellerTestUserSummary[]> {
  const response = await apiClient.get<{ users: SellerTestUserSummary[] }>(`/admin/sellers/${id}/test-user`, { timeout: 10000 });
  return response.data.users;
}

export async function resetAdminSellerPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.patch(`/admin/sellers/${id}/password`, { newPassword }, { timeout: 10000 });
}
