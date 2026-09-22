import { useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragOverlay, MeasuringStrategy, defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core";
import { FolderOpen, Layers, UtensilsCrossed } from "lucide-react";
import { useMediaQuery } from "../../../../../hooks/useMediaQuery";
import type { SortableData } from "./menuReorder";
import { ReorderContext, type ReorderState } from "./reorderContext";
import type { MenuReorder } from "./useMenuReorder";
import styles from "./Reorder.module.css";

// Las listas cambian de tamaño mientras se arrastra (un producto se muda de
// categoría): se vuelven a medir todo el tiempo.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

const DROP_ANIMATION: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } }),
};

const KIND_LABEL: Record<SortableData["kind"], string> = {
  section: "Sección",
  category: "Categoría",
  item: "Producto",
};

const KIND_ICON = { section: Layers, category: FolderOpen, item: UtensilsCrossed };

function ReorderPreview({ data }: { data: SortableData }) {
  const Icon = KIND_ICON[data.kind];
  return (
    <div className={styles.preview}>
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" className={styles.previewIcon} />
      <span className={styles.previewText}>
        <span className={styles.previewKind}>{KIND_LABEL[data.kind]}</span>
        <span className={styles.previewTitle}>{data.title}</span>
      </span>
    </div>
  );
}

// Envuelve el editor: el contexto de dnd-kit, el estado que leen las piezas
// del editor y la vista previa que sigue al puntero. La vista previa va a
// document.body (position: fixed se rompe debajo de un ancestro con
// backdrop-filter, y el editor usa vidrio) dentro de .admin-editor, que es
// donde viven sus variables de color.
export default function MenuReorderProvider({ reorder, available, disabledReason, children }: {
  reorder: MenuReorder;
  available: boolean;
  // Con `available`, por qué no se puede arrastrar ahora (null: sí se puede).
  disabledReason: string | null;
  children: ReactNode;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const activeKind = reorder.active?.kind ?? null;
  const enabled = available && disabledReason === null;
  const state = useMemo<ReorderState>(
    () => ({ available, enabled, disabledReason, activeKind, reducedMotion }),
    [available, enabled, disabledReason, activeKind, reducedMotion],
  );

  return (
    <DndContext
      sensors={reorder.sensors}
      collisionDetection={reorder.collisionDetection}
      measuring={MEASURING}
      accessibility={{
        announcements: reorder.announcements,
        screenReaderInstructions: reorder.screenReaderInstructions,
      }}
      onDragStart={reorder.handleDragStart}
      onDragOver={reorder.handleDragOver}
      onDragEnd={reorder.handleDragEnd}
      onDragCancel={reorder.handleDragCancel}
    >
      <ReorderContext.Provider value={state}>{children}</ReorderContext.Provider>
      {createPortal(
        <div className="admin-editor">
          <DragOverlay dropAnimation={reducedMotion ? null : DROP_ANIMATION} zIndex={1000}>
            {reorder.active ? <ReorderPreview data={reorder.active} /> : null}
          </DragOverlay>
        </div>,
        document.body,
      )}
    </DndContext>
  );
}
