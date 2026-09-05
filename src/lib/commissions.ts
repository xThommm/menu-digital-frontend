// ─────────────────────────────────────────────────────────────────────────────
// Comisiones de vendedores
//
// Sigue "Estructura de Comisiones y Políticas Comerciales v6.0".
//
// Renovaciones (sección 4, "Liquidación y Cómputo por Renovación"): el
// vendedor percibe nuevamente la comisión del nuevo contrato, con el
// porcentaje del escalafón del mes en que se efectúa la renovación, y esa
// renovación suma sus puntos al cómputo del mes. Es decir: una renovación se
// liquida igual que una venta nueva.
//
// Queda una ambigüedad del documento que NO se resuelve acá: la cláusula está
// redactada sobre "un cliente contratado por 1 mes [que] renueva", y no dice
// qué pasa cuando el que renueva venía de un contrato de 3, 6 o 12 meses. El
// cálculo trata a todas las renovaciones igual; si la intención fuera pagar
// solo las que vienen de un plan mensual, hay que filtrarlo antes de llamar a
// `buildBreakdown`.
// ─────────────────────────────────────────────────────────────────────────────

export type ContractMonths = 1 | 3 | 6 | 12;

export interface CommissionTier {
  rate: number;
  minPoints: number;
  label: string;
}

// Escala progresiva por puntos acumulados en el mes (PDF, sección 2).
export const COMMISSION_TIERS: CommissionTier[] = [
  { rate: 0.25, minPoints: 0, label: "Base" },
  { rate: 0.3, minPoints: 50, label: "Avanzado" },
  { rate: 0.35, minPoints: 100, label: "PRO" },
];

// Puntos que suma cada contrato según su duración (PDF, sección 1).
export const POINTS_BY_MONTHS: Record<ContractMonths, number> = {
  1: 1,
  3: 3,
  6: 5,
  12: 9,
};

export const CONTRACT_MONTHS: ContractMonths[] = [1, 3, 6, 12];

// Multiplicadores que asume el PDF (x1 / x3 / x5 / x9). Los del sistema son
// editables por plan desde el panel de Planes y hoy ya no coinciden: el
// catálogo usa x2,7 para 3 meses, así que ese contrato sale $80.997 y no los
// $89.997 de la tabla del documento. Se conservan acá solo para poder avisar
// de la diferencia donde se muestran los importes.
export const PDF_REFERENCE_MULTIPLIERS: Record<ContractMonths, number> = {
  1: 1,
  3: 3,
  6: 5,
  12: 9,
};

export function tierForPoints(points: number): CommissionTier {
  // Se recorre de mayor a menor para que 100+ gane sobre 50+.
  return (
    [...COMMISSION_TIERS].reverse().find((tier) => points >= tier.minPoints)
    ?? COMMISSION_TIERS[0]
  );
}

// ── Costos de Mercado Pago ───────────────────────────────────────────────────
// Las tarifas publicadas son "X% + IVA" y cambian según el plazo en que se
// libera el dinero. Son valores de referencia (agosto 2026) y dependen de la
// cuenta: en el panel se pueden editar, no se toman como verdad fija.
export interface MpTerm {
  id: string;
  label: string;
  ratePercent: number;
}

export const MP_TERMS: MpTerm[] = [
  { id: "instant", label: "Al instante", ratePercent: 6.39 },
  { id: "d14", label: "A 14 días", ratePercent: 3.39 },
  { id: "d30", label: "A 30 días", ratePercent: 1.79 },
];

export const MP_IVA_PERCENT = 21;

/** Costo total de cobrar `amount` por Mercado Pago, con IVA incluido. */
export function mercadoPagoFee(
  amount: number,
  ratePercent: number,
  ivaPercent: number = MP_IVA_PERCENT,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const base = amount * (ratePercent / 100);
  return base * (1 + ivaPercent / 100);
}

export interface BreakdownInput {
  /** Importe total del contrato, tal como se le cobra al cliente. */
  contractTotal: number;
  /** Porcentaje del escalafón (0.25 / 0.30 / 0.35). */
  commissionRate: number;
  months: ContractMonths;
  mpRatePercent: number;
  mpIvaPercent?: number;
}

export interface CommissionBreakdown {
  contractTotal: number;
  mpFee: number;
  /** Lo que efectivamente se acredita después del costo de Mercado Pago. */
  netCredited: number;
  /** Comisión del vendedor, calculada sobre el total del contrato (bruto),
   *  igual que en el PDF: 25% de $29.999 son $7.499,75. */
  sellerCommission: number;
  /** Lo que le queda a Menú Digital: neto acreditado menos la comisión. */
  companyMargin: number;
  points: number;
}

export function buildBreakdown({
  contractTotal,
  commissionRate,
  months,
  mpRatePercent,
  mpIvaPercent = MP_IVA_PERCENT,
}: BreakdownInput): CommissionBreakdown {
  const fee = mercadoPagoFee(contractTotal, mpRatePercent, mpIvaPercent);
  // Una renovación se liquida igual que una venta nueva (PDF, sección 4), así
  // que el cálculo no distingue entre las dos.
  const commission = contractTotal * commissionRate;

  return {
    contractTotal,
    mpFee: fee,
    netCredited: contractTotal - fee,
    sellerCommission: commission,
    companyMargin: contractTotal - fee - commission,
    points: POINTS_BY_MONTHS[months],
  };
}
