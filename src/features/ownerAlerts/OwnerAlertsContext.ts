import { createContext } from "react";

// Avisos del panel del dueño: pedido nuevo, mesa abierta, reserva nueva.
// Propios del panel (no push). Ver OwnerAlertsProvider.

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

export interface OwnerAlertsValue {
  /** Sonido de los avisos en este dispositivo. */
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  /** Muestra y hace sonar un aviso (si no se avisó ya). */
  announce: (alert: OwnerAlert) => void;
}

export const OwnerAlertsContext = createContext<OwnerAlertsValue | null>(null);
