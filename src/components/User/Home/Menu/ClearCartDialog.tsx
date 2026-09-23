import { useEffect, useRef } from "react";
import { useCart } from "../../../../context/useCart";
import styles from "./ClearCartDialog.module.css";

// Confirmación de "Vaciar pedido" con el estilo de la carta, en lugar del
// window.confirm del navegador. Se dibuja dentro de .mp (sin portal) para
// heredar los tokens --t-* del template y la familia visual del local; por
// eso la monta UserMenu al lado del CartDrawer, y tanto el drawer como el
// resumen de escritorio solo piden abrirla.
export default function ClearCartDialog({ onClose }: { onClose: () => void }) {
  const { clearCart } = useCart();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Foco en "Cancelar" (la opción segura) y, al cerrar, de vuelta al botón
  // que abrió el diálogo. Escape cierra; Tab queda dentro del diálogo.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const buttons = dialogRef.current.querySelectorAll<HTMLButtonElement>("button");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-cart-title"
        aria-describedby="clear-cart-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="clear-cart-title" className={`${styles.title} t-family-heading`}>¿Vaciar el pedido?</h2>
        <p id="clear-cart-desc" className={styles.text}>
          Se van a quitar todos los productos que agregaste.
        </p>
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => { clearCart(); onClose(); }}
          >
            Vaciar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
