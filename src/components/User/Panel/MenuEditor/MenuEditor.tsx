import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { useAuth } from "../../../../context/useAuth";
import MassiveImport from "../../../../Utils/MassiveImport";
import styles from "./MenuEditor.module.css";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Item {
  _id: string;
  title: string;
  description: string;
  price: number | null;
  offerPrice: number | null;
  options: Record<string, number>;
  image: string;
  available: boolean;
  hidden: boolean;
  recommended: boolean;
  code: string;
}

interface Categoria {
  _id: string;
  title: string;
  description: string | null;
  image: string;
  hidden: boolean;
  code: string;
  items: Item[];
}

interface Seccion {
  _id: string;
  title: string;
  hidden: boolean;
  code: string;
  categorias: Categoria[];
}

interface MenuData {
  secciones: Seccion[];
  sinSeccion: Categoria[];
}

// ── Estado vacío para formulario de item ───────────────────────────────────────

interface OptionRow {
  key: string;
  value: string;
}

interface ItemFormState {
  title: string;
  description: string;
  price: string;
  offerPrice: string;
  code: string;
  image: string;
  available: boolean;
  hidden: boolean;
  recommended: boolean;
  options: OptionRow[];
}

const EMPTY_ITEM: ItemFormState = {
  title: "",
  description: "",
  price: "",
  offerPrice: "",
  code: "",
  image: "",
  available: true,
  hidden: false,
  recommended: false,
  options: [],
};

// ── Subida de imagen de producto (directo a Cloudinary, sin passar por el backend) ──

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/dbzqq1del/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "menu_items";
const MAX_IMAGE_MB = 5;

// ── Vistas posibles ────────────────────────────────────────────────────────────

type View = "menu" | "item-form" | "categoria-form" | "seccion-form" | "massive-import";

// ── Íconos ─────────────────────────────────────────────────────────────────────

const icons = {
  upload: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  menu: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  ),
  folder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  ),
  layers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  chevron: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  back: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ── Toggle sub-componente ──────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.on : ""}`}
      onClick={onChange}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

// ── TopBar sub-componente ─────────────────────────────────────────────────────

function TopBar({ title, onBack, rightSlot }: { title: string; onBack: () => void; rightSlot?: React.ReactNode }) {
  return (
    <header className={styles.topBar}>
      <button
        className={styles.backBtn}
        onClick={onBack}
        type="button"
        aria-label="Volver al menú"
        title="Volver"
      >
        {icons.back}
      </button>
      <span className={styles.topTitle}>{title}</span>
      <div style={{ width: 36 }} aria-hidden="true">
        {rightSlot}
      </div>
    </header>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className={styles.spinner} width={size} height={size} viewBox="0 0 24 24"
      fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

// ── CategoriaAcordeon (memoizado) ─────────────────────────────────────────────

interface CategoriaAcordeonProps {
  cat: Categoria;
  expanded: boolean;
  onToggle: () => void;
  onEditCat: () => void;
  onDeleteCat: () => void;
  onNewItem: () => void;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onToggleAvailable: (item: Item) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragOver: (e: React.DragEvent, catId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, catId: string) => void;
  onDragEnd: () => void;
  dragOverCat: string | null;
  draggedItem: string | null;
}

const CategoriaAcordeon = memo(function CategoriaAcordeon({
  cat, expanded, onToggle, onEditCat, onDeleteCat, onNewItem,
  onEditItem, onDeleteItem, onToggleAvailable, onDragStart,
  onDragOver, onDragLeave, onDrop, onDragEnd, dragOverCat, draggedItem,
}: CategoriaAcordeonProps) {
  const isDragOver = dragOverCat === cat._id;
  const itemCount  = cat.items?.length ?? 0;

  return (
    <div className={styles.catAcordeon}>
      {/* Header */}
      <div className={`${styles.catHeader} ${expanded ? styles.open : ""}`}>
        <button
          className={styles.catChevronBtn}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Contraer ${cat.title}` : `Expandir ${cat.title}`}
        >
          <span className={`${styles.catChevron} ${expanded ? styles.open : ""}`}>
            {icons.chevron}
          </span>
        </button>

        <button className={styles.catHeaderInfo} onClick={onToggle} type="button">
          <span className={styles.catHeaderName}>{cat.title}</span>
          <span className={styles.catHeaderMeta}>
            {itemCount === 0 ? "Sin productos" : `${itemCount} producto${itemCount !== 1 ? "s" : ""}`}
            {cat.hidden ? " · oculta" : ""}
          </span>
        </button>

        <div className={styles.rowActions}>
          <button
            className={styles.iconBtn}
            onClick={onEditCat}
            title="Editar categoría"
            aria-label={`Editar ${cat.title}`}
          >
            {icons.edit}
          </button>
          <button
            className={`${styles.iconBtn} ${styles.danger}`}
            onClick={onDeleteCat}
            title="Eliminar categoría"
            aria-label={`Eliminar ${cat.title}`}
          >
            {icons.trash}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div
          className={`${styles.catBody} ${isDragOver ? styles.dragOver : ""}`}
          onDragOver={e => onDragOver(e, cat._id)}
          onDragLeave={onDragLeave}
          onDrop={e => onDrop(e, cat._id)}
          role="list"
          aria-label={`Productos de ${cat.title}`}
        >
          {itemCount === 0 && (
            <p className={styles.emptyHint} style={{ padding: "1.25rem", textAlign: "center" }}>
              Arrastrá productos aquí o usá el botón de abajo.
            </p>
          )}

          {cat.items?.map(item => (
            <div
              key={item._id}
              role="listitem"
              className={`${styles.itemRowAc} ${draggedItem === item._id ? styles.dragging : ""}`}
              draggable
              onDragStart={e => onDragStart(e, item._id)}
              onDragEnd={onDragEnd}
            >
              {/* Handle drag */}
              <span className={styles.dragHandle} aria-hidden="true">
                <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                  <circle cx="4" cy="3"  r="1.5" fill="currentColor" />
                  <circle cx="4" cy="8"  r="1.5" fill="currentColor" />
                  <circle cx="4" cy="13" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="3"  r="1.5" fill="currentColor" />
                  <circle cx="8" cy="8"  r="1.5" fill="currentColor" />
                  <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                </svg>
              </span>

              <button className={styles.itemInfoAc} onClick={() => onEditItem(item)} type="button">
                <span className={styles.itemNameAc}>{item.title}</span>
                <span className={styles.itemMetaAc}>
                  {item.price != null
                    ? `$${item.price.toLocaleString("es-AR")}`
                    : Object.keys(item.options || {}).length > 0
                      ? "Con variantes"
                      : "Sin precio"}
                  {item.offerPrice != null && (
                    <span className={styles.itemOffer}>
                      {` · Oferta $${item.offerPrice.toLocaleString("es-AR")}`}
                    </span>
                  )}
                  {item.hidden     ? " · oculto" : ""}
                  {item.recommended ? " · ⭐" : ""}
                </span>
              </button>

              <div className={styles.itemActions}>
                <button
                  className={`${styles.pillBtn} ${item.available ? styles.pillOn : styles.pillOff}`}
                  onClick={() => onToggleAvailable(item)}
                  aria-label={item.available ? `Pausar ${item.title}` : `Activar ${item.title}`}
                  type="button"
                >
                  {item.available ? "Activo" : "Pausado"}
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={() => onDeleteItem(item)}
                  title="Eliminar"
                  aria-label={`Eliminar ${item.title}`}
                  type="button"
                >
                  {icons.trash}
                </button>
              </div>
            </div>
          ))}

          <div className={styles.catFooter}>
            <button className={styles.addItemBtn} onClick={onNewItem} type="button">
              + Agregar producto
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Componente principal ───────────────────────────────────────────────────────

export default function MenuEditorPage() {
  const { token } = useAuth();

  const [menuData,    setMenuData]    = useState<MenuData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const [imageUploading, setImageUploading] = useState(false);
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const [view,            setView]            = useState<View>("menu");
  const [menuSheetOpen,   setMenuSheetOpen]   = useState(false);
  const [activeCategoria, setActiveCategoria] = useState<Categoria | null>(null);
  const [activeItem,      setActiveItem]      = useState<Item | null>(null);
  const [expandedCats,    setExpandedCats]    = useState<Set<string>>(new Set());

  const [deleteModal, setDeleteModal] = useState<{
    type: "item" | "categoria" | "seccion";
    id: string;
    name: string;
  } | null>(null);

  const [itemForm,      setItemForm]      = useState(EMPTY_ITEM);
  const [categoriaForm, setCategoriaForm] = useState({ title: "", description: "", code: "", seccionID: "", editingId: "" });
  const [seccionForm,   setSeccionForm]   = useState({ title: "", code: "", editingId: "" });

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  // ── Auto-clear error banner ─────────────────────────────────────────────────

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        // Endpoint autenticado del propio dueño: a diferencia de la carta
        // pública, incluye secciones/categorías/items ocultos para que se
        // puedan gestionar (reactivar) desde el editor.
        const menuRes  = await fetch("/api/users/me/menu", { headers: { Authorization: `Bearer ${token}` } });
        if (!menuRes.ok) throw new Error();
        const menuJson = await menuRes.json();
        setMenuData(menuJson.menu);
      } catch {
        setError("No se pudo cargar el menú. Intentá recargar la página.");
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [token]);

  // ── Refresca el menú desde el backend ──────────────────────────────────────

  const refetch = useCallback(async () => {
    try {
      const menuRes  = await fetch("/api/users/me/menu", { headers: { Authorization: `Bearer ${token}` } });
      const menuJson = await menuRes.json();
      setMenuData(menuJson.menu);

      if (activeCategoria) {
        const todas = [
          ...(menuJson.menu.sinSeccion ?? []),
          ...(menuJson.menu.secciones ?? []).flatMap((s: Seccion) => s.categorias),
        ];
        const actualizada = todas.find((c: Categoria) => c._id === activeCategoria._id);
        if (actualizada) setActiveCategoria(actualizada);
      }
    } catch {
      setError("No se pudo actualizar el menú.");
    }
  }, [token, activeCategoria]);

  // ── Acordeón ──────────────────────────────────────────────────────────────

  const toggleCat = useCallback((id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Handlers ITEMS ────────────────────────────────────────────────────────

  const openNewItem = useCallback((cat: Categoria) => {
    setActiveCategoria(cat);
    setActiveItem(null);
    setItemForm(EMPTY_ITEM);
    setError("");
    setView("item-form");
  }, []);

  const openEditItem = useCallback((item: Item, cat: Categoria) => {
    setActiveCategoria(cat);
    setActiveItem(item);
    setItemForm({
      title:       item.title,
      description: item.description || "",
      price:       item.price?.toString()      || "",
      offerPrice:  item.offerPrice?.toString() || "",
      code:        item.code || "",
      available:   item.available,
      hidden:      item.hidden,
      recommended: item.recommended,
      image: item.image || "",
      options:     Object.entries(item.options || {}).map(([key, value]) => ({ key, value: value.toString() })),
    });
    setError("");
    setView("item-form");
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo más adelante

    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("El archivo debe ser una imagen."); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`La imagen no puede superar los ${MAX_IMAGE_MB}MB.`); return; }

    setImageUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const res  = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.secure_url) throw new Error();

      setItemForm(f => ({ ...f, image: data.secure_url }));
    } catch {
      setError("No se pudo subir la imagen.");
    } finally {
      setImageUploading(false);
    }
  }, []);

  const removeItemImage = useCallback(() => {
    setItemForm(f => ({ ...f, image: "" }));
  }, []);

  const saveItem = async () => {
    if (!itemForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    if (!itemForm.code.trim()) { setError("El código es obligatorio."); return; }
    if (!itemForm.price.trim()) { setError("El precio es obligatorio."); return; }
    if (itemForm.price !== "" && isNaN(Number(itemForm.price))) { setError("El precio debe ser un número."); return; }
    if (itemForm.price !== "" && (!Number(itemForm.price) || Number(itemForm.price) <= 0)) { setError("El precio debe ser un número positivo."); return; }
    if (itemForm.offerPrice !== "" && isNaN(Number(itemForm.offerPrice))) { setError("El precio de oferta debe ser un número."); return; }
    if (itemForm.offerPrice !== "" && (!Number(itemForm.offerPrice) || Number(itemForm.offerPrice) <= 0)) { setError("El precio de oferta debe ser un número positivo."); return; }
    setSaving(true); setError("");

    try {
      const optionsObj: Record<string, number> = {};
      itemForm.options.forEach(({ key, value }) => {
        if (key.trim()) optionsObj[key.trim()] = Number(value) || 0;
      });
      const body = {
        menuID: activeCategoria!._id,
        title: itemForm.title.trim(),
        description: itemForm.description,
        image: itemForm.image,
        price: itemForm.price !== "" ? Number(itemForm.price) : null,
        offerPrice: itemForm.offerPrice !== "" ? Number(itemForm.offerPrice) : null,
        code: itemForm.code,
        available: itemForm.available,
        hidden: itemForm.hidden,
        recommended: itemForm.recommended,
        options: optionsObj,
      };
      const url    = activeItem ? `/api/items/${activeItem._id}` : "/api/items";
      const method = activeItem ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      await refetch();
      setView("menu");
    } catch {
      setError("No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
  if (!deleteModal) return;
  try {
    const url = deleteModal.type === "item"
      ? `/api/items/${deleteModal.id}`
      : `/api/menus/${deleteModal.id}`;
    const res = await fetch(url, { method: "DELETE", headers: authHeaders });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "No se pudo eliminar.");
    }
    await refetch();
    setDeleteModal(null);
    setView("menu");
  } catch (err) {
    setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    setDeleteModal(null);
  }
};

  const toggleItemAvailable = useCallback(async (item: Item) => {
    // Actualización optimista en el estado local
    setMenuData(prev => {
      if (!prev) return prev;
      const updateItems = (items: Item[]) =>
        items.map(i => i._id === item._id ? { ...i, available: !i.available } : i);
      return {
        secciones: prev.secciones.map(s => ({
          ...s,
          categorias: s.categorias.map(c => ({ ...c, items: updateItems(c.items) })),
        })),
        sinSeccion: prev.sinSeccion.map(c => ({ ...c, items: updateItems(c.items) })),
      };
    });
    try {
      const res = await fetch(`/api/items/${item._id}/available`, {
        method: "PATCH", headers: authHeaders,
        body: JSON.stringify({ available: !item.available }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("No se pudo cambiar la disponibilidad.");
      await refetch(); // Revertir
    }
  }, [authHeaders, refetch]);

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.setData("text/plain", itemId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, catId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCat(catId);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverCat(null), []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetMenuID: string) => {
    e.preventDefault();
    setDragOverCat(null);
    const itemId = e.dataTransfer.getData("text/plain");
    if (!itemId) return;
    try {
      const res = await fetch(`/api/items/${itemId}/move`, {
        method: "PATCH", headers: authHeaders,
        body: JSON.stringify({ menuID: targetMenuID }),
      });
      if (!res.ok) throw new Error();
      await refetch();
    } catch {
      setError("No se pudo mover el producto.");
    } finally {
      setDraggedItem(null);
    }
  }, [authHeaders, refetch]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverCat(null);
  }, []);

  // ── Handlers CATEGORÍAS ───────────────────────────────────────────────────

  const openNewCategoria = useCallback(() => {
    setCategoriaForm({ title: "", description: "", code: "", seccionID: "", editingId: "" });
    setError("");
    setView("categoria-form");
  }, []);

  const openEditCategoria = useCallback((cat: Categoria) => {
    setCategoriaForm({ title: cat.title, description: cat.description || "", code: cat.code || "", seccionID: "", editingId: cat._id });
    setError("");
    setView("categoria-form");
  }, []);

  const saveCategoria = async () => {
    if (!categoriaForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      let res: Response;
      if (categoriaForm.editingId) {
        res = await fetch(`/api/menus/${categoriaForm.editingId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({ title: categoriaForm.title.trim(), description: categoriaForm.description, code: categoriaForm.code }),
        });
      } else {
        res = await fetch("/api/menus", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ title: categoriaForm.title.trim(), description: categoriaForm.description, code: categoriaForm.code, sectionID: categoriaForm.seccionID || null, section: false }),
        });
      }
      if (!res.ok) throw new Error();
      await refetch();
      setView("menu");
    } catch {
      setError("No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers SECCIONES ────────────────────────────────────────────────────

  const openNewSeccion = useCallback(() => {
    setSeccionForm({ title: "", code: "", editingId: "" });
    setError("");
    setView("seccion-form");
  }, []);

  const openEditSeccion = useCallback((sec: Seccion) => {
    setSeccionForm({ title: sec.title, code: sec.code || "", editingId: sec._id });
    setError("");
    setView("seccion-form");
  }, []);

  const saveSeccion = async () => {
    if (!seccionForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      let res: Response;
      if (seccionForm.editingId) {
        res = await fetch(`/api/menus/${seccionForm.editingId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({ title: seccionForm.title.trim(), code: seccionForm.code }),
        });
      } else {
        res = await fetch("/api/menus", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ title: seccionForm.title.trim(), code: seccionForm.code, section: true }),
        });
      }
      if (!res.ok) throw new Error();
      await refetch();
      setView("menu");
    } catch {
      setError("No se pudo guardar la sección.");
    } finally {
      setSaving(false);
    }
  };

  // ── Conteo total de productos ─────────────────────────────────────────────

  const totalItems = menuData
    ? (menuData.sinSeccion?.flatMap(c => c.items).length ?? 0) +
      (menuData.secciones?.flatMap(s => s.categorias).flatMap(c => c.items).length ?? 0)
    : 0;

  // ── Pantalla de carga ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.pageCenter}>
        <div className={styles.loaderRing} aria-label="Cargando menú..." />
      </div>
    );
  }

  // ── Vista massive-import ──────────────────────────────────────────────────

  if (view === "massive-import") {
    return <MassiveImport onBack={() => setView("menu")} onSuccess={refetch} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
      <div className={styles.me}>

        {/* ══ VISTA PRINCIPAL: ACORDEÓN ══ */}
        {view === "menu" && (
          <>
            <header className={styles.topBar}>
              <div className={styles.topCenter}>
                <span className={styles.topTitle}>Menú</span>
                {totalItems > 0 && (
                  <span className={styles.topCount}>{totalItems} producto{totalItems !== 1 ? "s" : ""}</span>
                )}
              </div>
              <button
                className={styles.backBtn}
                onClick={() => setMenuSheetOpen(true)}
                title="Más opciones"
                aria-label="Abrir menú de acciones"
                aria-haspopup="true"
                aria-expanded={menuSheetOpen}
              >
                {icons.menu}
              </button>
            </header>

            <div className={styles.content}>
              {error && (
                <div className={styles.errorBanner} role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              {/* Secciones */}
              {menuData?.secciones.map(sec => (
                <div key={sec._id} className={styles.seccionBlock}>
                  <div className={styles.seccionRow}>
                    <div className={styles.seccionLeft}>
                      <span className={styles.seccionBadge}>Sección</span>
                      <span className={styles.seccionTitle}>{sec.title}</span>
                    </div>
                    <div className={styles.rowActions}>
                      <button className={styles.iconBtn} onClick={() => openEditSeccion(sec)} title="Editar sección" aria-label={`Editar ${sec.title}`}>
                        {icons.edit}
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.danger}`}
                        onClick={() => setDeleteModal({ type: "seccion", id: sec._id, name: sec.title })}
                        title="Eliminar sección"
                        aria-label={`Eliminar ${sec.title}`}
                      >
                        {icons.trash}
                      </button>
                    </div>
                  </div>

                  {sec.categorias.map(cat => (
                    <CategoriaAcordeon
                      key={cat._id}
                      cat={cat}
                      expanded={expandedCats.has(cat._id)}
                      onToggle={() => toggleCat(cat._id)}
                      onEditCat={() => openEditCategoria(cat)}
                      onDeleteCat={() => setDeleteModal({ type: "categoria", id: cat._id, name: cat.title })}
                      onNewItem={() => openNewItem(cat)}
                      onEditItem={item => openEditItem(item, cat)}
                      onDeleteItem={item => setDeleteModal({ type: "item", id: item._id, name: item.title })}
                      onToggleAvailable={toggleItemAvailable}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      dragOverCat={dragOverCat}
                      draggedItem={draggedItem}
                    />
                  ))}

                  {sec.categorias.length === 0 && (
                    <p className={styles.emptyHint} style={{ paddingLeft: "0.25rem" }}>
                      Sin categorías en esta sección.
                    </p>
                  )}
                </div>
              ))}

              {/* Categorías sin sección */}
              {(menuData?.sinSeccion?.length ?? 0) > 0 && (
                <div className={styles.seccionBlock}>
                  <div className={styles.seccionRow}>
                    <div className={styles.seccionLeft}>
                      <span className={`${styles.seccionBadge} ${styles.seccionBadgeDark}`}>
                        Sin sección
                      </span>
                    </div>
                  </div>
                  {menuData!.sinSeccion.map(cat => (
                    <CategoriaAcordeon
                      key={cat._id}
                      cat={cat}
                      expanded={expandedCats.has(cat._id)}
                      onToggle={() => toggleCat(cat._id)}
                      onEditCat={() => openEditCategoria(cat)}
                      onDeleteCat={() => setDeleteModal({ type: "categoria", id: cat._id, name: cat.title })}
                      onNewItem={() => openNewItem(cat)}
                      onEditItem={item => openEditItem(item, cat)}
                      onDeleteItem={item => setDeleteModal({ type: "item", id: item._id, name: item.title })}
                      onToggleAvailable={toggleItemAvailable}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      dragOverCat={dragOverCat}
                      draggedItem={draggedItem}
                    />
                  ))}
                </div>
              )}

              {/* Estado vacío */}
              {menuData?.secciones.length === 0 && menuData?.sinSeccion.length === 0 && (
                <div className={styles.emptyState}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#272420" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="16" x2="12" y2="16" />
                  </svg>
                  <p>Tu menú está vacío.</p>
                  <p className={styles.emptySub}>Creá una categoría para empezar a agregar productos.</p>
                </div>
              )}
            </div>

            {/* ── Bottom sheet: Categoría / Sección / Importar ── */}
            {menuSheetOpen && (
              <div
                className={styles.modalOverlay}
                onClick={() => setMenuSheetOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-sheet-title"
              >
                <div className={styles.sheet} onClick={e => e.stopPropagation()}>
                  <p id="menu-sheet-title" className={styles.sheetTitle}>Agregar al menú</p>

                  <button
                    className={styles.sheetOption}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); openNewCategoria(); }}
                  >
                    <span className={styles.sheetOptionIcon}>{icons.folder}</span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>Nueva categoría</span>
                      <span className={styles.sheetOptionDesc}>Agrupa productos, ej: Pizzas</span>
                    </span>
                  </button>

                  <button
                    className={styles.sheetOption}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); openNewSeccion(); }}
                  >
                    <span className={styles.sheetOptionIcon}>{icons.layers}</span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>Nueva sección</span>
                      <span className={styles.sheetOptionDesc}>Agrupa categorías, ej: Comidas</span>
                    </span>
                  </button>

                  <button
                    className={styles.sheetOption}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); setView("massive-import"); }}
                  >
                    <span className={styles.sheetOptionIcon}>{icons.upload}</span>
                    <span className={styles.sheetOptionText}>
                      <span className={styles.sheetOptionTitle}>Importar desde Excel</span>
                      <span className={styles.sheetOptionDesc}>Carga o actualiza en lote</span>
                    </span>
                  </button>

                  <button className={styles.sheetCancel} type="button" onClick={() => setMenuSheetOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ VISTA: FORMULARIO ITEM ══ */}
        {view === "item-form" && (
          <>
            <TopBar
              title={activeItem ? "Editar producto" : "Nuevo producto"}
              onBack={() => setView("menu")}
            />
            <div className={`${styles.content} ${styles.formContent}`}>
              {error && <div className={styles.errorBanner} role="alert">{error}</div>}

              {activeCategoria && (
                <p className={styles.formContext}>
                  en <strong>{activeCategoria.title}</strong>
                </p>
              )}

              <div className={styles.field}>
                <label htmlFor="item-title">Nombre <span style={{ color: "#c9a84c" }}>*</span></label>
                <input
                  id="item-title"
                  type="text"
                  placeholder="Ej: Pizza napolitana"
                  value={itemForm.title}
                  onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  maxLength={80}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="item-desc">Descripción</label>
                <textarea
                  id="item-desc"
                  placeholder="Ingredientes, alérgenos, preparación..."
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="item-image">Imagen</label>
                <div className={styles.imageUploader}>
                  <input
                    ref={itemImageInputRef}
                    id="item-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles.hiddenInput}
                  />

                  {itemForm.image ? (
                    <div
                      className={styles.imagePreviewWrapper}
                      onClick={() => !imageUploading && itemImageInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label="Cambiar imagen"
                      onKeyDown={e => e.key === "Enter" && !imageUploading && itemImageInputRef.current?.click()}
                    >
                      <img src={itemForm.image} alt="Vista previa del producto" className={styles.imagePreview} />
                      {imageUploading && (
                        <div className={styles.imageUploadingOverlay}>
                          <Spinner size={18} /> Subiendo...
                        </div>
                      )}
                      <button
                        type="button"
                        className={styles.removeImage}
                        onClick={e => { e.stopPropagation(); removeItemImage(); }}
                        aria-label="Quitar imagen"
                        title="Quitar imagen"
                      >
                        {icons.close}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.uploadButton}
                      onClick={() => itemImageInputRef.current?.click()}
                      disabled={imageUploading}
                    >
                      {imageUploading ? <Spinner size={16} /> : icons.upload}
                      {imageUploading ? "Subiendo..." : "Subir imagen"}
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="item-price">Precio</label>
                  <input
                    id="item-price"
                    type="number"
                    placeholder="0"
                    min="0"
                    value={itemForm.price}
                    onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="item-offer">Precio oferta</label>
                  <input
                    id="item-offer"
                    type="number"
                    placeholder="0"
                    min="0"
                    value={itemForm.offerPrice}
                    onChange={e => setItemForm(f => ({ ...f, offerPrice: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="item-code">Código interno</label>
                <input
                  id="item-code"
                  type="text"
                  placeholder="Ej: pizza-napo"
                  value={itemForm.code}
                  onChange={e => setItemForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>

              {/* Variantes */}
              <div className={styles.field}>
                <div className={styles.fieldLabelRow}>
                  <label>Variantes</label>
                  <button
                    className={styles.textBtn}
                    type="button"
                    onClick={() => setItemForm(f => ({ ...f, options: [...f.options, { key: "", value: "" }] }))}
                  >
                    + Agregar variante
                  </button>
                </div>
                {itemForm.options.length === 0 && (
                  <p className={styles.emptyHint}>Sin variantes. Útil para tamaños o presentaciones con precio distinto.</p>
                )}
                {itemForm.options.map((opt, i) => (
                  <div key={i} className={styles.optionRow}>
                    <input
                      type="text"
                      placeholder="Nombre (ej: Grande)"
                      value={opt.key}
                      aria-label={`Nombre variante ${i + 1}`}
                      onChange={e => setItemForm(f => {
                        const opts = [...f.options];
                        opts[i] = { ...opts[i], key: e.target.value };
                        return { ...f, options: opts };
                      })}
                    />
                    <input
                      type="number"
                      placeholder="Precio"
                      value={opt.value}
                      min="0"
                      aria-label={`Precio variante ${i + 1}`}
                      onChange={e => setItemForm(f => {
                        const opts = [...f.options];
                        opts[i] = { ...opts[i], value: e.target.value };
                        return { ...f, options: opts };
                      })}
                    />
                    <button
                      className={styles.removeBtn}
                      type="button"
                      aria-label={`Eliminar variante ${i + 1}`}
                      onClick={() => setItemForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                    >
                      {icons.close}
                    </button>
                  </div>
                ))}
              </div>

              {/* Toggles */}
              <div className={styles.toggleGroup}>
                {[
                  { label: "Disponible",   desc: "Se puede pedir ahora",          key: "available" },
                  { label: "Ocultar",      desc: "No aparece en la carta pública", key: "hidden" },
                  { label: "Recomendado",  desc: "Se destaca con un ícono ⭐",     key: "recommended" },
                ].map(({ label, desc, key }) => (
                  <div key={key} className={styles.toggleRow}>
                    <div>
                      <p className={styles.toggleLabel}>{label}</p>
                      <p className={styles.toggleDesc}>{desc}</p>
                    </div>
                    <Toggle
                      checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={() => setItemForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                      label={label}
                    />
                  </div>
                ))}
              </div>

              <div className={styles.formBtns}>
                <button
                  className={styles.saveBtn}
                  onClick={saveItem}
                  disabled={saving}
                  aria-busy={saving}
                  type="button"
                >
                  {saving ? <><Spinner /> Guardando...</> : activeItem ? "Guardar cambios" : "Crear producto"}
                </button>
                {activeItem && (
                  <button
                    className={styles.deleteBtn}
                    type="button"
                    onClick={() => setDeleteModal({ type: "item", id: activeItem._id, name: activeItem.title })}
                  >
                    Eliminar producto
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══ VISTA: FORMULARIO CATEGORÍA ══ */}
        {view === "categoria-form" && (
          <>
            <TopBar
              title={categoriaForm.editingId ? "Editar categoría" : "Nueva categoría"}
              onBack={() => setView("menu")}
            />
            <div className={`${styles.content} ${styles.formContent}`}>
              {error && <div className={styles.errorBanner} role="alert">{error}</div>}

              <div className={styles.field}>
                <label htmlFor="cat-title">Nombre <span style={{ color: "#c9a84c" }}>*</span></label>
                <input
                  id="cat-title"
                  type="text"
                  placeholder="Ej: Pizzas"
                  value={categoriaForm.title}
                  onChange={e => setCategoriaForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="cat-desc">Descripción</label>
                <input
                  id="cat-desc"
                  type="text"
                  placeholder="Opcional"
                  value={categoriaForm.description}
                  onChange={e => setCategoriaForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="cat-code">Código interno</label>
                <input
                  id="cat-code"
                  type="text"
                  placeholder="Ej: pizzas"
                  value={categoriaForm.code}
                  onChange={e => setCategoriaForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
              {!categoriaForm.editingId && (
                <div className={styles.field}>
                  <label htmlFor="cat-seccion">Sección</label>
                  <select
                    id="cat-seccion"
                    value={categoriaForm.seccionID}
                    onChange={e => setCategoriaForm(f => ({ ...f, seccionID: e.target.value }))}
                  >
                    <option value="">Sin sección</option>
                    {menuData?.secciones.map(s => (
                      <option key={s._id} value={s._id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.formBtns}>
                <button
                  className={styles.saveBtn}
                  onClick={saveCategoria}
                  disabled={saving}
                  aria-busy={saving}
                  type="button"
                >
                  {saving ? <><Spinner /> Guardando...</> : categoriaForm.editingId ? "Guardar cambios" : "Crear categoría"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ VISTA: FORMULARIO SECCIÓN ══ */}
        {view === "seccion-form" && (
          <>
            <TopBar
              title={seccionForm.editingId ? "Editar sección" : "Nueva sección"}
              onBack={() => setView("menu")}
            />
            <div className={`${styles.content} ${styles.formContent}`}>
              {error && <div className={styles.errorBanner} role="alert">{error}</div>}

              <div className={styles.field}>
                <label htmlFor="sec-title">Nombre <span style={{ color: "#c9a84c" }}>*</span></label>
                <input
                  id="sec-title"
                  type="text"
                  placeholder="Ej: Comidas"
                  value={seccionForm.title}
                  onChange={e => setSeccionForm(f => ({ ...f, title: e.target.value }))}
                  autoFocus
                  maxLength={60}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="sec-code">Código interno</label>
                <input
                  id="sec-code"
                  type="text"
                  placeholder="Ej: comidas"
                  value={seccionForm.code}
                  onChange={e => setSeccionForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className={styles.formBtns}>
                <button
                  className={styles.saveBtn}
                  onClick={saveSeccion}
                  disabled={saving}
                  aria-busy={saving}
                  type="button"
                >
                  {saving ? <><Spinner /> Guardando...</> : seccionForm.editingId ? "Guardar cambios" : "Crear sección"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══ MODAL DE CONFIRMACIÓN ══ */}
        {deleteModal && (
          <div
            className={styles.modalOverlay}
            onClick={() => setDeleteModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <p id="delete-modal-title" className={styles.modalTitle}>
                ¿Eliminar "{deleteModal.name}"?
              </p>
              <p className={styles.modalDesc}>
                {deleteModal.type === "item"
                  ? "El producto se eliminará de forma permanente. Esta acción no se puede deshacer."
                  : deleteModal.type === "categoria"
                    ? "La categoría se eliminará permanentemente. Debe estar vacía antes de eliminarla."
                    : "La sección se eliminará. Solo podés hacerlo si no tiene categorías asignadas."}
              </p>
              <div className={styles.modalBtns}>
                <button className={styles.modalCancel} onClick={() => setDeleteModal(null)} type="button">
                  Cancelar
                </button>
                <button className={styles.modalConfirm} onClick={confirmDelete} type="button" autoFocus>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>  
  );
}