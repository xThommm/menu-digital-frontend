import apiClient from "./client";

export interface SellerProfile {
  _id: string;
  name: string;
  mail: string;
  number: number | null;
  code: string;
  active: boolean;
  startDate: string | null;
  profilePicture: string | null;
  admin: boolean;
  createdAt: string;
}

export interface CommissionTierDTO {
  rate: number;
  minPoints: number;
  label: string;
}

export interface PlanBucket {
  count: number;
  points: number;
  commission: number;
  // Facturación real — solo viene cuando quien pregunta es admin (un
  // vendedor nunca la ve, ni la suya propia).
  revenue?: number;
}

export interface SellerCycleSummary {
  points: number;
  tier: CommissionTierDTO;
  basic: PlanBucket;
  pro: PlanBucket;
  total: PlanBucket;
}

export interface SellerOverviewEntry {
  sellerID: string;
  name: string;
  code: string;
  active: boolean;
  cycle: { start: string; end: string; offset: number };
  clientsSoldTotal: number;
  currentCycle: SellerCycleSummary;
}

export interface SellerOverviewResponse {
  scope: "self" | "single" | "all";
  sellers: SellerOverviewEntry[];
}

export type RankingPeriod = "current" | "previous" | "historic";

export interface SellerRankingEntry {
  sellerID: string;
  name: string;
  code: string;
  active: boolean;
  period: RankingPeriod;
  tier: CommissionTierDTO | null;
  basic: PlanBucket;
  pro: PlanBucket;
  total: PlanBucket;
}

export interface SellerRankingResponse {
  period: RankingPeriod;
  sellers: SellerRankingEntry[];
}

// GET /api/sellers/me
export async function getMySellerProfile(): Promise<SellerProfile> {
  const res = await apiClient.get<SellerProfile>("/sellers/me");
  return res.data;
}

// PATCH /api/sellers/me/password
export async function changeMySellerPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch("/sellers/me/password", { currentPassword, newPassword });
}

// POST /api/sellers/me/photo  (multipart/form-data)
export async function uploadMySellerPhoto(file: File): Promise<{ profilePicture: string }> {
  const form = new FormData();
  form.append("image", file);
  const res = await apiClient.post("/sellers/me/photo", form);
  return res.data;
}

// GET /api/sellers/overview — un vendedor se ve forzado a sí mismo; un admin
// ve a todos (o a uno puntual pasando sellerID).
export async function getSellerOverview(sellerID?: string): Promise<SellerOverviewResponse> {
  const res = await apiClient.get<SellerOverviewResponse>("/sellers/overview", {
    params: sellerID ? { sellerID } : undefined,
  });
  return res.data;
}

// GET /api/sellers/ranking?period=current|previous|historic — admin-only.
export async function getSellerRanking(period: RankingPeriod = "current"): Promise<SellerRankingResponse> {
  const res = await apiClient.get<SellerRankingResponse>("/sellers/ranking", { params: { period } });
  return res.data;
}
