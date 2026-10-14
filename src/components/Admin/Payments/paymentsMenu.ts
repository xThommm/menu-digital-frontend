import { Eraser, ExternalLink, ListFilter, ListX, PanelTopOpen, UserRound } from "lucide-react";
import { copySubmenu, openUrlItem, type MenuEnv } from "../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../features/contextMenu/types";
import type { AdminPayment } from "../../../types";

// Clic derecho en el historial de pagos del admin: un pago y el fondo.

/** Ficha del cliente en el CRM (la misma pantalla para admin y vendedores). */
export const crmClientPath = (userID: string) => `/sellers/crm?client=${encodeURIComponent(userID)}`;

/** Búsqueda del pago en la actividad de la cuenta de Mercado Pago. */
export const mercadoPagoActivityUrl = (paymentID: string) =>
  `https://www.mercadopago.com.ar/activities/1?q=${encodeURIComponent(paymentID)}`;

export interface PaymentMenuContext {
  payment: AdminPayment;
  expanded: boolean;
  /** Ya se están viendo solo los pagos de este cliente. */
  filteredByClient: boolean;
  actions: { filterByClient: (userID: string) => void; toggleDetails: () => void };
}

export function buildPaymentMenu(env: MenuEnv): ContextMenuItem<PaymentMenuContext>[] {
  return [
    {
      id: "details",
      label: ({ expanded }) => (expanded ? "Ocultar detalles" : "Ver detalles"),
      icon: PanelTopOpen,
      run: ({ actions }) => actions.toggleDetails(),
    },
    {
      id: "client-payments",
      label: "Ver pagos de este cliente",
      icon: ListFilter,
      visible: ({ payment, filteredByClient }) => Boolean(payment.customer?.id) && !filteredByClient,
      run: ({ payment, actions }) => actions.filterByClient(payment.customer!.id!),
    },
    {
      id: "crm",
      label: "Abrir cliente en el CRM",
      icon: UserRound,
      visible: ({ payment }) => Boolean(payment.customer?.id),
      run: ({ payment }) => env.navigate(crmClientPath(payment.customer!.id!)),
    },
    { type: "separator" },
    copySubmenu<PaymentMenuContext>(env, [
      { id: "payment-id", label: "ID de pago", value: ({ payment }) => payment.paymentID, done: "ID de pago copiado." },
      { id: "preference-id", label: "ID de preferencia", value: ({ payment }) => payment.preferenceId, done: "ID de preferencia copiado." },
    ]),
    openUrlItem<PaymentMenuContext>(env, {
      id: "mercadopago",
      label: "Buscar en Mercado Pago",
      icon: ExternalLink,
      url: ({ payment }) => (payment.paymentID ? mercadoPagoActivityUrl(payment.paymentID) : null),
    }),
  ];
}

export interface PaymentsPageMenuContext {
  filteredByClient: boolean;
  activeFilters: number;
  actions: { showAll: () => void; clearFilters: () => void };
}

export function buildPaymentsPageMenu(): ContextMenuItem<PaymentsPageMenuContext>[] {
  return [
    { id: "all", label: "Ver todos los pagos", icon: ListX, visible: ({ filteredByClient }) => filteredByClient, run: ({ actions }) => actions.showAll() },
    {
      id: "clear",
      label: "Limpiar filtros",
      icon: Eraser,
      disabled: ({ activeFilters }) => activeFilters === 0 && "No hay filtros aplicados",
      run: ({ actions }) => actions.clearFilters(),
    },
  ];
}
