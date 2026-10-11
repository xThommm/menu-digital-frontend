import { useContext } from "react";
import { OwnerAlertsContext, type OwnerAlertsValue } from "./OwnerAlertsContext";

const noop = async () => undefined;

// Fuera del panel del dueño (o en tests) no hay avisos: todo es inofensivo.
const FALLBACK: OwnerAlertsValue = {
  soundOn: false,
  setSoundOn: () => undefined,
  announce: () => undefined,
  push: { status: "unsupported", features: [], busy: false, help: null, toggle: noop, sendTest: noop },
};

export function useOwnerAlerts(): OwnerAlertsValue {
  return useContext(OwnerAlertsContext) ?? FALLBACK;
}
