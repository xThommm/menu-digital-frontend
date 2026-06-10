import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { User, Item } from "../../../../types/index";
import styles from "./UserMenu.module.css";


// ── Helpers de formato ────────────────────────────────────────────────────────

/** Devuelve el menor valor de un mapa de opciones, o null si está vacío */
const minOption = (options: Record<string, number>): number | null => {
  const vals = Object.values(options);
  return vals.length > 0 ? Math.min(...vals) : null;
};

/** Formatea un número como precio en pesos argentinos sin decimales */
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * MenuPage
 * Obtiene y renderiza el menú público de un negocio a partir del slug en la URL.
 * Organiza las categorías en tabs por sección para facilitar la navegación.
 */
export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser]           = useState<User | null>(null);
  const [menu, setMenu]           = useState<MenuData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  /** Carga los datos del menú cuando cambia el slug */
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch(`/api/users/${slug}/menu`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setUser(data.user);
        setMenu(data.menu);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [slug]);

  /** Vuelve a la landing page del negocio */
  const goBack = useCallback(() => navigate(`/${slug}`), [slug, navigate]);

  /**
   * Construye los tabs a partir de las secciones y las categorías sin sección.
   * Se memoiza para no recalcular en cada render.
   */
  const tabs = useMemo<Tab[]>(() => {
    if (!menu) return [];
    return [
      ...menu.secciones.map(s => ({ label: s.title, categorias: s.categorias })),
      ...(menu.sinSeccion.length > 0 ? [{ label: "Otros", categorias: menu.sinSeccion }] : []),
    ];
  }, [menu]);

  if (loading)                    return <Loader />;
  if (notFound || !menu || !user) return <NotFound />;

  if (tabs.length === 0) return (
    <EmptyMenu
      name={user.contactInfo.businessName}
      template={user.template}
      onBack={goBack}
    />
  );

  const info       = user.contactInfo;
  const currentTab = tabs[activeTab] ?? tabs[0];

  return (
    <div className={styles.mp} data-template={user.template ?? 1}>

      {/* ── Cabecera con botón volver e info básica del negocio ── */}
      <header className={styles.mpHeader}>
        <button className={styles.mpBack} onClick={goBack} aria-label="Volver">
          <BackIcon />
        </button>
        <div className={styles.mpHeaderInfo}>
          <h1 className={styles.mpName}>{info.businessName || "Menú"}</h1>
          <div className={styles.mpMeta}>
            {info.address     && <span>📍 {info.address}</span>}
            {user.hasDelivery && <span>🛵 Delivery</span>}
          </div>
        </div>
      </header>

      {/* ── Tabs de navegación entre secciones (solo si hay más de una) ── */}
      {tabs.length > 1 && (
        <nav className={styles.mpTabs} role="tablist">
          {tabs.map((tab, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={activeTab === i}
              className={`${styles.mpTab} ${activeTab === i ? styles.active : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {/* ── Listado de categorías e items del tab activo ── */}
      <main className={styles.mpContent}>
        {currentTab.categorias.map(cat => {
          const visibleItems = cat.items.filter(it => !it.hidden);
          if (visibleItems.length === 0) return null;

          return (
            <section key={cat._id} className={styles.mpCat}>
              <h2 className={styles.mpCatTitle}>{cat.title}</h2>
              {visibleItems.map(item => (
                <ItemCard key={item._id} item={item} />
              ))}
            </section>
          );
        })}
      </main>

    </div>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────────

/**
 * ItemCard
 * Tarjeta de un producto individual. Muestra imagen (o placeholder),
 * nombre, descripción, precio, precio tachado si tiene oferta,
 * badge de variantes y estado de disponibilidad.
 */
function ItemCard({ item }: { item: Item }) {
  const hasOptions = Object.keys(item.options ?? {}).length > 0;
  const minPrice   = hasOptions ? minOption(item.options) : null;

  /** Precio a mostrar: precio base si existe, si no el mínimo de opciones */
  const displayPrice = item.price != null ? item.price : minPrice;

  return (
    <article className={`${styles.itemCard} ${!item.available ? styles.unavailable : ""}`}>

      {/* Imagen o placeholder con ícono genérico */}
      {item.image ? (
        <img src={item.image} alt={item.title} className={styles.itemImg} loading="lazy" />
      ) : (
        <div className={styles.itemImgPlaceholder} aria-hidden>
          <ImagePlaceholderIcon />
        </div>
      )}

      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.itemName}>{item.title}</span>
          {item.recommended && (
            <span className={`${styles.badge} ${styles.badgeReco}`} title="Recomendado">⭐</span>
          )}
        </div>

        {item.description && (
          <span className={styles.itemDesc}>{item.description}</span>
        )}

        <div className={styles.itemBottom}>
          {displayPrice != null && (
            <span className={styles.itemPrice}>
              {hasOptions ? `Desde ${fmt(displayPrice)}` : fmt(displayPrice)}
            </span>
          )}

          {/* Precio original tachado cuando hay precio de oferta */}
          {item.offerPrice != null && item.price != null && (
            <span className={styles.itemOffer}>{fmt(item.price)}</span>
          )}

          {hasOptions && (
            <span className={`${styles.badge} ${styles.badgeVariant}`}>Variantes disponibles</span>
          )}

          {!item.available && (
            <span className={styles.itemUnavail}>No disponible</span>
          )}
        </div>
      </div>

    </article>
  );
}

// ── Íconos inline ─────────────────────────────────────────────────────────────
// Componentes para no repetir el SVG en cada uso.

/** Flecha hacia la izquierda para el botón "volver" */
function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/** Ícono genérico de imagen para items sin foto */
function ImagePlaceholderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.3 }} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ── Estados de carga y error ──────────────────────────────────────────────────

/** Spinner mientras se obtienen los datos del menú */
function Loader() {
  return (
    <div className={styles.loaderWrap}>
      <div className={styles.loaderRing} />
    </div>
  );
}

/** Pantalla cuando el slug no existe o la API falla */
function NotFound() {
  return (
    <div className={styles.notFound}>
      <p className={styles.notFoundTitle}>Menú no encontrado</p>
      <p className={styles.notFoundSub}>Este negocio no tiene menú disponible.</p>
    </div>
  );
}

/** Pantalla cuando el negocio existe pero aún no cargó ningún item */
function EmptyMenu({ name, template, onBack }: { name: string; template: number; onBack: () => void }) {
  return (
    <div className={styles.emptyMenu} data-template={template}>
      <p className={styles.emptyMenuTitle}>{name}</p>
      <p className={styles.emptyMenuSub}>El menú todavía no tiene items cargados.</p>
      <button onClick={onBack} className={styles.emptyMenuBtn}>Volver</button>
    </div>
  );
}