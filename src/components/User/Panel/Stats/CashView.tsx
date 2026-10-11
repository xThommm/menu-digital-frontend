import { useMemo, useState } from "react";
import { formatDateTime } from "../../../../features/orders/lib/format";
import type { CashSession } from "../../../../features/orders/types";
import DataTable from "../../../Common/DataTable/DataTable";
import s from "./UserStats.module.css";
import { Donut, Hero, Ring } from "./StatsCharts";
import { buildCashInsights, niceMax, type SalesReport } from "./salesReport";
import { formatCompactMoney, formatDay, formatMoney, formatPercent, plural } from "./statsFormat";

type CashResult = "exact" | "over" | "short" | "uncounted";
const RESULT_LABEL: Record<CashResult, string> = { exact: "Exacto", over: "Sobró", short: "Faltó", uncounted: "Sin contar" };
// Mismos colores que el gráfico de diferencias: son estados, no series.
const RESULT_COLOR: Record<CashResult, string> = {
  exact: "var(--admin-green, var(--admin-gold))",
  over: "color-mix(in srgb, var(--admin-text-primary) 55%, transparent)",
  short: "var(--admin-red-text)",
  uncounted: "var(--viz-rest)",
};
const resultOf = (session: CashSession): CashResult =>
  session.difference === null ? "uncounted" : session.difference === 0 ? "exact" : session.difference < 0 ? "short" : "over";

const differenceLabel = (difference: number | null) => {
  if (difference === null) return "Sin contar";
  if (difference === 0) return "Exacto";
  return `${difference < 0 ? "Faltó" : "Sobró"} ${formatMoney(Math.abs(difference))}`;
};

const closingsLabel = (count: number) => `${count} ${plural(count, "cierre", "cierres")}`;

export default function CashView({ report }: { report: SalesReport }) {
  // De la más reciente a la más vieja, como el historial de Caja.
  const sessions = useMemo(() => [...report.cashSessions].reverse(), [report.cashSessions]);
  const insights = useMemo(() => buildCashInsights(report.cashSessions), [report.cashSessions]);
  const range = `${formatDay(report.periodStart)} al ${formatDay(report.todayDate)}`;
  const registers = useMemo(() => [...new Set(sessions.map(session => session.registerName))].sort(), [sessions]);
  const cashiers = useMemo(() => [...new Set(sessions.map(session => session.cashierName || "Sin cajero"))].sort(), [sessions]);
  const results = (Object.keys(RESULT_LABEL) as CashResult[]).map(key => ({
    key, count: sessions.filter(session => resultOf(session) === key).length,
  }));
  const exact = results.find(result => result.key === "exact")?.count ?? 0;

  if (sessions.length === 0) {
    return (
      <div className={s.emptyCard}>
        <p className={s.emptyTitle}>No hubo cierres de caja en este período</p>
        <p className={s.emptyDesc}>
          Los cierres se hacen desde Gestión de pedidos → Caja. Al cerrar una caja queda guardado lo vendido,
          el efectivo esperado, lo que contaste y la diferencia.
        </p>
      </div>
    );
  }

  return (
    <>
      <Hero
        label={`Diferencia acumulada · ${range}`}
        value={insights.counted === 0 ? "—" : `${insights.difference < 0 ? "−" : ""}${formatMoney(Math.abs(insights.difference))}`}
        foot={insights.counted === 0
          ? "Ningún cierre tiene el efectivo contado"
          : insights.difference === 0 ? "El efectivo contado coincide con el esperado"
            : insights.difference < 0 ? "Faltó efectivo respecto de lo esperado" : "Sobró efectivo respecto de lo esperado"}
        series={report.cashSessions.map(session => session.summary?.netAmount ?? 0)}
        stats={[
          { label: "Cierres de caja", value: String(insights.count) },
          { label: "Neto de los cierres", value: formatMoney(insights.netAmount) },
          { label: "Con diferencia", value: `${insights.shortCount} faltantes · ${insights.overCount} sobrantes` },
        ]}
        aside={insights.counted > 0 && (
          <Ring size="lg" value={exact / insights.counted} label={`${exact} de ${closingsLabel(insights.counted)} con efectivo contado dieron exactos`}>
            <small>Cierres exactos</small>
            <strong>{formatPercent(exact / insights.counted)}</strong>
            <span>{exact} de {insights.counted} contados</span>
          </Ring>
        )}
      />

      <section className={`${s.card} ${s.span8}`}>
        <div className={s.cardHead}>
          <p className={s.cardLabel}>Diferencia por cierre</p>
          <p className={s.cardNote}>
            Efectivo contado menos el esperado, del cierre más viejo al más nuevo.
            {insights.counted < insights.count
              && ` ${insights.count - insights.counted} ${plural(insights.count - insights.counted, "cierre no tiene", "cierres no tienen")} el efectivo contado.`}
          </p>
        </div>
        <DifferenceChart sessions={report.cashSessions} />
      </section>

      <section className={`${s.card} ${s.span4}`}>
        <div className={s.cardHead}>
          <p className={s.cardLabel}>Cómo cerraron</p>
          <p className={s.cardNote}>Resultado del conteo de efectivo de cada cierre</p>
        </div>
        <Donut
          slices={results.map(result => ({
            key: result.key, label: RESULT_LABEL[result.key], value: result.count, color: RESULT_COLOR[result.key],
          }))}
          format={closingsLabel}
          centerLabel="en el período"
          label="Cierres de caja según el resultado del conteo. El detalle está en la lista siguiente."
        />
      </section>

      <section className={`${s.card} ${s.cardWide}`}>
        <div className={s.cardHead}>
          <p className={s.cardLabel}>Cierres del período</p>
          <p className={s.cardNote}>{range} · Filtrá por caja, cajero o resultado</p>
        </div>
        <div className={s.tableWrap}>
          <DataTable<CashSession>
            caption="Cierres de caja del período"
            rows={sessions}
            getRowId={session => String(session.id)}
            defaultSort={{ columnId: "closed", direction: "desc" }}
            countLabel={(visible, total) => (visible === total ? closingsLabel(total) : `${visible} de ${closingsLabel(total)}`)}
            noResultsMessage="Ningún cierre coincide con los filtros."
            minWidth={860}
            columns={[
              { id: "closed", header: "Cierre", sortValue: row => row.closedAt, initialDirection: "desc", render: row => <span className={s.nowrap}>{row.closedAt ? formatDateTime(row.closedAt) : "—"}</span> },
              {
                id: "register", header: "Caja", sortValue: row => row.registerName, render: row => row.registerName,
                filter: { accessor: row => row.registerName, options: registers.map(name => ({ value: name, label: name })), label: "Caja", placeholder: "Todas" },
              },
              {
                id: "cashier", header: "Cajero", sortValue: row => row.cashierName ?? "", render: row => row.cashierName || "—",
                filter: { accessor: row => row.cashierName || "Sin cajero", options: cashiers.map(name => ({ value: name, label: name })), label: "Cajero", placeholder: "Todos" },
              },
              { id: "orders", header: "Pedidos", align: "right", initialDirection: "desc", sortValue: row => row.summary?.salesCount, render: row => row.summary?.salesCount ?? "—" },
              { id: "net", header: "Neto", align: "right", initialDirection: "desc", sortValue: row => row.summary?.netAmount, render: row => (row.summary ? formatMoney(row.summary.netAmount) : "—") },
              { id: "expected", header: "Esperado", align: "right", initialDirection: "desc", sortValue: row => row.summary?.expectedCash, render: row => (row.summary ? formatMoney(row.summary.expectedCash) : "—") },
              { id: "counted", header: "Contado", align: "right", initialDirection: "desc", sortValue: row => row.cashCounted, render: row => (row.cashCounted === null ? "—" : formatMoney(row.cashCounted)) },
              {
                id: "difference", header: "Diferencia", align: "right", sortValue: row => row.difference,
                render: row => (
                  <span className={`${s.nowrap} ${row.difference !== null && row.difference < 0 ? s.diffShort : ""}`}>
                    {differenceLabel(row.difference)}
                  </span>
                ),
                filter: {
                  accessor: row => resultOf(row),
                  options: (Object.keys(RESULT_LABEL) as CashResult[]).map(key => ({ value: key, label: RESULT_LABEL[key] })),
                  label: "Resultado", placeholder: "Todos",
                },
              },
              { id: "notes", header: "Notas", render: row => row.closingNotes || "—" },
            ]}
          />
        </div>
      </section>

      <p className={s.measurementNote}>
        Cada cierre guarda los números del momento en que se cerró la caja. Una devolución posterior se
        registra en la caja que esté abierta, no cambia un cierre anterior.
      </p>
    </>
  );
}

// Barras hacia arriba (sobró) o hacia abajo (faltó) desde la línea de cero.
function DifferenceChart({ sessions }: { sessions: CashSession[] }) {
  const [active, setActive] = useState<number | null>(null);
  const counted = sessions.filter(session => session.difference !== null);
  const max = niceMax(Math.max(0, ...counted.map(session => Math.abs(session.difference ?? 0))));
  const allExact = counted.every(session => session.difference === 0);
  const shown = active !== null ? counted[active] : null;

  if (counted.length === 0) return <p className={s.cardNote}>Contá el efectivo al cerrar la caja para ver acá las diferencias.</p>;
  if (allExact) return <p className={s.cardNote}>Todos los cierres con efectivo contado dieron exactos.</p>;

  return (
    <div className={s.chartBlock}>
      <div className={s.chartFrame}>
        <div className={s.yAxis} aria-hidden>
          <span>{formatCompactMoney(max)}</span>
          <span>$ 0</span>
          <span>−{formatCompactMoney(max)}</span>
        </div>
        <div
          className={`${s.chart} ${s.diffChart}`}
          role="group"
          aria-label="Diferencia de efectivo de cada cierre. El detalle está en la tabla siguiente."
          onMouseLeave={() => setActive(null)}
        >
          <span className={s.gridLine} style={{ bottom: "100%" }} aria-hidden />
          <span className={`${s.gridLine} ${s.zeroLine}`} style={{ bottom: "50%" }} aria-hidden />
          {counted.map((session, i) => {
            const difference = session.difference ?? 0;
            const height = difference === 0 ? 0 : Math.max((Math.abs(difference) / max) * 50, 2);
            return (
              <button
                type="button"
                key={session.id}
                aria-label={`${session.closedAt ? formatDateTime(session.closedAt) : ""}, ${session.registerName}: ${differenceLabel(difference)}`}
                aria-pressed={active === i}
                className={`${s.barWrap} ${active === i ? s.barWrapActive : ""}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}
                onClick={() => setActive(i)}
              >
                <span
                  className={`${s.diffBar} ${difference < 0 ? s.diffBarShort : difference > 0 ? s.diffBarOver : s.diffBarExact}`}
                  style={difference < 0 ? { top: "50%", height: `${height}%` } : { bottom: "50%", height: `${height}%` }}
                />
              </button>
            );
          })}
          {shown && active !== null && (
            <div
              className={s.tooltip}
              aria-hidden="true"
              style={{
                left: `${((active + 0.5) / counted.length) * 100}%`,
                transform: `translateX(-${((active + 0.5) / counted.length) * 100}%)`,
              }}
            >
              <span className={s.tooltipMain}>
                <strong>{differenceLabel(shown.difference)}</strong>
                <small>{shown.closedAt ? formatDateTime(shown.closedAt) : ""}</small>
              </span>
              <small className={s.tooltipLine}>
                {shown.registerName}{shown.cashierName ? ` · ${shown.cashierName}` : ""}
              </small>
            </div>
          )}
        </div>
        <div className={s.chartAxis}>
          <span>{formatDay(counted[0]?.closedAt ?? undefined)}</span>
          <span className={s.chartLegend}>
            <i className={`${s.legendSwatch} ${s.diffBarOver}`} aria-hidden /> Sobró
            <i className={`${s.legendSwatch} ${s.diffBarShort}`} aria-hidden /> Faltó
          </span>
          <span>{formatDay(counted.at(-1)?.closedAt ?? undefined)}</span>
        </div>
      </div>
    </div>
  );
}
