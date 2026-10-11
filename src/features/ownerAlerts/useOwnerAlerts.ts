import { useContext } from "react";
import { OwnerAlertsContext, type OwnerAlertsValue } from "./OwnerAlertsContext";

// Fuera del panel del dueño (o en tests) no hay avisos: todo es inofensivo.
const FALLBACK: OwnerAlertsValue = {
  soundOn: false,
  setSoundOn: () => undefined,
  announce: () => undefined,
};

export function useOwnerAlerts(): OwnerAlertsValue {
  return useContext(OwnerAlertsContext) ?? FALLBACK;
}
