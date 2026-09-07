import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/useAuth";
import { getSellerRanking, type RankingPeriod, type SellerRankingEntry } from "../../../api/sellers";
import { formatPaymentAmount } from "../../../lib/adminPayments";
import Spinner from "../../Common/Spinner";
import s from "../sellerPanel.module.css";

const PERIOD_LABEL: Record<RankingPeriod, string> = {
  current: "Ciclo actual",
  previous: "Ciclo anterior",
  historic: "Histórico",
};

export default function SellerRanking() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/sellers" replace />;
  return <SellerRankingForAdmin />;
}

function SellerRankingForAdmin() {
  const [period, setPeriod] = useState<RankingPeriod>("current");
  const ranking = useQuery({
    queryKey: ["seller-ranking", period],
    queryFn: () => getSellerRanking(period),
    staleTime: 15_000,
  });

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Panel de vendedor</p>
          <h1>Ranking</h1>
          <p>Comisión y puntos por vendedor, separado por plan.</p>
        </header>

        <div className={s.toolbar}>
          <label className={s.selectField} htmlFor="ranking-period">
            Período
            <select
              id="ranking-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as RankingPeriod)}
            >
              {(Object.keys(PERIOD_LABEL) as RankingPeriod[]).map((key) => (
                <option key={key} value={key}>{PERIOD_LABEL[key]}</option>
              ))}
            </select>
          </label>
        </div>

        {ranking.isPending ? (
          <div className={s.card}><Spinner label="Cargando ranking" /></div>
        ) : ranking.isError ? (
          <div className={s.error} role="alert">No se pudo cargar el ranking.</div>
        ) : (
          <>
            <RankingChart title="General (básico + pro)" entries={ranking.data?.sellers ?? []} mode="total" />
            <RankingChart title="Plan Pro" entries={ranking.data?.sellers ?? []} mode="pro" />
            <RankingChart title="Plan Básico" entries={ranking.data?.sellers ?? []} mode="basic" />
          </>
        )}
      </div>
    </main>
  );
}

function RankingChart({
  title,
  entries,
  mode,
}: {
  title: string;
  entries: SellerRankingEntry[];
  mode: "total" | "basic" | "pro";
}) {
  const rows = entries
    .map((entry) => ({
      sellerID: entry.sellerID,
      name: entry.name,
      code: entry.code,
      basic: entry.basic.commission,
      pro: entry.pro.commission,
      value: mode === "basic" ? entry.basic.commission : mode === "pro" ? entry.pro.commission : entry.total.commission,
      points: mode === "basic" ? entry.basic.points : mode === "pro" ? entry.pro.points : entry.total.points,
    }))
    .filter((row) => row.value > 0 || row.points > 0)
    .sort((a, b) => b.value - a.value);

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className={`${s.section} ${s.chartCard}`}>
      <h2 className={s.chartTitle}>{title}</h2>
      {mode === "total" && (
        <div className={s.barLegend}>
          <span><span className={`${s.legendDot} ${s.legendDotBasic}`} />Básico</span>
          <span><span className={`${s.legendDot} ${s.legendDotPro}`} />Pro</span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className={s.emptyState}>Sin ventas en este período.</p>
      ) : (
        <div className={s.barList}>
          {rows.map((row) => (
            <div className={s.barRow} key={row.sellerID}>
              <span className={s.barRowName} title={row.name}>{row.name}</span>
              <div className={s.barTrack}>
                {mode !== "pro" && row.basic > 0 && (
                  <div className={s.barSegmentBasic} style={{ width: `${(row.basic / max) * 100}%` }} />
                )}
                {mode !== "basic" && row.pro > 0 && (
                  <div className={s.barSegmentPro} style={{ width: `${(row.pro / max) * 100}%` }} />
                )}
              </div>
              <span className={s.barValue}>
                {formatPaymentAmount(row.value)} · {row.points.toLocaleString("es-AR")} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
