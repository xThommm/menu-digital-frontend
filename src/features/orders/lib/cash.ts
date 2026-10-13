// Formularios de caja.

// Importe de un campo numérico: null si está vacío.
export const parseAmount = (value: string) => (value === "" ? null : Number(value));

// Cajero elegido: un operador del local (id) o un nombre a mano.
export interface CashierValue {
  id: number | null;
  name: string;
}

export const cashierPayload = (value: CashierValue) => ({
  cashierId: value.id,
  cashierName: value.id === null ? value.name.trim() : undefined,
});
