import { useQuery } from "@tanstack/react-query";
import { listPlans } from "../api/plans";

export const PLANS_QUERY_KEY = ["plans"] as const;

export function usePlans() {
  return useQuery({
    queryKey: PLANS_QUERY_KEY,
    queryFn: ({ signal }) => listPlans(signal),
    staleTime: 0,
    // Una nueva pantalla consulta el catálogo; el checkout además valida versión.
    refetchOnMount: true,
  });
}
