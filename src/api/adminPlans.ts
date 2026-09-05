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

// Cuentas y facturación por plan. Va aparte del catálogo a propósito: el
// catálogo es configuración (se edita) y esto es medición (solo lectura). Si
// la agregación falla, el editor de precios tiene que seguir funcionando.
export interface AdminPlanUsage {
  name: PlanDefinition["name"];
  accounts: number;
  activeAccounts: number;
  revenueTotal: number;
  revenue30d: number;
  payments: number;
}

export async function listAdminPlanUsage(signal?: AbortSignal): Promise<AdminPlanUsage[]> {
  const response = await apiClient.get<{ usage: AdminPlanUsage[] }>(
    "/admin/plans/usage",
    { signal, timeout: 10000 },
  );
  return Array.isArray(response.data?.usage) ? response.data.usage : [];
}

export async function updateAdminPlan(
  name: PlanDefinition["name"],
  update: AdminPlanPriceUpdate,
): Promise<PlanDefinition> {
  const response = await apiClient.patch<{ plan: PlanDefinition }>(`/admin/plans/${name}`, update, { timeout: 10000 });
  return response.data.plan;
}
