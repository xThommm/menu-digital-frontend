import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../../context/useAuth";
import {
  CONTRACT_MONTHS,
  commissionForSale,
  contractPrice,
  pointsForMonths,
  tierForPoints,
  type CommissionPlan,
  type ContractMonths,
} from "../../../lib/sellerCommission";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import { PLAN_LABEL } from "../../../lib/plans";
import s from "../sellerPanel.module.css";

const PLANS: CommissionPlan[] = ["basic", "pro"];
const MONTH_LABEL: Record<ContractMonths, string> = { 1: "1 mes", 3: "3 meses", 6: "6 meses", 12: "12 meses" };

// Las dos tablas de la simulación comparten forma: una fila por plan y una
// columna por duración de contrato; cambia solo el contenido de la celda.
const planColumns = (cell: (plan: CommissionPlan, months: ContractMonths) => ReactNode): DataTableColumn<CommissionPlan>[] => [
  { id: "plan", header: "Plan", resizable: false, render: (plan) => <strong>{PLAN_LABEL[plan]}</strong> },
  ...CONTRACT_MONTHS.map((months): DataTableColumn<CommissionPlan> => ({
    id: String(months),
    header: MONTH_LABEL[months],
    align: "right",
    resizable: false,
    render: (plan) => cell(plan, months),
  })),
];

type Counts = Record<CommissionPlan, Record<ContractMonths, number>>;

const emptyCounts = (): Counts => ({
  basic: { 1: 0, 3: 0, 6: 0, 12: 0 },
  pro: { 1: 0, 3: 0, 6: 0, 12: 0 },
});

export default function SellerSimulation() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [counts, setCounts] = useState<Counts>(emptyCounts);

  const setCount = (plan: CommissionPlan, months: ContractMonths, value: string) => {
    const parsed = Math.max(0, Math.floor(Number(value) || 0));
    setCounts((prev) => ({ ...prev, [plan]: { ...prev[plan], [months]: parsed } }));
  };

  const totals = useMemo(() => {
    let totalClients = 0;
    let totalPoints = 0;
    for (const plan of PLANS) {
      for (const months of CONTRACT_MONTHS) {
        const count = counts[plan][months];
        totalClients += count;
        totalPoints += count * pointsForMonths(months);
      }
    }
    const tier = tierForPoints(totalPoints);

    let totalCommission = 0;
    let totalRevenue = 0;
    const perPlan: Record<CommissionPlan, { commission: number; revenue: number }> = {
      basic: { commission: 0, revenue: 0 },
      pro: { commission: 0, revenue: 0 },
    };
    for (const plan of PLANS) {
      for (const months of CONTRACT_MONTHS) {
        const count = counts[plan][months];
        if (!count) continue;
        const commissionPerClient = commissionForSale(plan, months, tier.rate);
        const revenuePerClient = contractPrice(plan, months);
        totalCommission += count * commissionPerClient;
        totalRevenue += count * revenuePerClient;
        perPlan[plan].commission += count * commissionPerClient;
        perPlan[plan].revenue += count * revenuePerClient;
      }
    }

    return { totalClients, totalPoints, tier, totalCommission, totalRevenue, perPlan };
  }, [counts]);

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Panel de vendedor</p>
          <h1>Simulación de ventas</h1>
          <p>
            Cargá cuántos clientes venderías por plan y duración, y mirá los
            puntos, el nivel de comisión y la ganancia resultante. Usa la
            tabla de referencia fija de la estructura de comisiones, no los
            precios de checkout vigentes.
          </p>
        </header>

        <section className={s.section}>
          <h2 className={s.sectionTitle}>Cantidad de clientes vendidos</h2>
          <DataTable<CommissionPlan>
            caption="Cantidad de clientes vendidos por plan y duración"
            rows={PLANS}
            columns={planColumns((plan, months) => (
              <input
                className={s.simInput}
                type="number"
                min={0}
                inputMode="numeric"
                value={counts[plan][months] || ""}
                placeholder="0"
                aria-label={`Clientes ${PLAN_LABEL[plan]} a ${MONTH_LABEL[months]}`}
                onChange={(event) => setCount(plan, months, event.target.value)}
              />
            ))}
            getRowId={(plan) => plan}
          />
        </section>

        <section className={s.section}>
          <div className={s.statGrid}>
            <div className={s.stat}>
              <strong>{totals.totalClients.toLocaleString("es-AR")}</strong>
              <span>Clientes vendidos (simulados)</span>
            </div>
            <div className={s.stat}>
              <strong>{totals.totalPoints.toLocaleString("es-AR")}</strong>
              <span>Puntos acumulados</span>
            </div>
            <div className={s.stat}>
              <strong>{totals.tier.label} ({Math.round(totals.tier.rate * 100)}%)</strong>
              <span>Nivel de comisión alcanzado</span>
            </div>
            <div className={s.stat}>
              <strong>{formatPaymentAmount(totals.totalCommission)}</strong>
              <span>Comisión total</span>
            </div>
            {isAdmin && (
              <>
                <div className={s.stat}>
                  <strong>{formatPaymentAmount(totals.totalRevenue)}</strong>
                  <span>Facturación total</span>
                </div>
                <div className={s.stat}>
                  <strong>{formatPaymentAmount(totals.totalRevenue - totals.totalCommission)}</strong>
                  <span>Diferencia (facturación − comisión)</span>
                </div>
              </>
            )}
          </div>
        </section>

        <section className={s.section}>
          <h2 className={s.sectionTitle}>Comisión por cliente, según el nivel alcanzado</h2>
          <DataTable<CommissionPlan>
            caption="Comisión por cliente, según el nivel alcanzado"
            rows={PLANS}
            columns={planColumns((plan, months) => formatPaymentAmount(commissionForSale(plan, months, totals.tier.rate)))}
            getRowId={(plan) => plan}
          />
        </section>
      </div>
    </main>
  );
}
