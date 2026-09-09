import { createContext } from "react";

export interface MobileDockContextType {
  hidden: boolean;
  hide: () => void;
  show: () => void;
}

// ✅ Solo exporta el contexto — con allowConstantExport: true en ESLint no genera warning
export const MobileDockContext = createContext<MobileDockContextType | undefined>(undefined);
