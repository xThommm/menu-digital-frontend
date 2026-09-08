// Espejo EXACTO de backend/src/config/sellerCommission.js — números fijos,
// nunca los precios en vivo de la colección Plan (usePlans()): admin puede
// cambiar esos precios en cualquier momento y no deben distorsionar
// retroactivamente lo que se le debe a un vendedor por ventas pasadas. Si se
// tocan estos números acá, hay que tocarlos también del lado del backend.

export type CommissionPlan = "basic" | "pro";
export type ContractMonths = 1 | 3 | 6 | 12;

export const MONTHLY_PRICE: Record<CommissionPlan, number> = { basic: 29999, pro: 49999 };

// Coincide exactamente con los puntos que otorga esa duración.
export const MULTIPLIER: Record<ContractMonths, number> = { 1: 1, 3: 3, 6: 5, 12: 9 };

export const CONTRACT_MONTHS: ContractMonths[] = [1, 3, 6, 12];

export interface CommissionTier {
  rate: number;
  minPoints: number;
  label: string;
}

// De mayor a menor a propósito: tierForPoints toma el primero cuyo
// minPoints sea alcanzado.
export const TIERS: CommissionTier[] = [
  { rate: 0.35, minPoints: 100, label: "PRO" },
  { rate: 0.30, minPoints: 50, label: "Avanzado" },
  { rate: 0.25, minPoints: 0, label: "Base" },
];

export function contractPrice(plan: CommissionPlan, months: ContractMonths): number {
  return MONTHLY_PRICE[plan] * MULTIPLIER[months];
}

export function pointsForMonths(months: ContractMonths): number {
  return MULTIPLIER[months];
}

export function tierForPoints(points: number): CommissionTier {
  return TIERS.find((tier) => points >= tier.minPoints) ?? TIERS[TIERS.length - 1];
}

export function commissionForSale(plan: CommissionPlan, months: ContractMonths, tierRate: number): number {
  return Math.round(contractPrice(plan, months) * tierRate * 100) / 100;
}
