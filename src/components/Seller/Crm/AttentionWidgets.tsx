import type { CrmAttentionCode, CrmAttentionSummary } from "../../../types";
import { ATTENTION_META } from "./crmHelpers";
import { WarningIcon } from "./crmIcons";
import s from "./SellerCrm.module.css";

export function AttentionInbox({
  summary,
  active,
  onSelect,
}: {
  summary: CrmAttentionSummary;
  active: CrmAttentionCode | "all";
  onSelect: (code: CrmAttentionCode | "all") => void;
}) {
  const cards: { code: CrmAttentionCode; count: number; tone: "danger" | "warning" | "neutral" }[] = [
    { code: "payment_issue", count: summary.paymentIssues, tone: "danger" },
    { code: "subscription_expired", count: summary.expiredSubscriptions, tone: "danger" },
    { code: "subscription_expiring", count: summary.expiringSubscriptions, tone: "warning" },
    { code: "subscription_missing_expiry", count: summary.missingExpirySubscriptions, tone: "warning" },
    { code: "follow_up_overdue", count: summary.overdueFollowUps, tone: "warning" },
    { code: "onboarding_incomplete", count: summary.incompleteOnboarding, tone: "neutral" },
    { code: "no_traffic", count: summary.noTraffic ?? 0, tone: "warning" },
  ];

  return (
    <section className={s.attentionInbox} aria-labelledby="attention-title">
      <div className={s.attentionHeader}>
        <div>
          <p className={s.attentionEyebrow}>Operación diaria</p>
          <h2 id="attention-title"><WarningIcon /> Bandeja de atención</h2>
        </div>
        <button
          type="button"
          className={`${s.attentionTotal} ${active === "all" ? s.attentionTotalActive : ""}`}
          onClick={() => onSelect("all")}
        >
          {summary.clients} {summary.clients === 1 ? "cliente requiere" : "clientes requieren"} atención
        </button>
      </div>
      <div className={s.attentionGrid}>
        {cards.map((card) => (
          <button
            key={card.code}
            type="button"
            className={`${s.attentionCard} ${s[`attention_${card.tone}`]} ${active === card.code ? s.attentionCardActive : ""}`}
            onClick={() => onSelect(card.code)}
            aria-pressed={active === card.code}
            disabled={card.count === 0}
          >
            <strong>{card.count}</strong>
            <span>{ATTENTION_META[card.code].label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Tendencia de tráfico contra los 30 días previos. Sin base previa no se
// muestra porcentaje: "+∞%" no le dice nada a nadie, y una cuenta nueva
// siempre "creció".
export function TrafficTrend({ last30d, previous30d }: { last30d: number; previous30d: number }) {
  if (previous30d === 0) {
    return <small className={s.tableMuted}>{last30d > 0 ? "Sin base previa" : "Sin visitas"}</small>;
  }

  const delta = Math.round(((last30d - previous30d) / previous30d) * 100);
  if (delta === 0) return <small className={s.tableMuted}>Estable</small>;

  return (
    <small className={delta > 0 ? s.trendUp : s.trendDown}>
      {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
    </small>
  );
}
