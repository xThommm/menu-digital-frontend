import type { ServiceInput, ServiceType } from "../types";

// Borrador de "dónde va el pedido" (ver components/shared/ServiceFields).

export interface ServiceDraft {
  serviceType: ServiceType;
  table: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
}

export const emptyService = (serviceType: ServiceType = "table"): ServiceDraft => ({
  serviceType, table: "", customerName: "", customerPhone: "", deliveryAddress: "", deliveryNotes: "",
});

// Se puede enviar: una mesa elegida si es "Mesa"; el resto no exige nada.
export const serviceReady = (draft: ServiceDraft) => draft.serviceType !== "table" || draft.table !== "";

const trimmed = (value: string) => value.trim() || undefined;

export const toServiceInput = (draft: ServiceDraft): ServiceInput => {
  const withCustomer = draft.serviceType === "takeaway" || draft.serviceType === "delivery";
  return {
    serviceType: draft.serviceType,
    tableNumber: draft.serviceType === "table" && draft.table ? Number(draft.table) : null,
    ...(withCustomer ? {
      customerName: trimmed(draft.customerName),
      customerPhone: trimmed(draft.customerPhone),
      deliveryNotes: trimmed(draft.deliveryNotes),
    } : {}),
    ...(draft.serviceType === "delivery" ? { deliveryAddress: trimmed(draft.deliveryAddress) } : {}),
  };
};
