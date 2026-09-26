import type { ItemStatsData, StatsData, StatsPeriod } from "../../../../types/index.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isPeriod = (value: unknown, days: 7 | 30): value is StatsPeriod => isRecord(value)
  && value.windowDays === days && typeof value.comparisonAvailable === "boolean"
  && (value.observedFrom === null || typeof value.observedFrom === "string")
  && ["periodStart", "periodEnd", "previousStart", "previousEnd", "todayDate"].every(key => typeof value[key] === "string");

export function isStatsData(value: unknown, days: 7 | 30): value is StatsData {
  if (!isRecord(value) || !isPeriod(value, days)) return false;
  const data = value as unknown as Record<string, unknown>;
  return [data.totalViews, data.previousTotalViews, data.todayViews].every(isCount)
    && [data.days, data.previousDays].every(series => Array.isArray(series) && series.length === days
      && series.every(day => isRecord(day) && typeof day.date === "string" && isCount(day.count)));
}

export function isItemStatsData(value: unknown, days: 7 | 30): value is ItemStatsData {
  if (!isRecord(value) || !isPeriod(value, days)) return false;
  const data = value as unknown as Record<string, unknown>;
  return Array.isArray(data.topItems) && data.topItems.every(item => isRecord(item)
    && typeof item.itemID === "string" && typeof item.title === "string" && typeof item.image === "string"
    && isCount(item.totalViews) && isCount(item.previousViews));
}

const isDay = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isAudience = (value: unknown) => isRecord(value)
  && (value.from === null || isDay(value.from))
  && ["visits", "visitors", "returning", "qr", "engaged", "carts", "orders"].every(key => isCount(value[key]));
const isTopItems = (value: unknown) => Array.isArray(value) && value.every(item => isRecord(item)
  && typeof item.itemID === "string" && typeof item.title === "string" && typeof item.image === "string"
  && isCount(item.totalViews) && isCount(item.previousViews)
  && (item.orders === undefined || isCount(item.orders)));

/**
 * Los campos agregados después (horarios, embudo, pedidos) son opcionales:
 * si llegan mal formados se descartan y el resto del panel se muestra igual,
 * en vez de rechazar toda la respuesta como con los campos base.
 */
export function sanitizeStatsData(data: StatsData): StatsData {
  const { hours, hoursFrom, audience, ...base } = data;
  const validHours = Array.isArray(hours) && hours.length === 24 && hours.every(isCount)
    && (hoursFrom === null || isDay(hoursFrom));
  return {
    ...base,
    ...(validHours ? { hours, hoursFrom } : {}),
    ...(isAudience(audience) ? { audience } : {}),
  };
}

export function sanitizeItemStatsData(data: ItemStatsData): ItemStatsData {
  const { topOrdered, ...base } = data;
  return {
    ...base,
    topItems: base.topItems.map(({ orders, ...item }) => (isCount(orders) ? { ...item, orders } : item)),
    ...(isTopItems(topOrdered) ? { topOrdered } : {}),
  };
}

export type StatsResult<T> =
  | { kind: "locked" }
  | { kind: "unauthorized" }
  | { kind: "data"; data: T }
  | { kind: "error" };

export async function requestStatsData<T>(url: string, token: string, signal: AbortSignal): Promise<StatsResult<T>> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 403) return { kind: "locked" };
    if (!res.ok) return { kind: "error" };
    return { kind: "data", data: await res.json() };
  } catch {
    return { kind: "error" };
  }
}
