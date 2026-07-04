import { useCart } from "../../../../context/useCart";
import { buildOrderMessage, buildWaLink } from "../../../../lib/whatsapp";
import styles from "./CartDrawer.module.css";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  businessName: string;
  whatsappNumber: number | null;
}

export default function CartDrawer({ open, onClose, businessName, whatsappNumber }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, clearCart, totalPrice } = useCart();

  if (!open) return null;

  const waLink = buildWaLink(whatsappNumber, buildOrderMessage(items, businessName));

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Tu pedido">
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>Tu pedido</h2>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar" type="button">
            <CloseIcon />
          </button>
        </header>

        {items.length === 0 ? (
          <p className={styles.empty}>Todavía no agregaste nada del menú.</p>
        ) : (
          <>
            <ul className={styles.lines}>
              {items.map((l) => (
                <li key={`${l.itemId}::${l.selectedOption ?? ""}`} className={styles.line}>
                  <div className={styles.lineInfo}>
                    <span className={styles.lineTitle}>{l.title}</span>
                    {l.selectedOption && <span className={styles.lineVariant}>{l.selectedOption}</span>}
                  </div>
                  <div className={styles.lineQty}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.itemId, l.selectedOption, l.quantity - 1)}
                      aria-label={`Quitar una unidad de ${l.title}`}
                    >
                      −
                    </button>
                    <span>{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.itemId, l.selectedOption, l.quantity + 1)}
                      aria-label={`Agregar una unidad de ${l.title}`}
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.linePrice}>{fmt(l.unitPrice * l.quantity)}</span>
                  <button
                    className={styles.lineRemove}
                    onClick={() => removeItem(l.itemId, l.selectedOption)}
                    aria-label={`Quitar ${l.title} del pedido`}
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.total}>
              <span>Total</span>
              <span>{fmt(totalPrice)}</span>
            </div>

            {/* Zona de acciones de checkout — separada a propósito: sumar acá
                un botón de pago con MercadoPago (fase futura) es un cambio
                aislado, no una reestructuración de este componente. */}
            <div className={styles.checkoutActions}>
              {waLink ? (
                <a className={styles.waBtn} href={waLink} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon /> Pedir por WhatsApp
                </a>
              ) : (
                <p className={styles.noWa}>Este local todavía no cargó un WhatsApp para pedidos.</p>
              )}
              <button className={styles.clearBtn} onClick={clearCart} type="button">
                Vaciar pedido
              </button>
            </div>
          </>
        )}
      </div>
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

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.14h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.19-.31a8.18 8.18 0 0 1-1.26-4.35c0-4.53 3.69-8.21 8.24-8.21 2.2 0 4.27.86 5.82 2.42a8.15 8.15 0 0 1 2.41 5.8c0 4.53-3.69 8.22-8.22 8.22Zm4.5-6.16c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.47-.01a.9.9 0 0 0-.65.31c-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
