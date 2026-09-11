import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  CrmAttentionCode,
  CrmAttentionSummary,
  CrmClient,
  CrmStage,
} from "../../../types";
import {
  listCrmClients,
  updateCrmProfile,
  exportCrmClients,
} from "../../../api/crm";
import { listAdminSellers } from "../../../api/adminSellers";
import { useAuth } from "../../../context/useAuth";
import { useNotifications } from "../../../context/useNotifications";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { formatPaymentAmount, PAYMENT_STATUS_LABEL } from "../../../lib/adminPayments";
import { extractServerMessage } from "../../../lib/apiErrors";
import { formatDateAR } from "../../../lib/dates";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import { useQuery } from "@tanstack/react-query";
import {
  STAGE_META,
  STAGE_ORDER,
  EMPTY_ATTENTION_SUMMARY,
  ATTENTION_META,
  fmtDate,
  calendarDate,
  fmtFollowUpDate,
  isOverdue,
  effectiveSubscriptionFor,
  planBadgeLabel,
  planExpiryLabel,
  normalizeAttention,
  summarizeAttention,
} from "./crmHelpers";
import { AttentionInbox, TrafficTrend } from "./AttentionWidgets";
import { ListIcon, KanbanIcon, DownloadIcon } from "./crmIcons";
import ClientDrawer from "./ClientDrawer";
import s from "./SellerCrm.module.css";

// ══════════════════════════════════════════════════════════════════
// Componente principal — lista/kanban de clientes + filtros + drawer de
// detalle. Compartido por admin (ve y filtra a todos) y por cada vendedor
// (ve solo sus propios clientes atribuidos — el scoping real vive en el
// backend, esto es solo la UI).
// ══════════════════════════════════════════════════════════════════
export default function SellerCrm() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
  const [sellerFilter, setSellerFilter] = useState("all");
  const selectedId = urlParams.get("client");
  // En celular la tabla (pensada para desktop, con scroll horizontal) es
  // incómoda como primera vista — el kanban, con columnas angostas, se lee
  // mejor de arranque. Es solo el default inicial: el toggle de vista sigue
  // disponible para cambiar en cualquier momento.
  const [viewMode, setViewMode] = useState<"list" | "kanban">(
    () => (window.innerWidth < 768 ? "kanban" : "list"),
  );
  const [exporting, setExporting] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);
  const [movingClientId, setMovingClientId] = useState<string | null>(null);

  // Solo para armar el <select> de "vendedor" del admin. Misma queryKey que
  // AdminSellers (includeInactive=false) para compartir la caché en vez de
  // re-fetchear.
  const sellersList = useQuery({
    queryKey: ["admin-sellers", false],
    queryFn: () => listAdminSellers(false),
    enabled: isAdmin,
    staleTime: 60_000,
  });

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
      } catch (err) {
        if (!cancelled) setError(extractServerMessage(err, "No se pudieron cargar los clientes."));
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
    } catch (err) {
      setError(extractServerMessage(err, "El cambio se guardó, pero no se pudo actualizar la tabla 360."));
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
    } catch (err) {
      notifyError(extractServerMessage(err, "No se pudo guardar la nueva etapa del cliente."));
    } finally {
      setMovingClientId(null);
    }
  }, [clients, movingClientId, notifyError, notifySuccess, patchClient, refreshClients]);

  // Conteo por etapa (para los chips de filtro).
  const countByStage = (stage: CrmStage) => clients.filter((c) => c.stage === stage).length;

  const filtered = clients.filter((c) => {
    if (stageFilter !== "all" && c.stage !== stageFilter) return false;
    if (planFilter !== "all" && effectiveSubscriptionFor(c) !== planFilter) return false;
    if (accountFilter === "active" && !c.active) return false;
    if (accountFilter === "inactive" && c.active) return false;
    if (attentionFilter !== "all" && !(c.attention || []).includes(attentionFilter)) return false;
    if (isAdmin && sellerFilter !== "all" && c.seller?._id !== sellerFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.contactInfo?.mail || "").toLowerCase().includes(q)
    );
  });

  // El kanban no tiene encabezados para ordenar: se muestra siempre alfabético
  // por negocio, que es lo que se espera al mirar tarjetas.
  const kanbanClients = [...filtered].sort((left, right) =>
    (left.businessName || left.username).localeCompare(
      right.businessName || right.username,
      "es",
      { sensitivity: "base" },
    ),
  );

  // Columnas de la tabla 360. El ancho de cada una lo respeta el layout fijo de
  // DataTable; "Cliente" va sin ancho a propósito para quedarse con el espacio
  // sobrante en pantallas anchas (antes se lo llevaba la columna de la flecha).
  const columns = useMemo<DataTableColumn<CrmClient>[]>(() => [
    {
      id: "client",
      header: "Cliente",
      sortValue: (client) => client.businessName || client.username,
      render: (client) => (
        <button type="button" className={s.tableClientButton} onClick={() => openDrawer(client._id)}>
          <span className={s.tableClientName}>
            {client.businessName || <em>Sin nombre comercial</em>}
          </span>
          <span>@{client.username}</span>
          {isAdmin && client.seller && (
            <span className={s.tableSeller} title={`Vendedor: ${client.seller.name} (${client.seller.code})`}>
              {client.seller.name}
            </span>
          )}
        </button>
      ),
    },
    {
      id: "contact",
      header: "Contacto",
      width: "185px",
      render: (client) => (
        <div className={s.tableContact}>
          <span>{client.contactInfo?.mail || "Sin email"}</span>
          <small>{client.contactInfo?.number ? String(client.contactInfo.number) : "Sin teléfono"}</small>
        </div>
      ),
    },
    {
      id: "lastConnection",
      header: "Última conexión",
      width: "160px",
      initialDirection: "desc",
      sortValue: (client) => {
        const timestamp = client.lastConnectionAt ? Date.parse(client.lastConnectionAt) : NaN;
        return Number.isFinite(timestamp) ? timestamp : null;
      },
      render: (client) => {
        const date = formatDateAR(client.lastConnectionAt, {
          day: "2-digit", month: "2-digit", year: "numeric", fallback: "",
        });
        if (!date) return <span className={s.tableMuted}>Sin registro</span>;
        return (
          <time
            className={s.tableConnection}
            dateTime={client.lastConnectionAt || undefined}
            title="Horario de Buenos Aires (GMT-3)"
          >
            {date}
            <small>{formatDateAR(client.lastConnectionAt, { hour: "2-digit", minute: "2-digit" })} h</small>
          </time>
        );
      },
    },
    {
      id: "expiry",
      header: "Plan / vencimiento",
      width: "145px",
      // Sin fecha de vencimiento no es "vence lejísimos": es sin dato, y
      // DataTable lo manda al final en las dos direcciones.
      sortValue: (client) => (client.subscriptionExpiresAt
        ? new Date(client.subscriptionExpiresAt).getTime()
        : null),
      render: (client) => (
        <div className={s.tablePlan}>
          <span className={`${s.planBadge} ${s[`plan_${effectiveSubscriptionFor(client)}`]}`}>{planBadgeLabel(client)}</span>
          <small>{planExpiryLabel(client.subscription, client.subscriptionExpiresAt || null)}</small>
        </div>
      ),
    },
    {
      id: "stage",
      header: "Etapa",
      width: "120px",
      sortValue: (client) => STAGE_ORDER.indexOf(client.stage),
      render: (client) => (
        <span className={s.tableStage}>
          <span className={s.stageDot} style={{ background: STAGE_META[client.stage].color }} />
          {STAGE_META[client.stage].label}
        </span>
      ),
    },
    {
      id: "onboarding",
      header: "Onboarding",
      width: "115px",
      render: (client) => (client.onboarding ? (
        <div className={s.tableOnboarding}>
          <span>{client.onboarding.completedCount}/{client.onboarding.total}</span>
          <span
            className={s.tableProgressTrack}
            aria-label={`${client.onboarding.completedCount} de ${client.onboarding.total} pasos completos`}
          >
            <span style={{ width: `${Math.round((client.onboarding.completedCount / client.onboarding.total) * 100)}%` }} />
          </span>
        </div>
      ) : <span className={s.tableMuted}>Sin datos</span>),
    },
    {
      id: "views",
      header: "Visitas 30 d",
      width: "145px",
      render: (client) => (client.views ? (
        <div className={s.tableViews}>
          <strong className={client.views.last30d === 0 ? s.tableViewsZero : undefined}>
            {client.views.last30d.toLocaleString("es-AR")}
          </strong>
          <TrafficTrend last30d={client.views.last30d} previous30d={client.views.previous30d} />
        </div>
      ) : <span className={s.tableMuted}>Sin datos</span>),
    },
    {
      id: "payment",
      header: "Último pago",
      width: "125px",
      initialDirection: "desc",
      sortValue: (client) => (client.lastPayment?.createdAt
        ? new Date(client.lastPayment.createdAt).getTime()
        : null),
      render: (client) => {
        const payment = client.lastPayment;
        if (!payment) return <span className={s.tableMuted}>Sin pagos</span>;
        const hasIssue = payment.status === "approved" && payment.entitlementStatus !== "applied";
        return (
          <div className={`${s.tablePayment} ${hasIssue ? s.tablePaymentIssue : ""}`}>
            <strong>{formatPaymentAmount(payment.amount, payment.currency || "ARS")}</strong>
            <span>{PAYMENT_STATUS_LABEL[payment.status || ""] || payment.status || "Sin estado"}</span>
            <small>{payment.createdAt ? fmtDate(payment.createdAt) : "Sin fecha"}</small>
          </div>
        );
      },
    },
    {
      id: "followUp",
      header: "Seguimiento",
      width: "165px",
      sortValue: (client) => (client.nextFollowUp ? calendarDate(client.nextFollowUp).getTime() : null),
      render: (client) => (client.nextFollowUp ? (
        <span className={`${s.tableFollowUp} ${isOverdue(client.nextFollowUp) ? s.tableFollowUpOverdue : ""}`}>
          {isOverdue(client.nextFollowUp) ? "Vencido" : "Agendado"}
          <small>{fmtFollowUpDate(client.nextFollowUp)}</small>
        </span>
      ) : <span className={s.tableMuted}>Sin agendar</span>),
    },
    {
      id: "attention",
      header: "Alertas",
      width: "105px",
      initialDirection: "desc",
      sortValue: (client) => (client.attention || []).length,
      render: (client) => {
        const alerts = client.attention || [];
        if (!alerts.length) return <span className={s.tableOk}>Al día</span>;
        return (
          <div className={s.tableAlerts}>
            {alerts.slice(0, 2).map((code) => (
              <span key={code}>{ATTENTION_META[code].shortLabel}</span>
            ))}
            {alerts.length > 2 && <small>+{alerts.length - 2}</small>}
          </div>
        );
      },
    },
    {
      id: "open",
      header: null,
      headerLabel: "Acciones",
      width: "52px",
      render: (client) => (
        <button
          type="button"
          className={s.tableOpenButton}
          onClick={() => openDrawer(client._id)}
          aria-label={`Abrir ficha de ${client.businessName || client.username}`}
        >
          →
        </button>
      ),
    },
  ], [openDrawer, isAdmin]);

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
    } catch (err) {
      notifyError(extractServerMessage(err, "No se pudo exportar el listado. Intentá de nuevo."));
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
            {filtered.length === clients.length
              ? clients.length
              : `${filtered.length} de ${clients.length}`}
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

          {isAdmin && (
            <select
              className={s.toolbarSelect}
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              aria-label="Filtrar por vendedor"
            >
              <option value="all">Todos los vendedores</option>
              {(sellersList.data ?? []).map((seller) => (
                <option key={seller._id} value={seller._id}>{seller.name}</option>
              ))}
            </select>
          )}

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

          {isAdmin && (
            <button className={s.exportBtn} onClick={handleExport} disabled={exporting} type="button">
              <DownloadIcon />
              {exporting ? "Exportando…" : "Exportar a Excel"}
            </button>
          )}
        </div>

        {/* ── Vista Clientes 360 ── */}
        {viewMode === "list" && (
          // La búsqueda y los filtros quedan arriba, fuera de la tabla, porque
          // también gobiernan el kanban: acá ya llegan las filas filtradas.
          <DataTable<CrmClient>
            caption="Clientes 360"
            rows={filtered}
            columns={columns}
            getRowId={(client) => client._id}
            defaultSort={{ columnId: "client", direction: "asc" }}
            layout="fixed"
            minWidth={1420}
            rowClassName={(client) => [
              s.clientTableRow,
              client.active ? "" : s.clientTableRowInactive,
            ].join(" ").trim()}
            // Si la carga falló no hay que afirmar que no hay clientes: no se
            // sabe. El detalle del error ya está en el banner de arriba.
            emptyMessage={error
              ? "No se pudo cargar el listado."
              : clients.length === 0
                ? "Todavía no hay clientes."
                : "No hay clientes que coincidan."}
          />
        )}

        {/* ── Vista kanban ── */}
        {viewMode === "kanban" && (
          <div className={s.kanbanBoard}>
            {STAGE_ORDER.map((st) => {
              const stClients = kanbanClients.filter((c) => c.stage === st);
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
                          <span className={`${s.planBadge} ${s[`plan_${effectiveSubscriptionFor(c)}`]}`}>{planBadgeLabel(c)}</span>
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
