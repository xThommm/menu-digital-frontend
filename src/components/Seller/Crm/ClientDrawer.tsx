import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminPayment, CrmClient, CrmClientDetail } from "../../../types";
import {
  getCrmClient,
  updateCrmProfile,
  addCrmNote,
  deleteCrmNote,
  setCrmClientActive,
} from "../../../api/crm";
import { listAdminPayments } from "../../../api/adminPayments";
import { useAuth } from "../../../context/useAuth";
import { useNotifications } from "../../../context/useNotifications";
import {
  ENTITLEMENT_LABEL,
  OPERATION_LABEL,
  PAYMENT_STATUS_LABEL,
  formatPaymentAmount,
  formatPaymentDate,
} from "../../../lib/adminPayments";
import { sanitizePhoneForWa } from "../../../lib/whatsapp";
import { extractServerMessage } from "../../../lib/apiErrors";
import {
  STAGE_META,
  STAGE_ORDER,
  ONBOARDING_ITEMS,
  fmtDate,
  isOverdue,
  timeAgo,
  dateInputValue,
  planExpiryLabel,
  effectiveSubscriptionFor,
  planBadgeLabel,
} from "./crmHelpers";
import { EventDotIcon } from "./crmIcons";
import s from "./SellerCrm.module.css";

// ══════════════════════════════════════════════════════════════════
// Drawer de detalle — perfil + controles de CRM + actividad (notas + eventos)
// ══════════════════════════════════════════════════════════════════
export default function ClientDrawer({
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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

  // Carga del detalle + cierre con Escape. Los pagos son solo para admin: un
  // vendedor no ve el historial financiero de sus clientes, sólo el resto de
  // la ficha CRM.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setPaymentsLoading(isAdmin);
      setPaymentsError(false);
      const [detailResult, paymentsResult] = await Promise.allSettled([
        getCrmClient(userID),
        isAdmin ? listAdminPayments({ userID, page: 1, limit: 5 }) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (detailResult.status === "rejected") {
        notifyError("No se pudo cargar el detalle del cliente.");
        onClose();
        return;
      }
      setDetail(detailResult.value);
      setLoading(false);

      if (paymentsResult.status === "fulfilled" && paymentsResult.value) {
        setPayments(paymentsResult.value.payments);
        setPaymentsTotal(paymentsResult.value.pagination.total);
      } else if (isAdmin) {
        setPaymentsError(true);
      }
      setPaymentsLoading(false);
    };
    load();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [notifyError, userID, onClose, isAdmin]);

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
    } catch (err) {
      notifyError(extractServerMessage(err, "No se pudo guardar el cambio en el perfil de CRM."));
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
    } catch (err) {
      notifyError(extractServerMessage(err, "No se pudo agregar la nota."));
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
    } catch (err) {
      notifyError(extractServerMessage(err, "No se pudo eliminar la nota."));
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
    } catch (err) {
      notifyError(extractServerMessage(err, "No se pudo cambiar el estado de la cuenta."));
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
                  {isAdmin && (
                    <button
                      className={`${s.actionButton} ${u.active ? s.actionDanger : s.actionPrimary}`}
                      onClick={toggleClientActive}
                      disabled={changingActive}
                      type="button"
                    >
                      {changingActive ? "Guardando…" : (u.active ? "Desactivar cuenta" : "Activar cuenta")}
                    </button>
                  )}
                </div>
              </section>

              {/* ── Perfil / actividad ── */}
              <section className={s.section}>
                <div className={s.metaGrid}>
                  <div className={s.metaItem}>
                    <span className={s.metaLabel}>Plan</span>
                    <span className={`${s.planBadge} ${s[`plan_${effectiveSubscriptionFor(u)}`]}`}>{planBadgeLabel(u)}</span>
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

              {/* ── Historial financiero durable — solo admin ── */}
              {isAdmin && (
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
              )}

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
                        {n.kind === "event" && <EventDotIcon className={s.eventDotIcon} />}
                        {n.text}
                      </p>
                      <div className={s.noteFooter}>
                        <span className={s.noteMeta}>
                          {n.kind === "event"
                            ? "Sistema"
                            : n.author?.username
                              ? `${n.author.username} · `
                              : n.authorLabel
                                ? `${n.authorLabel} · `
                                : ""}{timeAgo(n.createdAt)}
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
