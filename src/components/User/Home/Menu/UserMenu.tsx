import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { User, Item, MenuData, Tab } from "../../../../types/index";
import { useReveal } from "../../../../hooks/useReveal";
import styles from "./UserMenu.module.css";

// ── Helpers de formato ────────────────────────────────────────────────────────

const minOption = (options: Record<string, number>): number | null => {
  const vals = Object.values(options);
  return vals.length > 0 ? Math.min(...vals) : null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

// Porcentaje de descuento redondeado, para el badge de oferta.
const offerPct = (original: number, offer: number) =>
  Math.round((1 - offer / original) * 100);

// ── Componente principal ──────────────────────────────────────────────────────

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser]         = useState<User | null>(null);
  const [menu, setMenu]         = useState<MenuData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const fetchMenu = async () => {
      try {
        const res = await fetch(`/api/users/${slug}/menu`, {
          signal: controller.signal,
        });
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setUser(data.user);
        setMenu(data.menu);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    document.title = user?.contactInfo?.businessName
      ? `${user.contactInfo.businessName} — Menú`
      : "Menú";
  }, [user]);

  const goBack = useCallback(() => navigate(`/${slug}`), [slug, navigate]);

  const tabs = useMemo<Tab[]>(() => {
    if (!menu) return [];
    return [
      ...menu.secciones.map(s => ({ label: s.title, categorias: s.categorias })),
      ...(menu.sinSeccion.length > 0 ? [{ label: "Otros", categorias: menu.sinSeccion }] : []),
    ];
  }, [menu]);

  // Un tab "visible" tiene al menos un item no oculto. Se usa tanto para
  // decidir qué botón de pestaña mostrar como para saltar automáticamente
  // si la pestaña activa se queda sin productos (ej: se ocultó todo).
  const hasVisibleItems = (tab: Tab) =>
    tab.categorias.some(cat => cat.items.some(it => !it.hidden));

  // Referencias para manejar foco y scroll entre tabs.
  const contentRef = useRef<HTMLDivElement>(null);
  const tabRefs     = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabChange = useCallback((index: number, opts?: { focus?: boolean }) => {
    setActiveTab(index);
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (opts?.focus) tabRefs.current[index]?.focus();
  }, []);

  // Navegación de tabs con teclado: ← → Home End, como recomienda el patrón
  // de tablist de WAI-ARIA. Hace que la navegación se sienta nativa.
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = tabs.length - 1;
      let next: number | null = null;
      if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
      else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      if (next !== null) {
        e.preventDefault();
        handleTabChange(next, { focus: true });
      }
    },
    [tabs.length, handleTabChange]
  );

  if (loading) return <MenuSkeleton />;
  if (notFound || !menu || !user) return <NotFound />;

  if (tabs.length === 0) {
    return (
      <EmptyMenu
        name={user.contactInfo.businessName}
        template={user.template}
        onBack={goBack}
      />
    );
  }

  // Si la pestaña activa se quedó sin productos visibles (ej: se ocultó
  // todo), saltamos a la primera que sí tenga — evita una pantalla en
  // blanco sin ninguna pestaña resaltada. Ajuste de estado durante el
  // render (no en un efecto) para no disparar un render en cascada.
  if (!hasVisibleItems(tabs[activeTab])) {
    const firstVisible = tabs.findIndex(hasVisibleItems);
    if (firstVisible !== -1 && firstVisible !== activeTab) {
      setActiveTab(firstVisible);
    }
  }

  const info       = user.contactInfo;
  const currentTab = tabs[activeTab] ?? tabs[0];
  const totalItems = currentTab.categorias.reduce(
    (acc, cat) => acc + cat.items.filter(it => !it.hidden).length,
    0
  );

  return (
    <div className={styles.mp} data-template={user.template ?? 1}>

      {/* ── Cabecera ── */}
      <header className={styles.mpHeader}>
        <button className={styles.mpBack} onClick={goBack} aria-label="Volver al inicio del local">
          <BackIcon />
        </button>
        <div className={styles.mpHeaderInfo}>
          <h1 className={styles.mpName}>{info.businessName || "Menú"}</h1>
          <div className={styles.mpMeta}>
            {info.address     && <span><PinIcon /> {info.address}</span>}
            {user.hasDelivery && <span><DeliveryIcon /> Delivery</span>}
          </div>
        </div>
      </header>

      {/* ── Tabs (solo si hay más de una) ── */}
      {tabs.length > 1 && (
        <nav className={styles.mpTabs} role="tablist" aria-label="Secciones del menú">
          {tabs.map((tab, i) => (
            hasVisibleItems(tab) && ( 
            <button
              key={i}
              ref={el => { tabRefs.current[i] = el; }}
              id={`mp-tab-${i}`}
              role="tab"
              type="button"
              tabIndex={activeTab === i ? 0 : -1}
              aria-selected={activeTab === i}
              aria-controls="mp-tabpanel"
              className={`${styles.mpTab} ${activeTab === i ? styles.active : ""}`}
              onClick={() => handleTabChange(i)}
              onKeyDown={e => handleTabKeyDown(e, i)}
            >
              {tab.label}
            </button>
            )
          ))}
        </nav>
      )}

      {/* ── Contenido del tab activo ── */}
      {/* key=activeTab fuerza re-animación de entrada al cambiar de tab,
          sin desmontar el <main> en sí (mantiene el ref y el scroll estables). */}
      <main
        ref={contentRef}
        id="mp-tabpanel"
        role="tabpanel"
        aria-labelledby={`mp-tab-${activeTab}`}
        className={styles.mpContent}
        key={activeTab}
      >
        {totalItems === 0 ? (
          <p className={styles.mpCatEmpty}>Esta sección no tiene productos disponibles por ahora.</p>
        ) : (
          currentTab.categorias.map(cat => {
            const visibleItems = cat.items.filter(it => !it.hidden);
            if (visibleItems.length === 0) return null;

            return (
              <section key={cat._id} className={styles.mpCat}>
                <h2 className={styles.mpCatTitle}>{cat.title}</h2>
                {visibleItems.map((item, idx) => (
                  <ItemCard key={item._id} item={item} index={idx} />
                ))}
              </section>
            );
          })
        )}
      </main>

    </div>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────────
function ItemCard({ item, index }: { item: Item; index: number }) {

  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { ref, revealed } = useReveal<HTMLElement>();

  const hasOptions  = Object.keys(item.options ?? {}).length > 0;
  const minPrice    = hasOptions ? minOption(item.options) : null;
  const basePrice   = item.price ?? minPrice;
  const isOnOffer   = item.offerPrice != null && item.price != null;
  const activePrice = isOnOffer ? item.offerPrice! : basePrice;
  const pct         = isOnOffer ? offerPct(item.price!, item.offerPrice!) : null;


  const showImage = item.image && !imgError;

return (
  <article
  ref={ref}
  className={`${styles.itemCard} ${!item.available ? styles.unavailable : ""} ${item.recommended ? styles.recommended : ""} ${revealed ? styles.itemRevealed : ""}`}
  style={{ "--reveal-delay": `${Math.min(index * 0.05, 0.3)}s` } as React.CSSProperties}
>
    {showImage ? (
  <img
    src={item.image}
    alt={item.title}
    className={styles.itemImg}
    onError={() => setImgError(true)}
  />
) : (
  <div className={styles.itemImgPlaceholder}>
    <ImagePlaceholderIcon />
  </div>
)}

      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.itemName}>{item.title}</span>
          {item.recommended && (
            <span className={`${styles.badge} ${styles.badgeReco}`} title="Recomendado">
              <StarIcon /> Recomendado
            </span>
          )}
        </div>

        {item.description && (
          <span className={styles.itemDesc}>{item.description}</span>
        )}

        <div className={styles.itemBottom}>
          {activePrice != null && !(hasOptions && !isOnOffer) && (
            <span className={styles.itemPrice}>
              {
              hasOptions && !isOnOffer ? fmt(basePrice!) : fmt(activePrice)
              }
            </span>
          )}
          {hasOptions && activePrice && !isOnOffer && (
            <span className={styles.itemPrice}>
              {
              hasOptions ? "Desde " + (minPrice != null ? fmt(minPrice) : "Consultar") : fmt(activePrice)
              }
            </span>
          )}
          {isOnOffer && (
            <>
              <span className={styles.itemOffer}>{fmt(item.price!)}</span>
              <span className={`${styles.badge} ${styles.badgeOffer}`}>-{pct}%</span>
            </>
          )}
          {hasOptions && (
  <button
    type="button"
    className={`${styles.badge} ${styles.badgeVariant}`}
    onClick={(e) => {
      e.stopPropagation();
      setExpanded(prev => !prev);
    }}
  >
    Variantes {expanded ? "▲" : "▼"}
  </button>
)}
          

          
          {!item.available && (
            <span className={styles.itemUnavail}>No disponible</span>
          )}
          {hasOptions && expanded && (
  <div className={styles.optionsContainer}>
    {Object.entries(item.options).map(([name, price]) => (
      <div key={name}>
        <span>{name + "     "} </span>
        <span className={styles.itemPrice}>{fmt(price)}</span>
      </div>
    ))}
  </div>
)}
        </div>
      </div>
    </article>
  );
}

// ── Skeleton de carga ────────────────────────────────────────────────────────
// Reproduce la silueta real del menú en vez de un spinner genérico: percepción
// de carga más rápida y evita el "salto" de layout cuando llegan los datos.

function MenuSkeleton() {
  return (
    <div className={styles.mp} aria-hidden="true">
      <div className={styles.mpHeader}>
        <div className={`${styles.skelBox} ${styles.skelBack}`} />
        <div className={styles.mpHeaderInfo}>
          <div className={`${styles.skelBox} ${styles.skelTitle}`} />
          <div className={`${styles.skelBox} ${styles.skelMeta}`} />
        </div>
      </div>
      <div className={styles.mpTabsSkeleton}>
        {[0, 1, 2].map(i => (
          <div key={i} className={`${styles.skelBox} ${styles.skelTab}`} />
        ))}
      </div>
      <div className={styles.mpContent}>
        <div className={`${styles.skelBox} ${styles.skelCatTitle}`} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={styles.skelItemCard}>
            <div className={`${styles.skelBox} ${styles.skelImg}`} />
            <div className={styles.skelItemBody}>
              <div className={`${styles.skelBox} ${styles.skelLine}`} style={{ width: "60%" }} />
              <div className={`${styles.skelBox} ${styles.skelLine}`} style={{ width: "90%" }} />
              <div className={`${styles.skelBox} ${styles.skelLine}`} style={{ width: "35%" }} />
            </div>
          </div>
        ))}
      </div>
      <span className={styles.srOnly} role="status">Cargando menú…</span>
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

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

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ display: "inline", verticalAlign: "-1px" }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DeliveryIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ display: "inline", verticalAlign: "-1px" }}>
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M15 17.5H9m6 0V6h-3l-6 6v5.5m6-11 4.5 4.5H21l-1.5-4.5H15Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden
      style={{ display: "inline", verticalAlign: "-1px" }}>
      <path d="M12 2 9.1 8.6 2 9.3l5.5 4.8L5.8 21 12 17.3 18.2 21l-1.7-6.9L22 9.3l-7.1-.7Z" />
    </svg>
  );
}

// ── Estados ───────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className={styles.notFound} role="alert">
      <p className={styles.notFoundTitle}>Menú no encontrado</p>
      <p className={styles.notFoundSub}>Este negocio no tiene menú disponible.</p>
    </div>
  );
}

function EmptyMenu({ name, template, onBack }: { name: string; template: number; onBack: () => void }) {
  return (
    <div className={styles.emptyMenu} data-template={template}>
      <p className={styles.emptyMenuTitle}>{name}</p>
      <p className={styles.emptyMenuSub}>El menú todavía no tiene productos cargados.</p>
      <button onClick={onBack} className={styles.emptyMenuBtn}>Volver</button>
    </div>
  );
}