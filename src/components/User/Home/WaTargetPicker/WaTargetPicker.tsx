import { useId, useState, type ReactNode } from "react";
import { buildWaHref, type WaTarget } from "../../../../lib/whatsapp";
import styles from "./WaTargetPicker.module.css";

interface WaTargetPickerProps {
  targets: WaTarget[];
  // Texto pre-cargado del chat (pedido o reserva).
  message?: string;
  // Clase del botón de cada pantalla (carta, drawer, landing): el picker no
  // cambia cómo se ve el CTA, solo lo que pasa al tocarlo.
  className: string;
  children: ReactNode;
  // Pregunta que encabeza la lista cuando hay más de un número.
  prompt: string;
}

// Botón de WhatsApp para pedidos y reservas. Con un solo número (o sin
// sucursales cargadas) es el link directo de siempre; con varios, el botón
// despliega debajo la lista de sucursales y el cliente elige a cuál
// escribir. Sin números no dibuja nada: cada pantalla decide qué mostrar.
export default function WaTargetPicker({ targets, message, className, children, prompt }: WaTargetPickerProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (targets.length === 0) return null;

  if (targets.length === 1) {
    return (
      <a className={className} href={buildWaHref(targets[0].phone, message)} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={listId}
      >
        {children}
      </button>
      {open && (
        <div id={listId} className={styles.panel} role="group" aria-label={prompt}>
          <p className={styles.prompt}>{prompt}</p>
          <ul className={styles.list}>
            {targets.map((target) => (
              <li key={`${target.name}-${target.phone}`}>
                <a
                  className={styles.option}
                  href={buildWaHref(target.phone, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  <span>{target.name}</span>
                  <span className={styles.optionArrow} aria-hidden>↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
