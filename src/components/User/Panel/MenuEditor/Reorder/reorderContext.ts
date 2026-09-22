import { createContext, useContext } from "react";
import type { ReorderKind } from "./menuReorder";

// Estado de "ordenar arrastrando" que leen las piezas del editor (tablero,
// columna de estructura y acordeón) sin pasarlo de prop en prop.
export interface ReorderState {
  // Hay manijas: el backend sabe ordenar y no se está en selección múltiple.
  available: boolean;
  // Se puede arrastrar ahora mismo (disponible y sin filtro activo).
  enabled: boolean;
  // Por qué no, cuando las manijas se muestran apagadas (filtro activo).
  disabledReason: string | null;
  // Qué se está arrastrando, o null: con una categoría en el aire se muestran
  // también los contenedores vacíos donde puede caer.
  activeKind: ReorderKind | null;
  reducedMotion: boolean;
}

export const ReorderContext = createContext<ReorderState>({
  available: false,
  enabled: false,
  disabledReason: null,
  activeKind: null,
  reducedMotion: false,
});

export const useReorderState = () => useContext(ReorderContext);
