import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { CrmClient, CrmClientDetail, CrmStage } from "../../../types";
import {
  listCrmClients,
  getCrmClient,
  updateCrmProfile,
  addCrmNote,
  deleteCrmNote,
} from "../../../api/crm";
import { PLAN_LABEL } from "../../../lib/plans";
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

// ── Helpers de fecha ──
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "";

// Una fecha de seguimiento está "vencida" si ya pasó (comparando por día).
const isOverdue = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
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

// ══════════════════════════════════════════════════════════════════
// Componente principal — lista de clientes + filtros + drawer de detalle
// ══════════════════════════════════════════════════════════════════
export default function CrmClients() {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CrmStage | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  }, []);

  // El drawer avisa cuando cambió algo de un cliente (etapa/tags/seguimiento)
  // para reflejarlo en la fila del listado sin volver a pedir todo.
  const patchClient = useCallback((userID: string, patch: Partial<CrmClient>) => {
    setClients((prev) => prev.map((c) => (c._id === userID ? { ...c, ...patch } : c)));
  }, []);

  // Conteo por etapa (para los chips de filtro).
  const countByStage = (stage: CrmStage) => clients.filter((c) => c.stage === stage).length;

  const filtered = clients.filter((c) => {
    if (stageFilter !== "all" && c.stage !== stageFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className={s.pageCenter}>
        <div className={s.loaderRing} aria-label="Cargando clientes…" />
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      {/* ── Top bar ── */}
      <header className={s.topBar}>
        <div className={s.topBarInner}>
          <Link to="/admin" className={s.backLink} aria-label="Volver al panel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div>
            <p className={s.eyebrow}>CRM</p>
            <h1 className={s.title}>Clientes</h1>
          </div>
          <span className={s.countBadge}>{clients.length}</span>
        </div>
      </header>

      <div className={s.content}>
        {error && <div className={s.errorBanner} role="alert">{error}</div>}

        {/* ── Filtros por etapa ── */}
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

        {/* ── Buscador ── */}
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

        {/* ── Lista de clientes ── */}
        {filtered.length === 0 ? (
          <p className={s.emptyHint}>No hay clientes que coincidan.</p>
        ) : (
          <ul className={s.clientList}>
            {filtered.map((c) => (
              <li key={c._id}>
                <button className={s.clientRow} onClick={() => setSelectedId(c._id)} type="button">
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
                          {isOverdue(c.nextFollowUp) ? "Seguimiento vencido" : "Seguir"} · {fmtDate(c.nextFollowUp)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={`${s.planBadge} ${s[`plan_${c.subscription}`]}`}>{PLAN_LABEL[c.subscription]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId && (
        <ClientDrawer
          userID={selectedId}
          onClose={() => setSelectedId(null)}
          onPatch={patchClient}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Drawer de detalle — perfil + controles de CRM + notas
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
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Carga del detalle + cierre con Escape.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await getCrmClient(userID);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [userID, onClose]);

  // Guarda un cambio de etapa/tags/seguimiento y sincroniza el estado local +
  // la fila del listado (onPatch). Optimista: refleja el cambio enseguida.
  const saveProfile = async (patch: Partial<Pick<CrmClientDetail["crm"], "stage" | "tags" | "nextFollowUp">>) => {
    if (!detail) return;
    setDetail({ ...detail, crm: { ...detail.crm, ...patch } });
    onPatch(userID, patch as Partial<CrmClient>);
    try {
      const updated = await updateCrmProfile(userID, patch);
      setDetail((d) => (d ? { ...d, crm: updated } : d));
    } catch {
      /* si falla, el próximo fetch corrige; para un panel interno alcanza */
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || !detail) return;
    if (detail.crm.tags.includes(t)) { setTagInput(""); return; }
    saveProfile({ tags: [...detail.crm.tags, t] });
    setTagInput("");
  };
  const removeTag = (tag: string) => {
    if (!detail) return;
    saveProfile({ tags: detail.crm.tags.filter((x) => x !== tag) });
  };

  const submitNote = async () => {
    const text = noteInput.trim();
    if (!text || savingNote) return;
    setSavingNote(true);
    try {
      const updated = await addCrmNote(userID, text);
      setDetail((d) => (d ? { ...d, crm: updated } : d));
      setNoteInput("");
    } catch {
      /* noop */
    } finally {
      setSavingNote(false);
    }
  };

  const removeNote = async (noteID: string) => {
    try {
      const updated = await deleteCrmNote(userID, noteID);
      setDetail((d) => (d ? { ...d, crm: updated } : d));
    } catch { /* noop */ }
  };

  const u = detail?.user;
  const crm = detail?.crm;

  return (
    <div className={s.drawerOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Detalle del cliente">
      <div className={s.drawer} onClick={(e) => e.stopPropagation()}>
        {loading || !detail || !u || !crm ? (
          <div className={s.drawerLoading}><div className={s.loaderRing} /></div>
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
                    <span className={s.metaLabel}>Carga</span>
                    <span className={s.metaValue}>{detail.activity.categoryCount} cat · {detail.activity.itemCount} prod</span>
                  </div>
                </div>
                {u.slug && (
                  <a className={s.slugLink} href={`/${u.slug}`} target="_blank" rel="noreferrer">
                    Ver carta pública ↗
                  </a>
                )}
              </section>

              {/* ── Etapa ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Etapa</p>
                <div className={s.stagePicker}>
                  {STAGE_ORDER.map((st) => (
                    <button
                      key={st}
                      className={`${s.stageOption} ${crm.stage === st ? s.stageOptionActive : ""}`}
                      onClick={() => saveProfile({ stage: st })}
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
                    onChange={(e) => saveProfile({ nextFollowUp: e.target.value || null })}
                  />
                  {crm.nextFollowUp && (
                    <button className={s.clearBtn} onClick={() => saveProfile({ nextFollowUp: null })} type="button">
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
                      <button className={s.tagRemove} onClick={() => removeTag(tag)} aria-label={`Quitar ${tag}`} type="button">×</button>
                    </span>
                  ))}
                  <input
                    className={s.tagInput}
                    placeholder="Agregar…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  />
                </div>
              </section>

              {/* ── Notas ── */}
              <section className={s.section}>
                <p className={s.sectionLabel}>Notas ({crm.notes.length})</p>
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
                    <li key={n._id} className={s.noteItem}>
                      <p className={s.noteText}>{n.text}</p>
                      <div className={s.noteFooter}>
                        <span className={s.noteMeta}>
                          {n.author?.username ? `${n.author.username} · ` : ""}{timeAgo(n.createdAt)}
                        </span>
                        <button className={s.noteDelete} onClick={() => removeNote(n._id)} aria-label="Borrar nota" type="button">
                          Borrar
                        </button>
                      </div>
                    </li>
                  ))}
                  {crm.notes.length === 0 && <p className={s.emptyHint}>Todavía no hay notas.</p>}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
