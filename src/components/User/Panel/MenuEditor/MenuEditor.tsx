import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";
import MassiveImport from "../../../../Utils/MassiveImport";

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
    <header className="top-bar">
      <button className="back-btn" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="top-title">{title}</span>
      <div style={{ width: 36 }} />
    </header>
  );

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button className={`toggle ${checked ? "on" : ""}`} onClick={onChange} type="button">
      <span className="toggle-knob" />
    </button>
  );

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="page-center"><div className="loader-ring" /></div>
  );

  // ── Vista massive-import: renderiza el componente completo sin el wrapper .me ──
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
    <div className="me">

      {/* ══════════════════════════════════════════
          VISTA 1: ACORDEÓN PRINCIPAL
      ══════════════════════════════════════════ */}
      {view === "menu" && (
        <>
          <header className="top-bar">
            <button className="back-btn" onClick={() => navigate("/admin")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="top-title">Editor de menú</span>
            {/* Botón importar Excel */}
            <button className="back-btn" onClick={() => setView("massive-import")} title="Importar desde Excel">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          </header>

          <div className="content">
            {error && <div className="error-banner">{error}</div>}

            {/* Secciones con categorías y items anidados */}
            {menuData?.secciones.map(sec => (
              <div key={sec._id} className="seccion-block">

                {/* Cabecera de sección */}
                <div className="seccion-row">
                  <div className="seccion-left">
                    <span className="seccion-badge">Sección</span>
                    <span className="seccion-title">{sec.title}</span>
                  </div>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => openEditSeccion(sec)} title="Editar sección">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button className="icon-btn danger" onClick={() => setDeleteModal({ type: "seccion", id: sec._id, name: sec.title })} title="Eliminar sección">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Categorías dentro de la sección */}
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
                  <p className="empty-hint" style={{ paddingLeft: "1rem" }}>Sin categorías.</p>
                )}
              </div>
            ))}

            {/* Categorías sin sección */}
            {(menuData?.sinSeccion?.length ?? 0) > 0 && (
              <div className="seccion-block">
                <div className="seccion-row">
                  <div className="seccion-left">
                    <span className="seccion-badge" style={{ background: "#1a1a1a", borderColor: "#333" }}>Sin sección</span>
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
              <p className="empty-hint" style={{ textAlign: "center", marginTop: "2rem" }}>
                Tu menú está vacío. Creá una categoría para empezar.
              </p>
            )}
          </div>

          <div className="fab-group">
            <button className="fab" onClick={openNewCategoria}>+ Categoría</button>
            <button className="fab-secondary" onClick={openNewSeccion}>+ Sección</button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          VISTA 2: FORMULARIO ITEM
      ══════════════════════════════════════════ */}
      {view === "item-form" && (
        <>
          <TopBar title={activeItem ? "Editar item" : "Nuevo item"} onBack={() => setView("menu")} />
          <div className="content form-content">
            {error && <div className="error-banner">{error}</div>}

            <div className="field">
              <label>Nombre *</label>
              <input type="text" placeholder="Ej: Pizza napolitana"
                value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea placeholder="Ingredientes, preparación..."
                value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Precio</label>
                <input type="number" placeholder="0" value={itemForm.price}
                  onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="field">
                <label>Precio oferta</label>
                <input type="number" placeholder="0" value={itemForm.offerPrice}
                  onChange={e => setItemForm(f => ({ ...f, offerPrice: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Código interno</label>
              <input type="text" placeholder="Ej: pizza-napo" value={itemForm.code}
                onChange={e => setItemForm(f => ({ ...f, code: e.target.value }))} />
            </div>

            {/* Variantes */}
            <div className="field">
              <div className="field-label-row">
                <label>Variantes</label>
                <button className="text-btn" type="button"
                  onClick={() => setItemForm(f => ({ ...f, options: [...f.options, { key: "", value: "" }] }))}>
                  + Agregar
                </button>
              </div>
              {itemForm.options.map((opt, i) => (
                <div key={i} className="option-row">
                  <input type="text" placeholder="Nombre (ej: Grande)" value={opt.key}
                    onChange={e => setItemForm(f => {
                      const opts = [...f.options]; opts[i] = { ...opts[i], key: e.target.value }; return { ...f, options: opts };
                    })} />
                  <input type="number" placeholder="Precio" value={opt.value}
                    onChange={e => setItemForm(f => {
                      const opts = [...f.options]; opts[i] = { ...opts[i], value: e.target.value }; return { ...f, options: opts };
                    })} />
                  <button className="remove-btn" type="button"
                    onClick={() => setItemForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div className="toggle-group">
              {[
                { label: "Disponible", desc: "Se puede pedir ahora", key: "available" },
                { label: "Ocultar", desc: "No aparece en el menú público", key: "hidden" },
                { label: "Recomendado", desc: "Se destaca en la carta", key: "recommended" },
              ].map(({ label, desc, key }) => (
                <div key={key} className="toggle-row">
                  <div>
                    <p className="toggle-label">{label}</p>
                    <p className="toggle-desc">{desc}</p>
                  </div>
                  <Toggle
                    checked={itemForm[key as keyof typeof itemForm] as boolean}
                    onChange={() => setItemForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                  />
                </div>
              ))}
            </div>

            <div className="form-btns">
              {activeItem && (
                <button className="delete-btn" type="button"
                  onClick={() => { setDeleteModal({ type: "item", id: activeItem._id, name: activeItem.title }); }}>
                  Eliminar item
                </button>
              )}
              <button className="save-btn" onClick={saveItem} disabled={saving}>
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
          <div className="content form-content">
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Nombre *</label>
              <input type="text" placeholder="Ej: Pizzas" value={categoriaForm.title}
                onChange={e => setCategoriaForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Descripción</label>
              <input type="text" placeholder="Opcional" value={categoriaForm.description}
                onChange={e => setCategoriaForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="field">
              <label>Código interno</label>
              <input type="text" placeholder="Ej: pizzas" value={categoriaForm.code}
                onChange={e => setCategoriaForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            {!categoriaForm.editingId && (
              <div className="field">
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
            <button className="save-btn" onClick={saveCategoria} disabled={saving}>
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
          <div className="content form-content">
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Nombre *</label>
              <input type="text" placeholder="Ej: Comidas" value={seccionForm.title}
                onChange={e => setSeccionForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Código interno</label>
              <input type="text" placeholder="Ej: comidas" value={seccionForm.code}
                onChange={e => setSeccionForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <button className="save-btn" onClick={saveSeccion} disabled={saving}>
              {saving ? "Guardando..." : seccionForm.editingId ? "Guardar cambios" : "Crear sección"}
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ══════════════════════════════════════════ */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">¿Eliminar "{deleteModal.name}"?</p>
            <p className="modal-desc">
              {deleteModal.type === "item"
                ? "El producto se eliminará permanentemente."
                : deleteModal.type === "categoria"
                  ? "La categoría se eliminará. Debe estar vacía."
                  : "La sección se eliminará. Debe no tener categorías."}
            </p>
            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setDeleteModal(null)}>Cancelar</button>
              <button className="modal-confirm" onClick={confirmDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Estilos ──────────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .me {
          min-height: 100vh; background: #0c0b09;
          font-family: 'DM Sans', system-ui, sans-serif; color: #d4c9b0;
          display: flex; flex-direction: column;
          max-width: 600px; margin: 0 auto;
        }

        /* Top bar */
        .top-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem; border-bottom: 0.5px solid #1e1c18;
          background: #0c0b09; position: sticky; top: 0; z-index: 10;
        }
        .top-title { font-size: 1rem; font-weight: 500; color: #ede4d0; }
        .back-btn {
          width: 36px; height: 36px; background: #181614; border: 0.5px solid #272420;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #a09070; transition: border-color 0.15s, color 0.15s;
        }
        .back-btn:hover { border-color: #c9a84c; color: #c9a84c; }

        /* Contenido */
        .content { flex: 1; padding: 1rem 1rem 6rem; }
        .form-content { padding-bottom: 2rem; }

        /* Bloque de sección */
        .seccion-block { margin-bottom: 1.25rem; }
        .seccion-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.5rem 0.25rem; margin-bottom: 0.4rem;
        }
        .seccion-left { display: flex; align-items: center; gap: 8px; }
        .seccion-badge {
          font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase;
          color: #c9a84c; background: #1e1a10; border: 0.5px solid #3a3020;
          padding: 2px 8px; border-radius: 4px; white-space: nowrap;
        }
        .seccion-title { font-size: 0.88rem; font-weight: 500; color: #ede4d0; }

        /* Acciones (editar / eliminar) */
        .row-actions { display: flex; gap: 4px; }
        .icon-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: #181614; border: 0.5px solid #272420;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #6b6457; transition: border-color 0.15s, color 0.15s;
        }
        .icon-btn:hover { border-color: #c9a84c; color: #c9a84c; }
        .icon-btn.danger:hover { border-color: #7a2020; color: #c97070; }

        /* Acordeón de categoría */
        .cat-acordeon { margin-bottom: 0.5rem; }
        .cat-header {
          display: flex; align-items: center; gap: 0.75rem;
          background: #131210; border: 0.5px solid #272420;
          border-radius: 12px; padding: 0.85rem 1rem;
          cursor: pointer; transition: border-color 0.15s;
          width: 100%;
        }
        .cat-header.open { border-color: #3a3020; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .cat-header:hover { border-color: #c9a84c44; }
        .cat-chevron { color: #3d3a33; transition: transform 0.2s; flex-shrink: 0; }
        .cat-chevron.open { transform: rotate(90deg); }
        .cat-header-info { flex: 1; text-align: left; }
        .cat-header-name { display: block; font-size: 0.92rem; font-weight: 500; color: #ede4d0; }
        .cat-header-meta { display: block; font-size: 0.72rem; color: #5c5649; margin-top: 2px; }

        /* Cuerpo del acordeón */
        .cat-body {
          background: #0f0e0c; border: 0.5px solid #3a3020;
          border-top: none; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;
          overflow: hidden;
        }

        /* Fila de item dentro del acordeón */
        .item-row-ac {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 1rem; border-bottom: 0.5px solid #1e1c18;
        }
        .item-row-ac:last-child { border-bottom: none; }
        .item-info-ac { flex: 1; cursor: pointer; }
        .item-name-ac { display: block; font-size: 0.88rem; font-weight: 500; color: #ede4d0; }
        .item-meta-ac { display: block; font-size: 0.72rem; color: #5c5649; margin-top: 1px; }
        .item-actions { display: flex; gap: 4px; align-items: center; }

        /* Pill disponible/pausado */
        .pill-btn {
          font-size: 0.68rem; padding: 3px 8px; border-radius: 20px; border: none;
          cursor: pointer; font-family: inherit; font-weight: 500; white-space: nowrap;
        }
        .pill-on  { background: #0d2b18; color: #4caf82; }
        .pill-off { background: #2a1a0a; color: #c9804c; }

        /* Footer del acordeón con botón + Item */
        .cat-footer {
          display: flex; justify-content: flex-end;
          padding: 0.6rem 1rem; border-top: 0.5px solid #1e1c18;
        }
        .add-item-btn {
          background: none; border: 0.5px solid #3a3020; border-radius: 8px;
          padding: 0.4rem 0.9rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.78rem; color: #c9a84c; cursor: pointer; transition: border-color 0.15s;
        }
        .add-item-btn:hover { border-color: #c9a84c; }

        /* FABs */
        .fab-group {
          position: fixed; bottom: 5rem;
          right: max(1.25rem, calc(50% - 288px));
          display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-end;
        }
        .fab {
          background: #c9a84c; border: none; border-radius: 14px;
          padding: 0.85rem 1.5rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.9rem; font-weight: 500; color: #0c0b09; cursor: pointer;
          transition: background 0.2s; box-shadow: 0 4px 20px rgba(201,168,76,0.25);
        }
        .fab:hover { background: #dabb62; }
        .fab-secondary {
          background: #1e1c17; border: 0.5px solid #3a3020; border-radius: 14px;
          padding: 0.85rem 1.25rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.9rem; font-weight: 500; color: #c9a84c;
          cursor: pointer; transition: border-color 0.2s;
        }
        .fab-secondary:hover { border-color: #c9a84c; }

        /* Formularios */
        .field { margin-bottom: 1.1rem; }
        .field label {
          display: block; font-size: 0.72rem; letter-spacing: 0.1em;
          text-transform: uppercase; color: #5c5649; margin-bottom: 0.4rem;
        }
        .field-label-row {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;
        }
        .field-label-row label {
          font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: #5c5649;
        }
        .field input, .field textarea, .field select {
          width: 100%; background: #0e0d0b; border: 0.5px solid #272420;
          border-radius: 10px; padding: 0.75rem 1rem;
          font-size: 0.9rem; color: #d4c9b0;
          font-family: 'DM Sans', system-ui, sans-serif;
          outline: none; transition: border-color 0.2s;
        }
        .field textarea { min-height: 80px; resize: vertical; }
        .field select option { background: #131210; }
        .field input:focus, .field textarea:focus, .field select:focus { border-color: #c9a84c; }
        .field input::placeholder, .field textarea::placeholder { color: #333029; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        /* Variantes */
        .option-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .option-row input { flex: 1; }
        .option-row input:last-of-type { max-width: 90px; }
        .remove-btn {
          background: #1e1209; border: 0.5px solid #4a2010; border-radius: 8px;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #b86040; flex-shrink: 0;
        }

        /* Toggles */
        .toggle-group {
          margin: 1.25rem 0; border: 0.5px solid #1e1c18; border-radius: 12px; overflow: hidden;
        }
        .toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.9rem 1rem; border-bottom: 0.5px solid #1e1c18;
        }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-label { font-size: 0.88rem; font-weight: 500; color: #ede4d0; }
        .toggle-desc  { font-size: 0.75rem; color: #5c5649; margin-top: 2px; }
        .toggle {
          width: 44px; height: 26px; border-radius: 13px;
          background: #1e1c17; border: 0.5px solid #2e2b23;
          cursor: pointer; position: relative; transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle.on { background: #2a3d1a; border-color: #4c7a2e; }
        .toggle-knob {
          position: absolute; top: 3px; left: 3px;
          width: 18px; height: 18px; border-radius: 50%;
          background: #5c5649; transition: transform 0.2s, background 0.2s;
        }
        .toggle.on .toggle-knob { transform: translateX(18px); background: #7ec850; }

        /* Botones del form */
        .form-btns { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.5rem; }
        .save-btn {
          width: 100%; background: #c9a84c; border: none; border-radius: 12px;
          padding: 0.9rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.95rem; font-weight: 500; color: #0c0b09;
          cursor: pointer; transition: background 0.2s;
        }
        .save-btn:hover:not(:disabled) { background: #dabb62; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .delete-btn {
          width: 100%; background: none; border: 0.5px solid #5a2020;
          border-radius: 12px; padding: 0.9rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.95rem; font-weight: 500; color: #c97070;
          cursor: pointer; transition: background 0.2s;
        }
        .delete-btn:hover { background: #1f1010; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 100; padding: 1rem;
        }
        .modal {
          background: #1a1816; border: 0.5px solid #3a3020;
          border-radius: 16px; padding: 1.5rem;
          width: 100%; max-width: 400px;
        }
        .modal-title { font-size: 1rem; font-weight: 500; color: #ede4d0; margin-bottom: 0.5rem; }
        .modal-desc  { font-size: 0.82rem; color: #5c5649; margin-bottom: 1.25rem; line-height: 1.5; }
        .modal-btns  { display: flex; gap: 0.6rem; }
        .modal-cancel {
          flex: 1; background: #131210; border: 0.5px solid #272420;
          border-radius: 10px; padding: 0.75rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.9rem; color: #6b6457; cursor: pointer;
        }
        .modal-confirm {
          flex: 1; background: #5a2020; border: none; border-radius: 10px; padding: 0.75rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.9rem; font-weight: 500; color: #ffb0b0; cursor: pointer;
          transition: background 0.2s;
        }
        .modal-confirm:hover { background: #7a2828; }

        /* Misc */
        .text-btn {
          background: none; border: none; color: #c9a84c;
          font-size: 0.82rem; cursor: pointer; padding: 0; font-family: inherit;
        }
        .empty-hint { font-size: 0.82rem; color: #3d3a33; padding: 0.5rem 0; }
        .error-banner {
          background: #1c1009; border: 0.5px solid #4a2010; border-radius: 8px;
          padding: 0.65rem 1rem; font-size: 0.82rem; color: #b86040; margin-bottom: 1rem;
        }
        .page-center {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; background: #0c0b09;
        }
        .loader-ring {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid #272420; border-top-color: #c9a84c;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
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
    <div className="cat-acordeon">
      <div className={`cat-header ${expanded ? "open" : ""}`}>
        <svg
          className={`cat-chevron ${expanded ? "open" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          onClick={onToggle} style={{ cursor: "pointer" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>

        <div className="cat-header-info" onClick={onToggle}>
          <span className="cat-header-name">{cat.title}</span>
          <span className="cat-header-meta">
            {cat.items?.length ?? 0} items{cat.hidden ? " · oculta" : ""}
          </span>
        </div>

        <div className="row-actions">
          <button className="icon-btn" onClick={onEditCat} title="Editar categoría">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className="icon-btn danger" onClick={onDeleteCat} title="Eliminar categoría">
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
          className={`cat-body ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(e) => onDragOver(e, cat._id)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, cat._id)}
        >
          {cat.items?.length === 0 && (
            <p className="empty-hint" style={{ padding: "1rem", textAlign: "center", fontStyle: "italic" }}>
              Arrastra items aquí
            </p>
          )}

          {cat.items?.map((item: any) => (
            <div
              key={item._id}
              className={`item-row-ac ${draggedItem === item._id ? "dragging" : ""}`}
              draggable
              onDragStart={(e) => onDragStart(e, item._id)}
              onDragEnd={onDragEnd}
            >
              <div className="item-info-ac" onClick={() => onEditItem(item)}>
                <span className="item-name-ac">{item.title}</span>
                <span className="item-meta-ac">
                  {item.price != null
                    ? `$${item.price}`
                    : Object.keys(item.options || {}).length > 0
                      ? "Con variantes"
                      : "Sin precio"}
                  {item.hidden ? " · oculto" : ""}
                  {item.recommended ? " · ⭐" : ""}
                </span>
              </div>

              <div className="item-actions">
                <button
                  className={`pill-btn ${item.available ? "pill-on" : "pill-off"}`}
                  onClick={() => onToggleAvailable(item)}
                >
                  {item.available ? "Activo" : "Pausado"}
                </button>
                <button className="icon-btn danger" onClick={() => onDeleteItem(item)} title="Eliminar">
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

          <div className="cat-footer">
            <button className="add-item-btn" onClick={onNewItem}>+ Agregar item</button>
          </div>
        </div>
      )}
    </div>
  );
}