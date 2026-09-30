import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { History, Pencil, QrCode, Smartphone, Trash2, X } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import {
  createWaiter, deleteWaiter, issuePairingCode, listWaiterSessions, revokeWaiterSession, revokeWaiterSessions, updateWaiter,
} from "../../api/ordersApi";
import { useWaiters } from "../../hooks/usePanelData";
import { errorMessage } from "../../lib/errors";
import { durationLabel, elapsedLabel, formatDateTime } from "../../lib/format";
import { waiterQrUrl } from "../../lib/qrUrls";
import type { Waiter, WaiterDeviceSession } from "../../types";
import p from "./panel.module.css";

// Operadores (antes "mozos"): quien toma pedidos, atiende mesas o está en la
// barra. Alta, edición, pausa, el QR de acceso de cada uno al tomador de
// pedidos y sus dispositivos conectados (desde cuándo y última actividad).
// El QR cambia cada minuto y sirve una sola vez, así que hay que escanearlo
// desde el panel (una foto vieja no sirve).

const EMPTY_FORM = { name: "", phone: "", notes: "" };
const REFRESH_LIST_MS = 30_000;

const ENDED_REASON: Record<NonNullable<WaiterDeviceSession["endedReason"]>, string> = {
  logout: "cerró sesión",
  revoked: "cerrada desde el panel",
  paused: "operador pausado",
  deleted: "operador eliminado",
};

export default function WaitersPage() {
  const waiters = useWaiters();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Waiter | null>(null);
  const [qrWaiter, setQrWaiter] = useState<Waiter | null>(null);
  const [historyWaiter, setHistoryWaiter] = useState<Waiter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { reload } = waiters;

  // "Conectado hace…" y la última actividad se mantienen al día solos.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      reload();
    }, REFRESH_LIST_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const list = waiters.data ?? [];
  const replace = (updated: Waiter) => waiters.setData(list.map(w => (w.id === updated.id ? updated : w)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        replace(await updateWaiter(editing.id, form));
        setEditing(null);
      } else {
        const created = await createWaiter(form);
        waiters.setData([...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el operador."));
    } finally {
      setSaving(false);
    }
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  };

  const startEdit = (waiter: Waiter) => {
    setEditing(waiter);
    setForm({ name: waiter.name, phone: waiter.phone ?? "", notes: waiter.notes ?? "" });
  };

  const withoutSession = (waiter: Waiter, sessionId: number): Waiter => {
    const sessions = waiter.sessions.filter(session => session.id !== sessionId);
    return { ...waiter, sessions, activeDevices: sessions.length };
  };

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Operadores</h1>
          <p className={p.subtitle}>
            Quien toma pedidos, atiende mesas o está en la barra. Cada operador entra al tomador de pedidos escaneando su QR desde este panel.
          </p>
        </div>
      </header>

      <div className={p.grid}>
        <form className={`${p.card} ${p.stack}`} onSubmit={submit}>
          <h2 className={p.cardTitle}>{editing ? `Editar a ${editing.name}` : "Agregar operador"}</h2>
          <label className={p.field}>
            <span className={p.label}>Nombre</span>
            <input className={p.input} value={form.name} maxLength={60} required onChange={e => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className={p.field}>
            <span className={p.label}>Teléfono (opcional)</span>
            <input className={p.input} value={form.phone} maxLength={30} inputMode="tel" onChange={e => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className={p.field}>
            <span className={p.label}>Notas (opcional)</span>
            <input className={p.input} value={form.notes} maxLength={200} placeholder="Ej: turno noche, sector terraza, barra" onChange={e => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className={p.headerActions}>
            <button type="submit" className={p.btnPrimary} disabled={saving || !form.name.trim()}>
              {editing ? "Guardar cambios" : "Agregar"}
            </button>
            {editing && (
              <button type="button" className={p.btn} onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>Cancelar</button>
            )}
          </div>
        </form>

        <section className={p.card} aria-label="Lista de operadores">
          <h2 className={p.cardTitle}>Equipo ({list.length})</h2>
          {error && <p className={p.error} role="alert">{error}</p>}
          {waiters.loading && <p className={p.loading}>Cargando…</p>}
          {waiters.error && <p className={p.error}>{waiters.error}</p>}
          {!waiters.loading && list.length === 0 && <p className={p.empty}>Todavía no cargaste operadores.</p>}

          {list.map(waiter => (
            <div key={waiter.id} className={p.switchRow}>
              <div className={p.switchText} style={{ minWidth: 0, flex: 1 }}>
                <span className={p.switchTitle}>{waiter.name}{!waiter.active && " (pausado)"}</span>
                <span className={p.switchHint}>
                  {[waiter.phone, waiter.notes].filter(Boolean).join(" · ") || "Sin datos extra"}
                </span>

                {waiter.sessions.length === 0 ? (
                  <span className={p.switchHint}>Sin dispositivos conectados.</span>
                ) : (
                  <ul className={p.stack} style={{ gap: "0.35rem", margin: "0.35rem 0 0", padding: 0, listStyle: "none" }}>
                    {waiter.sessions.map(session => (
                      <li key={session.id} className={p.switchHint} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.5rem" }}>
                        <Smartphone size={13} aria-hidden />
                        <strong style={{ fontWeight: 600 }}>{session.deviceLabel ?? "Dispositivo"}</strong>
                        <span>
                          · conectado desde hace {durationLabel(session.startedAt, null, now)} · última actividad {elapsedLabel(session.lastSeenAt, now)}
                        </span>
                        <button
                          type="button"
                          className={`${p.btnGhost} ${p.small}`}
                          style={{ minHeight: 28 }}
                          onClick={() => run(async () => {
                            await revokeWaiterSession(waiter.id, session.id);
                            replace(withoutSession(waiter, session.id));
                          }, "No se pudo cerrar la sesión.")}
                          aria-label={`Cerrar la sesión de ${waiter.name} en ${session.deviceLabel ?? "este dispositivo"}`}
                        >
                          Cerrar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={p.headerActions} style={{ marginTop: "0.4rem" }}>
                  <button type="button" className={`${p.btn} ${p.small}`} disabled={!waiter.active} onClick={() => setQrWaiter(waiter)}>
                    <QrCode size={14} aria-hidden /> QR de acceso
                  </button>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => startEdit(waiter)}>
                    <Pencil size={14} aria-hidden /> Editar
                  </button>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setHistoryWaiter(waiter)}>
                    <History size={14} aria-hidden /> Sesiones
                  </button>
                  {waiter.activeDevices > 1 && (
                    <button
                      type="button"
                      className={`${p.btnGhost} ${p.small}`}
                      onClick={() => run(async () => {
                        await revokeWaiterSessions(waiter.id);
                        replace({ ...waiter, activeDevices: 0, sessions: [] });
                      }, "No se pudieron cerrar las sesiones.")}
                    >
                      Cerrar todas
                    </button>
                  )}
                  {confirmDelete === waiter.id ? (
                    <>
                      <button
                        type="button"
                        className={`${p.btnDanger} ${p.small}`}
                        onClick={() => run(async () => {
                          await deleteWaiter(waiter.id);
                          waiters.setData(list.filter(w => w.id !== waiter.id));
                          setConfirmDelete(null);
                        }, "No se pudo eliminar el operador.")}
                      >
                        Sí, eliminar
                      </button>
                      <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirmDelete(null)}>No</button>
                    </>
                  ) : (
                    <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setConfirmDelete(waiter.id)} aria-label={`Eliminar a ${waiter.name}`}>
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="checkbox"
                className={p.switch}
                checked={waiter.active}
                aria-label={waiter.active ? `Pausar a ${waiter.name}` : `Activar a ${waiter.name}`}
                onChange={() => run(async () => replace(await updateWaiter(waiter.id, { active: !waiter.active })), "No se pudo actualizar el operador.")}
              />
            </div>
          ))}
          <p className={p.cardDesc} style={{ margin: "0.75rem 0 0" }}>
            Eliminar un operador no borra su historial: sus pedidos y mesas conservan el nombre.
          </p>
        </section>
      </div>

      {qrWaiter && <PairingQrModal waiter={qrWaiter} onClose={() => { setQrWaiter(null); waiters.reload(); }} />}
      {historyWaiter && <SessionsModal waiter={historyWaiter} onClose={() => setHistoryWaiter(null)} />}
    </div>
  );
}

// Historial de sesiones de un operador: dispositivo, inicio, última
// actividad y cierre.
function SessionsModal({ waiter, onClose }: { waiter: Waiter; onClose: () => void }) {
  const [sessions, setSessions] = useState<WaiterDeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWaiterSessions(waiter.id)
      .then(result => { if (!cancelled) setSessions(result); })
      .catch(err => { if (!cancelled) setError(errorMessage(err, "No se pudieron cargar las sesiones.")); });
    return () => { cancelled = true; };
  }, [waiter.id]);

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Sesiones de ${waiter.name}`} onClick={onClose}>
      <div className={p.modal} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Sesiones de {waiter.name}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={p.modalBody}>
          {error && <p className={p.error}>{error}</p>}
          {!sessions && !error && <p className={p.loading}>Cargando…</p>}
          {sessions?.length === 0 && <p className={p.empty}>Todavía no vinculó ningún dispositivo.</p>}
          {sessions?.map(session => (
            <div key={session.id} className={p.switchRow}>
              <div className={p.switchText}>
                <span className={p.switchTitle}>
                  {session.deviceLabel ?? "Dispositivo"}{!session.endedAt && " · conectado"}
                </span>
                <span className={p.switchHint}>
                  Inicio: {formatDateTime(session.startedAt)} · Última actividad: {formatDateTime(session.lastSeenAt)}
                  {session.endedAt
                    ? ` · Cierre: ${formatDateTime(session.endedAt)}${session.endedReason ? ` (${ENDED_REASON[session.endedReason]})` : ""}`
                    : ` · Conectado desde hace ${durationLabel(session.startedAt)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// QR de acceso que se renueva solo (el código vence a los 2 minutos y es de
// un solo uso; se pide uno nuevo cada minuto mientras el modal esté abierto).
const REFRESH_MS = 60_000;

function PairingQrModal({ waiter, onClose }: { waiter: Waiter; onClose: () => void }) {
  const slug = useAuth().user?.slug;
  const [image, setImage] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);

  const refresh = useCallback(async () => {
    if (!slug) return;
    try {
      const { code } = await issuePairingCode(waiter.id);
      const link = waiterQrUrl(slug, code);
      setUrl(link);
      setImage(await QRCode.toDataURL(link, { width: 320, margin: 1 }));
      setSecondsLeft(REFRESH_MS / 1000);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar el QR."));
    }
  }, [slug, waiter.id]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => setSecondsLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => { clearTimeout(first); clearInterval(timer); clearInterval(tick); };
  }, [refresh]);

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`QR de acceso de ${waiter.name}`} onClick={onClose}>
      <div className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>QR de {waiter.name}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={p.modalBody} style={{ textAlign: "center" }}>
          <p className={p.subtitle} style={{ marginBottom: "1rem", lineHeight: 1.5 }}>
            Que {waiter.name} lo escanee con la cámara de su celular o tablet. El dispositivo queda habilitado
            para tomar pedidos a su nombre.
          </p>
          {error && <p className={p.error}>{error}</p>}
          {image ? <img src={image} alt={`QR de acceso de ${waiter.name}`} className={p.qrImage} style={{ maxWidth: 260 }} /> : <p className={p.loading}>Generando…</p>}
          <p className={p.label} style={{ marginTop: "0.75rem" }}>Se renueva en {secondsLeft} s · sirve una sola vez</p>
          {url && (
            <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => navigator.clipboard?.writeText(url)}>
              Copiar enlace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
