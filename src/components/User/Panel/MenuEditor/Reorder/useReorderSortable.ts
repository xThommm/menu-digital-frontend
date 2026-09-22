import type { CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { dndId, type CategoryListData, type ItemListData, type SortableData } from "./menuReorder";
import { useReorderState } from "./reorderContext";

const ROLE_DESCRIPTION: Record<SortableData["kind"], string> = {
  section: "sección que se puede mover",
  category: "categoría que se puede mover",
  item: "producto que se puede mover",
};

// Un elemento que se arrastra y a la vez recibe (una sección, una categoría o
// un producto). `setNode` y `style` van en el nodo; el resto, en la manija
// (ver DragHandle). Los nombres no terminan en "Ref" a propósito: la regla
// react-hooks/refs toma por ref todo lo que se llama así y no deja leer el
// objeto durante el render.
export function useReorderSortable(data: SortableData) {
  const { enabled, reducedMotion } = useReorderState();
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver,
  } = useSortable({
    id: dndId(data),
    data,
    disabled: !enabled,
    attributes: { roleDescription: ROLE_DESCRIPTION[data.kind] },
  });
  // Translate y no Transform: las filas tienen alturas distintas y escalarlas
  // deformaría el contenido.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: reducedMotion ? undefined : transition,
  };
  return {
    setNode: setNodeRef,
    style,
    setActivator: setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
    isOver,
  };
}

export type ReorderSortable = ReturnType<typeof useReorderSortable>;

// Una lista que recibe lo que se suelta en su margen o, vacía, en su lugar.
export function useReorderList(data: CategoryListData | ItemListData) {
  const { enabled } = useReorderState();
  const { setNodeRef, isOver } = useDroppable({ id: dndId(data), data, disabled: !enabled });
  return { setNode: setNodeRef, isOver };
}
