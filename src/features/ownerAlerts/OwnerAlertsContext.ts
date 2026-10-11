import { createContext } from "react";
import type { AdminPushStatus } from "../../lib/pushDevices";

// Avisos del panel del dueño: pedido nuevo, mesa abierta, reserva nueva.
// Ver OwnerAlertsProvider.

export type OwnerAlertKind = "order" | "table" | "reservation";

export interface OwnerAlert {
  /** Identifica el hecho ("order:12"): el mismo aviso suena una sola vez. */
  key: string;
  kind: OwnerAlertKind;
  title: string;
  body?: string;
  /** Pantalla del panel que abre el botón "Ver". */
  url?: string;
  /** Pedido del aviso: si ya se avisó por ese pedido (ej. como mesa abierta), no se repite. */
  orderId?: number | null;
}

export interface OwnerPushState {
  /** Si este dispositivo puede recibir push y, si no, por qué. */
  status: AdminPushStatus;
  /** Push activas en ESTE dispositivo. */
  active: boolean;
  busy: boolean;
  /** Explicación cuando no se pueden activar. */
  help: string | null;
  toggle: () => Promise<void>;
  sendTest: () => Promise<void>;
}

export interface OwnerAlertsValue {
  /** Sonido de los avisos en este dispositivo. */
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  /** Muestra y hace sonar un aviso (si no se avisó ya). */
  announce: (alert: OwnerAlert) => void;
  push: OwnerPushState;
}

export const OwnerAlertsContext = createContext<OwnerAlertsValue | null>(null);
