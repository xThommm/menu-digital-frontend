import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { isAxiosError } from "axios";
import { useAsyncAction } from "../../../../../hooks/useAsyncAction";
import { getLiteItems, getPendingImages, uploadLibraryImage, assignLibraryImages } from "../../../../../api/items";
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
  status: "uploading" | "ready" | "error";
  errorMessage?: string;
  pickerRows: string[];
  initialSelected: Set<string>; // foto inicial de qué productos tenía asignados, para el dirty-check
  sourceFile?: File; // se guarda solo mientras status es uploading/error, para poder reintentar
}

const MAX_IMAGE_MB = 5;
const UPLOAD_CONCURRENCY = 3;
const SEARCH_RESULTS_LIMIT = 8;

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
  upload: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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
    return (
      <div className={styles.pickerChip}>
        <span className={styles.pickerChipText}>
          {item ? item.title : "Producto no encontrado"}
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
}) {
  const canAddRow = tile.pickerRows.length > 0 && tile.pickerRows[tile.pickerRows.length - 1] !== "";

  return (
    <div className={styles.tile}>
      <div className={styles.tileThumbWrap}>
        {tile.imageUrl
          ? <img src={tile.imageUrl} alt="" className={styles.tileThumb} />
          : <div className={styles.tileThumbPlaceholder} />}

        {tile.status === "uploading" && (
          <div className={styles.tileOverlay}>
            <Spinner size={20} label="Subiendo imagen" />
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

// ── Componente principal ─────────────────────────────────────────────────────

export default function ImageManager({ onBack, onSuccess }: ImageManagerProps) {
  const loadState = useAsyncAction();
  const saveState = useAsyncAction();

  const [items, setItems] = useState<ItemLite[]>([]);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [onlyPending, setOnlyPending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const errorMessage = loadState.error || saveState.error;

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
        <div className={styles.grid}>
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
            />
          ))}
          <button type="button" className={styles.addTile} onClick={() => fileInputRef.current?.click()}>
            {icons.plus}
            <span>Agregar imágenes</span>
          </button>
        </div>
      )}
    </div>
  );
}
