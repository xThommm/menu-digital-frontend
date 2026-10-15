import type { GroupSession, OccupiedTable, TableSession } from "../types";

// Salón: qué hay en cada mesa del local, de la 1 a la cantidad configurada.

export type FloorTable =
  | { kind: "free"; tableNumber: number; group: GroupSession | null }
  | { kind: "open"; tableNumber: number; session: TableSession; group: GroupSession | null }
  // Mesa de otro operador: el operador solo sabe que está ocupada y por quién.
  | { kind: "other"; tableNumber: number; occupied: OccupiedTable };

export type FloorFilter = "all" | "mine" | "busy" | "free";

export function buildFloor(
  tableCount: number,
  sessions: TableSession[],
  occupied: OccupiedTable[],
  groups: GroupSession[],
): FloorTable[] {
  // Si se bajó la cantidad de mesas con alguna abierta más arriba, igual se muestra.
  const highest = Math.max(
    tableCount,
    ...sessions.map(session => session.tableNumber),
    ...occupied.map(table => table.tableNumber),
    ...groups.map(group => group.tableNumber),
  );
  return Array.from({ length: highest }, (_, index): FloorTable => {
    const tableNumber = index + 1;
    const group = groups.find(g => g.tableNumber === tableNumber) ?? null;
    const session = sessions.find(s => s.tableNumber === tableNumber);
    if (session) return { kind: "open", tableNumber, session, group };
    const other = occupied.find(table => table.tableNumber === tableNumber);
    if (other) return { kind: "other", tableNumber, occupied: other };
    return { kind: "free", tableNumber, group };
  });
}

export const isMine = (table: FloorTable, waiterId?: number) =>
  table.kind === "open" && waiterId !== undefined && table.session.waiterId === waiterId;

export function filterFloor(tables: FloorTable[], filter: FloorFilter, waiterId?: number): FloorTable[] {
  if (filter === "mine") return tables.filter(table => isMine(table, waiterId));
  if (filter === "busy") return tables.filter(table => table.kind !== "free");
  if (filter === "free") return tables.filter(table => table.kind === "free");
  return tables;
}
