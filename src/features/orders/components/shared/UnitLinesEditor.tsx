import { useState } from "react";
import { MessageSquarePlus, Minus, Plus, Trash2 } from "lucide-react";
import { lineKey, NOTES_MAX, withQuantity, withUnitNote, type UnitLine } from "../../lib/units";
import { formatMoney } from "../../lib/format";
import s from "./UnitLinesEditor.module.css";

// Lista editable del pedido: cantidades y aclaraciones POR UNIDAD. La usan
// el carrito del comensal en la mesa, el tomador de pedidos del mozo y el
// alta manual del panel. Los colores salen de variables --ol-* que define
// cada contenedor (ver UnitLinesEditor.module.css).

interface Props {
  lines: UnitLine[];
  onChange: (lines: UnitLine[]) => void;
  hidePrices?: boolean;
  maxQuantity?: number;
}

export default function UnitLinesEditor({ lines, onChange, hidePrices = false, maxQuantity = 20 }: Props) {
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set());

  const replace = (key: string, next: UnitLine | null) =>
    onChange(next ? lines.map(line => (lineKey(line.itemId, line.option) === key ? next : line))
      : lines.filter(line => lineKey(line.itemId, line.option) !== key));

  const toggleNotes = (key: string) => setOpenNotes(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  if (lines.length === 0) return <p className={s.empty}>Todavía no agregaste productos.</p>;

  return (
    <ul className={s.list}>
      {lines.map(line => {
        const key = lineKey(line.itemId, line.option);
        const notesOpen = openNotes.has(key) || line.unitNotes.some(note => note.trim());
        return (
          <li key={key} className={s.line}>
            <div className={s.row}>
              <div className={s.info}>
                <span className={s.title}>{line.title}</span>
                {line.option && <span className={s.option}>{line.option}</span>}
              </div>
              <div className={s.qty}>
                <button
                  type="button"
                  className={s.qtyBtn}
                  onClick={() => replace(key, line.quantity > 1 ? withQuantity(line, line.quantity - 1) : null)}
                  aria-label={`Quitar una unidad de ${line.title}`}
                >
                  <Minus size={14} aria-hidden />
                </button>
                <span aria-live="polite">{line.quantity}</span>
                <button
                  type="button"
                  className={s.qtyBtn}
                  disabled={line.quantity >= maxQuantity}
                  onClick={() => replace(key, withQuantity(line, line.quantity + 1))}
                  aria-label={`Agregar una unidad de ${line.title}`}
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
              {!hidePrices && <span className={s.price}>{formatMoney(line.unitPrice * line.quantity)}</span>}
              <button
                type="button"
                className={s.iconBtn}
                onClick={() => toggleNotes(key)}
                aria-expanded={notesOpen}
                aria-label={`Aclaraciones de ${line.title}`}
                title="Aclaraciones"
              >
                <MessageSquarePlus size={16} aria-hidden />
              </button>
              <button
                type="button"
                className={`${s.iconBtn} ${s.remove}`}
                onClick={() => replace(key, null)}
                aria-label={`Quitar ${line.title}`}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>

            {notesOpen && (
              <div className={s.notes}>
                {Array.from({ length: line.quantity }, (_, unit) => (
                  <label key={unit} className={s.noteField}>
                    {line.quantity > 1 && <span className={s.noteLabel}>Unidad {unit + 1}</span>}
                    <input
                      type="text"
                      maxLength={NOTES_MAX}
                      value={line.unitNotes[unit] ?? ""}
                      placeholder="Aclaración (ej: sin cebolla)"
                      onChange={event => replace(key, withUnitNote(line, unit, event.target.value))}
                    />
                  </label>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
