import { useId, useState, type ReactNode } from "react";
import { buildWaHref, type WaMessageChoice, type WaTarget } from "../../../../lib/whatsapp";
import styles from "./WaTargetPicker.module.css";

interface WaTargetPickerProps {
  targets: WaTarget[];
  // Texto pre-cargado del chat (pedido o reserva).
  message?: string;
  // Alternativa a `message` para los pedidos: un texto por modalidad
  // (delivery / take away, ver buildOrderChoices). Con más de una, lo
  // primero que pregunta el botón es cuál quiere el cliente; con una sola,
  // se usa su texto directamente.
  choices?: WaMessageChoice[];
  // Pregunta que encabeza las modalidades cuando hay más de una.
  choicePrompt?: string;
  // Clase del botón de cada pantalla (carta, drawer, landing): el picker no
  // cambia cómo se ve el CTA, solo lo que pasa al tocarlo.
  className: string;
  children: ReactNode;
  // Pregunta que encabeza la lista cuando hay más de un número.
  prompt: string;
  // Se llama al abrir el chat (no al desplegar la lista): la carta lo usa
  // para contar el pedido en las estadísticas.
  onSend?: () => void;
}

// Botón de WhatsApp para pedidos y reservas. Con un solo número (o sin
// sucursales cargadas) es el link directo de siempre; con varios, el botón
// despliega debajo la lista de sucursales y el cliente elige a cuál
// escribir. Sin números no dibuja nada: cada pantalla decide qué mostrar.
export default function WaTargetPicker({ targets, message, className, children, prompt, onSend }: WaTargetPickerProps) {
    
  const [open, setOpen] = useState(false);
  // Modalidad elegida en el primer paso (solo con varias modalidades y
  // varios números: con uno solo, elegir ya abre el chat).
  const [choiceKey, setChoiceKey] = useState<string | null>(null);
  const listId = useId();

  if (targets.length === 0) return null;

  const askChoice = choices != null && choices.length > 1;
  const singleMessage = choices?.length === 1 ? choices[0].message : message;

  if (targets.length === 1 && !askChoice) {
    return (
      <a className={className} href={buildWaHref(targets[0].phone, message)} target="_blank" rel="noopener noreferrer" onClick={onSend}>
        {children}
      </a>
    );
  }

  const close = () => {
    setOpen(false);
    setChoiceKey(null);
  };
  const chosen = askChoice ? choices.find((c) => c.key === choiceKey) : undefined;
  const showTargets = !askChoice || chosen != null;
  const targetMessage = chosen ? chosen.message : singleMessage;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={className}
        onClick={() => (open ? close() : setOpen(true))}
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
                  onClick={() => { setOpen(false); onSend?.(); }}
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

function ChoiceText({ choice }: { choice: WaMessageChoice }) {
  return (
    <span className={styles.optionText}>
      <span>{choice.label}</span>
      {choice.detail && <span className={styles.optionDetail}>{choice.detail}</span>}
    </span>
  );
}
