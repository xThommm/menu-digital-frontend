import { createContext, type MouseEvent } from "react";
import type { ResolvedItem } from "./types";

export interface OpenContextMenuOptions {
  /** Marca el elemento que recibió el clic mientras el menú está abierto. */
  highlightTarget?: boolean;
  /**
   * Marca este elemento en lugar del que recibió el clic: para un manejador
   * delegado (uno en el contenedor que decide qué fila se clickeó).
   */
  highlightElement?: HTMLElement | null;
}

export interface ContextMenuContextValue {
  /**
   * Abre el menú en la posición del evento. No hace nada (y deja el menú del
   * navegador) si no hay opciones o si corresponde el menú nativo.
   */
  open: (event: MouseEvent<HTMLElement>, items: ResolvedItem[], options?: OpenContextMenuOptions) => void;
  close: () => void;
}

export const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);
