import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import type { User, Item, MenuData, Tab } from "../../../../types/index";
import { useReveal } from "../../../../hooks/useReveal";
import { CartProvider } from "../../../../context/CartProvider";
import { useCart } from "../../../../context/useCart";
import type { CartLine } from "../../../../context/CartContext";
import CartDrawer from "./CartDrawer";
import ItemPreviewModal from "./ItemPreviewModal";
import styles from "./UserMenu.module.css";
import BusinessSEO from "../../../Common/BusinessSEO";
import FreePlanAd from "../../../Common/FreePlanAd";
import { isOfferActive } from "../../../../lib/offers";
import { buildOrderMessage, buildWaLink } from "../../../../lib/whatsapp";
import { resolveMenuDisplay } from "../../../../lib/menuDisplay";
import { cartUnitPrice, repriceCartLines } from "../../../../lib/cartPricing";
import { resolveMenuStyle } from "../../../../lib/menuStyles";

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

// Precio de un producto con el mismo criterio en la tarjeta de la lista y en
// la del carrusel de destacados. Con los precios ocultos no hay oferta: el
// backend ya la manda en null, esto es por las dudas — y así el botón
// "Opciones" sigue apareciendo para ver y pedir las variantes por nombre.
function priceInfo(item: Item, hidePrices: boolean) {
  const hasOptions  = Object.keys(item.options ?? {}).length > 0;
  const minPrice    = hasOptions ? minOption(item.options) : null;
  const basePrice   = item.price ?? minPrice;
  const isOnOffer   = !hidePrices && isOfferActive(item);
  const activePrice = isOnOffer ? item.offerPrice! : basePrice;
  const pct         = isOnOffer ? offerPct(item.price!, item.offerPrice!) : null;
  return { hasOptions, minPrice, isOnOffer, activePrice, pct };
}

// Lista sobre la que navega el swipe del preview: la de la pestaña activa o
// la del carrusel de destacados, según desde dónde se abrió.
interface PreviewState {
  items: Item[];
  index: number;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser]         = useState<User | null>(null);
  const [menu, setMenu]         = useState<MenuData | null>(null);
  // Slug al que corresponden `user` y `menu`. En una navegación SPA de una
  // carta a otra la URL cambia antes de que llegue la carta nueva, y el
  // carrito se normaliza contra los productos de la carta cargada (ver
  // repriceCartLines): atado al slug de la URL, leería el carrito del local
  // nuevo contra la carta vieja y lo vaciaría entero.
  const [menuSlug, setMenuSlug] = useState("");
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [preview, setPreview]   = useState<PreviewState | null>(null);
  // Categorías abiertas cuando son desplegables. Vive acá (no en cada
  // sección) para que sobreviva al cambio de pestaña: <main> se remonta con
  // key={activeTab} y perdería el estado.
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set());

  // Analítica por plato (fase 3): abrir la previsualización de un producto
  // cuenta una vista, fire-and-forget — nunca debe afectar la experiencia
  // del cliente si falla. Se deduplica por producto acá y no por tarjeta:
  // con categorías desplegables las tarjetas se desmontan al plegar, y con
  // el carrusel un mismo producto tiene dos tarjetas, así que contar por
  // tarjeta inflaría las vistas según las opciones que tenga el dueño. El
  // registro se vacía al cambiar de pestaña, que es cuando antes se volvía
  // a contar (<main> se remonta con key={activeTab}).
  const viewedItems = useRef<Set<string>>(new Set());
  const trackItemView = useCallback((itemId: string) => {
    if (viewedItems.current.has(itemId)) return;
    viewedItems.current.add(itemId);
    fetch(`/api/users/${slug}/menu/items/${itemId}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchMenu = async () => {
      try {
        const res = await fetch(`/api/users/${slug}/menu`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          else setLoadError(true);
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setMenu(data.menu);
        setMenuSlug(slug ?? "");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
    return () => controller.abort();
  }, [slug]);


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

  // Opciones del dueño sobre cómo se ve la carta (panel de Configuración).
  // Ausentes = todo apagado: la carta se ve como siempre.
  const display = resolveMenuDisplay(user?.menuDisplay);
  const menuStyle = resolveMenuStyle(user?.menuStyle);
  const isBistro = menuStyle === "bistro";
  const collapsible = display.collapsibleCategories;

  // Ítems del tab activo, en el mismo orden en que se ven en pantalla
  // (categoría por categoría, tal como itera el render más abajo) — no el
  // orden de la base de datos. Es la lista sobre la que navega el swipe
  // del modal de previsualización, así que con categorías desplegables
  // solo entran las abiertas: una cerrada no tiene tarjetas en pantalla.
  const visibleTabItems = useMemo(() => {
    const tab = tabs[activeTab];
    if (!tab) return [];
    return tab.categorias
      .filter(cat => !collapsible || openCats.has(cat._id))
      .flatMap(cat => cat.items.filter(it => !it.hidden));
  }, [tabs, activeTab, collapsible, openCats]);

  // Carrusel "Destacados": los recomendados de TODAS las pestañas, en el
  // orden en que aparecen en la carta. Solo los disponibles — el carrusel
  // es una vidriera, no tiene sentido abrir la carta destacando algo que
  // hoy no hay.
  const featuredItems = useMemo(() => {
    const seen = new Set<string>();
    return tabs
      .flatMap(tab => tab.categorias.flatMap(cat => cat.items))
      .filter(it => {
        if (it.hidden || !it.available || !it.recommended || seen.has(it._id)) return false;
        seen.add(it._id);
        return true;
      });
  }, [tabs]);

  // Todos los productos de la carta (todas las pestañas): contra estos se
  // actualiza el carrito guardado al abrirla.
  const menuItems = useMemo(
    () => tabs.flatMap(tab => tab.categorias.flatMap(cat => cat.items)),
    [tabs]
  );

  const toggleCategory = useCallback((id: string) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Referencias para manejar el foco entre tabs.
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabChange = useCallback((index: number, opts?: { focus?: boolean }) => {
    setActiveTab(index);
    // El swipe del preview navega sobre los ítems del tab activo — si el
    // usuario cambia de pestaña con el modal abierto, ese índice ya no
    // correspondería a la misma lista, así que lo cerramos.
    setPreview(null);
    viewedItems.current.clear();
    // Volver al inicio de la lista: como header+tabs son sticky arriba de
    // todo, el tope de la página ya es el inicio visible del contenido.
    // Antes se hacía scrollIntoView(mpContent), que dejaba el arranque de
    // la lista tapado debajo del bloque sticky.
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  if (loadError) return <NotFound unavailable />;
  if (notFound || !menu || !user) return <NotFound />;

  if (tabs.length === 0) {
  return (
    <>
      <BusinessSEO
        user={user}
        slug={slug ?? ""}
        page="menu"
      />

      <EmptyMenu
        name={user.contactInfo.businessName}
        template={user.template}
        menuStyle={menuStyle}
        showAd={user.features?.sin_publicidad !== true}
        onBack={
          user.features?.landing_page === true
            ? goBack
            : undefined
        }
      />
    </>
  );
}

  // Si la pestaña activa se quedó sin productos visibles (ej: se ocultó
  // todo), saltamos a la primera que sí tenga — evita una pantalla en
  // blanco sin ninguna pestaña resaltada. Ajuste de estado durante el
  // render (no en un efecto) para no disparar un render en cascada.
  const firstVisible = tabs.findIndex(hasVisibleItems);
  if (!hasVisibleItems(tabs[activeTab])) {
    if (firstVisible !== -1 && firstVisible !== activeTab) {
      setActiveTab(firstVisible);
    }
  }

    const info = user.contactInfo;
  const currentTab = tabs[activeTab] ?? tabs[0];

  const totalItems = currentTab.categorias.reduce(
    (acc, cat) => acc + cat.items.filter((it) => !it.hidden).length,
    0
  );

  // El pedido por WhatsApp depende solo del plan. Con los precios ocultos
  // se sigue pudiendo pedir, pero el carrito no muestra ningún monto (ni en
  // la barra, ni en el resumen, ni en el drawer) y el mensaje sale con
  // productos y cantidades, sin subtotales ni total.
  const ordersEnabled = user.features?.pedido_whatsapp === true;
  const canOrder = user.hasDelivery === true && ordersEnabled;

  // El carrito guardado se pone al día contra esta carta al montar: fuera
  // lo que ya no se puede pedir y precios actuales (o 0, con los precios
  // ocultos). Ver repriceCartLines.
  const normalizeCart = (lines: CartLine[]) =>
    repriceCartLines(lines, menuItems, { hidePrices: display.hidePrices });

  // El carrusel va solo al inicio de la carta (la primera pestaña con
  // productos), no repetido arriba de cada pestaña.
  const showFeatured =
    display.featuredSection && featuredItems.length > 0 && activeTab === firstVisible;

  // Abrir el preview (desde la lista o desde el carrusel) es lo que cuenta
  // como vista; navegar con swipe dentro del modal no suma.
  const openPreview = (items: Item[], index: number) => {
    trackItemView(items[index]._id);
    setPreview({ items, index });
  };

  const renderItemCards = (items: Item[]) =>
    items.map((item, idx) => (
      <ItemCard
        key={item._id}
        item={item}
        index={idx}
        hasDelivery={canOrder}
        hidePrices={display.hidePrices}
        isBistro={isBistro}
        onOpenPreview={() =>
          openPreview(
            visibleTabItems,
            visibleTabItems.findIndex((i) => i._id === item._id)
          )
        }
      />
    ));

  return (
    <>
      <BusinessSEO
        user={user}
        slug={slug ?? ""}
        page="menu"
      />

      <CartProvider
        slug={menuSlug}
        enabled={ordersEnabled}
        normalize={normalizeCart}
      >
        {user.features?.sin_publicidad !== true && <FreePlanAd />}

        <div
          className={styles.mp}
          data-template={user.template ?? 1}
          data-menu-style={menuStyle}
        >
          {/* ── Cabecera + tabs ── */}
          <div className={styles.mpSticky}>
            <header className={styles.mpHeader}>
              {user.features?.landing_page && (
                <button
                  className={styles.mpBack}
                  onClick={goBack}
                  aria-label="Volver al inicio del local"
                >
                  <BackIcon />
                </button>
              )}

              <div className={styles.mpHeaderInfo}>
                {isBistro && <p className={styles.mpEyebrow}>Nuestra carta</p>}
                <h1 className={styles.mpName}>
                  {info.businessName || "Menú"}
                </h1>

                <div className={styles.mpMeta}>
                  {info.address && (
                    <span>
                      <PinIcon /> {info.address}
                    </span>
                  )}

                  {user.hasDelivery && (
                    <span>
                      <DeliveryIcon /> Delivery
                    </span>
                  )}
                </div>
              </div>
              {isBistro && ordersEnabled && <MenuCartShortcut onClick={() => setCartOpen(true)} />}
            </header>

            {/* Tabs */}
            {tabs.length > 1 && (
              <nav
                className={styles.mpTabs}
                role="tablist"
                aria-label="Secciones del menú"
              >
                {tabs.map(
                  (tab, i) =>
                    hasVisibleItems(tab) && (
                      <button
                        key={i}
                        ref={(el) => {
                          tabRefs.current[i] = el;
                        }}
                        id={`mp-tab-${i}`}
                        role="tab"
                        type="button"
                        tabIndex={activeTab === i ? 0 : -1}
                        aria-selected={activeTab === i}
                        aria-controls="mp-tabpanel"
                        className={`${styles.mpTab} ${
                          activeTab === i ? styles.active : ""
                        }`}
                        onClick={() => handleTabChange(i)}
                        onKeyDown={(e) => handleTabKeyDown(e, i)}
                      >
                        {isBistro && <UtensilsCrossed size={20} strokeWidth={1.5} aria-hidden="true" />}
                        {tab.label}
                      </button>
                    )
                )}
              </nav>
            )}
          </div>

          <div className={styles.mpShell}>
            {/* ── Contenido del tab activo ── */}
            <main
              id="mp-tabpanel"
              role={tabs.length > 1 ? "tabpanel" : undefined}
              aria-labelledby={tabs.length > 1 ? `mp-tab-${activeTab}` : undefined}
              className={styles.mpContent}
              key={activeTab}
            >
              {showFeatured && (
                <FeaturedCarousel
                  items={featuredItems}
                  hidePrices={display.hidePrices}
                  onOpen={(index) => openPreview(featuredItems, index)}
                />
              )}

              {totalItems === 0 ? (
                <p className={styles.mpCatEmpty}>
                  Esta sección no tiene productos disponibles por ahora.
                </p>
              ) : (
                currentTab.categorias.map((cat) => {
                  const visibleItems = cat.items.filter(
                    (it) => !it.hidden
                  );

                  if (visibleItems.length === 0) {
                    return null;
                  }

                  if (!collapsible) {
                    return (
                      <section
                        key={cat._id}
                        className={styles.mpCat}
                      >
                        <h2 className={styles.mpCatTitle}>
                          {cat.title}
                        </h2>

                        {renderItemCards(visibleItems)}
                      </section>
                    );
                  }

                  // Desplegable: las tarjetas se montan recién al abrir, así
                  // el reveal (useReveal) las anima al aparecer igual que al
                  // entrar en pantalla. El contenedor existe siempre para que
                  // aria-controls apunte a algo.
                  const open = openCats.has(cat._id);
                  const panelId = `mp-cat-${cat._id}`;
                  const count = visibleItems.length;

                  return (
                    <section
                      key={cat._id}
                      className={styles.mpCatCollapsible}
                    >
                      <h2 className={styles.mpCatTitle}>
                        <button
                          type="button"
                          className={styles.mpCatToggle}
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => toggleCategory(cat._id)}
                        >
                          <span className={styles.mpCatToggleLabel}>
                            {cat.title}
                          </span>
                          <span className={styles.mpCatCount} aria-hidden>
                            {count}
                          </span>
                          <span className="sr-only">
                            , {count} {count === 1 ? "producto" : "productos"}
                          </span>
                          <ChevronDownIcon className={styles.mpCatChevron} />
                        </button>
                      </h2>

                      <div
                        id={panelId}
                        className={styles.mpCatItems}
                        hidden={!open}
                      >
                        {open && renderItemCards(visibleItems)}
                      </div>
                    </section>
                  );
                })
              )}
            </main>

            {ordersEnabled && (
              <OrderSummary
                businessName={info.businessName || "el local"}
                whatsappNumber={info.number}
                orderMessage={info.orderMessage}
                hidePrices={display.hidePrices}
              />
            )}
          </div>

          {ordersEnabled && (
            <CartBar
              onClick={() => setCartOpen(true)}
              hidePrices={display.hidePrices}
            />
          )}

          {/* El drawer queda dentro de .mp para heredar los tokens del template */}
          {ordersEnabled && (
            <CartDrawer
              open={cartOpen}
              onClose={() => setCartOpen(false)}
              businessName={info.businessName || "el local"}
              whatsappNumber={info.number}
              orderMessage={info.orderMessage}
              hidePrices={display.hidePrices}
            />
          )}

          {preview !== null && (
            <ItemPreviewModal
              items={preview.items}
              index={preview.index}
              onClose={() => setPreview(null)}
              hasDelivery={canOrder}
              hidePrices={display.hidePrices}
              showOptionsInitially={isBistro}
              onNavigate={(index) =>
                setPreview((prev) => (prev ? { ...prev, index } : prev))
              }
            />
          )}
        </div>
      </CartProvider>
    </>
  );
}

// ── Componentes de nivel de módulo (fuera de MenuPage a propósito: así
// React no los remonta en cada render del padre y conservan su estado
// interno entre renders) ────────────────────────────────────────────────

// ── Botón flotante del carrito ────────────────────────────────────────────────
function MenuCartShortcut({ onClick }: { onClick: () => void }) {
  const { totalItems } = useCart();
  return (
    <button className={styles.mpCartShortcut} type="button" onClick={onClick}
      aria-label={`Ver pedido (${totalItems} productos)`}>
      <ShoppingBag size={21} strokeWidth={1.7} aria-hidden="true" />
      {totalItems > 0 && <span>{totalItems}</span>}
    </button>
  );
}

// Con los precios ocultos queda la cantidad y "Ver pedido"; la flecha se
// mantiene a la derecha, donde iba el total.
function CartBar({ onClick, hidePrices }: { onClick: () => void; hidePrices: boolean }) {
  const { totalItems, totalPrice } = useCart();
  if (totalItems === 0) return null;

  return (
    <button className={styles.cartBar} onClick={onClick} type="button" aria-label={`Ver pedido (${totalItems} productos)`}>
      <span className={styles.cartBarCount}>{totalItems}</span>
      <span className={styles.cartBarLabel}>Ver pedido</span>
      <span className={styles.cartBarTotal}>
        {!hidePrices && <>{fmt(totalPrice)}{" "}</>}
        <span aria-hidden>→</span>
      </span>
    </button>
  );
}

// Con los precios ocultos las líneas van sin monto y no hay fila de total
// (las líneas del carrito valen 0: mostrarlas diría "$0").
function OrderSummary({
  businessName,
  whatsappNumber,
  orderMessage,
  hidePrices,
}: {
  businessName: string;
  whatsappNumber: number | null;
  orderMessage?: string;
  hidePrices: boolean;
}) {
  const { items, totalPrice, updateQuantity, clearCart } = useCart();
  if (items.length === 0) return null;

  const waLink = buildWaLink(
    whatsappNumber,
    buildOrderMessage(items, businessName, orderMessage, { hidePrices })
  );

  return (
    <aside className={styles.orderSummary} aria-label="Tu pedido">
      <div className={styles.orderSummaryHeader}>
        <div>
          <h2>Tu pedido</h2>
          <span>{items.reduce((sum, item) => sum + item.quantity, 0)} productos</span>
        </div>
        <CartIcon />
      </div>
      <ul className={`${styles.orderLines} ${hidePrices ? styles.orderLinesNoTotal : ""}`}>
        {items.map((line) => (
          <li key={`${line.itemId}::${line.selectedOption ?? ""}`} className={styles.orderLine}>
            <div className={styles.orderLineInfo}>
              <strong>{line.title}</strong>
              {line.selectedOption && <span>{line.selectedOption}</span>}
              {!hidePrices && (
                <span className={styles.orderLinePrice}>{fmt(line.unitPrice * line.quantity)}</span>
              )}
            </div>
            <div className={styles.orderQty}>
              <button className="md-glass-button" type="button" onClick={() => updateQuantity(line.itemId, line.selectedOption, line.quantity - 1)} aria-label={`Quitar una unidad de ${line.title}`}>−</button>
              <span>{line.quantity}</span>
              <button className="md-glass-button" type="button" onClick={() => updateQuantity(line.itemId, line.selectedOption, line.quantity + 1)} aria-label={`Agregar una unidad de ${line.title}`}>+</button>
            </div>
          </li>
        ))}
      </ul>
      {!hidePrices && (
        <div className={styles.orderTotal}><span>Total</span><strong>{fmt(totalPrice)}</strong></div>
      )}
      {waLink ? (
        <a className={styles.orderWhatsapp} href={waLink} target="_blank" rel="noopener noreferrer">Pedir por WhatsApp <span aria-hidden>↗</span></a>
      ) : (
        <p className={styles.orderNoWhatsapp}>Este local todavía no cargó un WhatsApp para pedidos.</p>
      )}
      <button
        type="button"
        className={styles.orderClear}
        onClick={() => {
          if (window.confirm("¿Vaciar todo el pedido?")) clearCart();
        }}
      >
        Vaciar pedido
      </button>
    </aside>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  index,
  hasDelivery,
  hidePrices,
  isBistro,
  onOpenPreview,
}: {
  item: Item;
  index: number;
  hasDelivery: boolean;
  hidePrices: boolean;
  isBistro: boolean;
  onOpenPreview: () => void;
}) {

  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { ref, revealed } = useReveal<HTMLElement>();
  const { items: cartItems, addItem, updateQuantity } = useCart();

  const { hasOptions, minPrice, isOnOffer, activePrice, pct } = priceInfo(item, hidePrices);

  // Click en la tarjeta = abrir la previsualización (MenuPage registra la
  // vista). Los controles internos (agregar, cantidad, variantes) ya cortan
  // la propagación con e.stopPropagation(), así que no compiten con este
  // handler.
  const handleCardClick = onOpenPreview;

  // Solo se permite elegir variante puntual cuando NO hay una oferta a nivel
  // de producto (si la hay, "activePrice" ya es un precio único y se agrega
  // como ítem simple, sin variante — ver el control en itemBottom).
  const canPickVariant = hasOptions && !isOnOffer;

  const qtyOf = (selectedOption?: string) =>
    cartItems.find(l => l.itemId === item._id && l.selectedOption === selectedOption)?.quantity ?? 0;

  // Precio con el que entra al carrito sin variante: el mismo activePrice
  // de arriba, salvo con los precios ocultos, donde vale 0 aunque el
  // producto no tenga precio. null = no se puede agregar.
  const simplePrice = cartUnitPrice(item, undefined, { hidePrices });

  const handleAddSimple = () => {
    if (!item.available || simplePrice == null) return;
    addItem({ itemId: item._id, title: item.title, unitPrice: simplePrice });
  };

  // Con los precios ocultos la variante se pide por nombre, sin precio.
  const handleAddVariant = (name: string, price: number) => {
    if (!item.available) return;
    addItem({ itemId: item._id, title: item.title, unitPrice: hidePrices ? 0 : price, selectedOption: name });
  };

  const showImage = item.image && !imgError;

  const cardClass = [
    styles.itemCard,
    !item.available ? styles.unavailable : "",
    item.recommended ? styles.recommended : "",
    revealed ? styles.itemRevealed : "",
  ].filter(Boolean).join(" ");

  return (
    <article
      ref={ref}
      className={cardClass}
      style={{ "--reveal-delay": `${Math.min(index * 0.05, 0.3)}s` } as React.CSSProperties}
      onClick={handleCardClick}
    >
      {showImage ? (
        <img
          src={item.image}
          alt={item.title}
          className={styles.itemImg}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={styles.itemImgPlaceholder}>
          <ImagePlaceholderIcon />
        </div>
      )}

      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          {isBistro ? (
            <button type="button" className={styles.itemName} aria-haspopup="dialog" disabled={!item.available}
              onClick={(event) => { event.stopPropagation(); onOpenPreview(); }}>
              {item.title}
            </button>
          ) : <span className={styles.itemName}>{item.title}</span>}
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
          {/* Precio — un solo estado a la vez: oferta (precio nuevo + tachado
              + badge de descuento) > variantes ("Desde" el mínimo) > simple.
              Con los precios ocultos no va ninguno: el backend manda las
              variantes con valor 0 y saldría "Desde $0". */}
          {hidePrices ? null : isOnOffer ? (
            <>
              <span className={styles.itemPrice}>{fmt(activePrice!)}</span>
              <span className={styles.itemOffer}>{fmt(item.price!)}</span>
              <span className={`${styles.badge} ${styles.badgeOffer}`}>-{pct}%</span>
            </>
          ) : hasOptions ? (
            <span className={styles.itemPrice}>
              Desde {minPrice != null ? fmt(minPrice) : "Consultar"}
            </span>
          ) : (
            activePrice != null && <span className={styles.itemPrice}>{fmt(activePrice)}</span>
          )}

          {/* Con oferta activa el producto se agrega como ítem simple al
              precio de oferta (canPickVariant es false), así que el botón
              de variantes solo aparece cuando el panel realmente abre. */}
          {canPickVariant && (
            <button
              type="button"
              className={`${styles.badge} ${styles.badgeVariant}`}
              aria-expanded={isBistro ? undefined : expanded}
              aria-haspopup={isBistro ? "dialog" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (isBistro) onOpenPreview();
                else setExpanded(prev => !prev);
              }}
            >
              {isBistro ? "Elegir opciones" : <>Opciones {expanded ? "▲" : "▼"}</>}
            </button>
          )}

          {!item.available && (
            <span className={styles.itemUnavail}>No disponible</span>
          )}

          {(!hasOptions || isOnOffer) && item.available && simplePrice != null && hasDelivery && (
            <AddControl
              qty={qtyOf(undefined)}
              onAdd={handleAddSimple}
              onChange={(q) => updateQuantity(item._id, undefined, q)}
            />
          )}

          {canPickVariant && expanded && (
            <div className={styles.optionsContainer}>
              {Object.entries(item.options).map(([name, price]) => (
                <div key={name} className={styles.optionRow}>
                  <span>{name}</span>
                  <div className={styles.optionRowRight}>
                    {/* Sin precios, cada variante es su nombre y el control
                        para pedirla (el valor viene en 0). */}
                    {!hidePrices && <span className={styles.itemPrice}>{fmt(price)}</span>}
                    {item.available && (
                      <AddControl
                        qty={qtyOf(name)}
                        onAdd={() => handleAddVariant(name, price)}
                        onChange={(q) => updateQuantity(item._id, name, q)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Carrusel "Destacados" ─────────────────────────────────────────────────────
// Los recomendados al inicio de la carta, en tarjetas compactas con scroll
// horizontal. Siguen apareciendo también en su categoría: esto es una
// vidriera, no los mueve de lugar.
function FeaturedCarousel({
  items,
  hidePrices,
  onOpen,
}: {
  items: Item[];
  hidePrices: boolean;
  onOpen: (index: number) => void;
}) {
  return (
    <section className={styles.featured} aria-labelledby="mp-featured-title">
      <h2 id="mp-featured-title" className={styles.featuredTitle}>
        <StarIcon size={11} /> Destacados
      </h2>
      <ul className={styles.featuredTrack}>
        {items.map((item, i) => (
          <li key={item._id} className={styles.featuredSlide}>
            <FeaturedCard
              item={item}
              hidePrices={hidePrices}
              onOpen={() => onOpen(i)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedCard({
  item,
  hidePrices,
  onOpen,
}: {
  item: Item;
  hidePrices: boolean;
  onOpen: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const { hasOptions, minPrice, isOnOffer, activePrice } = priceInfo(item, hidePrices);

  return (
    <button
      type="button"
      className={styles.featuredCard}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      {/* alt vacío: el nombre ya está escrito en la tarjeta y el botón lo
          leería dos veces. */}
      {item.image && !imgError ? (
        <img
          src={item.image}
          alt=""
          className={styles.featuredImg}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={styles.featuredImgPlaceholder}>
          <ImagePlaceholderIcon />
        </span>
      )}

      <span className={styles.featuredBody}>
        <span className={styles.featuredName}>{item.title}</span>
        {hidePrices ? null : isOnOffer ? (
          <span className={styles.featuredPrice}>
            {fmt(activePrice!)}{" "}
            <span className={styles.featuredPriceOld}>{fmt(item.price!)}</span>
          </span>
        ) : hasOptions ? (
          minPrice != null && (
            <span className={styles.featuredPrice}>Desde {fmt(minPrice)}</span>
          )
        ) : (
          activePrice != null && (
            <span className={styles.featuredPrice}>{fmt(activePrice)}</span>
          )
        )}
      </span>
    </button>
  );
}

// ── Control de agregar / cantidad (carrito) ───────────────────────────────────
function AddControl({
  qty,
  onAdd,
  onChange
}: {
  qty: number;
  onAdd: () => void;
  onChange: (q: number) => void;
}) {
  const { enabled } = useCart();
  if (!enabled) return null;
  if (qty === 0) {
    return (
      <button
        type="button"
        className={styles.addBtn}
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        aria-label="Agregar al pedido"
      >
        +
      </button>
    );
  }
  return (
    <div className={styles.qtyStepper} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => onChange(qty - 1)} aria-label="Quitar uno">−</button>
      <span>{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="Agregar uno">+</button>
    </div>
  );
}

// ── Skeleton de carga ────────────────────────────────────────────────────────
// Reproduce la silueta real del menú en vez de un spinner genérico: percepción
// de carga más rápida y evita el "salto" de layout cuando llegan los datos.

function MenuSkeleton() {
  return (
    <div className={styles.mp} aria-hidden="true">
      <div className={styles.mpSticky}>
        
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
      </div>
      <div className={styles.mpContent}>
        {/* Dentro de .mpCat para heredar la grilla de 2 columnas en
            desktop — misma silueta que el contenido real. */}
        <div className={styles.mpCat}>
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
      </div>
      <span className="sr-only" role="status">Cargando menú…</span>
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

function StarIcon({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden
      style={{ display: "inline", verticalAlign: "-1px" }}>
      <path d="M12 2 9.1 8.6 2 9.3l5.5 4.8L5.8 21 12 17.3 18.2 21l-1.7-6.9L22 9.3l-7.1-.7Z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

// ── Estados ───────────────────────────────────────────────────────────────────

function NotFound({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <div className="t-notfound" role="alert">
      <p className="t-notfound-title">{unavailable ? "No pudimos cargar el menú" : "Menú no encontrado"}</p>
      <p className="t-notfound-sub">{unavailable ? "El servicio no está disponible por el momento. Intentá nuevamente." : "Este negocio no tiene menú disponible."}</p>
      {unavailable && <button className="t-notfound-retry" onClick={() => window.location.reload()}>Reintentar</button>}
    </div>
  );
}

function EmptyMenu({
  name,
  template,
  menuStyle,
  showAd,
  onBack,
}: {
  name: string;
  template: number;
  menuStyle: string;
  showAd: boolean;
  onBack?: () => void;
}) {
  return (
    <div className={styles.emptyMenu} data-template={template} data-menu-style={menuStyle}>
      <p className={styles.emptyMenuTitle}>{name}</p>
      <p className={styles.emptyMenuSub}>El menú todavía no tiene productos cargados.</p>
      {onBack && <button onClick={onBack} className={styles.emptyMenuBtn}>Volver</button>}
      {showAd && <FreePlanAd />}
    </div>
  );
}
