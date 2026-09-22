import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type Dispatch, type SetStateAction,
} from "react";
import {
  KeyboardSensor, PointerSensor, closestCenter, getClientRect, pointerWithin, rectIntersection, useSensor, useSensors,
  type Active, type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent,
  type DragStartEvent, type Over, type ScreenReaderInstructions, type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { AdminMenuData as MenuData } from "../../../../../types";
import {
  categoriesIn, findCategory, findItem, itemsIn, moveCategory, moveItem, moveSection, saveAfterDrop,
  type OrderSave, type ReorderData, type ReorderKind, type SortableData,
} from "./menuReorder";

// ── Ordenar el menú arrastrando ─────────────────────────────────────────────
// Todo lo que pasa entre agarrar y soltar, y el guardado. El cambio se ve al
// instante (estado local) y se guarda en segundo plano, un pedido por vez: si
// hay otro en cola para el mismo contenedor, se manda solo el último. Si un
// guardado falla, se avisa y se recarga el menú desde el servidor.

interface Options {
  menuData: MenuData | null;
  setMenuData: Dispatch<SetStateAction<MenuData | null>>;
  authHeaders: Record<string, string>;
  onUnauthorized: () => void;
  onSaveError: (message: string) => void;
  // Un producto soltado sobre una categoría cuya lista no se ve (la columna
  // de estructura o un acordeón cerrado) va al final de esa categoría.
  onItemAppended: (itemId: string, catId: string) => void;
}

// Motivo de un guardado rechazado por el backend (el resto de los errores,
// como uno de red, se muestran con un texto genérico).
class OrderSaveError extends Error {}

// ── Dónde puede caer cada cosa ──────────────────────────────────────────────

const accepts = (activeKind: ReorderKind, data: ReorderData | undefined): boolean => {
  if (!data) return false;
  if (activeKind === "section") return data.kind === "section";
  if (activeKind === "category") return data.kind === "category" || data.kind === "category-list";
  // Un producto cae sobre otro producto, sobre una lista de productos o
  // sobre una categoría (al final).
  return data.kind === "item" || data.kind === "item-list" || data.kind === "category";
};

const belongsTo = (data: ReorderData, list: ReorderData): boolean =>
  (list.kind === "item-list" && data.kind === "item" && data.catId === list.catId)
  || (list.kind === "category-list" && data.kind === "category" && data.sectionKey === list.sectionKey);

// Altura a la que va lo que se arrastra: la del puntero (el nodo puede ser una
// categoría entera, mucho más alta que la vista previa) o, con el teclado, el
// centro del nodo desplazado.
const draggedY = ({ activatorEvent, delta, active }: DragOverEvent): number | null => {
  if (activatorEvent && "clientY" in activatorEvent && typeof activatorEvent.clientY === "number") {
    return activatorEvent.clientY + delta.y;
  }
  const rect = active.rect.current.translated;
  return rect ? rect.top + rect.height / 2 : null;
};

// Posición al entrar a otra lista: antes del elemento que está debajo, o
// después si ya se pasó su mitad.
const indexNear = (overIndex: number, length: number, event: DragOverEvent, over: Over) => {
  if (overIndex < 0) return length;
  const y = draggedY(event);
  const below = y != null && y > over.rect.top + over.rect.height / 2;
  return overIndex + (below ? 1 : 0);
};

// ── Lector de pantalla ──────────────────────────────────────────────────────

const describe = (data: ReorderData | undefined): string => {
  if (!data) return "el elemento";
  switch (data.kind) {
    case "section": return `la sección «${data.title}»`;
    case "category": return `la categoría «${data.title}»`;
    case "item": return `el producto «${data.title}»`;
    case "category-list": return `las categorías de «${data.title}»`;
    case "item-list": return `los productos de «${data.title}»`;
  }
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const dataOf = (entry: Active | Over | null) => entry?.data.current as ReorderData | undefined;

const announcements: Announcements = {
  onDragStart: ({ active }) => `Levantaste ${describe(dataOf(active))}.`,
  onDragOver: ({ active, over }) => over
    ? `${capitalize(describe(dataOf(active)))} está sobre ${describe(dataOf(over))}.`
    : `${capitalize(describe(dataOf(active)))} no está sobre ningún lugar donde se pueda soltar.`,
  onDragEnd: ({ active, over }) => over
    ? `Soltaste ${describe(dataOf(active))} sobre ${describe(dataOf(over))}.`
    : `Soltaste ${describe(dataOf(active))}. Quedó donde estaba.`,
  onDragCancel: ({ active }) => `Cancelaste el movimiento: ${describe(dataOf(active))} quedó donde estaba.`,
};

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable: "Para cambiarlo de lugar, presioná espacio o Enter. Movelo con las flechas, volvé a presionar "
    + "espacio o Enter para soltarlo, o Escape para cancelar.",
};

export function useMenuReorder({
  menuData, setMenuData, authHeaders, onUnauthorized, onSaveError, onItemAppended,
}: Options) {
  const [active, setActive] = useState<SortableData | null>(null);

  // Lo último de cada valor, para leerlo desde los handlers de dnd-kit y la
  // cola sin rehacerlos en cada render.
  const menuRef = useRef(menuData);
  const optionsRef = useRef({ authHeaders, onUnauthorized, onSaveError, onItemAppended });
  useLayoutEffect(() => {
    menuRef.current = menuData;
    optionsRef.current = { authHeaders, onUnauthorized, onSaveError, onItemAppended };
  });

  // El menú al empezar a arrastrar: a esto se vuelve si se cancela.
  const snapshotRef = useRef<MenuData | null>(null);
  // Evitan el parpadeo al pasar de una lista a otra (mismo criterio que el
  // ejemplo de varios contenedores de dnd-kit): mientras la lista recién
  // cambiada se vuelve a medir, se sigue apuntando al último destino.
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMoved = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { recentlyMoved.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [menuData]);

  // ── Cola de guardado ────────────────────────────────────────────────────

  const pendingRef = useRef(new Map<string, OrderSave>());
  const runningRef = useRef(false);
  const idleWaitersRef = useRef<(() => void)[]>([]);

  const flush = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (pendingRef.current.size > 0) {
        const [key, save] = pendingRef.current.entries().next().value as [string, OrderSave];
        pendingRef.current.delete(key);
        try {
          const res = await fetch(save.url, {
            method: "PATCH",
            headers: optionsRef.current.authHeaders,
            body: JSON.stringify(save.body),
          });
          if (res.status === 401) {
            pendingRef.current.clear();
            optionsRef.current.onUnauthorized();
            return;
          }
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            // 409: algo del pedido ya no existe (se borró o se movió desde otra
            // pestaña). Su mensaje pide recargar, y eso ya lo hace onSaveError.
            throw new OrderSaveError(res.status === 409
              ? "El menú cambió desde otra pestaña o dispositivo."
              : typeof data.message === "string" && data.message ? data.message : "No se pudo guardar el nuevo orden.");
          }
        } catch (err) {
          // Lo que seguía en cola partía del orden que no se pudo guardar.
          pendingRef.current.clear();
          const reason = err instanceof OrderSaveError ? err.message : "No se pudo guardar el nuevo orden.";
          optionsRef.current.onSaveError(`${reason} Volvimos a cargar el menú.`);
        }
      }
    } finally {
      runningRef.current = false;
      if (pendingRef.current.size === 0) idleWaitersRef.current.splice(0).forEach(resolve => resolve());
    }
  }, []);

  const enqueue = useCallback((save: OrderSave) => {
    pendingRef.current.set(save.key, save);
    void flush();
  }, [flush]);

  // Recargar el menú mientras hay un orden sin guardar lo pisaría con el
  // anterior: refetch espera a que la cola termine.
  const waitForSaves = useCallback((): Promise<void> => {
    if (!runningRef.current && pendingRef.current.size === 0) return Promise.resolve();
    return new Promise(resolve => { idleWaitersRef.current.push(resolve); });
  }, []);

  // ── Colisiones ──────────────────────────────────────────────────────────
  // Solo cuentan los destinos del mismo tipo que lo que se arrastra, y gana
  // el más puntual bajo el puntero: un producto antes que su lista, y la
  // lista antes que la categoría que la contiene.
  //
  // Todo se decide por el puntero y no por el rectángulo de la vista previa:
  // dnd-kit le da el tamaño del nodo original, y el centro de una sección o
  // una categoría entera queda lejos de donde está la mano (con teclado no
  // hay puntero, y ahí sí vale el rectángulo, que las flechas van moviendo).

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeData = args.active.data.current as SortableData | undefined;
    if (!activeData) return closestCenter(args);

    const droppableContainers = args.droppableContainers.filter(container =>
      accepts(activeData.kind, container.data.current as ReorderData | undefined));

    // dnd-kit corrige cada medida por lo que scrolleó la página desde que la
    // tomó. La columna de estructura es sticky: no se mueve con ese scroll, y
    // esa corrección la corría de lugar (soltar ahí fallaba después de hacer
    // scroll). Lo `pinned` se vuelve a medir acá, en coordenadas de pantalla
    // como el puntero; sin transform, igual que mide dnd-kit.
    const droppableRects = new Map(args.droppableRects);
    for (const container of droppableContainers) {
      const data = container.data.current as ReorderData | undefined;
      const node = container.node.current;
      if (data && "pinned" in data && data.pinned && node) {
        droppableRects.set(container.id, getClientRect(node, { ignoreTransform: true }));
      }
    }

    const pointer = args.pointerCoordinates;
    const scoped = {
      ...args,
      droppableContainers,
      droppableRects,
      collisionRect: pointer
        ? { top: pointer.y, bottom: pointer.y, left: pointer.x, right: pointer.x, width: 0, height: 0 }
        : args.collisionRect,
    };
    // Con el puntero en un hueco (entre tarjetas) no hay destino nuevo: sigue
    // el último (lastOverId, abajo).
    const hits = pointer ? pointerWithin(scoped) : rectIntersection(scoped);
    const hitOf = (kind: ReorderData["kind"]) => hits.find(hit =>
      (droppableContainers.find(container => container.id === hit.id)?.data.current as ReorderData | undefined)?.kind === kind);

    let overId: UniqueIdentifier | null = hitOf(activeData.kind)?.id ?? null;

    if (overId == null && activeData.kind !== "section") {
      const listHit = hitOf(activeData.kind === "item" ? "item-list" : "category-list");
      const list = droppableContainers.find(container => container.id === listHit?.id);
      const listData = list?.data.current as ReorderData | undefined;
      if (list && listData) {
        const members = droppableContainers.filter(container =>
          belongsTo(container.data.current as ReorderData, listData));
        overId = members.length > 0
          ? closestCenter({ ...scoped, droppableContainers: members })[0]?.id ?? list.id
          : list.id;
      }
    }

    if (overId == null && activeData.kind === "item") overId = hitOf("category")?.id ?? null;

    if (overId != null) {
      lastOverId.current = overId;
      return [{ id: overId }];
    }
    if (recentlyMoved.current) lastOverId.current = args.active.id;
    return lastOverId.current != null ? [{ id: lastOverId.current }] : [];
  }, []);

  // ── Arrastrar ───────────────────────────────────────────────────────────

  const handleDragStart = useCallback(({ active: dragged }: DragStartEvent) => {
    snapshotRef.current = menuRef.current;
    lastOverId.current = null;
    setActive(dragged.data.current as SortableData);
  }, []);

  // Pasar a otra lista se ve mientras se arrastra: el elemento se muda de
  // lista en el estado y la lista nueva le hace lugar. Dentro de la misma
  // lista lo resuelve la animación de dnd-kit, y el cambio se aplica al soltar.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active: dragged, over } = event;
    const data = dataOf(dragged) as SortableData | undefined;
    const overData = dataOf(over);
    const menu = menuRef.current;
    if (!data || !overData || !over || !menu || data.kind === "section") return;

    if (data.kind === "item") {
      const from = findItem(menu, data.id);
      const toCatId = overData.kind === "item"
        ? findItem(menu, overData.id)?.catId
        : overData.kind === "item-list" ? overData.catId : undefined;
      if (!from || !toCatId || toCatId === from.catId) return;
      const target = itemsIn(menu, toCatId);
      const index = overData.kind === "item"
        ? indexNear(target.findIndex(item => item._id === overData.id), target.length, event, over)
        : target.length;
      recentlyMoved.current = true;
      setMenuData(prev => prev && moveItem(prev, data.id, toCatId, index));
      return;
    }

    const from = findCategory(menu, data.id);
    const toSectionKey = overData.kind === "category"
      ? findCategory(menu, overData.id)?.sectionKey
      : overData.kind === "category-list" ? overData.sectionKey : undefined;
    if (!from || !toSectionKey || toSectionKey === from.sectionKey) return;
    const target = categoriesIn(menu, toSectionKey);
    const index = overData.kind === "category"
      ? indexNear(target.findIndex(categoria => categoria._id === overData.id), target.length, event, over)
      : target.length;
    recentlyMoved.current = true;
    setMenuData(prev => prev && moveCategory(prev, data.id, toSectionKey, index));
  }, [setMenuData]);

  const handleDragEnd = useCallback(({ active: dragged, over }: DragEndEvent) => {
    const data = dataOf(dragged) as SortableData | undefined;
    const overData = dataOf(over);
    const before = snapshotRef.current;
    snapshotRef.current = null;
    lastOverId.current = null;
    setActive(null);

    let menu = menuRef.current;
    if (!data || !before || !menu) return;
    if (!overData) {
      setMenuData(before);
      return;
    }

    let appendedTo: string | null = null;

    if (data.kind === "section") {
      const to = overData.kind === "section" ? menu.secciones.findIndex(seccion => seccion._id === overData.id) : -1;
      if (to !== -1) menu = moveSection(menu, data.id, to);
    } else if (data.kind === "category") {
      const from = findCategory(menu, data.id);
      const to = overData.kind === "category" ? findCategory(menu, overData.id) : null;
      if (from && to && from.sectionKey === to.sectionKey) menu = moveCategory(menu, data.id, to.sectionKey, to.index);
    } else {
      const from = findItem(menu, data.id);
      if (from && overData.kind === "item") {
        const to = findItem(menu, overData.id);
        if (to && to.catId === from.catId) menu = moveItem(menu, data.id, to.catId, to.index);
      } else if (from && overData.kind === "category" && overData.id !== from.catId) {
        menu = moveItem(menu, data.id, overData.id, itemsIn(menu, overData.id).length);
        appendedTo = overData.id;
      }
    }

    if (menu !== menuRef.current) setMenuData(menu);
    const save = saveAfterDrop(before, menu, data);
    if (save) enqueue(save);
    if (appendedTo) optionsRef.current.onItemAppended(data.id, appendedTo);
  }, [setMenuData, enqueue]);

  const handleDragCancel = useCallback(() => {
    const before = snapshotRef.current;
    snapshotRef.current = null;
    lastOverId.current = null;
    setActive(null);
    if (before) setMenuData(before);
  }, [setMenuData]);

  // Mouse: arranca recién a los 4 px, para que un click en la manija no
  // cuente como arrastre. Teclado: espacio o Enter sobre la manija.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return {
    active,
    sensors,
    collisionDetection,
    announcements,
    screenReaderInstructions,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    waitForSaves,
  };
}

export type MenuReorder = ReturnType<typeof useMenuReorder>;
