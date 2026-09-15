import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCrmAlertCounts, markCrmAlertsSeen } from "../api/crm";
import { useAuth } from "../context/useAuth";

// Badge de alertas (sidebar + dashboard): seguimientos vencidos + leads
// nuevos asignados desde la última vez que el vendedor los revisó.
// Se refresca solo (polling liviano) mientras la pestaña está visible —
// React Query pausa refetchInterval en segundo plano por defecto.
export function crmAlertsQueryKey(userID?: string) {
  return ["crm-alert-counts", userID] as const;
}

export function useCrmAlerts() {
  const { user } = useAuth();
  // Mismo criterio que decide si se muestra el ítem "CRM" en SellerLayout:
  // admin y vendedor no-influencer entran al CRM, un influencer no (tiene su
  // propio panel — denyInfluencer bloquea estas rutas para él en el backend).
  const canSeeCrm = user?.role === "admin" || (user?.role === "seller" && !user.influencer);
  // newAssignments solo aplica a un vendedor puntual (el backend siempre
  // devuelve 0 para un admin, que no tiene bandeja de asignaciones personal).
  const isSeller = user?.role === "seller";
  const queryClient = useQueryClient();
  const queryKey = crmAlertsQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: getCrmAlertCounts,
    enabled: canSeeCrm,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const markSeen = useCallback(async () => {
    if (!isSeller) return;
    try {
      await markCrmAlertsSeen();
    } finally {
      await queryClient.invalidateQueries({ queryKey });
    }
  }, [isSeller, queryClient, queryKey]);

  return {
    overdueFollowUps: query.data?.count ?? 0,
    newAssignments: query.data?.newAssignments ?? 0,
    markSeen,
  };
}
