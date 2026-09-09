import { useContext } from "react";
import { MobileDockContext } from "./MobileDockContext";

export function useMobileDock() {
  const context = useContext(MobileDockContext);

  if (!context) {
    throw new Error("useMobileDock debe usarse dentro de MobileDockProvider");
  }

  return context;
}
