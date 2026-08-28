import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AdminPayment, CrmClient, CrmClientDetail, CrmStage } from "../../../types";
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

// ══════════════════════════════════════════════════════════════════
// Componente principal — lista/kanban de clientes + filtros + drawer de detalle
// ══════════════════════════════════════════════════════════════════
export default function CrmClients() {
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const [urlParams, setUrlParams] = useSearchParams();
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useFeedbackMessage("error");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CrmStage | "all">("all");
  const selectedId = urlParams.get("client");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);
  const [movingClientId, setMovingClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { clients } = await listCrmClients();
        if (!cancelled) setClients(clients);
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
      notifySuccess("Etapa del cliente actualizada.");
    } catch {
      notifyError("No se pudo guardar la nueva etapa del cliente.");
    } finally {
      setMovingClientId(null);
    }
  }, [clients, movingClientId, notifyError, notifySuccess, patchClient]);

  // Conteo por etapa (para los chips de filtro).
  const countByStage = (stage: CrmStage) => clients.filter((c) => c.stage === stage).length;

  const overdueClients = clients.filter((c) => isOverdue(c.nextFollowUp));

  const filtered = clients.filter((c) => {
    if (stageFilter !== "all" && c.stage !== stageFilter) return false;
    if (onlyOverdue && !isOverdue(c.nextFollowUp)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

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
          <span className={s.countBadge}>{clients.length}</span>
        </div>
      </header>

      <div className={s.content}>
        {error && <div className={s.errorBanner} role="alert">{error}</div>}

        {/* ── Alerta de seguimientos vencidos ── */}
        {overdueClients.length > 0 && (
          <button
            type="button"
            className={`${s.overdueBanner} ${onlyOverdue ? s.overdueBannerActive : ""}`}
            onClick={() => setOnlyOverdue((v) => !v)}
          >
            <WarningIcon />
            {overdueClients.length} {overdueClients.length === 1 ? "cliente tiene" : "clientes tienen"} seguimiento vencido
            <span className={s.overdueBannerAction}>{onlyOverdue ? "Ver todos" : "Ver solo estos"}</span>
          </button>
        )}

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

        {/* ── Buscador + vista + exportar ── */}
        <div className={s.toolbarRow}>
          <div className={s.searchRow}>
            <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={s.searchInput}
              placeholder="Buscar por negocio, usuario o slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={s.viewToggle}>
            <button
              className={`${s.viewToggleBtn} ${viewMode === "list" ? s.viewToggleBtnActive : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="Vista lista"
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

        {/* ── Vista lista ── */}
        {viewMode === "list" && (
          filtered.length === 0 ? (
            <p className={s.emptyHint}>No hay clientes que coincidan.</p>
          ) : (
            <ul className={s.clientList}>
              {filtered.map((c) => (
                <li key={c._id}>
                  <button className={s.clientRow} onClick={() => openDrawer(c._id)} type="button">
                    <span className={s.stageDot} style={{ background: STAGE_META[c.stage].color }} title={STAGE_META[c.stage].label} />
                    <span className={s.clientMain}>
                      <span className={s.clientName}>
                        {c.businessName || <span className={s.clientNameEmpty}>Sin nombre — @{c.username}</span>}
                      </span>
                      <span className={s.clientMeta}>
                        {STAGE_META[c.stage].label}
                        {!c.active && <span className={s.inactiveTag}>Inactivo</span>}
                        {c.nextFollowUp && (
                          <span className={`${s.followUp} ${isOverdue(c.nextFollowUp) ? s.followUpOverdue : ""}`}>
                            {isOverdue(c.nextFollowUp) ? "Seguimiento vencido" : "Seguir"} · {fmtFollowUpDate(c.nextFollowUp)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={`${s.planBadge} ${s[`plan_${c.subscription}`]}`}>{PLAN_LABEL[c.subscription]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ── Vista kanban ── */}
        {viewMode === "kanban" && (
          <div className={s.kanbanBoard}>
            {STAGE_ORDER.map((st) => {
              const stClients = filtered.filter((c) => c.stage === st);
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
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Drawer de detalle — perfil + controles de CRM + actividad (notas + eventos)
// ══════════════════════════════════════════════════════════════════
function ClientDrawer({
  userID,
  onClose,
  onPatch,
}: {
  userID: string;
  onClose: () => void;
  onPatch: (userID: string, patch: Partial<CrmClient>) => void;
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
