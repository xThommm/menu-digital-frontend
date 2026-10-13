import type { StatsPeriod } from "../../../../types/index.ts";
import type { CashSession } from "../../../../features/orders/types.ts";

// Ventas del período para Estadísticas (GET /api/orders/reports/sales del
// backend, ver orders/services/reportService.js). Mismas ventanas de días
// completos que las visitas, con hoy aparte.

export interface SalesDay {
  date: string;
  orders: number;
  amount: number;
}

export interface SalesTotals {
  orders: number;
  amount: number;
  averageTicket: number;
  discounts: number;
  cancelledCount: number;
  cancelledAmount: number;
  returnedCount: number;
  returnedAmount: number;
}

export interface SalesGroup {
  key: string;
  count: number;
  amount: number;
}

export interface SalesProduct {
  title: string;
  option: string | null;
  category: string | null;
  quantity: number;
  amount: number;
}

// Resultado de un grupo de cierres (todo el período, un cajero o una caja).
export interface CashClosingResult {
  closings: number;
  netAmount: number;
  // Cierres con el efectivo contado: la diferencia solo se mide en esos.
  countedCount: number;
  difference: number;
  exactCount: number;
  shortCount: number;
  shortAmount: number;
  overCount: number;
  overAmount: number;
}

// Reporte de caja del período, ya agregado por el servidor a partir de las
// cajas cerradas (orders/services/reportService.js → cashReport).
export interface CashReport {
  from: string;
  to: string;
  totals: CashClosingResult & {
    cashSalesAmount: number;
    onlineAmount: number;
    incomeAmount: number;
    expenseAmount: number;
    // Retiros con la caja abierta + lo retirado al cerrar.
    withdrawalAmount: number;
  };
  // Cómo entró lo vendido; suma el neto. count: cobros anotados (null si no aplica).
  byMethod: { kind: string; label: string; count: number | null; amount: number }[];
  // Ingresos, egresos y retiros por concepto, de mayor a menor.
  movements: { type: "income" | "expense" | "withdrawal"; typeLabel: string; category: string; label: string; count: number; amount: number }[];
  byCashier: (CashClosingResult & { name: string })[];
  byRegister: (CashClosingResult & { name: string })[];
}

export interface SalesReport extends StatsPeriod {
  // Tipo de pedido al que está filtrado el reporte; null o ausente = todos.
  serviceType?: string | null;
  totals: SalesTotals;
  previousTotals: SalesTotals;
  today: { orders: number; amount: number };
  days: SalesDay[];
  previousDays: SalesDay[];
  byServiceType: SalesGroup[];
  bySource: SalesGroup[];
  byWaiter: SalesGroup[];
  byPayment: SalesGroup[];
  hours: { count: number; amount: number }[];
  topProducts: SalesProduct[];
  byCategory: { name: string; quantity: number; amount: number }[];
  averagePrepMinutes: number | null;
  averageServiceMinutes: number | null;
  // Cajas cerradas desde el inicio del período hasta hoy.
  cashSessions: CashSession[];
  // Mismo rango que cashSessions. Ausente con un backend anterior.
  cash?: CashReport;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isAmount = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const isCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isDays = (value: unknown, length: number) => Array.isArray(value) && value.length === length
  && value.every(day => isRecord(day) && typeof day.date === "string" && isCount(day.orders) && isAmount(day.amount));
const isTotals = (value: unknown) => isRecord(value) && isCount(value.orders)
  && [value.amount, value.averageTicket, value.discounts, value.cancelledAmount, value.returnedAmount].every(isAmount)
  && isCount(value.cancelledCount) && isCount(value.returnedCount);
const isGroups = (value: unknown) => Array.isArray(value)
  && value.every(row => isRecord(row) && typeof row.key === "string" && isCount(row.count) && isAmount(row.amount));

const isClosingResult = (value: unknown) => isRecord(value)
  && [value.closings, value.countedCount, value.exactCount, value.shortCount, value.overCount].every(isCount)
  && [value.netAmount, value.difference, value.shortAmount, value.overAmount].every(isAmount);
const isNamedResults = (value: unknown) => Array.isArray(value)
  && value.every(row => isClosingResult(row) && typeof (row as Record<string, unknown>).name === "string");
const isCashReport = (value: unknown) => isRecord(value) && isClosingResult(value.totals) && isRecord(value.totals)
  && [value.totals.cashSalesAmount, value.totals.onlineAmount, value.totals.incomeAmount, value.totals.expenseAmount, value.totals.withdrawalAmount].every(isAmount)
  && Array.isArray(value.byMethod) && value.byMethod.every(row => isRecord(row) && typeof row.label === "string" && isAmount(row.amount))
  && Array.isArray(value.movements) && value.movements.every(row => isRecord(row)
    && typeof row.type === "string" && typeof row.label === "string" && isCount(row.count) && isAmount(row.amount))
  && isNamedResults(value.byCashier) && isNamedResults(value.byRegister);

/** Una respuesta de otro período o con otra forma se trata como error, nunca se muestra mal rotulada. */
export function isSalesReport(value: unknown, days: 7 | 30): value is SalesReport {
  if (!isRecord(value) || value.windowDays !== days) return false;
  return ["periodStart", "periodEnd", "previousStart", "previousEnd", "todayDate"].every(key => typeof value[key] === "string")
    && isTotals(value.totals) && isTotals(value.previousTotals)
    && isRecord(value.today) && isCount(value.today.orders) && isAmount(value.today.amount)
    && isDays(value.days, days) && isDays(value.previousDays, days)
    && [value.byServiceType, value.bySource, value.byWaiter, value.byPayment].every(isGroups)
    && Array.isArray(value.hours) && value.hours.length === 24
    && value.hours.every(hour => isRecord(hour) && isCount(hour.count) && isAmount(hour.amount))
    && Array.isArray(value.topProducts) && value.topProducts.every(product => isRecord(product)
      && typeof product.title === "string" && isCount(product.quantity) && isAmount(product.amount))
    && Array.isArray(value.byCategory) && value.byCategory.every(category => isRecord(category)
      && typeof category.name === "string" && isCount(category.quantity) && isAmount(category.amount))
    && Array.isArray(value.cashSessions) && value.cashSessions.every(session => isRecord(session)
      && typeof session.id === "number" && typeof session.closedAt === "string" && isRecord(session.summary))
    && (value.cash === undefined || isCashReport(value.cash));
}

export type SalesResult =
  | { kind: "data"; data: SalesReport }
  | { kind: "unauthorized" }
  // El plan no incluye la gestión de pedidos.
  | { kind: "locked" }
  // El servidor todavía no ofrece el reporte (versión anterior o sin base de pedidos).
  | { kind: "unavailable" }
  | { kind: "error" };

export async function requestSalesReport(
  days: 7 | 30,
  serviceType: string | null,
  token: string,
  signal: AbortSignal,
): Promise<SalesResult> {
  try {
    const filter = serviceType ? `&serviceType=${encodeURIComponent(serviceType)}` : "";
    const res = await fetch(`/api/orders/reports/sales?days=${days}${filter}`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 403) return { kind: "locked" };
    if (res.status === 404 || res.status === 503) return { kind: "unavailable" };
    if (!res.ok) return { kind: "error" };
    const data: unknown = await res.json();
    // Un servidor que ignora el filtro devolvería el total rotulado como filtrado.
    return isSalesReport(data, days) && (data.serviceType ?? null) === serviceType ? { kind: "data", data } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** Variación porcentual contra el período anterior; null si no hay base. */
export function percentChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface SalesInsights {
  amountTrend: number | null;
  ordersTrend: number | null;
  ticketTrend: number | null;
  dailyAverage: number;
  best: SalesDay | null;
  // Franja de 3 horas seguidas con más pedidos (puede cruzar la medianoche).
  peak: { start: number; end: number; share: number } | null;
}

export function buildSalesInsights(report: SalesReport): SalesInsights {
  const { totals, previousTotals, days, hours } = report;
  const best = days.reduce<SalesDay | null>(
    (top, day) => (day.amount > 0 && (!top || day.amount > top.amount) ? day : top), null,
  );
  let peak: SalesInsights["peak"] = null;
  if (totals.orders > 0) {
    let bestSum = 0;
    for (let start = 0; start < 24; start += 1) {
      const sum = hours[start].count + hours[(start + 1) % 24].count + hours[(start + 2) % 24].count;
      if (sum > bestSum) { bestSum = sum; peak = { start, end: (start + 3) % 24, share: sum / totals.orders }; }
    }
  }
  return {
    amountTrend: percentChange(totals.amount, previousTotals.amount),
    ordersTrend: percentChange(totals.orders, previousTotals.orders),
    ticketTrend: percentChange(totals.averageTicket, previousTotals.averageTicket),
    dailyAverage: days.length > 0 ? totals.amount / days.length : 0,
    best,
    peak,
  };
}

export interface CashInsights {
  count: number;
  netAmount: number;
  // Solo cierres donde se contó el efectivo.
  counted: number;
  difference: number;
  shortCount: number;
  overCount: number;
}

export function buildCashInsights(sessions: CashSession[]): CashInsights {
  const counted = sessions.filter(session => session.difference !== null);
  return {
    count: sessions.length,
    netAmount: sessions.reduce((sum, session) => sum + (session.summary?.netAmount ?? 0), 0),
    counted: counted.length,
    difference: counted.reduce((sum, session) => sum + (session.difference ?? 0), 0),
    shortCount: counted.filter(session => (session.difference ?? 0) < 0).length,
    overCount: counted.filter(session => (session.difference ?? 0) > 0).length,
  };
}

/** Los totales de caja del servidor; con un backend anterior se calculan de los cierres. */
export function cashInsightsOf(report: Pick<SalesReport, "cash" | "cashSessions">): CashInsights {
  if (!report.cash) return buildCashInsights(report.cashSessions);
  const { totals } = report.cash;
  return {
    count: totals.closings,
    netAmount: totals.netAmount,
    counted: totals.countedCount,
    difference: totals.difference,
    shortCount: totals.shortCount,
    overCount: totals.overCount,
  };
}

/** Tope "redondo" para el eje de un gráfico, sin dejar mucho aire sobre la barra más alta. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(candidate => candidate * power >= value) ?? 10;
  return step * power;
}

// ── Exportación a Excel ──

export const SALES_SHEETS = ["ventas", "productos", "desgloses", "pedidos", "caja", "movimientos"] as const;
export const VISIT_SHEETS = ["visitas", "vistos"] as const;
export type ReportSheet = (typeof SALES_SHEETS)[number] | (typeof VISIT_SHEETS)[number];

export const SHEET_LABEL: Record<ReportSheet, { title: string; detail: string }> = {
  ventas: { title: "Ventas por día", detail: "Pedidos, importe, ticket promedio, anulados y devueltos" },
  productos: { title: "Productos vendidos", detail: "Unidades e importe de cada producto y variante" },
  desgloses: { title: "Desgloses", detail: "Por tipo de pedido, origen, forma de pago, operador, categoría y hora" },
  pedidos: { title: "Pedidos", detail: "Un pedido por fila, con su estado y total" },
  caja: { title: "Cierres de caja", detail: "Cada cierre con su arqueo, y los desgloses por medio de cobro, concepto, cajero y caja" },
  movimientos: { title: "Movimientos de caja", detail: "Cada ingreso, egreso y retiro, con su concepto y quién lo registró" },
  visitas: { title: "Visitas por día", detail: "Visitas a la carta y el recorrido hasta el pedido" },
  vistos: { title: "Productos vistos", detail: "Veces que abrieron cada producto" },
};

export type ExportPreset = "period7" | "period30" | "today" | "month" | "lastMonth" | "custom";

const shiftDay = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

/** Rango de días (inclusive) de cada atajo, a partir de "hoy" en Buenos Aires. */
export function presetRange(preset: Exclude<ExportPreset, "custom">, today: string): { from: string; to: string } {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case "period7": return { from: shiftDay(today, -7), to: shiftDay(today, -1) };
    case "period30": return { from: shiftDay(today, -30), to: shiftDay(today, -1) };
    case "today": return { from: today, to: today };
    case "month": return { from: monthStart, to: today };
    case "lastMonth": {
      const end = shiftDay(monthStart, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
  }
}

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Mensaje de error del rango elegido, o null si se puede exportar. */
export function rangeError(from: string, to: string, today: string): string | null {
  if (!isDay(from) || !isDay(to)) return "Elegí las dos fechas.";
  if (from > to) return "La fecha de inicio es posterior a la de fin.";
  if (to > today) return "El período no puede terminar después de hoy.";
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1 > 366) {
    return "El período no puede superar un año.";
  }
  return null;
}

export type ExportResult = { kind: "file"; blob: Blob } | { kind: "unauthorized" } | { kind: "error"; message: string };

export async function requestReportFile(
  range: { from: string; to: string },
  sheets: ReportSheet[],
  token: string,
): Promise<ExportResult> {
  const fallback = "No pudimos generar el reporte. Intentá de nuevo.";
  try {
    const params = new URLSearchParams({ from: range.from, to: range.to, sheets: sheets.join(",") });
    const res = await fetch(`/api/users/me/reports/export?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 404) return { kind: "error", message: "La exportación todavía no está disponible. Probá de nuevo en unos minutos." };
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      return { kind: "error", message: isRecord(body) && typeof body.message === "string" ? body.message : fallback };
    }
    return { kind: "file", blob: await res.blob() };
  } catch {
    return { kind: "error", message: fallback };
  }
}
