import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { History, Pencil, QrCode, Smartphone, Trash2, X } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import {
  createCourier, deleteCourier, issueCourierPairingCode, listCourierSessions, revokeCourierPairingCode, revokeCourierSession,
  revokeCourierSessions, updateCourier,
} from "../../api/ordersApi";
import { useCouriers } from "../../hooks/usePanelData";
import { ownerHello, useLiveRefresh } from "../../hooks/useLiveRefresh";
import { errorCode, errorMessage } from "../../lib/errors";
import { durationLabel, elapsedLabel, formatDateTime } from "../../lib/format";
import { courierManualUrl, courierQrUrl } from "../../lib/qrUrls";
import type { Courier, WaiterDeviceSession } from "../../types";
import DeliveryTabs from "./DeliveryTabs";
import p from "../panel/panel.module.css";
import s from "./Delivery.module.css";

// Repartidores del local: alta, edición, pausa, el QR de vinculación de cada
// uno y sus dispositivos conectados. Estar vinculado no es estar disponible:
// la disponibilidad la marca el propio repartidor en su celular y se ve acá.
// Pausar o eliminar a alguien con entregas sin resolver exige pasárselas a otro
// repartidor (no quedan pedidos huérfanos).

const EMPTY_FORM = { name: "", phone: "", notes: "" };
const REFRESH_LIST_MS = 30_000;

const ENDED_REASON: Record<NonNullable<WaiterDeviceSession["endedReason"]>, string> = {
  logout: "cerró sesión",
  revoked: "cerrada desde el panel",
  paused: "repartidor pausado",
  deleted: "repartidor eliminado",
};

type Leaving = { courier: Courier; kind: "pause" | "delete" };

export default function CouriersPage() {
  const couriers = useCouriers();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [qrCourier, setQrCourier] = useState<Courier | null>(null);
  const [historyCourier, setHistoryCourier] = useState<Courier | null>(null);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { reload } = couriers;

  // "Conectado hace…" avanza con el reloj local; disponibilidad y dispositivos llegan
  // con el aviso del servidor (sin conexión en vivo, cada REFRESH_LIST_MS).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_LIST_MS);
    return () => clearInterval(timer);
  }, []);
  useLiveRefresh({ hello: ownerHello(), refresh: reload, offlineMs: REFRESH_LIST_MS, initial: false });

  const list = couriers.data ?? [];
  const replace = (updated: Courier) => couriers.setData(list.map(item => (item.id === updated.id ? updated : item)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        replace(await updateCourier(editing.id, form));
        setEditing(null);
      } else {
        const created = await createCourier(form);
        couriers.setData([...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el repartidor."));
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

  const startEdit = (courier: Courier) => {
    setEditing(courier);
    setForm({ name: courier.name, phone: courier.phone ?? "", notes: courier.notes ?? "" });
  };

  const withoutSession = (courier: Courier, sessionId: number): Courier => {
    const sessions = courier.sessions.filter(session => session.id !== sessionId);
    return { ...courier, sessions, activeDevices: sessions.length, available: sessions.length > 0 && courier.available };
  };

  // Pausar o activar: si tiene entregas sin resolver se pide a quién pasárselas.
  const toggleActive = (courier: Courier) => run(async () => {
    if (courier.active && courier.activeDeliveries > 0) {
      setLeaving({ courier, kind: "pause" });
      return;
    }
    try {
      replace(await updateCourier(courier.id, { active: !courier.active }));
    } catch (err) {
      if (errorCode(err) === "COURIER_HAS_ACTIVE_DELIVERIES") setLeaving({ courier, kind: "pause" });
      else throw err;
    }
  }, "No se pudo actualizar el repartidor.");

  const requestDelete = (courier: Courier) => run(async () => {
    if (courier.activeDeliveries > 0) {
      setLeaving({ courier, kind: "delete" });
      return;
    }
    try {
      await deleteCourier(courier.id);
      couriers.setData(list.filter(item => item.id !== courier.id));
      setConfirmDelete(null);
    } catch (err) {
      if (errorCode(err) === "COURIER_HAS_ACTIVE_DELIVERIES") setLeaving({ courier, kind: "delete" });
      else throw err;
    }
  }, "No se pudo eliminar el repartidor.");

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Repartidores</h1>
          <p className={p.subtitle}>
            Quienes llevan los pedidos de delivery. Cada repartidor entra a su app escaneando un QR desde este panel (sirve una sola vez y vence en
            minutos) y se marca disponible cuando puede recibir pedidos.
          </p>
        </div>
        <DeliveryTabs />
      </header>

      <div className={p.grid}>
        <form className={`${p.card} ${p.stack}`} onSubmit={submit}>
          <h2 className={p.cardTitle}>{editing ? `Editar a ${editing.name}` : "Agregar repartidor"}</h2>
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
            <input className={p.input} value={form.notes} maxLength={200} placeholder="Ej: moto, zona norte, turno noche" onChange={e => setForm({ ...form, notes: e.target.value })} />
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

        <section className={p.card} aria-label="Lista de repartidores">
          <h2 className={p.cardTitle}>Equipo de reparto ({list.length})</h2>
          {error && <p className={p.error} role="alert">{error}</p>}
          {couriers.loading && <p className={p.loading}>Cargando…</p>}
          {couriers.error && <p className={p.error}>{couriers.error}</p>}
          {!couriers.loading && list.length === 0 && <p className={p.empty}>Todavía no cargaste repartidores.</p>}

          {list.map(courier => (
            <div key={courier.id} className={p.switchRow}>
              <div className={p.switchText} style={{ minWidth: 0, flex: 1 }}>
                <span className={p.switchTitle}>
                  {courier.name}
                  {!courier.active ? " (pausado)" : courier.available ? " · disponible" : courier.activeDevices > 0 ? " · no disponible" : " · sin conectar"}
                </span>
                <span className={p.switchHint}>
                  {[courier.phone, courier.notes].filter(Boolean).join(" · ") || "Sin datos extra"}
                  {courier.activeDeliveries > 0 && ` · ${courier.activeDeliveries} ${courier.activeDeliveries === 1 ? "entrega" : "entregas"} sin resolver`}
                </span>

                {courier.sessions.length === 0 ? (
                  <span className={p.switchHint}>Sin dispositivos conectados.</span>
                ) : (
                  <ul className={s.deviceList}>
                    {courier.sessions.map(session => (
                      <li key={session.id} className={p.switchHint} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.5rem" }}>
                        <Smartphone size={13} aria-hidden />
                        <strong style={{ fontWeight: 600 }}>{session.deviceLabel ?? "Dispositivo"}</strong>
                        <span>· conectado desde hace {durationLabel(session.startedAt, null, now)} · última actividad {elapsedLabel(session.lastSeenAt, now)}</span>
                        <button
                          type="button"
                          className={`${p.btnGhost} ${p.small}`}
                          style={{ minHeight: 28 }}
                          onClick={() => run(async () => {
                            await revokeCourierSession(courier.id, session.id);
                            replace(withoutSession(courier, session.id));
                          }, "No se pudo cerrar la sesión.")}
                          aria-label={`Cerrar la sesión de ${courier.name} en ${session.deviceLabel ?? "este dispositivo"}`}
                        >
                          Cerrar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={p.headerActions} style={{ marginTop: "0.4rem" }}>
                  <button type="button" className={`${p.btn} ${p.small}`} disabled={!courier.active} onClick={() => setQrCourier(courier)}>
                    <QrCode size={14} aria-hidden /> QR de acceso
                  </button>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => startEdit(courier)}>
                    <Pencil size={14} aria-hidden /> Editar
                  </button>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setHistoryCourier(courier)}>
                    <History size={14} aria-hidden /> Sesiones
                  </button>
                  {courier.activeDevices > 1 && (
                    <button
                      type="button"
                      className={`${p.btnGhost} ${p.small}`}
                      onClick={() => run(async () => {
                        await revokeCourierSessions(courier.id);
                        replace({ ...courier, activeDevices: 0, sessions: [], available: false });
                      }, "No se pudieron cerrar las sesiones.")}
                    >
                      Cerrar todas
                    </button>
                  )}
                  {confirmDelete === courier.id ? (
                    <>
                      <button type="button" className={`${p.btnDanger} ${p.small}`} onClick={() => requestDelete(courier)}>Sí, eliminar</button>
                      <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirmDelete(null)}>No</button>
                    </>
                  ) : (
                    <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setConfirmDelete(courier.id)} aria-label={`Eliminar a ${courier.name}`}>
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="checkbox"
                className={p.switch}
                checked={courier.active}
                aria-label={courier.active ? `Pausar a ${courier.name}` : `Activar a ${courier.name}`}
                onChange={() => toggleActive(courier)}
              />
            </div>
          ))}
          <p className={p.cardDesc} style={{ margin: "0.75rem 0 0" }}>
            Eliminar un repartidor no borra su historial: sus entregas conservan el nombre.
          </p>
        </section>
      </div>

      {qrCourier && <PairingQrModal courier={qrCourier} onClose={() => { setQrCourier(null); couriers.reload(); }} />}
      {historyCourier && <SessionsModal courier={historyCourier} onClose={() => setHistoryCourier(null)} />}
      {leaving && (
        <ReassignModal
          leaving={leaving}
          others={list.filter(item => item.active && item.id !== leaving.courier.id)}
          onClose={() => setLeaving(null)}
          onDone={() => { setLeaving(null); setConfirmDelete(null); couriers.reload(); }}
        />
      )}
    </div>
  );
}

// Pausar o eliminar a un repartidor con entregas sin resolver: se las pasás a otro.
function ReassignModal({ leaving, others, onClose, onDone }: {
  leaving: Leaving;
  others: Courier[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { courier, kind } = leaving;
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "pause") await updateCourier(courier.id, { active: false, reassignTo: Number(target) });
      else await deleteCourier(courier.id, Number(target));
      onDone();
    } catch (err) {
      setError(errorMessage(err, "No se pudieron reasignar las entregas."));
      setSaving(false);
    }
  };

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Entregas de ${courier.name}`} onClick={onClose}>
      <form className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()} onSubmit={submit}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>{courier.name} tiene entregas sin resolver</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={`${p.modalBody} ${p.stack}`}>
          <p className={p.subtitle} style={{ lineHeight: 1.5 }}>
            Tiene {courier.activeDeliveries} {courier.activeDeliveries === 1 ? "entrega asignada o en camino" : "entregas asignadas o en camino"}.
            Para {kind === "pause" ? "pausarlo" : "eliminarlo"}, pasalas a otro repartidor (queda registrado en el historial de cada pedido)
            o resolvelas antes desde Entregas en curso.
          </p>
          {others.length === 0 ? (
            <p className={p.error}>No hay otro repartidor activo al que pasarle las entregas.</p>
          ) : (
            <label className={p.field}>
              <span className={p.label}>Pasarlas a</span>
              <select className={p.select} value={target} onChange={event => setTarget(event.target.value)}>
                <option value="">Elegí un repartidor</option>
                {others.map(other => <option key={other.id} value={other.id}>{other.name}{other.available ? " · disponible" : ""}</option>)}
              </select>
            </label>
          )}
          {error && <p className={p.error} role="alert">{error}</p>}
        </div>
        <footer className={p.modalFooter}>
          <button type="submit" className={p.btnPrimary} disabled={saving || !target}>
            {kind === "pause" ? "Reasignar y pausar" : "Reasignar y eliminar"}
          </button>
          <button type="button" className={p.btn} onClick={onClose}>Volver</button>
        </footer>
      </form>
    </div>
  );
}

function SessionsModal({ courier, onClose }: { courier: Courier; onClose: () => void }) {
  const [sessions, setSessions] = useState<WaiterDeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCourierSessions(courier.id)
      .then(result => { if (!cancelled) setSessions(result); })
      .catch(err => { if (!cancelled) setError(errorMessage(err, "No se pudieron cargar las sesiones.")); });
    return () => { cancelled = true; };
  }, [courier.id]);

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Sesiones de ${courier.name}`} onClick={onClose}>
      <div className={p.modal} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Sesiones de {courier.name}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={p.modalBody}>
          {error && <p className={p.error}>{error}</p>}
          {!sessions && !error && <p className={p.loading}>Cargando…</p>}
          {sessions?.length === 0 && <p className={p.empty}>Todavía no vinculó ningún dispositivo.</p>}
          {sessions?.map(session => (
            <div key={session.id} className={p.switchRow}>
              <div className={p.switchText}>
                <span className={p.switchTitle}>{session.deviceLabel ?? "Dispositivo"}{!session.endedAt && " · conectado"}</span>
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

// QR de vinculación que se renueva solo (el código vence a los 2 minutos y es
// de un solo uso; se pide uno nuevo cada minuto mientras el modal esté abierto).
// Al cerrar el modal se revoca el código pendiente.
const REFRESH_MS = 60_000;

function PairingQrModal({ courier, onClose }: { courier: Courier; onClose: () => void }) {
  const slug = useAuth().user?.slug;
  const [image, setImage] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);

  const refresh = useCallback(async () => {
    if (!slug) return;
    try {
      const { code, manualCode: typed } = await issueCourierPairingCode(courier.id);
      const link = courierQrUrl(slug, code);
      setUrl(link);
      setManualCode(typed);
      setImage(await QRCode.toDataURL(link, { width: 320, margin: 1 }));
      setSecondsLeft(REFRESH_MS / 1000);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar el QR."));
    }
  }, [slug, courier.id]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => setSecondsLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => { clearTimeout(first); clearInterval(timer); clearInterval(tick); };
  }, [refresh]);

  const close = () => {
    // Un QR que ya no se está mostrando no tiene por qué seguir siendo válido.
    void revokeCourierPairingCode(courier.id).catch(() => undefined);
    onClose();
  };

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`QR de acceso de ${courier.name}`} onClick={close}>
      <div className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>QR de {courier.name}</h2>
          <button type="button" className={p.iconBtn} onClick={close} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={p.modalBody} style={{ textAlign: "center" }}>
          <p className={p.subtitle} style={{ marginBottom: "1rem", lineHeight: 1.5 }}>
            Que {courier.name} lo escanee con la cámara de su celular. El dispositivo queda vinculado para repartir a su nombre.
          </p>
          {error && <p className={p.error}>{error}</p>}
          {image ? <img src={image} alt={`QR de acceso de ${courier.name}`} className={p.qrImage} style={{ maxWidth: 260 }} /> : <p className={p.loading}>Generando…</p>}
          {manualCode && (
            <div style={{ marginTop: "1rem" }}>
              <p className={p.subtitle} style={{ lineHeight: 1.5 }}>
                ¿No le anda la cámara? Que entre a <strong>{courierManualUrl().replace(/^https?:\/\//, "")}</strong> y escriba este código:
              </p>
              <strong aria-label={`Código: ${manualCode.split("").join(" ")}`} style={{ display: "block", fontSize: "1.8rem", letterSpacing: "0.15em", margin: "0.4rem 0", fontVariantNumeric: "tabular-nums" }}>
                {manualCode}
              </strong>
            </div>
          )}
          <p className={p.label} style={{ marginTop: "0.75rem" }}>Se renueva en {secondsLeft} s · el QR y el código sirven una sola vez</p>
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
