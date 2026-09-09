import { useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import { useAsyncAction } from "../../../../../hooks/useAsyncAction";
import {
  getLiteItems, getPendingImages, uploadLibraryImage, assignLibraryImages, deleteLibraryImage,
} from "../../../../../api/items";
import { useMobileDock } from "../../../../../context/useMobileDock";
import type { ItemLite, ImageAssignChange } from "../../../../../types";
import Spinner from "../../../../Common/Spinner";
import styles from "./ImageManager.module.css";

// ── Props ──────────────────────────────────────────────────────────────────

interface ImageManagerProps {
  onBack: () => void;
  onSuccess: () => void; // refetch del padre, para que el acordeón de productos refleje las fotos nuevas
}

// ── Estado interno de cada imagen mostrada en la grilla ─────────────────────
// Una imagen "pendiente" (sin producto todavía) tiene pickerRows = [""].
// Una imagen ya asignada tiene un pickerRow por cada producto que la usa hoy.
// "" en un pickerRow = selector vacío, todavía sin elegir producto.

interface TileState {
  clientId: string;
  imageUrl: string | null; // null mientras se está subiendo
  status: "uploading" | "ready" | "error" | "deleting";
  errorMessage?: string;
  pickerRows: string[];
  initialSelected: Set<string>; // foto inicial de qué productos tenía asignados, para el dirty-check
  sourceFile?: File; // se guarda solo mientras status es uploading/error, para poder reintentar
}

const MAX_IMAGE_MB = 5;
const UPLOAD_CONCURRENCY = 3;
const SEARCH_RESULTS_LIMIT = 8;

// Tamaño de grilla (PC): cuántas imágenes por línea — menos columnas implica
// imágenes más grandes, ya que cada una ocupa 1fr del ancho disponible.
const GRID_COLUMNS_STORAGE_KEY = "imageManager.gridColumns";
const DEFAULT_GRID_COLUMNS = 5;
const MIN_GRID_COLUMNS = 2;
const MAX_GRID_COLUMNS = 8;

const readStoredGridColumns = (): number => {
  const stored = Number(localStorage.getItem(GRID_COLUMNS_STORAGE_KEY));
  return Number.isInteger(stored) && stored >= MIN_GRID_COLUMNS && stored <= MAX_GRID_COLUMNS
    ? stored
    : DEFAULT_GRID_COLUMNS;
};

const normalizeSearchValue = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-AR")
    .trim();

const extractServerMessage = (cause: unknown): string | null =>
  isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message ?? null : null;

const buildTilesFromServer = (liteItems: ItemLite[], pendingImages: string[]): TileState[] => {
  const byImage = new Map<string, string[]>();
  liteItems.forEach((item) => {
    if (!item.image) return;
    const list = byImage.get(item.image) ?? [];
    list.push(item._id);
    byImage.set(item.image, list);
  });

  const pendingTiles: TileState[] = pendingImages.map((imageUrl) => ({
    clientId: imageUrl,
    imageUrl,
    status: "ready",
    pickerRows: [""],
    initialSelected: new Set<string>(),
  }));

  const assignedTiles: TileState[] = [...byImage.entries()].map(([imageUrl, itemIds]) => ({
    clientId: imageUrl,
    imageUrl,
    status: "ready",
    pickerRows: itemIds,
    initialSelected: new Set(itemIds),
  }));

  return [...pendingTiles, ...assignedTiles];
};

const isTileDirty = (tile: TileState) => {
  const current = new Set(tile.pickerRows.filter(Boolean));
  if (current.size !== tile.initialSelected.size) return true;
  for (const id of current) if (!tile.initialSelected.has(id)) return true;
  return false;
};

// ── Íconos ─────────────────────────────────────────────────────────────────

const icons = {
  back: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  close: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  plusLarge: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  upload: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
};

// ── Selector de producto (buscador + dropdown, o chip si ya hay elegido) ────

function ProductPicker({
  value,
  items,
  itemById,
  assignedItemIdSet,
  onlyPending,
  showRemove,
  onSelect,
  onRemove,
}: {
  value: string;
  items: ItemLite[];
  itemById: Map<string, ItemLite>;
  assignedItemIdSet: Set<string>;
  onlyPending: boolean;
  showRemove: boolean;
  onSelect: (itemID: string) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  if (value) {
    const item = itemById.get(value);
    const fullLabel = item ? `${item.title}${item.code ? ` · ${item.code}` : ""}` : "Producto no encontrado";
    return (
      <div className={styles.pickerChip}>
        <span className={styles.pickerChipText} title={fullLabel}>
          <span className={styles.pickerChipTitle}>{item ? item.title : "Producto no encontrado"}</span>
          {item?.code && <span className={styles.pickerChipCode}>{item.code}</span>}
        </span>
        <button type="button" className={styles.pickerChipRemove} onClick={onRemove} aria-label="Quitar producto">
          {icons.close}
        </button>
      </div>
    );
  }

  const normalized = normalizeSearchValue(query);
  const results = normalized
    ? items
        .filter((item) => !onlyPending || !assignedItemIdSet.has(item._id))
        .filter((item) => {
          const haystack = `${normalizeSearchValue(item.title)} ${normalizeSearchValue(item.code)}`;
          return haystack.includes(normalized);
        })
        .slice(0, SEARCH_RESULTS_LIMIT)
    : [];

  return (
    <div className={styles.pickerBox}>
      <input
        type="text"
        className={styles.pickerInput}
        placeholder="Buscar producto por nombre o código…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && normalized && (
        <ul className={styles.pickerDropdown}>
          {results.length === 0 && <li className={styles.pickerDropdownEmpty}>Sin resultados</li>}
          {results.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                className={styles.pickerDropdownItem}
                title={`${item.title}${item.code ? ` · ${item.code}` : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(item._id); setQuery(""); setOpen(false); }}
              >
                <span className={styles.pickerDropdownTitle}>{item.title}</span>
                {item.code && <span className={styles.pickerDropdownCode}>{item.code}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showRemove && (
        <button type="button" className={styles.pickerRowRemove} onClick={onRemove} aria-label="Quitar este selector">
          {icons.close}
        </button>
      )}
    </div>
  );
}

// ── Tile de imagen ───────────────────────────────────────────────────────────

function ImageTile({
  tile,
  items,
  itemById,
  assignedItemIdSet,
  onlyPending,
  onSelectProduct,
  onRemoveProduct,
  onAddRow,
  onRetry,
  onDismiss,
  onDelete,
}: {
  tile: TileState;
  items: ItemLite[];
  itemById: Map<string, ItemLite>;
  assignedItemIdSet: Set<string>;
  onlyPending: boolean;
  onSelectProduct: (rowIndex: number, itemID: string) => void;
  onRemoveProduct: (rowIndex: number) => void;
  onAddRow: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onDelete: () => void;
}) {
  const canAddRow = tile.pickerRows.length > 0 && tile.pickerRows[tile.pickerRows.length - 1] !== "";

  return (
    <div className={styles.tile}>
      <div className={styles.tileThumbWrap}>
        {tile.imageUrl
          ? <img src={tile.imageUrl} alt="" className={styles.tileThumb} />
          : <div className={styles.tileThumbPlaceholder} />}

        {tile.status === "ready" && (
          <button
            type="button"
            className={styles.tileDeleteBtn}
            onClick={onDelete}
            aria-label="Eliminar imagen"
            title="Eliminar imagen"
          >
            {icons.trash}
          </button>
        )}

        {tile.status === "uploading" && (
          <div className={styles.tileOverlay}>
            <Spinner size={20} label="Subiendo imagen" />
          </div>
        )}

        {tile.status === "deleting" && (
          <div className={styles.tileOverlay}>
            <Spinner size={20} label="Eliminando imagen" />
          </div>
        )}

        {tile.status === "error" && (
          <div className={styles.tileOverlayError}>
            <span>{tile.errorMessage || "No se pudo subir"}</span>
            <div className={styles.tileErrorActions}>
              {tile.sourceFile && (
                <button type="button" className={styles.tileErrorBtn} onClick={onRetry}>Reintentar</button>
              )}
              <button type="button" className={styles.tileErrorBtn} onClick={onDismiss}>Quitar</button>
            </div>
          </div>
        )}
      </div>

      {tile.status === "ready" && tile.imageUrl && (
        <div className={styles.tilePickers}>
          {tile.pickerRows.map((itemID, rowIndex) => (
            <ProductPicker
              key={rowIndex}
              value={itemID}
              items={items}
              itemById={itemById}
              assignedItemIdSet={assignedItemIdSet}
              onlyPending={onlyPending}
              showRemove={rowIndex > 0 || Boolean(itemID)}
              onSelect={(id) => onSelectProduct(rowIndex, id)}
              onRemove={() => onRemoveProduct(rowIndex)}
            />
          ))}
          {canAddRow && (
            <button type="button" className={styles.addRowBtn} onClick={onAddRow}>
              {icons.plus} Agregar otro producto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal de confirmación de borrado ─────────────────────────────────────────

function DeleteConfirmModal({
  assignedCount,
  onConfirm,
  onCancel,
}: {
  assignedCount: number;
  onConfirm: (skipNextTime: boolean) => void;
  onCancel: () => void;
}) {
  const [skipNextTime, setSkipNextTime] = useState(false);

  // Portal a document.body: mismo motivo que UpgradeModal.tsx — el gestor
  // vive bastante anidado dentro del panel, y sin portal el overlay solo
  // gana el z-index DENTRO de ese contexto de apilamiento.
  return createPortal(
    <div className={styles.confirmOverlay} onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="delete-image-title">
      <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
        <h3 id="delete-image-title" className={styles.confirmTitle}>Eliminar imagen</h3>
        <p className={styles.confirmText}>
          {assignedCount > 0
            ? `Está asignada a ${assignedCount} producto${assignedCount > 1 ? "s" : ""}. Si la eliminás, ese${assignedCount > 1 ? "s" : ""} producto${assignedCount > 1 ? "s" : ""} queda${assignedCount > 1 ? "n" : ""} sin foto. `
            : "No está asignada a ningún producto. "}
          Esta acción no se puede deshacer.
        </p>
        <label className={styles.confirmCheckbox}>
          <input
            type="checkbox"
            checked={skipNextTime}
            onChange={(e) => setSkipNextTime(e.target.checked)}
          />
          No volver a preguntar (hasta cerrar el gestor de imágenes)
        </label>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.confirmCancelBtn} onClick={onCancel}>Cancelar</button>
          <button type="button" className={styles.confirmDeleteBtn} onClick={() => onConfirm(skipNextTime)}>
            {icons.trash} Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ImageManager({ onBack, onSuccess }: ImageManagerProps) {
  const loadState = useAsyncAction();
  const saveState = useAsyncAction();
  const deleteState = useAsyncAction();

  const [items, setItems] = useState<ItemLite[]>([]);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [onlyPending, setOnlyPending] = useState(false);
  const [gridColumns, setGridColumns] = useState<number>(readStoredGridColumns);
  // "No volver a preguntar" es por sesión de uso del gestor: vive en un
  // useState normal (no localStorage/sessionStorage) a propósito, así que se
  // resetea solo la próxima vez que se monte el componente — que es
  // exactamente cuando se vuelve a abrir el gestor (MenuEditor.tsx desmonta
  // ImageManager por completo al salir de la vista "image-manager").
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);
  const [pendingDeleteTile, setPendingDeleteTile] = useState<TileState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(GRID_COLUMNS_STORAGE_KEY, String(gridColumns));
  }, [gridColumns]);

  // El gestor ya tiene su propio botón de "volver" arriba a la izquierda —
  // el dock de navegación mobile de DashboardLayout no aporta nada acá y
  // solo tapa contenido, así que se oculta mientras esta vista está montada.
  const { hide: hideMobileDock, show: showMobileDock } = useMobileDock();
  useEffect(() => {
    hideMobileDock();
    return () => showMobileDock();
  }, [hideMobileDock, showMobileDock]);

  const loadData = useCallback(async () => {
    await loadState.run(async () => {
      try {
        const [liteItems, pendingImages] = await Promise.all([getLiteItems(), getPendingImages()]);
        setItems(liteItems);
        setTiles(buildTilesFromServer(liteItems, pendingImages));
      } catch (cause) {
        throw new Error(extractServerMessage(cause) || "No se pudieron cargar las imágenes.", { cause });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const itemById = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);

  const assignedItemIdSet = useMemo(() => {
    const set = new Set<string>();
    tiles.forEach((tile) => tile.pickerRows.forEach((id) => { if (id) set.add(id); }));
    return set;
  }, [tiles]);

  const itemsWithoutImageCount = useMemo(
    () => items.filter((item) => !assignedItemIdSet.has(item._id)).length,
    [items, assignedItemIdSet]
  );

  const visibleTiles = onlyPending
    ? tiles.filter((tile) => tile.pickerRows.filter(Boolean).length === 0)
    : tiles;

  const dirtyTiles = tiles.filter((tile) => tile.status === "ready" && tile.imageUrl && isTileDirty(tile));
  const anyUploading = tiles.some((tile) => tile.status === "uploading");
  const saveDisabled = dirtyTiles.length === 0 || saveState.loading || anyUploading;

  // ── Subida de imágenes ─────────────────────────────────────────────────────

  const uploadOne = useCallback(async (file: File, clientId: string) => {
    try {
      const { imageUrl } = await uploadLibraryImage(file);
      setTiles((prev) => prev.map((t) => (
        t.clientId === clientId ? { ...t, imageUrl, status: "ready", sourceFile: undefined } : t
      )));
    } catch (cause) {
      const message = extractServerMessage(cause) || "No se pudo subir la imagen.";
      setTiles((prev) => prev.map((t) => (
        t.clientId === clientId ? { ...t, status: "error", errorMessage: message } : t
      )));
    }
  }, []);

  const runUploads = useCallback(async (queue: { file: File; clientId: string }[]) => {
    let index = 0;
    const worker = async () => {
      while (index < queue.length) {
        const current = queue[index];
        index += 1;
        await uploadOne(current.file, current.clientId);
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker));
  }, [uploadOne]);

  const handleFilesSelected = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const toUpload: { file: File; clientId: string }[] = [];

    // Se arma toUpload/newTiles ANTES de tocar el estado: el updater de
    // setTiles puede correr diferido (batching de React), así que mutar un
    // array de afuera desde adentro del updater y leerlo justo después, como
    // se hacía antes, corría el riesgo de leerlo todavía vacío.
    const newTiles: TileState[] = files.map((file) => {
      const clientId = crypto.randomUUID();
      if (!file.type.startsWith("image/")) {
        return {
          clientId, imageUrl: null, status: "error",
          errorMessage: "El archivo debe ser una imagen.", pickerRows: [""], initialSelected: new Set<string>(),
        };
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        return {
          clientId, imageUrl: null, status: "error",
          errorMessage: `No puede superar los ${MAX_IMAGE_MB}MB.`, pickerRows: [""], initialSelected: new Set<string>(),
        };
      }
      toUpload.push({ file, clientId });
      return {
        clientId, imageUrl: null, status: "uploading",
        pickerRows: [""], initialSelected: new Set<string>(), sourceFile: file,
      };
    });

    setTiles((prev) => [...newTiles, ...prev]);

    if (toUpload.length > 0) runUploads(toUpload);
  }, [runUploads]);

  const retryUpload = useCallback((clientId: string, file: File) => {
    setTiles((prev) => prev.map((t) => (
      t.clientId === clientId ? { ...t, status: "uploading", errorMessage: undefined } : t
    )));
    uploadOne(file, clientId);
  }, [uploadOne]);

  const dismissTile = useCallback((clientId: string) => {
    setTiles((prev) => prev.filter((t) => t.clientId !== clientId));
  }, []);

  // ── Eliminar una imagen (Cloudinary + productos/pendientes) ─────────────────

  const performDelete = useCallback(async (tile: TileState) => {
    if (tile.status !== "ready" || !tile.imageUrl) return;
    const imageUrl = tile.imageUrl;

    setTiles((prev) => prev.map((t) => (t.clientId === tile.clientId ? { ...t, status: "deleting" } : t)));

    await deleteState.run(async () => {
      try {
        await deleteLibraryImage(imageUrl);
      } catch (cause) {
        throw new Error(extractServerMessage(cause) || "No se pudo eliminar la imagen.", { cause });
      }
      setTiles((prev) => prev.filter((t) => t.clientId !== tile.clientId));
      setItems((prev) => prev.map((item) => (item.image === imageUrl ? { ...item, image: "" } : item)));
      onSuccess();
    }, { successMessage: "Imagen eliminada." });

    // Si falló, la tile sigue en la lista (no se filtró arriba) — la
    // devolvemos a "ready" para que se pueda reintentar.
    setTiles((prev) => prev.map((t) => (
      t.clientId === tile.clientId && t.status === "deleting" ? { ...t, status: "ready" } : t
    )));
  }, [deleteState, onSuccess]);

  // Pedido del usuario: la confirmación nativa (window.confirm) se reemplazó
  // por un modal propio con un tilde "no volver a preguntar" — ver
  // DeleteConfirmModal más arriba. skipDeleteConfirm dura lo que dura el
  // componente montado (por sesión de uso del gestor), no para siempre.
  const requestDelete = useCallback((tile: TileState) => {
    if (tile.status !== "ready" || !tile.imageUrl) return;
    if (skipDeleteConfirm) {
      performDelete(tile);
      return;
    }
    setPendingDeleteTile(tile);
  }, [skipDeleteConfirm, performDelete]);

  const confirmDelete = useCallback((skipNextTime: boolean) => {
    if (skipNextTime) setSkipDeleteConfirm(true);
    const tile = pendingDeleteTile;
    setPendingDeleteTile(null);
    if (tile) performDelete(tile);
  }, [pendingDeleteTile, performDelete]);

  const cancelDelete = useCallback(() => setPendingDeleteTile(null), []);

  // ── Selección de productos ──────────────────────────────────────────────────

  const selectProduct = useCallback((tileClientId: string, rowIndex: number, itemID: string) => {
    setTiles((prev) => prev.map((t) => {
      if (t.clientId === tileClientId) {
        const nextRows = [...t.pickerRows];
        nextRows[rowIndex] = itemID;
        return { ...t, pickerRows: nextRows };
      }
      // Si ese producto ya estaba elegido en otra imagen, se la "lleva" para
      // acá — nunca puede quedar el mismo producto asignado a dos imágenes
      // distintas al guardar.
      if (t.pickerRows.includes(itemID)) {
        const filtered = t.pickerRows.filter((id) => id !== itemID);
        return { ...t, pickerRows: filtered.length > 0 ? filtered : [""] };
      }
      return t;
    }));
  }, []);

  const removeProductRow = useCallback((tileClientId: string, rowIndex: number) => {
    setTiles((prev) => prev.map((t) => {
      if (t.clientId !== tileClientId) return t;
      if (t.pickerRows.length <= 1) return { ...t, pickerRows: [""] };
      return { ...t, pickerRows: t.pickerRows.filter((_, i) => i !== rowIndex) };
    }));
  }, []);

  const addProductRow = useCallback((tileClientId: string) => {
    setTiles((prev) => prev.map((t) => (
      t.clientId === tileClientId && t.pickerRows[t.pickerRows.length - 1] !== ""
        ? { ...t, pickerRows: [...t.pickerRows, ""] }
        : t
    )));
  }, []);

  // ── Guardar cambios ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const dirty = tiles.filter((tile) => tile.status === "ready" && tile.imageUrl && isTileDirty(tile));
    if (dirty.length === 0) return;

    const changes: ImageAssignChange[] = dirty.map((tile) => ({
      imageUrl: tile.imageUrl as string,
      itemIDs: [...new Set(tile.pickerRows.filter(Boolean))],
    }));

    await saveState.run(async () => {
      try {
        await assignLibraryImages(changes);
      } catch (cause) {
        throw new Error(extractServerMessage(cause) || "No se pudieron guardar los cambios.", { cause });
      }
      await loadData();
      onSuccess();
    }, { successMessage: "Cambios guardados." });
  }, [tiles, saveState, loadData, onSuccess]);

  const errorMessage = loadState.error || saveState.error || deleteState.error;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Volver al menú" title="Volver">
          {icons.back}
        </button>
        <div className={styles.headerTitle}>
          <span className={styles.headerTitleText}>Gestor de imágenes</span>
          {items.length > 0 && (
            <span className={styles.headerSubtitle}>
              {itemsWithoutImageCount} de {items.length} productos sin foto
            </span>
          )}
        </div>
        <button type="button" className={styles.saveBtn} disabled={saveDisabled} onClick={handleSave}>
          {saveState.loading ? <Spinner size={16} /> : null}
          Guardar cambios{dirtyTiles.length > 0 ? ` (${dirtyTiles.length})` : ""}
        </button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.onlyPendingToggle}>
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
          />
          Mostrar solo pendientes
        </label>
        {/* Solo tiene sentido en pantallas anchas: en mobile el ancho de columna ya
            se resuelve solo (ver breakpoint en el CSS) y se oculta con display:none. */}
        <label className={styles.gridSizeControl} title="Tamaño de la grilla (solo en PC)">
          <span className={styles.gridSizeLabel}>Imágenes por fila: {gridColumns}</span>
          <input
            type="range"
            min={MIN_GRID_COLUMNS}
            max={MAX_GRID_COLUMNS}
            step={1}
            value={gridColumns}
            onChange={(e) => setGridColumns(Number(e.target.value))}
            className={styles.gridSizeSlider}
            aria-label="Cantidad de imágenes por fila"
          />
        </label>
        <button type="button" className={styles.stockPlaceholder} disabled title="Próximamente">
          Imágenes prediseñadas (Próximamente)
        </button>
      </div>

      {errorMessage && <div className={styles.errorBanner} role="alert">{errorMessage}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ""; }}
      />

      {loadState.loading ? (
        <div className={styles.loadingState}><Spinner size={24} label="Cargando imágenes" /></div>
      ) : tiles.length === 0 ? (
        <button type="button" className={styles.emptyState} onClick={() => fileInputRef.current?.click()}>
          <span className={styles.emptyStateIcon}>{icons.upload}</span>
          <span>Seleccioná imágenes para importar</span>
        </button>
      ) : (
        <div className={styles.grid} style={{ "--tile-columns": gridColumns } as CSSProperties}>
          {visibleTiles.map((tile) => (
            <ImageTile
              key={tile.clientId}
              tile={tile}
              items={items}
              itemById={itemById}
              assignedItemIdSet={assignedItemIdSet}
              onlyPending={onlyPending}
              onSelectProduct={(rowIndex, itemID) => selectProduct(tile.clientId, rowIndex, itemID)}
              onRemoveProduct={(rowIndex) => removeProductRow(tile.clientId, rowIndex)}
              onAddRow={() => addProductRow(tile.clientId)}
              onRetry={() => tile.sourceFile && retryUpload(tile.clientId, tile.sourceFile)}
              onDismiss={() => dismissTile(tile.clientId)}
              onDelete={() => requestDelete(tile)}
            />
          ))}
        </div>
      )}

      {/* Botón flotante de "agregar imágenes": reemplaza al tile "+" que antes
          vivía al final de la grilla — con muchas imágenes cargadas, había que
          scrollear hasta el fondo para encontrarlo. Portal a document.body por
          el mismo motivo que el modal: position:fixed necesita no tener un
          ancestro con su propio contexto de apilamiento en el medio. Se oculta
          en el estado vacío (tiles.length === 0), donde ese caso ya lo cubre
          el botón grande de emptyState de arriba. */}
      {tiles.length > 0 && createPortal(
        <button
          type="button"
          className={styles.fabAddBtn}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Agregar imágenes"
          title="Agregar imágenes"
        >
          {icons.plusLarge}
        </button>,
        document.body,
      )}

      {pendingDeleteTile && (
        <DeleteConfirmModal
          assignedCount={pendingDeleteTile.pickerRows.filter(Boolean).length}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}
