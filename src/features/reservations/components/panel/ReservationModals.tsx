import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { createManualReservation, runReservationAction } from "../../api/reservationsApi";
import { errorMessage } from "../../../orders/lib/errors";
import { formatPeople, formatReservationDate, todayBuenosAires } from "../../lib/format";
import type { OwnerReservation } from "../../types";
import p from "../../../orders/components/panel/panel.module.css";

// Modales del panel de reservas: confirmar con mesa, marcar el horario como
// no disponible (con alternativa opcional) y cargar una reserva a mano.

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>{title}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={20} aria-hidden /></button>
        </header>
        {children}
        <footer className={p.modalFooter}>{footer}</footer>
      </div>
    </div>
  );
}

const summary = (reservation: OwnerReservation) =>
  `${reservation.name} · ${formatPeople(reservation.partySize)} · ${formatReservationDate(reservation.date)} ${reservation.time} hs`;

// ── Confirmación propia (reemplaza window.confirm) ──

export function ConfirmDialog({ title, text, confirmLabel, danger = false, busy = false, onConfirm, onClose }: {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button type="button" className={p.btnGhost} onClick={onClose}>Volver</button>
        <button type="button" className={danger ? p.btnDanger : p.btnPrimary} disabled={busy} onClick={onConfirm}>
          {busy ? "Procesando…" : confirmLabel}
        </button>
      </>}
    >
      <div className={p.modalBody}>
        <p className={p.subtitle} style={{ lineHeight: 1.55 }}>{text}</p>
      </div>
    </Modal>
  );
}

// ── Cancelar (el mensaje para el cliente es obligatorio) ──

export function CancelModal({ reservation, onClose, onDone }: {
  reservation: OwnerReservation;
  onClose: () => void;
  onDone: (reservation: OwnerReservation) => void;
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onDone(await runReservationAction(reservation.id, "cancel", { message: message.trim() }));
    } catch (err) {
      setError(errorMessage(err, "No se pudo cancelar la reserva."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal
        title="Cancelar reserva"
        onClose={onClose}
        footer={<>
          <button type="button" className={p.btnGhost} onClick={onClose}>Volver</button>
          <button type="submit" className={p.btnDanger} disabled={saving || message.trim() === ""}>
            {saving ? "Cancelando…" : "Cancelar reserva"}
          </button>
        </>}
      >
        <div className={p.modalBody}>
          <div className={p.stack}>
            <p className={p.subtitle}>{summary(reservation)}</p>
            <label className={p.field}>
              <span className={p.label}>Mensaje para el cliente (obligatorio)</span>
              <textarea
                className={p.textarea} value={message} onChange={e => setMessage(e.target.value)}
                maxLength={300} rows={3} required autoFocus placeholder="Ej. Tuvimos que cerrar ese día por mantenimiento."
              />
            </label>
            <p className={p.cardDesc} style={{ margin: 0 }}>El cliente ve este mensaje en su pantalla junto con el aviso de cancelación.</p>
            {error && <p className={p.error} role="alert">{error}</p>}
          </div>
        </div>
      </Modal>
    </form>
  );
}

// ── Confirmar ────────────────────────────────

export function ConfirmModal({ reservation, onClose, onDone }: {
  reservation: OwnerReservation;
  onClose: () => void;
  onDone: (reservation: OwnerReservation) => void;
}) {
  const [tableLabel, setTableLabel] = useState(reservation.tableLabel ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onDone(await runReservationAction(reservation.id, "confirm", { tableLabel: tableLabel.trim() || undefined, message: message.trim() || undefined }));
    } catch (err) {
      setError(errorMessage(err, "No se pudo confirmar la reserva."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal
        title="Confirmar reserva"
        onClose={onClose}
        footer={<>
          <button type="button" className={p.btnGhost} onClick={onClose}>Volver</button>
          <button type="submit" className={p.btnPrimary} disabled={saving}>{saving ? "Confirmando…" : "Confirmar"}</button>
        </>}
      >
        <div className={p.modalBody}>
          <div className={p.stack}>
            <p className={p.subtitle}>{summary(reservation)}</p>
            <label className={p.field}>
              <span className={p.label}>Mesa asignada</span>
              <input className={p.input} value={tableLabel} onChange={e => setTableLabel(e.target.value)} maxLength={30} placeholder="Ej. Mesa 4" autoFocus />
            </label>
            <label className={p.field}>
              <span className={p.label}>Mensaje para el cliente (opcional)</span>
              <textarea className={p.textarea} value={message} onChange={e => setMessage(e.target.value)} maxLength={300} rows={2} />
            </label>
            {error && <p className={p.error} role="alert">{error}</p>}
          </div>
        </div>
      </Modal>
    </form>
  );
}

// ── Horario no disponible ────────────────────

export function RejectModal({ reservation, onClose, onDone }: {
  reservation: OwnerReservation;
  onClose: () => void;
  onDone: (reservation: OwnerReservation) => void;
}) {
  const [altTime, setAltTime] = useState("");
  const [altDate, setAltDate] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onDone(await runReservationAction(reservation.id, "reject", {
        altTime: altTime || undefined,
        // La fecha solo cuenta si se propone otro horario; vacía = el mismo día.
        altDate: altTime && altDate && altDate !== reservation.date ? altDate : undefined,
        message: message.trim() || undefined,
      }));
    } catch (err) {
      setError(errorMessage(err, "No se pudo actualizar la reserva."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal
        title="Horario no disponible"
        onClose={onClose}
        footer={<>
          <button type="button" className={p.btnGhost} onClick={onClose}>Volver</button>
          <button type="submit" className={p.btnDanger} disabled={saving}>
            {saving ? "Enviando…" : altTime ? `Proponer ${altTime}` : "Rechazar reserva"}
          </button>
        </>}
      >
        <div className={p.modalBody}>
          <div className={p.stack}>
            <p className={p.subtitle}>{summary(reservation)}</p>
            <p className={p.notice}>
              El cliente ve el aviso en su pantalla al instante. Si proponés otro horario, le aparece un botón
              para solicitarlo y la reserva vuelve a quedar pendiente.
            </p>
            <div className={p.row}>
              <label className={p.field}>
                <span className={p.label}>Horario alternativo (opcional)</span>
                <input className={p.input} type="time" step={900} value={altTime} onChange={e => setAltTime(e.target.value)} />
              </label>
              <label className={p.field}>
                <span className={p.label}>Otro día (opcional)</span>
                <input className={p.input} type="date" min={todayBuenosAires()} value={altDate} onChange={e => setAltDate(e.target.value)} disabled={!altTime} />
              </label>
            </div>
            <label className={p.field}>
              <span className={p.label}>Mensaje para el cliente (opcional)</span>
              <textarea className={p.textarea} value={message} onChange={e => setMessage(e.target.value)} maxLength={300} rows={2} placeholder="Ej. A esa hora tenemos un evento privado." />
            </label>
            {error && <p className={p.error} role="alert">{error}</p>}
          </div>
        </div>
      </Modal>
    </form>
  );
}

// ── Carga manual ─────────────────────────────

export function ManualReservationModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (reservation: OwnerReservation) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [date, setDate] = useState(todayBuenosAires());
  const [time, setTime] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onCreated(await createManualReservation({
        name, phone: phone.trim() || undefined, partySize: Number(partySize), date, time,
        tableLabel: confirmed ? tableLabel.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
        status: confirmed ? "confirmed" : "pending",
      }));
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar la reserva."));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal
        title="Nueva reserva"
        onClose={onClose}
        footer={<>
          <button type="button" className={p.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={p.btnPrimary} disabled={saving}>{saving ? "Guardando…" : "Cargar reserva"}</button>
        </>}
      >
        <div className={p.modalBody}>
          <div className={p.stack}>
            <p className={p.notice}>Para reservas que atendés por WhatsApp o teléfono. Al guardarla vas a ver el código para pasárselo al cliente.</p>
            <label className={p.field}>
              <span className={p.label}>Nombre</span>
              <input className={p.input} value={name} onChange={e => setName(e.target.value)} maxLength={60} required autoFocus />
            </label>
            <div className={p.row}>
              <label className={p.field}>
                <span className={p.label}>Personas</span>
                <input className={p.input} type="number" min={1} max={100} value={partySize} onChange={e => setPartySize(e.target.value)} required />
              </label>
              <label className={p.field}>
                <span className={p.label}>Fecha</span>
                <input className={p.input} type="date" min={todayBuenosAires()} value={date} onChange={e => setDate(e.target.value)} required />
              </label>
              <label className={p.field}>
                <span className={p.label}>Hora</span>
                <input className={p.input} type="time" step={900} value={time} onChange={e => setTime(e.target.value)} required />
              </label>
            </div>
            <label className={p.field}>
              <span className={p.label}>Teléfono (opcional)</span>
              <input className={p.input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} />
            </label>
            <div className={p.switchRow}>
              <div className={p.switchText}>
                <span className={p.switchTitle}>Dejarla confirmada</span>
                <span className={p.switchHint}>Si la desactivás queda pendiente para confirmarla después.</span>
              </div>
              <input type="checkbox" className={p.switch} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} aria-label="Dejarla confirmada" />
            </div>
            {confirmed && (
              <label className={p.field}>
                <span className={p.label}>Mesa (opcional)</span>
                <input className={p.input} value={tableLabel} onChange={e => setTableLabel(e.target.value)} maxLength={30} />
              </label>
            )}
            <label className={p.field}>
              <span className={p.label}>Aclaraciones (opcional)</span>
              <textarea className={p.textarea} value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} rows={2} />
            </label>
            {error && <p className={p.error} role="alert">{error}</p>}
          </div>
        </div>
      </Modal>
    </form>
  );
}
