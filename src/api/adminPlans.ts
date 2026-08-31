import apiClient from "./client";
import type { PlanDefinition } from "./plans";
import { parsePlanCatalog } from "./plans";

export interface AdminPlanPriceUpdate {
  version: number;
  price: number;
  discountPrice: number | null;
  label: string;
  description: string;
  features: PlanDefinition["features"];
  periodMultipliers: PlanDefinition["periodMultipliers"];
}

export async function listAdminPlans(signal?: AbortSignal): Promise<PlanDefinition[]> {
  const response = await apiClient.get<{ plans: PlanDefinition[] }>("/admin/plans", { signal, timeout: 10000 });
  return parsePlanCatalog(response.data);
}

export async function updateAdminPlan(
  name: PlanDefinition["name"],
  update: AdminPlanPriceUpdate,
): Promise<PlanDefinition> {
  const response = await apiClient.patch<{ plan: PlanDefinition }>(`/admin/plans/${name}`, update, { timeout: 10000 });
  return response.data.plan;
}
