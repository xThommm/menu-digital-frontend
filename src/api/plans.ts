import { apiFetch } from "./apiClient";
import { PLAN_ORDER, BOOLEAN_FEATURES } from "../lib/plans";
import type { Subscription, PlanFeatures } from "../types";

export interface PlanBillingOption {
  months: 1 | 3 | 6 | 12;
  multiplier: number;
  total: number;
  regularTotal: number;
  savings: number;
}

export type PlanPeriodMultipliers = Record<PlanBillingOption["months"], number>;

export interface PlanDefinition {
  name: Subscription;
  label: string;
  description: string;
  price: number;
  discountPrice: number | null;
  effectivePrice: number;
  currency: "ARS";
  features: PlanFeatures;
  periodMultipliers: PlanPeriodMultipliers;
  billingOptions: PlanBillingOption[];
  version: number;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPeriodMultipliers(value: unknown): value is PlanPeriodMultipliers {
  return isRecord(value) && Object.keys(value).length === 4 && value[1] === 1
    && [1, 3, 6, 12].every(months => typeof value[months] === "number"
      && Number.isFinite(value[months]) && value[months] > 0 && value[months] <= months);
}

function isBillingOption(value: unknown, price: number, effectivePrice: number): value is PlanBillingOption {
  if (!isRecord(value) || ![1, 3, 6, 12].includes(value.months as number)
    || typeof value.multiplier !== "number" || !Number.isFinite(value.multiplier)
    || value.multiplier <= 0 || value.multiplier > Number(value.months)
    || (value.months === 1 && value.multiplier !== 1)
    || !isAmount(value.total) || !isAmount(value.regularTotal) || !isAmount(value.savings)) {
    return false;
  }
  // Solo comprobamos integridad del DTO; la UI usa siempre los totales recibidos.
  return value.total === Math.round(effectivePrice * value.multiplier)
    && value.regularTotal === price * Number(value.months)
    && value.savings === value.regularTotal - value.total
    && (price === 0 ? value.total === 0 : value.total > 0);
}

export function isPlanFeatures(value: unknown): value is PlanFeatures {
  return isRecord(value)
    && Object.keys(value).length === BOOLEAN_FEATURES.length + 2
    && BOOLEAN_FEATURES.every(key => typeof value[key] === "boolean")
    && (value.item_limit === null || (isAmount(value.item_limit) && value.item_limit > 0))
    && Array.isArray(value.templateIds) && value.templateIds.length > 0
    && value.templateIds.every(id => isAmount(id) && id >= 1 && id <= 15)
    && new Set(value.templateIds).size === value.templateIds.length;
}

function isPlanDefinition(value: unknown): value is PlanDefinition {
  if (!isRecord(value) || !PLAN_ORDER.includes(value.name as Subscription)
    || !isNonemptyString(value.label) || !isNonemptyString(value.description)
    || value.currency !== "ARS" || !isAmount(value.price) || value.price > 100_000_000
    || !isAmount(value.effectivePrice) || !isAmount(value.version)
    || !isNonemptyString(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt))
    || !isPlanFeatures(value.features)
    || !isPeriodMultipliers(value.periodMultipliers)
    || !Array.isArray(value.billingOptions) || value.billingOptions.length !== 4) {
    return false;
  }
  if (value.discountPrice !== null
    && (!isAmount(value.discountPrice) || value.discountPrice <= 0 || value.discountPrice >= value.price)) {
    return false;
  }
  if (value.effectivePrice !== (value.discountPrice ?? value.price)
    || (value.name === "free" ? value.price !== 0 || value.discountPrice !== null : value.price === 0)) {
    return false;
  }
  const { price, effectivePrice, billingOptions, periodMultipliers } = value;
  return billingOptions.every(option => isBillingOption(option, price, effectivePrice)
      && option.multiplier === periodMultipliers[option.months])
    && new Set(billingOptions.map(option => option.months)).size === 4;
}

export function parsePlanCatalog(response: unknown): PlanDefinition[] {
  if (!isRecord(response) || !Array.isArray(response.plans)
    || response.plans.length !== PLAN_ORDER.length || !response.plans.every(isPlanDefinition)
    || new Set(response.plans.map(plan => plan.name)).size !== PLAN_ORDER.length) {
    throw new Error("El catálogo de planes está incompleto o no es válido. Intentá nuevamente.");
  }
  // Mantener el orden comercial aunque el servidor entregue otro orden.
  return [...response.plans].sort((first, second) => PLAN_ORDER.indexOf(first.name) - PLAN_ORDER.indexOf(second.name));
}

export async function listPlans(signal?: AbortSignal): Promise<PlanDefinition[]> {
  const response = await apiFetch<unknown>(
    `${import.meta.env.VITE_API_URL}/plans`,
    { signal, cache: "no-store" },
  );
  return parsePlanCatalog(response);
}
