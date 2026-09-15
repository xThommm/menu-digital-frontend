import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCrmClients } from "../api/crm";
import { useAuth } from "../context/useAuth";
import {
  normalizeAttention,
  summarizeAttention,
} from "../components/Seller/Crm/crmHelpers";
import type { CrmClient } from "../types";

// Centraliza el fetch de /sellers/crm/clients para que SellerCrm.tsx y el
// dashboard (SellerOverview.tsx) compartan la misma caché de React Query en
// vez de pedir la lista dos veces al navegar entre /sellers y /sellers/crm.
export function crmClientsQueryKey(userID?: string) {
  return ["crm-clients", userID] as const;
}

export function useCrmClients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = crmClientsQueryKey(user?.id);

  const query = useQuery({
    queryKey,
    queryFn: listCrmClients,
    staleTime: 15_000,
  });

  const clients = useMemo(
    () => normalizeAttention(query.data?.clients ?? []),
    [query.data],
  );
  const attentionSummary = query.data?.attentionSummary || summarizeAttention(clients);

  // El drawer/kanban avisan cuando cambió algo de un cliente (etapa/tags/
  // seguimiento) para reflejarlo en la lista sin esperar un refetch completo.
  const patchClient = useCallback((userID: string, patch: Partial<CrmClient>) => {
    queryClient.setQueryData(queryKey, (old: Awaited<ReturnType<typeof listCrmClients>> | undefined) =>
      old ? { ...old, clients: old.clients.map((c) => (c._id === userID ? { ...c, ...patch } : c)) } : old,
    );
  }, [queryClient, queryKey]);

  return {
    clients,
    attentionSummary,
    loading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    patchClient,
  };
}
