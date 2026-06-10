import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";
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
const EMPTY_ITEM = {
  title: "", description: "", price: "", offerPrice: "",
  code: "", available: true, hidden: false, recommended: false,
  options: [] as { key: string; value: string }[],
};

// ── Vistas posibles ────────────────────────────────────────────────────────────
type View = "menu" | "item-form" | "categoria-form" | "seccion-form" | "massive-import";

export default function MenuEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Estado principal
  const [menuData, setMenuData]     = useState<MenuData | null>(null);
  const [slug, setSlug]             = useState("");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  // Drag & Drop
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  // Navegación
  const [view, setView]             = useState<View>("menu");
  const [activeCategoria, setActiveCategoria] = useState<Categoria | null>(null);
  const [activeItem, setActiveItem] = useState<Item | null>(null);

  // Acordeón: IDs de categorías expandidas
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Modal de confirmación de eliminación
  const [deleteModal, setDeleteModal] = useState<{
    type: "item" | "categoria" | "seccion";
    id: string;
    name: string;
  } | null>(null);

  // Formularios
  const [itemForm, setItemForm]         = useState(EMPTY_ITEM);
  const [categoriaForm, setCategoriaForm] = useState({ title: "", description: "", code: "", seccionID: "", editingId: "" });
  const [seccionForm, setSeccionForm]   = useState({ title: "", code: "", editingId: "" });

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const meRes = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        setSlug(meData.slug);

        const menuRes = await fetch(`/api/users/${meData.slug}/menu`);
        const menuJson = await menuRes.json();
        setMenuData(menuJson.menu);
      } catch {
        setError("No se pudo cargar el menú.");
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // ── Refresca el menú desde el backend ─────────────────────────────────────
  const refetch = async () => {
    if (!slug) return;
    const menuRes = await fetch(`/api/users/${slug}/menu`);
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
  };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Acordeón ───────────────────────────────────────────────────────────────
  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Handlers ITEMS ─────────────────────────────────────────────────────────

  const openNewItem = (cat: Categoria) => {
    setActiveCategoria(cat);
    setActiveItem(null);
    setItemForm(EMPTY_ITEM);
    setError("");
    setView("item-form");
  };

  const openEditItem = (item: Item, cat: Categoria) => {
    setActiveCategoria(cat);
    setActiveItem(item);
    setItemForm({
      title: item.title,
      description: item.description || "",
      price: item.price?.toString() || "",
      offerPrice: item.offerPrice?.toString() || "",
      code: item.code || "",
      available: item.available,
      hidden: item.hidden,
      recommended: item.recommended,
      options: Object.entries(item.options || {}).map(([key, value]) => ({
        key, value: value.toString(),
      })),
    });
    setError("");
    setView("item-form");
  };

  const saveItem = async () => {
    if (!itemForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      const optionsObj: Record<string, number> = {};
      itemForm.options.forEach(({ key, value }) => {
        if (key.trim()) optionsObj[key.trim()] = Number(value) || 0;
      });
      const body = {
        menuID: activeCategoria!._id,
        title: itemForm.title,
        description: itemForm.description,
        price: itemForm.price !== "" ? Number(itemForm.price) : null,
        offerPrice: itemForm.offerPrice !== "" ? Number(itemForm.offerPrice) : null,
        code: itemForm.code,
        available: itemForm.available,
        hidden: itemForm.hidden,
        recommended: itemForm.recommended,
        options: optionsObj,
      };
      if (activeItem) {
        await fetch(`/api/items/${activeItem._id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(body) });
      } else {
        await fetch("/api/items", { method: "POST", headers: authHeaders, body: JSON.stringify(body) });
      }
      await refetch();
      setView("menu");
    } catch {
      setError("No se pudo guardar el item.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      if (deleteModal.type === "item") {
        await fetch(`/api/items/${deleteModal.id}`, { method: "DELETE", headers: authHeaders });
      } else {
        await fetch(`/api/menus/${deleteModal.id}`, { method: "DELETE", headers: authHeaders });
      }
      await refetch();
      setDeleteModal(null);
      setView("menu");
    } catch {
      setError("No se pudo eliminar.");
      setDeleteModal(null);
    }
  };

  const toggleItemAvailable = async (item: Item) => {
    await fetch(`/api/items/${item._id}/available`, {
      method: "PATCH", headers: authHeaders,
      body: JSON.stringify({ available: !item.available }),
    });
    await refetch();
  };

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.setData("text/plain", itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, catId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCat(catId);
  };

  const handleDragLeave = () => {
    setDragOverCat(null);
  };

  const handleDrop = async (e: React.DragEvent, targetMenuID: string) => {
    e.preventDefault();
    setDragOverCat(null);

    const itemId = e.dataTransfer.getData("text/plain");
    if (!itemId || itemId === "") return;

    try {
      await fetch(`/api/items/${itemId}/move`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ menuID: targetMenuID }),
      });
      await refetch();
    } catch (err) {
      setError("No se pudo mover el item.");
    } finally {
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverCat(null);
  };

  // ── Handlers CATEGORÍAS ────────────────────────────────────────────────────

  const openNewCategoria = () => {
    setCategoriaForm({ title: "", description: "", code: "", seccionID: "", editingId: "" });
    setError("");
    setView("categoria-form");
  };

  const openEditCategoria = (cat: Categoria) => {
    setCategoriaForm({
      title: cat.title,
      description: cat.description || "",
      code: cat.code || "",
      seccionID: "",
      editingId: cat._id,
    });
    setError("");
    setView("categoria-form");
  };

  const saveCategoria = async () => {
    if (!categoriaForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      if (categoriaForm.editingId) {
        await fetch(`/api/menus/${categoriaForm.editingId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({
            title: categoriaForm.title,
            description: categoriaForm.description,
            code: categoriaForm.code,
          }),
        });
      } else {
        await fetch("/api/menus", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({
            title: categoriaForm.title,
            description: categoriaForm.description,
            code: categoriaForm.code,
            sectionID: categoriaForm.seccionID || null,
            section: false,
          }),
        });
      }
      await refetch();
      setView("menu");
    } catch {
      setError("No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers SECCIONES ─────────────────────────────────────────────────────

  const openNewSeccion = () => {
    setSeccionForm({ title: "", code: "", editingId: "" });
    setError("");
    setView("seccion-form");
  };

  const openEditSeccion = (sec: Seccion) => {
    setSeccionForm({ title: sec.title, code: sec.code || "", editingId: sec._id });
    setError("");
    setView("seccion-form");
  };

  const saveSeccion = async () => {
    if (!seccionForm.title.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    try {
      if (seccionForm.editingId) {
        await fetch(`/api/menus/${seccionForm.editingId}`, {
          method: "PUT", headers: authHeaders,
          body: JSON.stringify({ title: seccionForm.title, code: seccionForm.code }),
        });
      } else {
        await fetch("/api/menus", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ title: seccionForm.title, code: seccionForm.code, section: true }),
        });
      }
      await refetch();
      setView("menu");
    } catch {
      setError("No se pudo guardar la sección.");
    } finally {
      setSaving(false);
    }
  };

  // ── Componentes internos ───────────────────────────────────────────────────

  const TopBar = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <header className={styles["top-bar"]}>
      <button className={styles["back-btn"]} onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className={styles["top-title"]}>{title}</span>
      <div style={{ width: 36 }} />
    </header>
  );

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      className={`${styles.toggle} ${checked ? styles.on : ""}`}
      onClick={onChange}
      type="button"
    >
      <span className={styles["toggle-knob"]} />
    </button>
  );

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (loading) return (
    <div className={styles["page-center"]}><div className={styles["loader-ring"]} /></div>
  );

  // ── Vista massive-import ───────────────────────────────────────────────────
  if (view === "massive-import") {
    return (
      <MassiveImport
        onBack={() => setView("menu")}
        onSuccess={refetch}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.me}>

      {/* ══════════════════════════════════════════
          VISTA 1: ACORDEÓN PRINCIPAL
      ══════════════════════════════════════════ */}
      {view === "menu" && (
        <>
          <header className={styles["top-bar"]}>
            <button className={styles["back-btn"]} onClick={() => navigate("/dashboard")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles["top-title"]}>Editor de menú</span>
            <button className={styles["back-btn"]} onClick={() => setView("massive-import")} title="Importar desde Excel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          </header>

          <div className={styles.content}>
            {error && <div className={styles["error-banner"]}>{error}</div>}

            {/* Secciones con categorías y items anidados */}
            {menuData?.secciones.map(sec => (
              <div key={sec._id} className={styles["seccion-block"]}>

                <div className={styles["seccion-row"]}>
                  <div className={styles["seccion-left"]}>
                    <span className={styles["seccion-badge"]}>Sección</span>
                    <span className={styles["seccion-title"]}>{sec.title}</span>
                  </div>
                  <div className={styles["row-actions"]}>
                    <button className={styles["icon-btn"]} onClick={() => openEditSeccion(sec)} title="Editar sección">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className={`${styles["icon-btn"]} ${styles.danger}`}
                      onClick={() => setDeleteModal({ type: "seccion", id: sec._id, name: sec.title })}
                      title="Eliminar sección"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
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
                    onEditItem={(item) => openEditItem(item, cat)}
                    onDeleteItem={(item) => setDeleteModal({ type: "item", id: item._id, name: item.title })}
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
                  <p className={styles["empty-hint"]} style={{ paddingLeft: "1rem" }}>Sin categorías.</p>
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
                    onEditItem={(item) => openEditItem(item, cat)}
                    onDeleteItem={(item) => setDeleteModal({ type: "item", id: item._id, name: item.title })}
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

            {menuData?.secciones.length === 0 && menuData?.sinSeccion.length === 0 && (
              <p className={styles["empty-hint"]} style={{ textAlign: "center", marginTop: "2rem" }}>
                Tu menú está vacío. Creá una categoría para empezar.
              </p>
            )}
          </div>

          <div className={styles["fab-group"]}>
            <button className={styles.fab} onClick={openNewCategoria}>+ Categoría</button>
            <button className={styles["fab-secondary"]} onClick={openNewSeccion}>+ Sección</button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          VISTA 2: FORMULARIO ITEM
      ══════════════════════════════════════════ */}
      {view === "item-form" && (
        <>
          <TopBar title={activeItem ? "Editar item" : "Nuevo item"} onBack={() => setView("menu")} />
          <div className={`${styles.content} ${styles["form-content"]}`}>
            {error && <div className={styles["error-banner"]}>{error}</div>}

            <div className={styles.field}>
              <label>Nombre *</label>
              <input type="text" placeholder="Ej: Pizza napolitana"
                value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label>Descripción</label>
              <textarea placeholder="Ingredientes, preparación..."
                value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className={styles["field-row"]}>
              <div className={styles.field}>
                <label>Precio</label>
                <input type="number" placeholder="0" value={itemForm.price}
                  onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>Precio oferta</label>
                <input type="number" placeholder="0" value={itemForm.offerPrice}
                  onChange={e => setItemForm(f => ({ ...f, offerPrice: e.target.value }))} />
              </div>
            </div>
            <div className={styles.field}>
              <label>Código interno</label>
              <input type="text" placeholder="Ej: pizza-napo" value={itemForm.code}
                onChange={e => setItemForm(f => ({ ...f, code: e.target.value }))} />
            </div>

            {/* Variantes */}
            <div className={styles.field}>
              <div className={styles["field-label-row"]}>
                <label>Variantes</label>
                <button className={styles["text-btn"]} type="button"
                  onClick={() => setItemForm(f => ({ ...f, options: [...f.options, { key: "", value: "" }] }))}>
                  + Agregar
                </button>
              </div>
              {itemForm.options.map((opt, i) => (
                <div key={i} className={styles["option-row"]}>
                  <input type="text" placeholder="Nombre (ej: Grande)" value={opt.key}
                    onChange={e => setItemForm(f => {
                      const opts = [...f.options]; opts[i] = { ...opts[i], key: e.target.value }; return { ...f, options: opts };
                    })} />
                  <input type="number" placeholder="Precio" value={opt.value}
                    onChange={e => setItemForm(f => {
                      const opts = [...f.options]; opts[i] = { ...opts[i], value: e.target.value }; return { ...f, options: opts };
                    })} />
                  <button className={styles["remove-btn"]} type="button"
                    onClick={() => setItemForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div className={styles["toggle-group"]}>
              {[
                { label: "Disponible", desc: "Se puede pedir ahora", key: "available" },
                { label: "Ocultar", desc: "No aparece en el menú público", key: "hidden" },
                { label: "Recomendado", desc: "Se destaca en la carta", key: "recommended" },
              ].map(({ label, desc, key }) => (
                <div key={key} className={styles["toggle-row"]}>
                  <div>
                    <p className={styles["toggle-label"]}>{label}</p>
                    <p className={styles["toggle-desc"]}>{desc}</p>
                  </div>
                  <Toggle
                    checked={itemForm[key as keyof typeof itemForm] as boolean}
                    onChange={() => setItemForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                  />
                </div>
              ))}
            </div>

            <div className={styles["form-btns"]}>
              {activeItem && (
                <button className={styles["delete-btn"]} type="button"
                  onClick={() => { setDeleteModal({ type: "item", id: activeItem._id, name: activeItem.title }); }}>
                  Eliminar item
                </button>
              )}
              <button className={styles["save-btn"]} onClick={saveItem} disabled={saving}>
                {saving ? "Guardando..." : activeItem ? "Guardar cambios" : "Crear item"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          VISTA 3: FORMULARIO CATEGORÍA
      ══════════════════════════════════════════ */}
      {view === "categoria-form" && (
        <>
          <TopBar
            title={categoriaForm.editingId ? "Editar categoría" : "Nueva categoría"}
            onBack={() => setView("menu")}
          />
          <div className={`${styles.content} ${styles["form-content"]}`}>
            {error && <div className={styles["error-banner"]}>{error}</div>}
            <div className={styles.field}>
              <label>Nombre *</label>
              <input type="text" placeholder="Ej: Pizzas" value={categoriaForm.title}
                onChange={e => setCategoriaForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label>Descripción</label>
              <input type="text" placeholder="Opcional" value={categoriaForm.description}
                onChange={e => setCategoriaForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label>Código interno</label>
              <input type="text" placeholder="Ej: pizzas" value={categoriaForm.code}
                onChange={e => setCategoriaForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            {!categoriaForm.editingId && (
              <div className={styles.field}>
                <label>Sección (opcional)</label>
                <select value={categoriaForm.seccionID}
                  onChange={e => setCategoriaForm(f => ({ ...f, seccionID: e.target.value }))}>
                  <option value="">Sin sección</option>
                  {menuData?.secciones.map(s => (
                    <option key={s._id} value={s._id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}
            <button className={styles["save-btn"]} onClick={saveCategoria} disabled={saving}>
              {saving ? "Guardando..." : categoriaForm.editingId ? "Guardar cambios" : "Crear categoría"}
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          VISTA 4: FORMULARIO SECCIÓN
      ══════════════════════════════════════════ */}
      {view === "seccion-form" && (
        <>
          <TopBar
            title={seccionForm.editingId ? "Editar sección" : "Nueva sección"}
            onBack={() => setView("menu")}
          />
          <div className={`${styles.content} ${styles["form-content"]}`}>
            {error && <div className={styles["error-banner"]}>{error}</div>}
            <div className={styles.field}>
              <label>Nombre *</label>
              <input type="text" placeholder="Ej: Comidas" value={seccionForm.title}
                onChange={e => setSeccionForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label>Código interno</label>
              <input type="text" placeholder="Ej: comidas" value={seccionForm.code}
                onChange={e => setSeccionForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <button className={styles["save-btn"]} onClick={saveSeccion} disabled={saving}>
              {saving ? "Guardando..." : seccionForm.editingId ? "Guardar cambios" : "Crear sección"}
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ══════════════════════════════════════════ */}
      {deleteModal && (
        <div className={styles["modal-overlay"]} onClick={() => setDeleteModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles["modal-title"]}>¿Eliminar "{deleteModal.name}"?</p>
            <p className={styles["modal-desc"]}>
              {deleteModal.type === "item"
                ? "El producto se eliminará permanentemente."
                : deleteModal.type === "categoria"
                  ? "La categoría se eliminará. Debe estar vacía."
                  : "La sección se eliminará. Debe no tener categorías."}
            </p>
            <div className={styles["modal-btns"]}>
              <button className={styles["modal-cancel"]} onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className={styles["modal-confirm"]} onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente acordeón de categoría (con Drag & Drop) ─────────────────────
function CategoriaAcordeon({
  cat,
  expanded,
  onToggle,
  onEditCat,
  onDeleteCat,
  onNewItem,
  onEditItem,
  onDeleteItem,
  onToggleAvailable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dragOverCat,
  draggedItem,
}: {
  cat: any;
  expanded: boolean;
  onToggle: () => void;
  onEditCat: () => void;
  onDeleteCat: () => void;
  onNewItem: () => void;
  onEditItem: (item: any) => void;
  onDeleteItem: (item: any) => void;
  onToggleAvailable: (item: any) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragOver: (e: React.DragEvent, catId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, catId: string) => void;
  onDragEnd: () => void;
  dragOverCat: string | null;
  draggedItem: string | null;
}) {
  const isDragOver = dragOverCat === cat._id;

  return (
    <div className={styles["cat-acordeon"]}>
      <div className={`${styles["cat-header"]} ${expanded ? styles.open : ""}`}>
        <svg
          className={`${styles["cat-chevron"]} ${expanded ? styles.open : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          onClick={onToggle} style={{ cursor: "pointer" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>

        <div className={styles["cat-header-info"]} onClick={onToggle}>
          <span className={styles["cat-header-name"]}>{cat.title}</span>
          <span className={styles["cat-header-meta"]}>
            {cat.items?.length ?? 0} items{cat.hidden ? " · oculta" : ""}
          </span>
        </div>

        <div className={styles["row-actions"]}>
          <button className={styles["icon-btn"]} onClick={onEditCat} title="Editar categoría">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className={`${styles["icon-btn"]} ${styles.danger}`}
            onClick={onDeleteCat}
            title="Eliminar categoría"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className={`${styles["cat-body"]} ${isDragOver ? styles["drag-over"] : ""}`}
          onDragOver={(e) => onDragOver(e, cat._id)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, cat._id)}
        >
          {cat.items?.length === 0 && (
            <p className={styles["empty-hint"]} style={{ padding: "1rem", textAlign: "center", fontStyle: "italic" }}>
              Arrastra items aquí
            </p>
          )}

          {cat.items?.map((item: any) => (
            <div
              key={item._id}
              className={`${styles["item-row-ac"]} ${draggedItem === item._id ? styles.dragging : ""}`}
              draggable
              onDragStart={(e) => onDragStart(e, item._id)}
              onDragEnd={onDragEnd}
            >
              <div className={styles["item-info-ac"]} onClick={() => onEditItem(item)}>
                <span className={styles["item-name-ac"]}>{item.title}</span>
                <span className={styles["item-meta-ac"]}>
                  {item.price != null
                    ? `$${item.price}`
                    : Object.keys(item.options || {}).length > 0
                      ? "Con variantes"
                      : "Sin precio"}
                  {item.hidden ? " · oculto" : ""}
                  {item.recommended ? " · ⭐" : ""}
                </span>
              </div>

              <div className={styles["item-actions"]}>
                <button
                  className={`${styles["pill-btn"]} ${item.available ? styles["pill-on"] : styles["pill-off"]}`}
                  onClick={() => onToggleAvailable(item)}
                >
                  {item.available ? "Activo" : "Pausado"}
                </button>
                <button
                  className={`${styles["icon-btn"]} ${styles.danger}`}
                  onClick={() => onDeleteItem(item)}
                  title="Eliminar"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          <div className={styles["cat-footer"]}>
            <button className={styles["add-item-btn"]} onClick={onNewItem}>+ Agregar item</button>
          </div>
        </div>
      )}
    </div>
  );
}