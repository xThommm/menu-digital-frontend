import { useMemo } from "react";
import { GripVertical } from "lucide-react";
import { useReorderState } from "./reorderContext";
import type { ReorderSortable } from "./useReorderSortable";
import styles from "./Reorder.module.css";

// Manija para arrastrar una sección, una categoría o un producto. Es un botón
// de verdad: se alcanza con Tab y se levanta con espacio o Enter. Con el orden
// apagado por un filtro queda visible pero inactiva, y el title explica por
// qué; sin orden disponible (selección múltiple) no se dibuja.
export default function DragHandle({ sortable, label, className, iconSize = 16 }: {
  sortable: ReorderSortable;
  label: string;
  className?: string;
  iconSize?: number;
}) {
  const { available, enabled, disabledReason } = useReorderState();
  // Desestructurado a propósito: react-hooks/refs no deja leer propiedades de
  // un objeto del que una propiedad se usa como ref.
  const { setActivator, attributes, listeners } = sortable;
  // La manija se vuelve a renderizar con cada cambio de destino mientras se
  // arrastra: el mismo elemento de ícono le ahorra a React redibujarlo.
  const icon = useMemo(() => <GripVertical size={iconSize} strokeWidth={1.8} aria-hidden="true" />, [iconSize]);
  if (!available) return null;

  return (
    <button
      type="button"
      ref={setActivator}
      className={className ? `${styles.handle} ${className}` : styles.handle}
      {...attributes}
      {...(enabled ? listeners : undefined)}
      aria-label={label}
      aria-disabled={!enabled}
      title={enabled ? "Arrastrá para cambiar el orden" : disabledReason ?? undefined}
    >
      {icon}
    </button>
  );
}
