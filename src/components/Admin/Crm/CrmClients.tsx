import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  AdminPayment,
  CrmAttentionCode,
  CrmAttentionSummary,
  CrmClient,
  CrmClientDetail,
  CrmStage,
} from "../../../types";
import {
  listCrmClients,
  getCrmClient,
  updateCrmProfile,
  addCrmNote,
  deleteCrmNote,
  exportCrmClients,
  setCrmClientActive,
} from "../../../api/crm";
import { listAdminPayments } from "../../../api/adminPayments";
import { useNotifications } from "../../../context/useNotifications";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import {
  ENTITLEMENT_LABEL,
  OPERATION_LABEL,
  PAYMENT_STATUS_LABEL,
  formatPaymentAmount,
  formatPaymentDate,
} from "../../../lib/adminPayments";
import { PLAN_LABEL } from "../../../lib/plans";
import { sanitizePhoneForWa } from "../../../lib/whatsapp";
import s from "./CrmClients.module.css";

// ── Metadata de cada etapa del pipeline: etiqueta visible + color del punto. ──
const STAGE_META: Record<CrmStage, { label: string; color: string }> = {
  lead:       { label: "Lead",       color: "#6b8ca0" },
  onboarding: { label: "Onboarding", color: "#c9a84c" },
  activo:     { label: "Activo",     color: "#4caf82" },
  en_riesgo:  { label: "En riesgo",  color: "#d98a3d" },
  baja:       { label: "Baja",       color: "#c97070" },
};
const STAGE_ORDER: CrmStage[] = ["lead", "onboarding", "activo", "en_riesgo", "baja"];

const ATTENTION_META: Record<CrmAttentionCode, { label: string; shortLabel: string }> = {
  payment_issue: { label: "Pagos con incidencia", shortLabel: "Pago" },
  subscription_expired: { label: "Suscripciones vencidas", shortLabel: "Vencida" },
  subscription_expiring: { label: "Vencen en 30 días", shortLabel: "Por vencer" },
  subscription_missing_expiry: { label: "Planes sin vencimiento", shortLabel: "Sin vencimiento" },
  follow_up_overdue: { label: "Seguimientos vencidos", shortLabel: "Seguimiento" },
  onboarding_incomplete: { label: "Onboarding incompleto", shortLabel: "Onboarding" },
};

const EMPTY_ATTENTION_SUMMARY: CrmAttentionSummary = {
  clients: 0,
  paymentIssues: 0,
  expiredSubscriptions: 0,
  expiringSubscriptions: 0,
  missingExpirySubscriptions: 0,
  overdueFollowUps: 0,
  incompleteOnboarding: 0,
};

type SortKey = "client" | "stage" | "expiry" | "payment" | "followUp" | "attention";
type SortDirection = "asc" | "desc";

const ONBOARDING_ITEMS = [
  { key: "businessInfo", label: "Datos del negocio", detail: "Nombre y dirección" },
  { key: "contactChannel", label: "Canal de contacto", detail: "Email o WhatsApp" },
  { key: "schedule", label: "Horarios", detail: "Al menos un día habilitado" },
  { key: "branding", label: "Identidad visual", detail: "Portada o galería" },
  { key: "menuStructure", label: "Categorías", detail: "Estructura de la carta" },
  { key: "products", label: "Productos", detail: "Al menos uno cargado" },
  { key: "publicMenu", label: "Carta operativa", detail: "Cuenta activa y carta con productos" },
] as const;

// ── Helpers de fecha ──
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "";

// Los seguimientos son días de calendario (no instantes). El backend los
// persiste como Date a medianoche UTC, así que usamos YYYY-MM-DD para evitar
// que Buenos Aires los muestre como el día anterior.
const calendarDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};
const fmtFollowUpDate = (iso: string) =>
  calendarDate(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

// Una fecha de seguimiento está "vencida" si ya pasó (comparando por día).
const isOverdue = (iso: string | null) => {
  if (!iso) return false;
  const d = calendarDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

// value del <input type="date"> (YYYY-MM-DD) desde un ISO.
const dateInputValue = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

const planExpiryLabel = (subscription: CrmClient["subscription"], iso: string | null) => {
  if (subscription === "free") return "Sin vencimiento";
  if (!iso) return "Sin fecha registrada";
  return `${new Date(iso).getTime() < Date.now() ? "Venció" : "Vence"} ${fmtDate(iso)}`;
};

// Compatibilidad durante un despliegue escalonado: si todavía responde el
// backend anterior, conservamos al menos la alerta de seguimiento que ya podía
// deducirse del contrato viejo. Las demás señales siguen siendo del servidor.
const normalizeAttention = (clients: CrmClient[]) => clients.map((client) => {
  if (client.attention) return client;
  return {
    ...client,
    attention: isOverdue(client.nextFollowUp)
      ? ["follow_up_overdue" as const]
      : [],
  };
});

const summarizeAttention = (clients: CrmClient[]): CrmAttentionSummary => ({
  clients: clients.filter((client) => (client.attention || []).length > 0).length,
  paymentIssues: clients.filter((client) => client.attention?.includes("payment_issue")).length,
  expiredSubscriptions: clients.filter((client) => client.attention?.includes("subscription_expired")).length,
  expiringSubscriptions: clients.filter((client) => client.attention?.includes("subscription_expiring")).length,
  missingExpirySubscriptions: clients.filter((client) => client.attention?.includes("subscription_missing_expiry")).length,
  overdueFollowUps: clients.filter((client) => client.attention?.includes("follow_up_overdue")).length,
  incompleteOnboarding: clients.filter((client) => client.attention?.includes("onboarding_incomplete")).length,
});

// ══════════════════════════════════════════════════════════════════
// Componente principal — lista/kanban de clientes + filtros + drawer de detalle
// ══════════════════════════════════════════════════════════════════
export default function CrmClients() {
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const [urlParams, setUrlParams] = useSearchParams();
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [attentionSummary, setAttentionSummary] = useState<CrmAttentionSummary>(EMPTY_ATTENTION_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useFeedbackMessage("error");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CrmStage | "all">("all");
  const [planFilter, setPlanFilter] = useState<CrmClient["subscription"] | "all">("all");
  const [accountFilter, setAccountFilter] = useState<"all" | "active" | "inactive">("all");
  const [attentionFilter, setAttentionFilter] = useState<CrmAttentionCode | "all">("all");
  const selectedId = urlParams.get("client");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [sortKey, setSortKey] = useState<SortKey>("client");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [exporting, setExporting] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);
  const [movingClientId, setMovingClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await listCrmClients();
        if (!cancelled) {
          const normalizedClients = normalizeAttention(response.clients);
          setClients(normalizedClients);
          setAttentionSummary(response.attentionSummary || summarizeAttention(normalizedClients));
        }
      } catch {
        if (!cancelled) setError("No se pudieron cargar los clientes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [setError]);

  // El drawer avisa cuando cambió algo de un cliente (etapa/tags/seguimiento)
  // para reflejarlo en la fila del listado sin volver a pedir todo.
  const patchClient = useCallback((userID: string, patch: Partial<CrmClient>) => {
    setClients((prev) => prev.map((c) => (c._id === userID ? { ...c, ...patch } : c)));
  }, []);
  const refreshClients = useCallback(async () => {
    try {
      const response = await listCrmClients();
      const normalizedClients = normalizeAttention(response.clients);
      setClients(normalizedClients);
      setAttentionSummary(response.attentionSummary || summarizeAttention(normalizedClients));
    } catch {
      setError("El cambio se guardó, pero no se pudo actualizar la tabla 360.");
    }
  }, [setError]);
  const openDrawer = useCallback((userID: string) => {
    const next = new URLSearchParams(urlParams);
    next.set("client", userID);
    setUrlParams(next, { replace: true });
  }, [setUrlParams, urlParams]);
  const closeDrawer = useCallback(() => {
    const next = new URLSearchParams(urlParams);
    next.delete("client");
    setUrlParams(next, { replace: true });
  }, [setUrlParams, urlParams]);

  // Cambia de etapa al soltar una tarjeta. Se refleja recién cuando el servidor
  // confirma para no mostrar como guardado un movimiento que pudo fallar.
  const moveToStage = useCallback(async (userID: string, stage: CrmStage) => {
    const current = clients.find((client) => client._id === userID);
    if (!current || current.stage === stage || movingClientId) return;

    setMovingClientId(userID);
    try {
      await updateCrmProfile(userID, { stage });
      patchClient(userID, { stage });
      await refreshClients();
      notifySuccess("Etapa del cliente actualizada.");
    } catch {
      notifyError("No se pudo guardar la nueva etapa del cliente.");
    } finally {
      setMovingClientId(null);
    }
  }, [clients, movingClientId, notifyError, notifySuccess, patchClient, refreshClients]);

  // Conteo por etapa (para los chips de filtro).
  const countByStage = (stage: CrmStage) => clients.filter((c) => c.stage === stage).length;

  const filtered = clients.filter((c) => {
    if (stageFilter !== "all" && c.stage !== stageFilter) return false;
    if (planFilter !== "all" && c.subscription !== planFilter) return false;
    if (accountFilter === "active" && !c.active) return false;
    if (accountFilter === "inactive" && c.active) return false;
    if (attentionFilter !== "all" && !(c.attention || []).includes(attentionFilter)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.contactInfo?.mail || "").toLowerCase().includes(q)
    );
  });

  const sortValue = (client: CrmClient, key: SortKey): string | number => {
    if (key === "client") return client.businessName || client.username;
    if (key === "stage") return STAGE_ORDER.indexOf(client.stage);
    if (key === "expiry") return client.subscriptionExpiresAt
      ? new Date(client.subscriptionExpiresAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (key === "payment") return client.lastPayment?.createdAt
      ? new Date(client.lastPayment.createdAt).getTime()
      : 0;
    if (key === "followUp") return client.nextFollowUp
      ? calendarDate(client.nextFollowUp).getTime()
      : Number.MAX_SAFE_INTEGER;
    return (client.attention || []).length;
  };

  const sortedClients = [...filtered].sort((left, right) => {
    const leftValue = sortValue(left, sortKey);
    const rightValue = sortValue(right, sortKey);
    const result = typeof leftValue === "string" && typeof rightValue === "string"
      ? leftValue.localeCompare(rightValue, "es", { sensitivity: "base" })
      : Number(leftValue) - Number(rightValue);
    return sortDirection === "asc" ? result : -result;
  });

  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "attention" || key === "payment" ? "desc" : "asc");
  };

  const selectAttention = (code: CrmAttentionCode | "all") => {
    setAttentionFilter((current) => (current === code ? "all" : code));
    setViewMode("list");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportCrmClients(stageFilter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm-clientes${stageFilter !== "all" ? `-${stageFilter}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess("Listado de clientes exportado.");
    } catch {
      notifyError("No se pudo exportar el listado. Intentá de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="pageLoaderScreen">
        <div className="pageLoaderRing" aria-label="Cargando clientes…" />
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      {/* ── Top bar ── */}
      <header className={s.topBar}>
        <div className={s.topBarInner}>
          <div>
            <p className={s.eyebrow}>CRM</p>
            <h1 className={s.title}>Clientes</h1>
          </div>
          <span className={s.countBadge}>
            {sortedClients.length === clients.length
              ? clients.length
              : `${sortedClients.length} de ${clients.length}`}
          </span>
        </div>
      </header>

      <div className={s.content}>
        {error && <div className={s.errorBanner} role="alert">{error}</div>}

        <AttentionInbox
          summary={attentionSummary}
          active={attentionFilter}
          onSelect={selectAttention}
        />

        {/* ── Filtros por etapa (solo en vista lista — en kanban ya están separados por columna) ── */}
        {viewMode === "list" && (
          <div className={s.stageFilters}>
            <button
              className={`${s.stageChip} ${stageFilter === "all" ? s.stageChipActive : ""}`}
              onClick={() => setStageFilter("all")}
              type="button"
            >
              Todos <span className={s.chipCount}>{clients.length}</span>
            </button>
            {STAGE_ORDER.map((st) => (
              <button
                key={st}
                className={`${s.stageChip} ${stageFilter === st ? s.stageChipActive : ""}`}
                onClick={() => setStageFilter(st)}
                type="button"
              >
                <span className={s.stageDot} style={{ background: STAGE_META[st].color }} />
                {STAGE_META[st].label} <span className={s.chipCount}>{countByStage(st)}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Buscador + filtros operativos + vista + exportar ── */}
        <div className={s.toolbarRow}>
          <div className={s.searchRow}>
            <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={s.searchInput}
              placeholder="Buscar negocio, usuario, slug o email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={s.toolbarSelect}
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as CrmClient["subscription"] | "all")}
            aria-label="Filtrar por plan"
          >
            <option value="all">Todos los planes</option>
            <option value="free">Gratis</option>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
          </select>

          <select
            className={s.toolbarSelect}
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value as "all" | "active" | "inactive")}
            aria-label="Filtrar por estado de cuenta"
          >
            <option value="all">Todas las cuentas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>

          <div className={s.viewToggle}>
            <button
              className={`${s.viewToggleBtn} ${viewMode === "list" ? s.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="Vista tabla"
              aria-current={viewMode === "list" ? "true" : undefined}
              type="button"
            >
              <ListIcon />
            </button>
            <button
              className={`${s.viewToggleBtn} ${viewMode === "kanban" ? s.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("kanban")}
              aria-label="Vista kanban"
              aria-current={viewMode === "kanban" ? "true" : undefined}
              type="button"
            >
              <KanbanIcon />
            </button>
          </div>

          <button className={s.exportBtn} onClick={handleExport} disabled={exporting} type="button">
            <DownloadIcon />
            {exporting ? "Exportando…" : "Exportar a Excel"}
          </button>
        </div>

        {/* ── Vista Clientes 360 ── */}
        {viewMode === "list" && (
          sortedClients.length === 0 ? (
            <p className={s.emptyHint}>No hay clientes que coincidan.</p>
          ) : (
            <div className={s.clientTableShell}>
              <table className={s.clientTable}>
                <thead>
                  <tr>
                    <SortableHeader label="Cliente" sortKey="client" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
                    <th>Contacto</th>
                    <SortableHeader label="Plan / vencimiento" sortKey="expiry" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
                    <SortableHeader label="Etapa" sortKey="stage" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
                    <th>Onboarding</th>
                    <SortableHeader label="Último pago" sortKey="payment" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
                    <SortableHeader label="Seguimiento" sortKey="followUp" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
                    <SortableHeader label="Alertas" sortKey="attention" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
                    <th><span className={s.srOnly}>Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map((client) => (
                    <ClientTableRow key={client._id} client={client} onOpen={openDrawer} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Vista kanban ── */}
        {viewMode === "kanban" && (
          <div className={s.kanbanBoard}>
            {STAGE_ORDER.map((st) => {
              const stClients = sortedClients.filter((c) => c.stage === st);
              return (
                <div
                  key={st}
                  className={`${s.kanbanColumn} ${dragOverStage === st ? s.kanbanColumnOver : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverStage(st); }}
                  onDragLeave={() => setDragOverStage((cur) => (cur === st ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverStage(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) moveToStage(id, st);
                  }}
                >
                  <div className={s.kanbanColumnHeader}>
                    <span className={s.stageDot} style={{ background: STAGE_META[st].color }} />
                    {STAGE_META[st].label}
                    <span className={s.chipCount}>{stClients.length}</span>
                  </div>
                  <div className={s.kanbanCards}>
                    {stClients.map((c) => (
                      <div
                        key={c._id}
                        className={`${s.kanbanCard} ${movingClientId === c._id ? s.kanbanCardMoving : ""}`}
                        draggable={movingClientId !== c._id}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", c._id)}
                        onClick={() => openDrawer(c._id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") openDrawer(c._id); }}
                      >
                        <span className={s.kanbanCardName}>
                          {c.businessName || `@${c.username}`}
                        </span>
                        <span className={s.kanbanCardMeta}>
                          <span className={`${s.planBadge} ${s[`plan_${c.subscription}`]}`}>{PLAN_LABEL[c.subscription]}</span>
                          {!c.active && <span className={s.inactiveTag}>Inactivo</span>}
                        </span>
                        {c.nextFollowUp && (
                          <span className={`${s.followUp} ${isOverdue(c.nextFollowUp) ? s.followUpOverdue : ""}`}>
                            {fmtFollowUpDate(c.nextFollowUp)}
                          </span>
                        )}
                      </div>
                    ))}
                    {stClients.length === 0 && <p className={s.kanbanEmpty}>Sin clientes</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedId && (
        <ClientDrawer
          userID={selectedId}
          onClose={closeDrawer}
          onPatch={patchClient}
          onRefresh={refreshClients}
        />
      )}
    </div>
  );
}

function AttentionInbox({
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

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={s.sortButton} onClick={() => onSort(sortKey)}>
        {label}
        <span aria-hidden>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function ClientTableRow({ client, onOpen }: { client: CrmClient; onOpen: (userID: string) => void }) {
  const alerts = client.attention || [];
  const onboarding = client.onboarding;
  const payment = client.lastPayment;
  const paymentHasIssue = Boolean(
    payment && payment.status === "approved" && payment.entitlementStatus !== "applied"
  );

  return (
    <tr className={!client.active ? s.clientTableRowInactive : undefined}>
      <td>
        <button type="button" className={s.tableClientButton} onClick={() => onOpen(client._id)}>
          <span className={s.tableClientName}>
            {client.businessName || <em>Sin nombre comercial</em>}
          </span>
          <span>@{client.username}</span>
        </button>
      </td>
      <td>
        <div className={s.tableContact}>
          <span>{client.contactInfo?.mail || "Sin email"}</span>
          <small>{client.contactInfo?.number ? String(client.contactInfo.number) : "Sin teléfono"}</small>
        </div>
      </td>
      <td>
        <div className={s.tablePlan}>
          <span className={`${s.planBadge} ${s[`plan_${client.subscription}`]}`}>{PLAN_LABEL[client.subscription]}</span>
          <small>{planExpiryLabel(client.subscription, client.subscriptionExpiresAt || null)}</small>
        </div>
      </td>
      <td>
        <span className={s.tableStage}>
          <span className={s.stageDot} style={{ background: STAGE_META[client.stage].color }} />
          {STAGE_META[client.stage].label}
        </span>
      </td>
      <td>
        {onboarding ? (
          <div className={s.tableOnboarding}>
            <span>{onboarding.completedCount}/{onboarding.total}</span>
            <span className={s.tableProgressTrack} aria-label={`${onboarding.completedCount} de ${onboarding.total} pasos completos`}>
              <span style={{ width: `${Math.round((onboarding.completedCount / onboarding.total) * 100)}%` }} />
            </span>
          </div>
        ) : <span className={s.tableMuted}>Sin datos</span>}
      </td>
      <td>
        {payment ? (
          <div className={`${s.tablePayment} ${paymentHasIssue ? s.tablePaymentIssue : ""}`}>
            <strong>{formatPaymentAmount(payment.amount, payment.currency || "ARS")}</strong>
            <span>{PAYMENT_STATUS_LABEL[payment.status || ""] || payment.status || "Sin estado"}</span>
            <small>{payment.createdAt ? fmtDate(payment.createdAt) : "Sin fecha"}</small>
          </div>
        ) : <span className={s.tableMuted}>Sin pagos</span>}
      </td>
      <td>
        {client.nextFollowUp ? (
          <span className={`${s.tableFollowUp} ${isOverdue(client.nextFollowUp) ? s.tableFollowUpOverdue : ""}`}>
            {isOverdue(client.nextFollowUp) ? "Vencido" : "Agendado"}
            <small>{fmtFollowUpDate(client.nextFollowUp)}</small>
          </span>
        ) : <span className={s.tableMuted}>Sin agendar</span>}
      </td>
      <td>
        {alerts.length ? (
          <div className={s.tableAlerts}>
            {alerts.slice(0, 2).map((code) => (
              <span key={code}>{ATTENTION_META[code].shortLabel}</span>
            ))}
            {alerts.length > 2 && <small>+{alerts.length - 2}</small>}
          </div>
        ) : <span className={s.tableOk}>Al día</span>}
      </td>
      <td>
        <button
          type="button"
          className={s.tableOpenButton}
          onClick={() => onOpen(client._id)}
          aria-label={`Abrir ficha de ${client.businessName || client.username}`}
        >
          →
        </button>
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════
// Drawer de detalle — perfil + controles de CRM + actividad (notas + eventos)
// ══════════════════════════════════════════════════════════════════
function ClientDrawer({
  userID,
  onClose,
  onPatch,
  onRefresh,
}: {
  userID: string;
  onClose: () => void;
  onPatch: (userID: string, patch: Partial<CrmClient>) => void;
  onRefresh: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<CrmClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingActive, setChangingActive] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  const { success: notifySuccess, error: notifyError } = useNotifications();

  // Carga del detalle + cierre con Escape.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setPaymentsLoading(true);
      setPaymentsError(false);
      const [detailResult, paymentsResult] = await Promise.allSettled([
        getCrmClient(userID),
        listAdminPayments({ userID, page: 1, limit: 5 }),
      ]);
      if (cancelled) return;

      if (detailResult.status === "rejected") {
        notifyError("No se pudo cargar el detalle del cliente.");
        onClose();
        return;
      }
      setDetail(detailResult.value);
      setLoading(false);

      if (paymentsResult.status === "fulfilled") {
        setPayments(paymentsResult.value.payments);
        setPaymentsTotal(paymentsResult.value.pagination.total);
      } else {
        setPaymentsError(true);
      }
      setPaymentsLoading(false);
    };
    load();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [notifyError, userID, onClose]);

  // Guarda etapa/tags/seguimiento y actualiza la UI solo con la respuesta
  // confirmada por el servidor. También bloquea cambios superpuestos.
  const saveProfile = async (patch: Partial<Pick<CrmClientDetail["crm"], "stage" | "tags" | "nextFollowUp">>) => {
    if (!detail || savingProfile) return false;
    setSavingProfile(true);
    try {
      const updated = await updateCrmProfile(userID, patch);
      setDetail((d) => (d ? { ...d, crm: updated } : d));
      const listPatch: Partial<CrmClient> = {};
      if (patch.stage !== undefined) listPatch.stage = updated.stage;
      if (patch.tags !== undefined) listPatch.tags = updated.tags;
      if (patch.nextFollowUp !== undefined) listPatch.nextFollowUp = updated.nextFollowUp;
      onPatch(userID, listPatch);
      void onRefresh();
      notifySuccess("Perfil de CRM actualizado.");
      return true;
    } catch {
      notifyError("No se pudo guardar el cambio en el perfil de CRM.");
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || !detail || savingProfile) return;
    if (detail.crm.tags.includes(t)) { setTagInput(""); return; }
    if (await saveProfile({ tags: [...detail.crm.tags, t] })) setTagInput("");
  };
  const removeTag = (tag: string) => {
    if (!detail || savingProfile) return;
    void saveProfile({ tags: detail.crm.tags.filter((x) => x !== tag) });
  };

  const submitNote = async () => {
    const text = noteInput.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    try {
      const updated = await addCrmNote(userID, text);
      setDetail((d) => (d ? { ...d, crm: updated } : d));
      setNoteInput("");
      notifySuccess("Nota agregada.");
    } catch {
      notifyError("No se pudo agregar la nota.");
    } finally {
      setSavingNote(false);
    }
  };

  const removeNote = async (noteID: string) => {
    if (deletingNoteId) return;
    setDeletingNoteId(noteID);
    try {
      const updated = await deleteCrmNote(userID, noteID);
      setDetail((d) => (d ? { ...d, crm: updated } : d));
      notifySuccess("Nota eliminada.");
    } catch {
      notifyError("No se pudo eliminar la nota.");
    } finally {
      setDeletingNoteId(null);
    }
  };

  const copyPublicMenuLink = async () => {
    if (!detail?.user.slug || copyingLink) return;
    setCopyingLink(true);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${detail.user.slug}/menu`);
      notifySuccess("Enlace de la carta copiado.");
    } catch {
      notifyError("No se pudo copiar el enlace de la carta.");
    } finally {
      setCopyingLink(false);
    }
  };

  const toggleClientActive = async () => {
    if (!detail || changingActive) return;
    const nextActive = !detail.user.active;
    const confirmed = window.confirm(
      nextActive
        ? "¿Activar esta cuenta y permitir el acceso público?"
        : "¿Desactivar esta cuenta? El cliente y su carta dejarán de estar accesibles."
    );
    if (!confirmed) return;

    setChangingActive(true);
    try {
      const active = await setCrmClientActive(userID, nextActive);
      setDetail((current) => current ? { ...current, user: { ...current.user, active } } : current);
      onPatch(userID, { active });

      // El servidor es la fuente del checklist; lo refrescamos porque el estado
      // de la cuenta modifica el punto "Carta operativa".
      const refreshed = await getCrmClient(userID).catch(() => null);
      if (refreshed) setDetail(refreshed);
      void onRefresh();

      notifySuccess(active ? "Cuenta activada." : "Cuenta desactivada.");
    } catch {
      notifyError("No se pudo cambiar el estado de la cuenta.");
    } finally {
      setChangingActive(false);
    }
  };

  const u = detail?.user;
  const crm = detail?.crm;
  const onboarding = detail?.onboarding;
  const whatsappPhone = sanitizePhoneForWa(u?.contactInfo.number ?? null);
  const onboardingPercent = onboarding?.total
    ? Math.round((onboarding.completedCount / onboarding.total) * 100)
    : 0;

  return (
    <div className={s.drawerOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Detalle del cliente">
      <div className={s.drawer} onClick={(e) => e.stopPropagation()}>
        {loading || !detail || !u || !crm ? (
          <div className={s.drawerLoading}><div className="pageLoaderRing" /></div>
        ) : (
          <>
            <header className={s.drawerHeader}>
              <div>
                <h2 className={s.drawerTitle}>{u.contactInfo?.businessName || `@${u.username}`}</h2>
                <p className={s.drawerSub}>@{u.username}</p>
              </div>
              <button className={s.drawerClose} onClick={onClose} aria-label="Cerrar" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            <div className={s.drawerBody}>
              {/* ── Acciones operativas ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Acciones rápidas</p>
                <div className={s.actionGrid}>
                  {whatsappPhone && (
                    <a className={s.actionButton} href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  )}
                  {u.contactInfo.mail && (
                    <a className={s.actionButton} href={`mailto:${u.contactInfo.mail}`}>Email</a>
                  )}
                  {u.slug && (
                    <>
                      <a className={s.actionButton} href={`/${u.slug}/menu`} target="_blank" rel="noreferrer">
                        Ver carta ↗
                      </a>
                      <button className={s.actionButton} onClick={copyPublicMenuLink} disabled={copyingLink} type="button">
                        {copyingLink ? "Copiando…" : "Copiar enlace"}
                      </button>
                    </>
                  )}
                  <button
                    className={`${s.actionButton} ${u.active ? s.actionDanger : s.actionPrimary}`}
                    onClick={toggleClientActive}
                    disabled={changingActive}
                    type="button"
                  >
                    {changingActive ? "Guardando…" : (u.active ? "Desactivar cuenta" : "Activar cuenta")}
                  </button>
                </div>
              </section>

              {/* ── Perfil / actividad ── */}
              <section className={s.section}>
                <div className={s.metaGrid}>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Plan</span>
                    <span className={`${s.planBadge} ${s[`plan_${u.subscription}`]}`}>{PLAN_LABEL[u.subscription]}</span>
                  </div>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Estado</span>
                    <span className={s.metaValue}>{u.active ? "Activo" : "Inactivo"}</span>
                  </div>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Cliente desde</span>
                    <span className={s.metaValue}>{fmtDate(u.createdAt)}</span>
                  </div>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Vigencia</span>
                    <span className={s.metaValue}>{planExpiryLabel(u.subscription, u.subscriptionExpiresAt)}</span>
                  </div>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Carta</span>
                    <span className={s.metaValue}>{detail.activity.categoryCount} cat · {detail.activity.sectionCount} sec · {detail.activity.itemCount} prod</span>
                  </div>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Delivery</span>
                    <span className={s.metaValue}>{u.hasDelivery ? "Habilitado" : "No habilitado"}</span>
                  </div>
                </div>
              </section>

              {/* ── Datos de contacto ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Contacto</p>
                <dl className={s.contactList}>
                  <div className={s.contactRow}>
                    <dt>Email</dt><dd>{u.contactInfo.mail || "Sin cargar"}</dd>
                  </div>
                  <div className={s.contactRow}>
                    <dt>WhatsApp</dt><dd>{u.contactInfo.number ?? "Sin cargar"}</dd>
                  </div>
                  <div className={s.contactRow}>
                    <dt>Dirección</dt><dd>{u.contactInfo.address || "Sin cargar"}</dd>
                  </div>
                </dl>
              </section>

              {/* ── Onboarding calculado por el backend ── */}
              {onboarding && <section className={s.section}>
                <div className={s.onboardingHeader}>
                  <p className={s.sectionLabel}>Onboarding</p>
                  <span className={s.onboardingCount}>
                    {onboarding.completedCount}/{onboarding.total}
                  </span>
                </div>
                <div
                  className={s.progressTrack}
                  role="progressbar"
                  aria-label="Progreso de onboarding"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={onboardingPercent}
                >
                  <span className={s.progressFill} style={{ width: `${onboardingPercent}%` }} />
                </div>
                <ul className={s.onboardingList}>
                  {ONBOARDING_ITEMS.map((item) => {
                    const done = onboarding[item.key];
                    return (
                      <li key={item.key} className={`${s.onboardingItem} ${done ? s.onboardingDone : ""}`}>
                        <span className={s.onboardingMark} aria-hidden>{done ? "✓" : "○"}</span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>}

              {/* ── Etapa ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Etapa</p>
                <div className={s.stagePicker}>
                  {STAGE_ORDER.map((st) => (
                    <button
                      key={st}
                      className={`${s.stageOption} ${crm.stage === st ? s.stageOptionActive : ""}`}
                      onClick={() => { void saveProfile({ stage: st }); }}
                      disabled={savingProfile}
                      type="button"
                      style={crm.stage === st ? { borderColor: STAGE_META[st].color } : undefined}
                    >
                      <span className={s.stageDot} style={{ background: STAGE_META[st].color }} />
                      {STAGE_META[st].label}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Próximo seguimiento ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Próximo seguimiento</p>
                <div className={s.followRow}>
                  <input
                    type="date"
                    className={s.dateInput}
                    value={dateInputValue(crm.nextFollowUp)}
                    onChange={(e) => { void saveProfile({ nextFollowUp: e.target.value || null }); }}
                    disabled={savingProfile}
                  />
                  {crm.nextFollowUp && (
                    <button className={s.clearBtn} onClick={() => { void saveProfile({ nextFollowUp: null }); }} disabled={savingProfile} type="button">
                      Quitar
                    </button>
                  )}
                </div>
                {isOverdue(crm.nextFollowUp) && <p className={s.overdueNote}>Este seguimiento ya venció.</p>}
              </section>

              {/* ── Tags ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Etiquetas</p>
                <div className={s.tagList}>
                  {crm.tags.map((tag) => (
                    <span key={tag} className={s.tag}>
                      {tag}
                      <button className={s.tagRemove} onClick={() => removeTag(tag)} aria-label={`Quitar ${tag}`} type="button" disabled={savingProfile}>×</button>
                    </span>
                  ))}
                  <input
                    className={s.tagInput}
                    placeholder="Agregar…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTag(); } }}
                    disabled={savingProfile}
                  />
                </div>
              </section>

              {/* ── Historial financiero durable ── */}
              <section className={s.section}>
                <div className={s.paymentHistoryHeader}>
                  <p className={s.sectionLabel}>Pagos ({paymentsTotal})</p>
                  <Link className={s.paymentHistoryLink} to={`/admin/payments?userID=${userID}`}>
                    Ver historial completo →
                  </Link>
                </div>
                {paymentsLoading ? (
                  <p className={s.paymentHistoryHint}>Cargando pagos…</p>
                ) : paymentsError ? (
                  <p className={s.paymentHistoryError}>No se pudo cargar el historial de pagos.</p>
                ) : payments.length === 0 ? (
                  <p className={s.paymentHistoryHint}>Este cliente todavía no tiene pagos registrados.</p>
                ) : (
                  <ul className={s.paymentHistoryList}>
                    {payments.map((payment) => (
                      <li className={s.paymentHistoryItem} key={payment.id || payment.paymentID}>
                        <div className={s.paymentHistoryMain}>
                          <div>
                            <strong>{OPERATION_LABEL[payment.operation]} · {payment.planId || "Plan sin identificar"}</strong>
                            <span>{formatPaymentDate(payment.paymentCreatedAt || payment.createdAt)}</span>
                          </div>
                          <strong>{formatPaymentAmount(payment.amount, payment.currency || "ARS")}</strong>
                        </div>
                        <div className={s.paymentHistoryStatuses}>
                          <span>{PAYMENT_STATUS_LABEL[payment.status || ""] || payment.status || "Sin estado MP"}</span>
                          <span className={
                            payment.entitlementStatus === "applied"
                              ? s.paymentApplied
                              : payment.entitlementStatus === "pending"
                                ? s.paymentPending
                                : s.paymentNotApplied
                          }>
                            {ENTITLEMENT_LABEL[payment.entitlementStatus]}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ── Actividad: notas manuales + eventos automáticos, mezclados
                   cronológicamente (el backend ya los inserta en orden). ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Actividad ({crm.notes.length})</p>
                <div className={s.noteComposer}>
                  <textarea
                    className={s.noteTextarea}
                    placeholder="Escribí una nota de seguimiento…"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    rows={2}
                  />
                  <button className={s.noteAddBtn} onClick={submitNote} disabled={!noteInput.trim() || savingNote} type="button">
                    {savingNote ? "Guardando…" : "Agregar nota"}
                  </button>
                </div>
                <ul className={s.noteList}>
                  {crm.notes.map((n) => (
                    <li key={n._id} className={`${s.noteItem} ${n.kind === "event" ? s.eventItem : ""}`}>
                      <p className={n.kind === "event" ? s.eventText : s.noteText}>
                        {n.kind === "event" && <EventDotIcon />}
                        {n.text}
                      </p>
                      <div className={s.noteFooter}>
                        <span className={s.noteMeta}>
                          {n.kind === "event" ? "Sistema" : (n.author?.username ? `${n.author.username} · ` : "")}{timeAgo(n.createdAt)}
                        </span>
                        {n.kind !== "event" && (
                          <button className={s.noteDelete} onClick={() => removeNote(n._id)} aria-label="Borrar nota" type="button" disabled={deletingNoteId !== null}>
                            {deletingNoteId === n._id ? "Borrando…" : "Borrar"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {crm.notes.length === 0 && <p className={s.emptyHint}>Todavía no hay actividad.</p>}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function WarningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="6" height="18" rx="1" /><rect x="9" y="3" width="6" height="11" rx="1" /><rect x="15" y="3" width="6" height="15" rx="1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function EventDotIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={s.eventDotIcon}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
