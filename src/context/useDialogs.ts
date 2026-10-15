import { useContext } from "react";
import { DialogContext } from "./DialogContext";

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialogs debe usarse dentro de DialogProvider");
  }
  return context;
}
