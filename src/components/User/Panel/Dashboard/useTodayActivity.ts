import { useCallback, useEffect, useRef, useState } from "react";
import type { StatsData } from "../../../../types";
import { TIMEZONE_BA } from "../../../../lib/dates";
import { getBoard } from "../../../../features/orders/api/ordersApi";
import { listReservations } from "../../../../features/reservations/api/reservationsApi";
import { todayBuenosAires } from "../../../../features/reservations/lib/format";
import { isStatsData, requestStatsData } from "../Stats/statsRequests";
import {
  summarizeOrders, summarizeReservations, summarizeVisits,
  type OrdersSummary, type ReservationsSummary, type VisitsSummary,
} from "./todayActivity";

// Cada fuente: undefined = cargando, null = no disponible (falló o el plan no
// la incluye: la tarjeta no se muestra), o su resumen.
export interface TodayActivity {
  visits: VisitsSummary | null | undefined;
  orders: OrdersSummary | null | undefined;
  reservations: ReservationsSummary | null | undefined;
}

interface Options {
  token: string | null;
  visits: boolean;
  orders: boolean;
  reservations: boolean;
}

// Al volver a la pestaña se actualiza, pero no más seguido que esto.
const REFRESH_MIN_MS = 60_000;

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE_BA, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/**
 * Resumen del día para el inicio del panel. Usa los mismos endpoints que
 * Estadísticas, Gestión de pedidos y Reservas; cada uno falla por separado y
 * en silencio (el inicio no depende de ninguno).
 */
export function useTodayActivity({ token, visits, orders, reservations }: Options): TodayActivity {
  const [state, setState] = useState<TodayActivity>({ visits: undefined, orders: undefined, reservations: undefined });
  const lastRun = useRef(0);

  const load = useCallback((signal: AbortSignal) => {
    if (!token) return;
    lastRun.current = Date.now();
    const set = <K extends keyof TodayActivity>(key: K, value: TodayActivity[K]) => {
      if (!signal.aborted) setState(prev => ({ ...prev, [key]: value }));
    };

    if (visits) {
      requestStatsData<StatsData>("/api/users/me/stats?days=7", token, signal).then(result => {
        set("visits", result.kind === "data" && isStatsData(result.data, 7) ? summarizeVisits(result.data) : null);
      });
    }
    if (orders) {
      getBoard()
        .then(board => set("orders", summarizeOrders(board)))
        .catch(() => set("orders", null));
    }
    if (reservations) {
      listReservations()
        .then(list => {
          const now = new Date();
          set("reservations", summarizeReservations(list, todayBuenosAires(now), timeFormatter.format(now)));
        })
        .catch(() => set("reservations", null));
    }
  }, [token, visits, orders, reservations]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > REFRESH_MIN_MS) {
        load(controller.signal);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return {
    visits: visits ? state.visits : null,
    orders: orders ? state.orders : null,
    reservations: reservations ? state.reservations : null,
  };
}
