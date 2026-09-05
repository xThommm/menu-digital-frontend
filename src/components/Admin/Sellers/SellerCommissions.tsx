import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePlans } from "../../../hooks/usePlans";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import {
  buildBreakdown,
  tierForPoints,
  COMMISSION_TIERS,
  CONTRACT_MONTHS,
  POINTS_BY_MONTHS,
  MP_TERMS,
  MP_IVA_PERCENT,
  PDF_REFERENCE_MULTIPLIERS,
  type ContractMonths,
} from "../../../lib/commissions";
import type { PlanDefinition } from "../../../api/plans";
import Spinner from "../../Common/Spinner";
import s from "./SellerCommissions.module.css";

const money = (value: number) => formatPaymentAmount(Math.round(value), "ARS");

// El importe del contrato sale del catálogo vivo, no de la tabla del PDF: los
// multiplicadores son editables desde el panel de planes y hoy ya difieren (el
// PDF usa x3 para 3 meses, el sistema cobra x2,7).
function contractTotal(plan: PlanDefinition, months: ContractMonths, withSellerCode: boolean): number {
  const monthly = withSellerCode ? (plan.discountPrice ?? plan.price) : plan.price;
  const multiplier = plan.periodMultipliers[months] ?? months;
  return Math.round(monthly * multiplier);
}

export default function SellerCommissions() {
  const catalog = usePlans();
  const paidPlans = useMemo(
    () => (catalog.data ?? []).filter((plan) => plan.name !== "free"),
    [catalog.data],
  );

  const [planName, setPlanName] = useState<string>("");
  const [months, setMonths] = useState<ContractMonths>(1);
  const [withSellerCode, setWithSellerCode] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [monthPoints, setMonthPoints] = useState("0");
  const [mpTermId, setMpTermId] = useState(MP_TERMS[0].id);
  const [mpRate, setMpRate] = useState(String(MP_TERMS[0].ratePercent));
  const [mpIva, setMpIva] = useState(String(MP_IVA_PERCENT));

  const selectedPlan = paidPlans.find((plan) => plan.name === planName) ?? paidPlans[0];

  // Duraciones donde el catálogo cobra distinto de lo que asume el PDF. Se
  // avisa explícitamente: si no, la tabla parece equivocada al compararla
  // contra el documento comercial.
  const multiplierMismatches = useMemo(() => {
    const diffs = new Set<ContractMonths>();
    paidPlans.forEach((plan) => {
      CONTRACT_MONTHS.forEach((m) => {
        const real = plan.periodMultipliers[m];
        if (real !== undefined && real !== PDF_REFERENCE_MULTIPLIERS[m]) diffs.add(m);
      });
    });
    return [...diffs].sort((a, b) => a - b);
  }, [paidPlans]);

  // Los puntos del contrato que se está simulando cuentan para el escalafón:
  // si cerrás una venta de 12 meses con 95 puntos previos, esa misma venta te
  // sube a PRO.
  const previousPoints = Number(monthPoints) || 0;
  const contractPoints = POINTS_BY_MONTHS[months];
  const totalPoints = previousPoints + contractPoints;
  const tier = tierForPoints(totalPoints);

  const total = selectedPlan ? contractTotal(selectedPlan, months, withSellerCode) : 0;
  const parsedMpRate = Number(mpRate.replace(",", ".")) || 0;
  const parsedMpIva = Number(mpIva.replace(",", ".")) || 0;

  const breakdown = buildBreakdown({
    contractTotal: total,
    commissionRate: tier.rate,
    months,
    isRenewal,
    mpRatePercent: parsedMpRate,
    mpIvaPercent: parsedMpIva,
  });

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Administración de MenuDigital</p>
          <h1>Comisiones de vendedores</h1>
          <p>
            Simulador de una venta y tabla completa por plan, duración y escalafón.
          </p>
          <div className={s.headerLinks}>
            <Link to="/admin/sellers">← Vendedores</Link>
            <Link to="/admin/sellers/metricas">Métricas del equipo</Link>
          </div>
        </header>

        <aside className={s.rule}>
          <strong>El vendedor cobra solo por la primera venta concretada.</strong>
          <p>
            Si el cliente renueva, esa ganancia es íntegra de Menú Digital. Los puntos
            del escalafón sí suman igual, porque miden actividad comercial y no lo que
            se paga.
          </p>
          <p className={s.ruleNote}>
            Ojo: el PDF "Estructura de Comisiones v6.0" dice lo contrario en su sección 4
            (que la renovación vuelve a pagar comisión). Acá manda esta regla; si se
            cambia de criterio, se ajusta en <code>src/lib/commissions.ts</code>.
          </p>
        </aside>

        {catalog.isPending ? (
          <div className={s.loading}><Spinner size={28} label="Cargando planes" /></div>
        ) : catalog.isError || !selectedPlan ? (
          <div className={s.error} role="alert">
            <p>No se pudo cargar el catálogo de planes, así que no se muestran importes.</p>
            <button
              className={s.secondaryButton}
              type="button"
              onClick={() => void catalog.refetch()}
              disabled={catalog.isFetching}
            >
              {catalog.isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        ) : (
          <>
            <section className={s.calculator} aria-label="Calculadora de una venta">
              <div className={s.controls}>
                <label>
                  Plan
                  <select value={selectedPlan.name} onChange={(e) => setPlanName(e.target.value)}>
                    {paidPlans.map((plan) => (
                      <option key={plan.name} value={plan.name}>
                        {plan.label} — {money(plan.price)}/mes
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Duración
                  <select
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value) as ContractMonths)}
                  >
                    {CONTRACT_MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "mes" : "meses"} ({POINTS_BY_MONTHS[m]} pts)
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Puntos ya acumulados en el mes
                  <input
                    type="number"
                    min={0}
                    value={monthPoints}
                    onChange={(e) => setMonthPoints(e.target.value)}
                  />
                </label>

                <label>
                  Acreditación de Mercado Pago
                  <select
                    value={mpTermId}
                    onChange={(e) => {
                      const term = MP_TERMS.find((t) => t.id === e.target.value);
                      setMpTermId(e.target.value);
                      if (term) setMpRate(String(term.ratePercent));
                    }}
                  >
                    {MP_TERMS.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.label} ({term.ratePercent}% + IVA)
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Comisión MP (%)
                  <input value={mpRate} onChange={(e) => setMpRate(e.target.value)} inputMode="decimal" />
                </label>

                <label>
                  IVA sobre la comisión (%)
                  <input value={mpIva} onChange={(e) => setMpIva(e.target.value)} inputMode="decimal" />
                </label>
              </div>

              <div className={s.toggles}>
                <label>
                  <input
                    type="checkbox"
                    checked={isRenewal}
                    onChange={(e) => setIsRenewal(e.target.checked)}
                  />
                  Es una renovación (no paga comisión)
                </label>
                {selectedPlan.discountPrice !== null && (
                  <label>
                    <input
                      type="checkbox"
                      checked={withSellerCode}
                      onChange={(e) => setWithSellerCode(e.target.checked)}
                    />
                    El cliente usó código de vendedor ({money(selectedPlan.discountPrice)}/mes)
                  </label>
                )}
              </div>

              <div className={s.result}>
                <div className={s.resultRow}>
                  <span>Total del contrato</span>
                  <strong>{money(breakdown.contractTotal)}</strong>
                </div>
                <div className={`${s.resultRow} ${s.negative}`}>
                  <span>Comisión Mercado Pago ({parsedMpRate}% + {parsedMpIva}% IVA)</span>
                  <strong>− {money(breakdown.mpFee)}</strong>
                </div>
                <div className={s.resultRow}>
                  <span>Neto acreditado</span>
                  <strong>{money(breakdown.netCredited)}</strong>
                </div>
                <div className={`${s.resultRow} ${s.negative}`}>
                  <span>
                    Comisión del vendedor
                    {isRenewal ? " (renovación: no aplica)" : ` (${Math.round(tier.rate * 100)}%, nivel ${tier.label})`}
                  </span>
                  <strong>{isRenewal ? money(0) : `− ${money(breakdown.sellerCommission)}`}</strong>
                </div>
                <div className={`${s.resultRow} ${s.total}`}>
                  <span>Queda para Menú Digital</span>
                  <strong>{money(breakdown.companyMargin)}</strong>
                </div>
                <p className={s.pointsNote}>
                  Esta venta suma <strong>{contractPoints} pts</strong>: quedás en{" "}
                  <strong>{totalPoints} pts</strong> y nivel <strong>{tier.label}</strong>
                  {" "}({Math.round(tier.rate * 100)}%).
                </p>
              </div>
            </section>

            <section aria-label="Tabla de comisiones por plan y duración">
              <h2 className={s.tableTitle}>Ganancia del vendedor por cliente</h2>
              <p className={s.tableCaption}>
                Comisión sobre el total del contrato, según el escalafón del mes. Aplica
                solo a la primera venta de cada cliente.
              </p>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">Duración</th>
                      {paidPlans.map((plan) => (
                        <th key={plan.name} scope="col" colSpan={COMMISSION_TIERS.length}>
                          {plan.label} ({money(plan.price)}/mes)
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th scope="col" />
                      {paidPlans.flatMap((plan) =>
                        COMMISSION_TIERS.map((t) => (
                          <th key={`${plan.name}-${t.rate}`} scope="col" className={s.numeric}>
                            {Math.round(t.rate * 100)}%
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {CONTRACT_MONTHS.map((m) => (
                      <tr key={m}>
                        <th scope="row" className={s.rowHead}>
                          {m} {m === 1 ? "mes" : "meses"}
                          <small>{POINTS_BY_MONTHS[m]} pts</small>
                        </th>
                        {paidPlans.flatMap((plan) => {
                          const planTotal = contractTotal(plan, m, false);
                          return COMMISSION_TIERS.map((t) => (
                            <td key={`${plan.name}-${m}-${t.rate}`} className={s.numeric}>
                              {money(planTotal * t.rate)}
                            </td>
                          ));
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {multiplierMismatches.length > 0 && (
                <p className={s.mismatch} role="note">
                  <strong>No coincide con la tabla del PDF en {multiplierMismatches.map((m) => `${m} ${m === 1 ? "mes" : "meses"}`).join(" y ")}.</strong>{" "}
                  El documento asume un multiplicador de{" "}
                  {multiplierMismatches.map((m) => `x${PDF_REFERENCE_MULTIPLIERS[m]}`).join(" y ")}, pero el catálogo
                  cobra{" "}
                  {multiplierMismatches
                    .map((m) => `x${selectedPlan.periodMultipliers[m]}`)
                    .join(" y ")}
                  . Los importes de acá son los que realmente se cobran; si el correcto es
                  el del PDF, hay que corregir el multiplicador en Planes.
                </p>
              )}
              <p className={s.footnote}>
                Los importes salen del catálogo vigente (precio × multiplicador de cada
                plan), no de una tabla fija: si cambiás un precio o un multiplicador en
                Planes, esta tabla acompaña. Las tarifas de Mercado Pago son de
                referencia (agosto 2026) y dependen de tu cuenta — verificalas y editalas
                arriba antes de tomar una decisión con estos números.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
