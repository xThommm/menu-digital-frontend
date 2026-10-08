// Tipos de Reservas. Espejo de los DTOs de backend/src/reservations
// (services/reservationService.js).

export type ReservationStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "no_show";

export type PhoneMode = "off" | "optional" | "required";

// Lo que ve el cliente con su código.
export interface CustomerReservation {
  code: string;
  name: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: ReservationStatus;
  tableLabel: string | null;
  altDate: string | null;
  altTime: string | null;
  message: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Lo que ve el local.
export interface OwnerReservation {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  partySize: number;
  date: string;
  time: string;
  status: ReservationStatus;
  source: "web" | "manual";
  tableLabel: string | null;
  altDate: string | null;
  altTime: string | null;
  message: string | null;
  notes: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationSettings {
  enabled: boolean;
  phoneMode: PhoneMode;
  maxPartySize: number;
  maxDaysAhead: number;
  minNoticeMinutes: number;
}

export type ReservationConfig =
  | { enabled: false }
  | ({ enabled: true; businessName: string } & ReservationSettings);

export interface NewReservationInput {
  name: string;
  phone?: string;
  partySize: number;
  date: string;
  time: string;
  notes?: string;
}

export type OwnerAction = "confirm" | "reject" | "cancel" | "complete" | "no-show" | "reopen";

export interface OwnerActionBody {
  tableLabel?: string;
  message?: string;
  altTime?: string;
  altDate?: string;
}

// Mensajes del WebSocket (servidor → cliente).
export type SocketMessage =
  | { type: "ready"; role: "owner" | "customer" }
  | { type: "reservation"; reservation: CustomerReservation | OwnerReservation }
  | { type: "error"; code?: string; message: string };
