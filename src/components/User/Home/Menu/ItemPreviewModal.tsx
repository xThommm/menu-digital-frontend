/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import type { Item } from "../../../../types/index";
import { useCart } from "../../../../context/useCart";
import styles from "./ItemPreviewModal.module.css";
import { isOfferActive } from "../../../../lib/offers";

// ── Helpers de formato (mismos criterios que en UserMenu.tsx) ──────────────────

const minOption = (options: Record<string, number>): number | null => {
  const vals = Object.values(options);
  return vals.length > 0 ? Math.min(...vals) : null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const offerPct = (original: number, offer: number) =>
  Math.round((1 - offer / original) * 100);

// Umbral de arrastre (px) a partir del cual un swipe cuenta como "cambiar de
// producto" en vez de un toque accidental.
const SWIPE_THRESHOLD = 60;

// Separación entre la tarjeta activa y la que se asoma detrás: si quedara
// pegada (offset exacto de 100%), aparecería de golpe apenas se mueve un
// pixel. Con este margen extra, la tarjeta de atrás "ya estaba ahí" pero
// hay que arrastrar un poco más para que asome — se siente parte de una
// pila, no un elemento que se genera de la nada.
const STACK_GAP = 225;

interface ItemPreviewModalProps {
  items: Item[]; // lista de productos en el orden en que se ven en el menú (ya filtrados de ocultos)
  index: number; // índice activo dentro de `items`
  hasDelivery: boolean; // si el usuario tiene delivery activo (para mostrar o no el control de agregar al pedido)
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function ItemPreviewModal({ items, index, onClose, onNavigate, hasDelivery }: ItemPreviewModalProps) {
  const item = items[index];
  const { items: cartItems, addItem, updateQuantity } = useCart();

  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const startScrollTop = useRef(0);
  const maxScroll = useRef(0);
  // 'swipe' = arrastrando el popup entero para cambiar de producto.
  // 'scroll' = el gesto es para leer la descripción (se lo dejamos al scroll nativo).
  const gestureMode = useRef<"swipe" | "scroll" | null>(null);

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = () => hasPrev && onNavigate(index - 1);
  const goNext = () => hasNext && onNavigate(index + 1);

  // Reset de estado propio del producto (imagen rota, variantes abiertas) al
  // cambiar de ítem — sin esto un error de imagen o un panel abierto en el
  // producto anterior "arrastraría" visualmente al siguiente.
  useEffect(() => {
    setImgError(false);
    setExpanded(false);
    setDragY(0);
  }, [index]);

  // Navegación con teclado: ← → para cambiar de producto, Esc para cerrar.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  // Con el popup abierto, el fondo (el menú) no debe poder scrollear —
  // antes, al arrastrar el popup en mobile, ese mismo gesto también movía
  // la página de atrás.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  if (!item) return null;

  const hasOptions  = Object.keys(item.options ?? {}).length > 0;
  const minPrice    = hasOptions ? minOption(item.options) : null;
  const basePrice   = item.price ?? minPrice;
  const isOnOffer   = isOfferActive(item);
  const activePrice = isOnOffer ? item.offerPrice! : basePrice;
  const pct         = isOnOffer ? offerPct(item.price!, item.offerPrice!) : null;
  const canPickVariant = hasOptions && !isOnOffer;
  const showImage = item.image && !imgError;
  const aptEntries = Object.entries(item.apt ?? {}).filter(([, v]) => v !== "" && v != null);

  const qtyOf = (selectedOption?: string) =>
    cartItems.find(l => l.itemId === item._id && l.selectedOption === selectedOption)?.quantity ?? 0;

  const handleAddSimple = () => {
    if (!item.available || activePrice == null) return;
    addItem({ itemId: item._id, title: item.title, unitPrice: activePrice });
  };

  const handleAddVariant = (name: string, price: number) => {
    if (!item.available) return;
    addItem({ itemId: item._id, title: item.title, unitPrice: price, selectedOption: name });
  };

  // ── Swipe vertical, estilo TikTok: arriba = siguiente, abajo = anterior ──
  // Se arrastra el popup COMPLETO (no solo la imagen). El único cuidado es
  // no pisar el scroll de una descripción larga: al arrancar el gesto
  // guardamos el scroll actual del texto, y solo lo tomamos como "cambiar
  // de producto" si el texto ya está en su límite (arriba o abajo) en la
  // dirección del arrastre — igual que el patrón de las hojas deslizables
  // de Apple/Google Maps.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = contentRef.current;
    startScrollTop.current = el ? el.scrollTop : 0;
    maxScroll.current = el ? el.scrollHeight - el.clientHeight : 0;
    gestureMode.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (gestureMode.current === null && Math.abs(dy) > 6) {
      if (maxScroll.current <= 0) {
        gestureMode.current = "swipe";
      } else if (dy < 0 && startScrollTop.current < maxScroll.current - 1) {
        // Arrastre hacia arriba con texto todavía sin llegar al final: es scroll de lectura.
        gestureMode.current = "scroll";
      } else if (dy > 0 && startScrollTop.current > 1) {
        // Arrastre hacia abajo con el texto no arriba del todo: también es scroll de lectura.
        gestureMode.current = "scroll";
      } else {
        gestureMode.current = "swipe";
      }
    }

    if (gestureMode.current !== "swipe") return;

    e.preventDefault();
    // Resistencia en los extremos: si no hay más producto hacia ese lado,
    // el popup "topa" en vez de arrastrarse libremente.
    const clamped = (!hasNext && dy < 0) || (!hasPrev && dy > 0) ? dy / 3 : dy;
    setDragY(clamped);
  };

  const onTouchEnd = () => {
    if (gestureMode.current === "swipe") {
      if (dragY <= -SWIPE_THRESHOLD && hasNext) goNext();
      else if (dragY >= SWIPE_THRESHOLD && hasPrev) goPrev();
    }
    setDragging(false);
    setDragY(0);
    touchStartY.current = null;
    gestureMode.current = null;
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      {/* Flechas fuera del popup, pegadas a los bordes de la pantalla — solo
          desktop (ver CSS); en mobile se navega con el swipe vertical. */}
      {hasPrev && (
        <button
          className={`${styles.navBtn} ${styles.navPrev}`}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Producto anterior"
          type="button"
        >
          <ChevronIcon direction="left" />
        </button>
      )}
      {hasNext && (
        <button
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Producto siguiente"
          type="button"
        >
          <ChevronIcon direction="right" />
        </button>
      )}

      <div className={styles.stackWrap}>
        {/* Tarjeta que se "asoma" desde atrás mientras se arrastra — el
            mismo efecto de TikTok de ver el próximo contenido antes de
            soltar. Solo una a la vez, según hacia dónde se está arrastrando. */}
        {dragging && gestureMode.current === "swipe" && dragY < 0 && hasNext && (
          <PeekCard item={items[index + 1]} edge="bottom" dragY={dragY} />
        )}
        {dragging && gestureMode.current === "swipe" && dragY > 0 && hasPrev && (
          <PeekCard item={items[index - 1]} edge="top" dragY={dragY} />
        )}

        <div
          className={styles.sheet}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            transform: `translateY(${dragY}px)`,
            transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <button className={styles.close} onClick={onClose} aria-label="Cerrar" type="button">
            <CloseIcon />
          </button>

          <div className={styles.imageZone}>
            {showImage ? (
              <img
                src={item.image}
                alt={item.title}
                className={styles.img}
                draggable={false}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className={styles.imgPlaceholder}>
                <ImagePlaceholderIcon />
              </div>
            )}
          </div>

          <div className={styles.content} ref={contentRef}>
            <div className={styles.top}>
              <h2 className={styles.name}>{item.title}</h2>
              {item.recommended && (
                <span className={`${styles.badge} ${styles.badgeReco}`}>
                  <StarIcon /> Recomendado
                </span>
              )}
            </div>

            {item.description && <p className={styles.desc}>{item.description}</p>}

            {aptEntries.length > 0 && (
            <dl className={styles.aptList}>
              {aptEntries.map(([k, v]) => (
                <div key={k} className={styles.aptRow}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className={styles.priceRow}>
            {isOnOffer ? (
              <>
                <span className={styles.price}>{fmt(activePrice!)}</span>
                <span className={styles.priceOld}>{fmt(item.price!)}</span>
                <span className={`${styles.badge} ${styles.badgeOffer}`}>-{pct}%</span>
              </>
            ) : hasOptions ? (
              <span className={styles.price}>
                Desde {minPrice != null ? fmt(minPrice) : "Consultar"}
              </span>
            ) : (
              activePrice != null && <span className={styles.price}>{fmt(activePrice)}</span>
            )}
          </div>

          {!item.available && <span className={styles.unavail}>No disponible</span>}

          {(!hasOptions || isOnOffer) && item.available && activePrice != null && hasDelivery && (
            <AddControl
              qty={qtyOf(undefined)}
              onAdd={handleAddSimple}
              onChange={(q) => updateQuantity(item._id, undefined, q)}
            />
          )}

          {canPickVariant && (
            <div className={styles.variants}>
              <button
                type="button"
                className={styles.variantsToggle}
                aria-expanded={expanded}
                onClick={() => setExpanded(prev => !prev)}
              >
                Opciones {expanded ? "▲" : "▼"}
              </button>
              {expanded && (
                <div className={styles.optionsContainer}>
                  {Object.entries(item.options).map(([name, price]) => (
                    <div key={name} className={styles.optionRow}>
                      <span>{name}</span>
                      <div className={styles.optionRowRight}>
                        <span className={styles.price}>{fmt(price)}</span>
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
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Tarjeta que se asoma detrás durante el arrastre ─────────────────────────
// Versión liviana (sin controles de carrito) del producto adyacente, para dar
// la sensación de "ya viene lo siguiente" mientras se desliza — no es
// interactiva, solo se ve hasta que el swipe se confirma o se cancela.
function PeekCard({ item, edge, dragY }: { item: Item; edge: "top" | "bottom"; dragY: number }) {
  const hasOptions = Object.keys(item.options ?? {}).length > 0;
  const minPrice    = hasOptions ? minOption(item.options) : null;
  const basePrice   = item.price ?? minPrice;
  const isOnOffer   = isOfferActive(item);
  const activePrice = isOnOffer ? item.offerPrice! : basePrice;

  // calc() mezcla % (tamaño del contenedor) con el px del arrastre en curso,
  // así no hace falta medir el alto por JS. El STACK_GAP extra hace que, a
  // dragY=0, quede un poco más lejos que "justo pegada" — recién empieza a
  // asomar pasado ese margen, como si estuviera esperando más abajo.
  const transform = edge === "bottom"
    ? `translateY(calc(100% + ${STACK_GAP}px + ${dragY}px))`
    : `translateY(calc(-100% - ${STACK_GAP}px + ${dragY}px))`;

  return (
    <div className={styles.peek} style={{ transform }} aria-hidden>
      {item.image ? (
        <img src={item.image} alt="" className={styles.img} draggable={false} />
      ) : (
        <div className={styles.imgPlaceholder}>
          <ImagePlaceholderIcon />
        </div>
      )}
      <div className={styles.peekBody}>
        <span className={styles.peekTitle}>{item.title}</span>
        {activePrice != null && (
          <span className={styles.price}>
            {hasOptions && !isOnOffer ? "Desde " : ""}{fmt(activePrice)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Control de agregar / cantidad (mismo patrón que en UserMenu.tsx) ───────────
function AddControl({
  qty,
  onAdd,
  onChange,
}: {
  qty: number;
  onAdd: () => void;
  onChange: (q: number) => void;
}) {
  if (qty === 0) {
    return (
      <button type="button" className={styles.addBtn} onClick={onAdd} aria-label="Agregar al pedido">
        + Agregar
      </button>
    );
  }
  return (
    <div className={styles.qtyStepper}>
      <button type="button" onClick={() => onChange(qty - 1)} aria-label="Quitar uno">−</button>
      <span>{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="Agregar uno">+</button>
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const points = direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points={points} />
    </svg>
  );
}

function ImagePlaceholderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.3 }} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
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
