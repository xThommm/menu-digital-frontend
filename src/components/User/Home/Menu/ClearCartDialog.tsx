import { useCart } from "../../../../context/useCart";
import ConfirmDialog from "../../../Common/ConfirmDialog";

// Confirmación de "Vaciar pedido" con el estilo de la carta, en lugar del
// window.confirm del navegador. Se dibuja dentro de .mp (sin portal) para
// heredar los tokens --t-* del template y la familia visual del local; por
// eso la monta UserMenu al lado del CartDrawer, y tanto el drawer como el
// resumen de escritorio solo piden abrirla.
export default function ClearCartDialog({ onClose }: { onClose: () => void }) {
  const { clearCart } = useCart();

  return (
    <ConfirmDialog
      variant="menu"
      title="¿Vaciar el pedido?"
      message="Se van a quitar todos los productos que agregaste."
      confirmLabel="Vaciar pedido"
      danger
      onAnswer={(accepted) => {
        if (accepted) clearCart();
        onClose();
      }}
    />
  );
}
