import { useCallback, useContext, type MouseEvent } from "react";
import { ContextMenuContext, type OpenContextMenuOptions } from "../ContextMenuContext";
import { resolveMenuItems } from "../lib/contextMenu";
import type { ContextMenuItem } from "../types";

/**
 * Habilita el menú contextual en una zona. Devuelve el handler para
 * `onContextMenu`, que recibe el evento y el contexto del elemento:
 *
 *   const openMenu = useContextMenu(ORDER_MENU, { highlightTarget: true });
 *   <tr onContextMenu={(event) => openMenu(event, order)} />
 *
 * Para un contexto general (espacio vacío de una pantalla) alcanza con pasar
 * el contexto que corresponda, o `undefined` si las opciones no dependen de
 * nada. Gana siempre la zona más específica; fuera de las zonas que usan este
 * hook aparece el menú global (globalMenu.ts).
 *
 * `items` tiene que ser estable entre renders (constante de módulo o useMemo).
 *
 * Con un manejador delegado (uno en el contenedor que mira qué fila se
 * clickeó) se puede pasar en cada llamada el elemento a resaltar:
 *
 *   openMenu(event, row, { highlightElement: rowElement });
 */
export function useContextMenu<C>(items: ContextMenuItem<C>[], options?: OpenContextMenuOptions) {
  const contextMenu = useContext(ContextMenuContext);
  if (!contextMenu) {
    throw new Error("useContextMenu debe usarse dentro de ContextMenuProvider");
  }
  const { open } = contextMenu;
  const highlightTarget = options?.highlightTarget === true;

  return useCallback((event: MouseEvent<HTMLElement>, context: C, call?: Pick<OpenContextMenuOptions, "highlightElement">) => {
    open(event, resolveMenuItems(items, context), { highlightTarget, highlightElement: call?.highlightElement });
  }, [open, items, highlightTarget]);
}
