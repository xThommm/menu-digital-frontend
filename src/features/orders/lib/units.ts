import type { OrderLineInput } from "../types";

// Aclaraciones por unidad: dos milanesas donde solo una va "sin cebolla" se
// cargan como una línea de cantidad 2 con una aclaración por unidad, y se
// envían agrupando las unidades con la misma aclaración:
//   { qty: 2, notes: ["sin cebolla", ""] } → 1× "sin cebolla" + 1× sin aclaración

export interface UnitLine {
  itemId: string;
  title: string;
  option?: string;
  unitPrice: number;
  quantity: number;
  // Una aclaración por unidad (índice = unidad). Puede ser más corto que
  // quantity: las que faltan van sin aclaración.
  unitNotes: string[];
}

export const NOTES_MAX = 140;

export const lineKey = (itemId: string, option?: string) => `${itemId}::${option ?? ""}`;

export function toOrderLines(lines: UnitLine[]): OrderLineInput[] {
  const result: OrderLineInput[] = [];
  for (const line of lines) {
    const groups = new Map<string, number>();
    for (let unit = 0; unit < line.quantity; unit += 1) {
      const note = (line.unitNotes[unit] ?? "").trim().slice(0, NOTES_MAX);
      groups.set(note, (groups.get(note) ?? 0) + 1);
    }
    for (const [note, quantity] of groups) {
      result.push({
        itemId: line.itemId,
        ...(line.option ? { option: line.option } : {}),
        quantity,
        ...(note ? { notes: note } : {}),
      });
    }
  }
  return result;
}

export const unitsTotal = (lines: UnitLine[]) =>
  lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

export const unitsCount = (lines: UnitLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

// Cambia la cantidad conservando las aclaraciones de las unidades que quedan.
export function withQuantity(line: UnitLine, quantity: number): UnitLine {
  return { ...line, quantity, unitNotes: line.unitNotes.slice(0, quantity) };
}

export function withUnitNote(line: UnitLine, unit: number, note: string): UnitLine {
  const unitNotes = [...line.unitNotes];
  while (unitNotes.length <= unit) unitNotes.push("");
  unitNotes[unit] = note.slice(0, NOTES_MAX);
  return { ...line, unitNotes };
}
