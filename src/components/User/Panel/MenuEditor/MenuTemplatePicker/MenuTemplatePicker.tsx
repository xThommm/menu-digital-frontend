import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncAction } from "../../../../../hooks/useAsyncAction";
import { getMenuTemplates, copyMenuTemplates } from "../../../../../api/menuTemplates";
import { useMobileDock } from "../../../../../context/useMobileDock";
import type {
  MenuTemplatesData, MenuTemplateSeccion, MenuTemplateCategoria, CopyMenuTemplatesPayload,
} from "../../../../../types";
import Spinner from "../../../../Common/Spinner";
import styles from "./MenuTemplatePicker.module.css";

interface MenuTemplatePickerProps {
  onBack: () => void;
  onSuccess: () => void; // refetch del padre, para que el menú propio refleje lo agregado
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const icons = {
  back: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  sparkles: (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  ),
};

// IDs de todos los productos de una categoría/sección — base de los cálculos
// de selección completa/parcial (mismo criterio que allInCatSelected en MenuEditor).
const itemIdsOf = (cat: MenuTemplateCategoria) => cat.items.map((item) => item._id);
const itemIdsOfSeccion = (sec: MenuTemplateSeccion) => sec.categorias.flatMap(itemIdsOf);

// Traduce la selección (a nivel producto) al payload mínimo que espera el
// backend: una sección/categoría entera si TODOS sus productos están
// tildados, o los productos sueltos en caso contrario — el backend hace el
// mismo cálculo de "completo o no" al recibirlo (ver menuTemplateController).
const buildPayload = (data: MenuTemplatesData, selectedItemIds: Set<string>): CopyMenuTemplatesPayload => {
  const sectionIds: string[] = [];
  const categoryIds: string[] = [];
  const itemIds: string[] = [];

  const addCategoria = (cat: MenuTemplateCategoria) => {
    const ids = itemIdsOf(cat);
    if (ids.length > 0 && ids.every((id) => selectedItemIds.has(id))) {
      categoryIds.push(cat._id);
    } else {
      ids.forEach((id) => { if (selectedItemIds.has(id)) itemIds.push(id); });
    }
  };

  for (const sec of data.secciones) {
    const secIds = itemIdsOfSeccion(sec);
    if (secIds.length > 0 && secIds.every((id) => selectedItemIds.has(id))) {
      sectionIds.push(sec._id);
    } else {
      sec.categorias.forEach(addCategoria);
    }
  }
  data.sinSeccion.forEach(addCategoria);

  return { sectionIds, categoryIds, itemIds };
};

export default function MenuTemplatePicker({ onBack, onSuccess }: MenuTemplatePickerProps) {
  const loadState = useAsyncAction();
  const copyState = useAsyncAction();

  const [data, setData] = useState<MenuTemplatesData | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Mismo motivo que ImageManager: esta vista ya tiene su propio botón de
  // "volver", el dock de navegación mobile solo taparía contenido.
  const { hide: hideMobileDock, show: showMobileDock } = useMobileDock();
  useEffect(() => {
    hideMobileDock();
    return () => showMobileDock();
  }, [hideMobileDock, showMobileDock]);

  const loadData = useCallback(async () => {
    await loadState.run(async () => {
      const templates = await getMenuTemplates();
      setData(templates);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  const toggleCategoria = useCallback((cat: MenuTemplateCategoria) => {
    const ids = itemIdsOf(cat);
    setSelectedItemIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  }, []);

  const toggleSeccion = useCallback((sec: MenuTemplateSeccion) => {
    const ids = itemIdsOfSeccion(sec);
    setSelectedItemIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  }, []);

  const totalTemplateItems = useMemo(() => {
    if (!data) return 0;
    return data.secciones.reduce((sum, sec) => sum + itemIdsOfSeccion(sec).length, 0)
      + data.sinSeccion.reduce((sum, cat) => sum + itemIdsOf(cat).length, 0);
  }, [data]);

  const handleCopy = useCallback(async () => {
    if (!data || selectedItemIds.size === 0) return;
    await copyState.run(async () => {
      const payload = buildPayload(data, selectedItemIds);
      const result = await copyMenuTemplates(payload);
      setSelectedItemIds(new Set());
      copyState.setSuccess(
        `Se agregaron ${result.createdItems} ${result.createdItems === 1 ? "producto" : "productos"} a tu menú.`
      );
      onSuccess();
    });
  }, [data, selectedItemIds, copyState, onSuccess]);

  const errorMessage = loadState.error || copyState.error;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Volver al menú" title="Volver">
          {icons.back}
        </button>
        <div className={styles.headerTitle}>
          <span className={styles.headerTitleText}>Elegir desde plantilla</span>
          <span className={styles.headerSubtitle}>
            {selectedItemIds.size} de {totalTemplateItems} producto(s) seleccionados
          </span>
        </div>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={selectedItemIds.size === 0 || copyState.loading}
          onClick={handleCopy}
        >
          {copyState.loading ? <Spinner size={16} /> : null}
          Agregar a mi menú{selectedItemIds.size > 0 ? ` (${selectedItemIds.size})` : ""}
        </button>
      </header>

      {errorMessage && <div className={styles.errorBanner} role="alert">{errorMessage}</div>}
      {copyState.success && <div className={styles.successBanner} role="status">{copyState.success}</div>}

      {loadState.loading ? (
        <div className={styles.loadingState}><Spinner size={24} label="Cargando plantillas" /></div>
      ) : !data || (data.secciones.length === 0 && data.sinSeccion.length === 0) ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateIcon}>{icons.sparkles}</span>
          <span>Todavía no hay un menú de plantillas configurado.</span>
        </div>
      ) : (
        <div className={styles.list}>
          {data.secciones.map((sec) => {
            const ids = itemIdsOfSeccion(sec);
            const allSelected = ids.length > 0 && ids.every((id) => selectedItemIds.has(id));
            const someSelected = ids.some((id) => selectedItemIds.has(id));
            return (
              <div key={sec._id} className={styles.seccionBlock}>
                <label className={styles.seccionHeader}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleSeccion(sec)}
                    aria-label={allSelected ? `Deseleccionar toda la sección ${sec.title}` : `Seleccionar toda la sección ${sec.title}`}
                  />
                  <span className={styles.seccionTitle}>{sec.title}</span>
                  <span className={styles.catCount}>{ids.length} producto(s)</span>
                </label>
                {sec.categorias.map((cat) => (
                  <CategoriaBlock key={cat._id} cat={cat} selectedItemIds={selectedItemIds} onToggleCategoria={toggleCategoria} onToggleItem={toggleItem} indented />
                ))}
              </div>
            );
          })}
          {data.sinSeccion.map((cat) => (
            <CategoriaBlock key={cat._id} cat={cat} selectedItemIds={selectedItemIds} onToggleCategoria={toggleCategoria} onToggleItem={toggleItem} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriaBlock({ cat, selectedItemIds, onToggleCategoria, onToggleItem, indented = false }: {
  cat: MenuTemplateCategoria;
  selectedItemIds: Set<string>;
  onToggleCategoria: (cat: MenuTemplateCategoria) => void;
  onToggleItem: (itemId: string) => void;
  indented?: boolean;
}) {
  const ids = itemIdsOf(cat);
  const allSelected = ids.length > 0 && ids.every((id) => selectedItemIds.has(id));
  const someSelected = ids.some((id) => selectedItemIds.has(id));

  return (
    <div className={`${styles.catBlock} ${indented ? styles.catBlockIndented : ""}`}>
      <label className={styles.catHeader}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={() => onToggleCategoria(cat)}
          aria-label={allSelected ? `Deseleccionar todos los productos de ${cat.title}` : `Seleccionar todos los productos de ${cat.title}`}
        />
        {cat.image && <img src={cat.image} alt="" className={styles.catThumb} />}
        <span className={styles.catTitle}>{cat.title}</span>
        <span className={styles.catCount}>{cat.items.length} producto(s)</span>
      </label>
      {cat.items.length === 0 ? (
        <p className={styles.catEmptyNote}>Esta categoría todavía no tiene productos cargados.</p>
      ) : (
        <div className={styles.itemList}>
          {cat.items.map((item) => (
            <label key={item._id} className={styles.itemRow}>
              <input
                type="checkbox"
                checked={selectedItemIds.has(item._id)}
                onChange={() => onToggleItem(item._id)}
              />
              {item.image && <img src={item.image} alt="" className={styles.itemThumb} />}
              <span className={styles.itemTitle}>{item.title}</span>
              {item.price != null && <span className={styles.itemPrice}>{formatPrice(item.price)}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
