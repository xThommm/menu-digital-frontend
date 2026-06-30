import { useState, useEffect, useCallback, memo, useMemo } from "react";
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
      <span className={styles["toggle-knob"]} />
    </button>
  );
}

// ── TopBar sub-componente ─────────────────────────────────────────────────────

function TopBar({ title, rightSlot }: { title: string; onBack: () => void; rightSlot?: React.ReactNode }) {
  return (
    <header className={styles["top-bar"]}>
      <span className={styles["top-title"]}>{title}</span>
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
    <div className={styles["cat-acordeon"]}>
      {/* Header */}
      <div className={`${styles["cat-header"]} ${expanded ? styles.open : ""}`}>
        <button
          className={`${styles["cat-chevron-btn"]}`}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Contraer ${cat.title}` : `Expandir ${cat.title}`}
        >
          <span className={`${styles["cat-chevron"]} ${expanded ? styles.open : ""}`}>
            {icons.chevron}
          </span>
        </button>

        <button className={styles["cat-header-info"]} onClick={onToggle} type="button">
          <span className={styles["cat-header-name"]}>{cat.title}</span>
          <span className={styles["cat-header-meta"]}>
            {itemCount === 0 ? "Sin productos" : `${itemCount} producto${itemCount !== 1 ? "s" : ""}`}
            {cat.hidden ? " · oculta" : ""}
          </span>
        </button>

        <div className={styles["row-actions"]}>
          <button
            className={styles["icon-btn"]}
            onClick={onEditCat}
            title="Editar categoría"
            aria-label={`Editar ${cat.title}`}
          >
            {icons.edit}
          </button>
          <button
            className={`${styles["icon-btn"]} ${styles.danger}`}
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
          className={`${styles["cat-body"]} ${isDragOver ? styles["drag-over"] : ""}`}
          onDragOver={e => onDragOver(e, cat._id)}
          onDragLeave={onDragLeave}
          onDrop={e => onDrop(e, cat._id)}
          role="list"
          aria-label={`Productos de ${cat.title}`}
        >
          {itemCount === 0 && (
            <p className={styles["empty-hint"]} style={{ padding: "1.25rem", textAlign: "center" }}>
              Arrastrá productos aquí o usá el botón de abajo.
            </p>
          )}

          {cat.items?.map(item => (
            <div
              key={item._id}
              role="listitem"
              className={`${styles["item-row-ac"]} ${draggedItem === item._id ? styles.dragging : ""}`}
              draggable
              onDragStart={e => onDragStart(e, item._id)}
              onDragEnd={onDragEnd}
            >
              {/* Handle drag */}
              <span className={styles["drag-handle"]} aria-hidden="true">
                <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                  <circle cx="4" cy="3"  r="1.5" fill="currentColor" />
                  <circle cx="4" cy="8"  r="1.5" fill="currentColor" />
                  <circle cx="4" cy="13" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="3"  r="1.5" fill="currentColor" />
                  <circle cx="8" cy="8"  r="1.5" fill="currentColor" />
                  <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                </svg>
              </span>

              <button className={styles["item-info-ac"]} onClick={() => onEditItem(item)} type="button">
                <span className={styles["item-name-ac"]}>{item.title}</span>
                <span className={styles["item-meta-ac"]}>
                  {item.price != null
                    ? `$${item.price.toLocaleString("es-AR")}`
                    : Object.keys(item.options || {}).length > 0
                      ? "Con variantes"
                      : "Sin precio"}
                  {item.offerPrice != null && (
                    <span className={styles["item-offer"]}>
                      {` · Oferta $${item.offerPrice.toLocaleString("es-AR")}`}
                    </span>
                  )}
                  {item.hidden     ? " · oculto" : ""}
                  {item.recommended ? " · ⭐" : ""}
                </span>
              </button>

              <div className={styles["item-actions"]}>
                <button
                  className={`${styles["pill-btn"]} ${item.available ? styles["pill-on"] : styles["pill-off"]}`}
                  onClick={() => onToggleAvailable(item)}
                  aria-label={item.available ? `Pausar ${item.title}` : `Activar ${item.title}`}
                  type="button"
                >
                  {item.available ? "Activo" : "Pausado"}
                </button>
                <button
                  className={`${styles["icon-btn"]} ${styles.danger}`}
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

          <div className={styles["cat-footer"]}>
            <button className={styles["add-item-btn"]} onClick={onNewItem} type="button">
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
  const [slug,        setSlug]        = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

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
        const meRes   = await fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
        if (!meRes.ok) throw new Error();
        const meData  = await meRes.json();
        setSlug(meData.slug);

        const menuRes  = await fetch(`/api/users/${meData.slug}/menu`);
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
    if (!slug) return;
    try {
      const menuRes  = await fetch(`/api/users/${slug}/menu`);
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
  }, [slug, activeCategoria]);

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

  const saveItem = async () => {
    //hacer obligatorio el nombre, codigo y precio (Siempre debe tener precio, y ser un numero entero y positivo).
    if (!itemForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    if (!itemForm.code.trim()) { setError("El código es obligatorio."); return; }
    if (!itemForm.price.trim()) { setError("El precio es obligatorio."); return; }  
    if (itemForm.price !== "" && isNaN(Number(itemForm.price))) { setError("El precio debe ser un número."); return; }
    if (itemForm.price !== "" && (!Number(itemForm.price) || Number(itemForm.price) <= 0)) { setError("El precio debe ser un número positivo."); return; }
    if (itemForm.offerPrice !== "" && (!Number(itemForm.offerPrice) || Number(itemForm.offerPrice) <= 0)) { setError("El precio de oferta debe ser un número positivo."); return; }
    if (itemForm.offerPrice !== "" && isNaN(Number(itemForm.offerPrice))) { setError("El precio de oferta debe ser un número."); return; }
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
      console.log(itemForm);
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
      <div className={styles["page-center"]}>
        <div className={styles["loader-ring"]} aria-label="Cargando menú..." />
      </div>
    );
  }

  //-------------------------------------------

const handleImageUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  if (!file) return;

  try {
    const formData = new FormData();

    formData.append("file", file);
    formData.append(
      "upload_preset",
      "menu_items"
    );

    const res = await fetch(
  "https://api.cloudinary.com/v1_1/dbzqq1del/image/upload",
  {
    method: "POST",
    body: formData,
  }
);

    const data = await res.json();

    console.log(data);

    setItemForm(prev => ({
      ...prev,
      image: data.secure_url,
    }));
    console.log("URL:", data.secure_url);
  } catch {
    setError("No se pudo subir la imagen.");
  }
};

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
            <header className={styles["top-bar"]}>
              <div className={styles["top-center"]}>
                <span className={styles["top-title"]}>Menú</span>
                {totalItems > 0 && (
                  <span className={styles["top-count"]}>{totalItems} producto{totalItems !== 1 ? "s" : ""}</span>
                )}
              </div>
              <button
                className={styles["back-btn"]}
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
                <div className={styles["error-banner"]} role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              {/* Secciones */}
              {menuData?.secciones.map(sec => (
                <div key={sec._id} className={styles["seccion-block"]}>
                  <div className={styles["seccion-row"]}>
                    <div className={styles["seccion-left"]}>
                      <span className={styles["seccion-badge"]}>Sección</span>
                      <span className={styles["seccion-title"]}>{sec.title}</span>
                    </div>
                    <div className={styles["row-actions"]}>
                      <button className={styles["icon-btn"]} onClick={() => openEditSeccion(sec)} title="Editar sección" aria-label={`Editar ${sec.title}`}>
                        {icons.edit}
                      </button>
                      <button
                        className={`${styles["icon-btn"]} ${styles.danger}`}
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
                    <p className={styles["empty-hint"]} style={{ paddingLeft: "0.25rem" }}>
                      Sin categorías en esta sección.
                    </p>
                  )}
                </div>
              ))}

              {/* Categorías sin sección */}
              {(menuData?.sinSeccion?.length ?? 0) > 0 && (
                <div className={styles["seccion-block"]}>
                  <div className={styles["seccion-row"]}>
                    <div className={styles["seccion-left"]}>
                      <span className={`${styles["seccion-badge"]} ${styles["seccion-badge-dark"]}`}>
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
                <div className={styles["empty-state"]}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#272420" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="16" x2="12" y2="16" />
                  </svg>
                  <p>Tu menú está vacío.</p>
                  <p className={styles["empty-sub"]}>Creá una categoría para empezar a agregar productos.</p>
                </div>
              )}
            </div>

            {/* ── Bottom sheet: Categoría / Sección / Importar ── */}
            {menuSheetOpen && (
              <div
                className={styles["modal-overlay"]}
                onClick={() => setMenuSheetOpen(false)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-sheet-title"
              >
                <div className={styles["sheet"]} onClick={e => e.stopPropagation()}>
                  <p id="menu-sheet-title" className={styles["sheet-title"]}>Agregar al menú</p>

                  <button
                    className={styles["sheet-option"]}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); openNewCategoria(); }}
                  >
                    <span className={styles["sheet-option-icon"]}>{icons.folder}</span>
                    <span className={styles["sheet-option-text"]}>
                      <span className={styles["sheet-option-title"]}>Nueva categoría</span>
                      <span className={styles["sheet-option-desc"]}>Agrupa productos, ej: Pizzas</span>
                    </span>
                  </button>

                  <button
                    className={styles["sheet-option"]}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); openNewSeccion(); }}
                  >
                    <span className={styles["sheet-option-icon"]}>{icons.layers}</span>
                    <span className={styles["sheet-option-text"]}>
                      <span className={styles["sheet-option-title"]}>Nueva sección</span>
                      <span className={styles["sheet-option-desc"]}>Agrupa categorías, ej: Comidas</span>
                    </span>
                  </button>

                  <button
                    className={styles["sheet-option"]}
                    type="button"
                    onClick={() => { setMenuSheetOpen(false); setView("massive-import"); }}
                  >
                    <span className={styles["sheet-option-icon"]}>{icons.upload}</span>
                    <span className={styles["sheet-option-text"]}>
                      <span className={styles["sheet-option-title"]}>Importar desde Excel</span>
                      <span className={styles["sheet-option-desc"]}>Carga o actualiza en lote</span>
                    </span>
                  </button>

                  <button className={styles["sheet-cancel"]} type="button" onClick={() => setMenuSheetOpen(false)}>
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
            <div className={`${styles.content} ${styles["form-content"]}`}>
              {error && <div className={styles["error-banner"]} role="alert">{error}</div>}

              {activeCategoria && (
                <p className={styles["form-context"]}>
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
  <label>Imagen</label>

  <input
    type="file"
    accept="image/*"
    onChange={handleImageUpload}
  />

  {itemForm.image && (
    <img
      src={itemForm.image}
      alt="Preview"
      style={{
        width: "100%",
        maxHeight: 200,
        objectFit: "cover",
        borderRadius: 12,
        marginTop: 10,
      }}
    />
  )}
</div>

              <div className={styles["field-row"]}>
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
                <div className={styles["field-label-row"]}>
                  <label>Variantes</label>
                  <button
                    className={styles["text-btn"]}
                    type="button"
                    onClick={() => setItemForm(f => ({ ...f, options: [...f.options, { key: "", value: "" }] }))}
                  >
                    + Agregar variante
                  </button>
                </div>
                {itemForm.options.length === 0 && (
                  <p className={styles["empty-hint"]}>Sin variantes. Útil para tamaños o presentaciones con precio distinto.</p>
                )}
                {itemForm.options.map((opt, i) => (
                  <div key={i} className={styles["option-row"]}>
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
                      className={styles["remove-btn"]}
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
              <div className={styles["toggle-group"]}>
                {[
                  { label: "Disponible",   desc: "Se puede pedir ahora",          key: "available" },
                  { label: "Ocultar",      desc: "No aparece en la carta pública", key: "hidden" },
                  { label: "Recomendado",  desc: "Se destaca con un ícono ⭐",     key: "recommended" },
                ].map(({ label, desc, key }) => (
                  <div key={key} className={styles["toggle-row"]}>
                    <div>
                      <p className={styles["toggle-label"]}>{label}</p>
                      <p className={styles["toggle-desc"]}>{desc}</p>
                    </div>
                    <Toggle
                      checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={() => setItemForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                      label={label}
                    />
                  </div>
                ))}
              </div>

              <div className={styles["form-btns"]}>
                <button
                  className={styles["save-btn"]}
                  onClick={saveItem}
                  disabled={saving}
                  aria-busy={saving}
                  type="button"
                >
                  {saving ? <><Spinner /> Guardando...</> : activeItem ? "Guardar cambios" : "Crear producto"}
                </button>
                {activeItem && (
                  <button
                    className={styles["delete-btn"]}
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
            <div className={`${styles.content} ${styles["form-content"]}`}>
              {error && <div className={styles["error-banner"]} role="alert">{error}</div>}

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
              <div className={styles["form-btns"]}>
                <button
                  className={styles["save-btn"]}
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
            <div className={`${styles.content} ${styles["form-content"]}`}>
              {error && <div className={styles["error-banner"]} role="alert">{error}</div>}

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
              <div className={styles["form-btns"]}>
                <button
                  className={styles["save-btn"]}
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
            className={styles["modal-overlay"]}
            onClick={() => setDeleteModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <p id="delete-modal-title" className={styles["modal-title"]}>
                ¿Eliminar "{deleteModal.name}"?
              </p>
              <p className={styles["modal-desc"]}>
                {deleteModal.type === "item"
                  ? "El producto se eliminará de forma permanente. Esta acción no se puede deshacer."
                  : deleteModal.type === "categoria"
                    ? "La categoría se eliminará permanentemente. Debe estar vacía antes de eliminarla."
                    : "La sección se eliminará. Solo podés hacerlo si no tiene categorías asignadas."}
              </p>
              <div className={styles["modal-btns"]}>
                <button className={styles["modal-cancel"]} onClick={() => setDeleteModal(null)} type="button">
                  Cancelar
                </button>
                <button className={styles["modal-confirm"]} onClick={confirmDelete} type="button" autoFocus>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>  
  );
}