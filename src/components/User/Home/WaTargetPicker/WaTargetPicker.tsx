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
  // Se llama al abrir el chat (no al desplegar la lista ni al elegir una
  // modalidad que todavía pide sucursal): la carta lo usa para contar el
  // pedido en las estadísticas.
  onSend?: () => void;
}

// Botón de WhatsApp para pedidos y reservas. Con un solo número (o sin
// sucursales cargadas) es el link directo de siempre; con varios, el botón
// despliega debajo la lista de sucursales y el cliente elige a cuál
// escribir. Si el pedido ofrece más de una modalidad, antes de la sucursal
// pregunta cuál quiere (con un solo número, esa elección ya abre el chat).
// Sin números no dibuja nada: cada pantalla decide qué mostrar.
export default function WaTargetPicker({
  targets,
  message,
  choices,
  choicePrompt = "¿Cómo querés recibir tu pedido?",
  className,
  children,
  prompt,
  onSend,
}: WaTargetPickerProps) {
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
      <a className={className} href={buildWaHref(targets[0].phone, singleMessage)} target="_blank" rel="noopener noreferrer" onClick={onSend}>
        {children}
      </a>
    );
  }

  const close = () => {
    setOpen(false);
    setChoiceKey(null);
  };
  // Cada link de este panel abre el chat: se cierra y se avisa.
  const send = () => {
    close();
    onSend?.();
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
        <div
          id={listId}
          className={styles.panel}
          role="group"
          aria-label={showTargets ? prompt : choicePrompt}
        >
          {showTargets ? (
            <>
              {chosen && (
                <div className={styles.chosen}>
                  <span>{chosen.label}</span>
                  <button type="button" className={styles.back} onClick={() => setChoiceKey(null)}>
                    Cambiar
                  </button>
                </div>
              )}
              <p className={styles.prompt}>{prompt}</p>
              <ul className={styles.list}>
                {targets.map((target) => (
                  <li key={`${target.name}-${target.phone}`}>
                    <a
                      className={styles.option}
                      href={buildWaHref(target.phone, targetMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={send}
                    >
                      <span>{target.name}</span>
                      <span className={styles.optionArrow} aria-hidden>↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className={styles.prompt}>{choicePrompt}</p>
              <ul className={styles.list}>
                {choices!.map((choice) => (
                  <li key={choice.key}>
                    {targets.length === 1 ? (
                      <a
                        className={styles.option}
                        href={buildWaHref(targets[0].phone, choice.message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={send}
                      >
                        <ChoiceText choice={choice} />
                        <span className={styles.optionArrow} aria-hidden>↗</span>
                      </a>
                    ) : (
                      <button type="button" className={styles.option} onClick={() => setChoiceKey(choice.key)}>
                        <ChoiceText choice={choice} />
                        <span className={styles.optionArrow} aria-hidden>›</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
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
