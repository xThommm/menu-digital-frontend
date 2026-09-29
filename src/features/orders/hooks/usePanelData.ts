import { useCallback, useEffect, useState } from "react";
import { getOrderSettings, listWaiters } from "../api/ordersApi";
import { fetchMenuForOrdering } from "../api/publicOrdersApi";
import { errorMessage } from "../lib/errors";
import type { SettingsResponse, Waiter } from "../types";
import type { PublicMenuPayload } from "../../../types";

// Datos que comparten varias páginas del panel de pedidos. Sin caché global
// a propósito: cada página los pide al montarse (son livianos).

interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

function useLoadable<T>(load: () => Promise<T>, fallback: string): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(result => { if (!cancelled) { setData(result); setError(null); } })
      .catch(err => { if (!cancelled) setError(errorMessage(err, fallback)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // load es estable por página (useCallback en quien lo usa).
  }, [load, fallback, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { data, error, loading, reload, setData };
}

export const useOrderSettings = () =>
  useLoadable<SettingsResponse>(getOrderSettings, "No se pudo cargar la configuración de pedidos.");

export const useWaiters = () =>
  useLoadable<Waiter[]>(listWaiters, "No se pudieron cargar los mozos.");

export function useOrderingMenu(slug: string | undefined) {
  const load = useCallback(() => {
    if (!slug) return Promise.reject(new Error("Sin slug"));
    return fetchMenuForOrdering(slug);
  }, [slug]);
  return useLoadable<PublicMenuPayload>(load, "No se pudo cargar la carta.");
}
