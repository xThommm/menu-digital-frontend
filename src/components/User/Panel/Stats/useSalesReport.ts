import { useEffect, useState } from "react";
import { useAuth } from "../../../../context/useAuth";
import { requestSalesReport, type SalesReport, type SalesResult } from "./salesReport";

export interface SalesState {
  // null mientras carga el período elegido por primera vez.
  result: Exclude<SalesResult, { kind: "unauthorized" }> | null;
  // Último reporte bueno del período: se sigue mostrando si un refresco falla.
  report: SalesReport | null;
  refreshing: boolean;
  // El reporte mostrado todavía es el del filtro anterior.
  pending: boolean;
  retry: () => void;
}

/**
 * Ventas del período para las pestañas Ventas y Caja. Se pide recién cuando
 * `enabled` (plan Pro y alguna de esas pestañas abierta) y se refresca solo
 * mientras la pestaña del navegador está visible, igual que las visitas.
 */
export function useSalesReport(days: 7 | 30, serviceType: string | null, enabled: boolean): SalesState {
  const { token, logout } = useAuth();
  const [loaded, setLoaded] = useState<{ days: 7 | 30; serviceType: string | null; result: SalesState["result"]; report: SalesReport | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    let inFlight = false;
    let stopped = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (inFlight || stopped || cancelled) return;
      inFlight = true;
      controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller?.abort(), 20_000);
      setRefreshing(true);
      try {
        const result = await requestSalesReport(days, serviceType, token, controller.signal);
        if (cancelled) return;
        if (result.kind === "unauthorized") {
          stopped = true;
          logout();
          window.location.href = "/login";
          return;
        }
        // Sin plan o sin reporte en el servidor: insistir no cambia nada.
        if (result.kind === "locked" || result.kind === "unavailable") stopped = true;
        setLoaded(previous => ({
          days,
          // Si falla, lo que queda en pantalla sigue siendo del filtro anterior.
          serviceType: result.kind !== "data" && previous?.days === days && previous.report ? previous.serviceType : serviceType,
          result,
          report: result.kind === "data" ? result.data : previous?.days === days ? previous.report : null,
        }));
      } finally {
        window.clearTimeout(timeoutId);
        inFlight = false;
        if (!cancelled) setRefreshing(false);
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, token, logout, days, serviceType, attempt]);

  const current = loaded?.days === days ? loaded : null;
  return {
    result: current?.result ?? null,
    report: current?.report ?? null,
    refreshing,
    pending: current !== null && current.serviceType !== serviceType,
    retry: () => setAttempt(value => value + 1),
  };
}
