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
