import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, X } from "lucide-react";
import WaTargetPicker from "../../../../components/User/Home/WaTargetPicker/WaTargetPicker";
import type { WaTarget } from "../../../../lib/whatsapp";
import { getReservation } from "../../api/reservationsApi";
import { isActiveReservation, useCustomerReservation } from "../../hooks/useCustomerReservation";
import { addDays, formatPeople, formatReservationDate, STATUS_LABEL, todayBuenosAires } from "../../lib/format";
import type { CustomerReservation, ReservationConfig } from "../../types";
import s from "./ReservationEntry.module.css";

// Reservas en la landing del local: el botón y el diálogo. Sin cuenta: el
// cliente deja nombre, fecha, hora y cantidad de personas; recibe un código,
// que se guarda en su navegador y le sirve para ver el estado (en vivo) o
// consultarla desde otro dispositivo.

type EnabledConfig = Extract<ReservationConfig, { enabled: true }>;

interface Props {
  slug: string;
  businessName: string;
  config: EnabledConfig;
  // WhatsApp del local, para quien necesita atención más personalizada.
  whatsappTargets: WaTarget[];
  whatsappMessage: string;
  // Clase del botón de la landing (la misma que "Reservar por WhatsApp").
  buttonClassName: string;
}

// auto: lo que corresponda (la reserva activa, o el formulario si no hay).
type Mode = "auto" | "form" | "lookup" | "history" | "status";

export default function ReservationEntry({ slug, businessName, config, whatsappTargets, whatsappMessage, buttonClassName }: Props) {
  // El diálogo se monta dentro de la landing (.t-wrap) y no en <body>: así
  // hereda los tokens del template del local (--t-*).
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const state = useCustomerReservation(slug, true);
  const { reservation } = state;
  // Sin una reserva activa el botón es el de siempre, como si nunca hubiera pedido.
  const active = isActiveReservation(reservation) ? reservation : null;

  return (
    <>
      <button type="button" className={buttonClassName} onClick={event => setContainer(event.currentTarget.closest<HTMLElement>(".t-wrap") ?? document.body)} aria-haspopup="dialog">
        <CalendarCheck size={18} strokeWidth={1.75} aria-hidden />
        <span>{active ? "Mi reserva" : "Reservar mesa"}</span>
        {active && <span className={`${s.chip} ${s[`chip_${active.status}`]}`}>{STATUS_LABEL[active.status]}</span>}
      </button>
      {container && createPortal(
        <ReservationDialog
          slug={slug}
          businessName={businessName}
          config={config}
          state={state}
          whatsappTargets={whatsappTargets}
          whatsappMessage={whatsappMessage}
          onClose={() => setContainer(null)}
        />,
        container
      )}
    </>
  );
}

type State = ReturnType<typeof useCustomerReservation>;

interface DialogProps extends Omit<Props, "buttonClassName"> {
  state: State;
  onClose: () => void;
}

function ReservationDialog({ slug, businessName, config, state, whatsappTargets, whatsappMessage, onClose }: DialogProps) {
  const { reservation, loading } = state;
  const [mode, setMode] = useState<Mode>("auto");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Mientras el cliente mira su reserva activa, la pantalla se queda en ella
  // aunque pase a cancelada o cerrada (así ve el mensaje del local, p. ej. el
  // motivo de una cancelación) en vez de saltar al formulario.
  const [pinned, setPinned] = useState(false);
  const activeNow = isActiveReservation(reservation);
  if (mode === "auto" && activeNow && !pinned) setPinned(true);
  const view: Exclude<Mode, "auto"> =
    mode !== "auto" ? mode : activeNow || (pinned && reservation) ? "status" : "form";
  const hasHistory = state.history.length > 0;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
      >
        <header className={s.header}>
          <h2 id={titleId} className={s.title}>
            {view === "status" ? "Tu reserva" : view === "lookup" ? "Consultar mi reserva" : view === "history" ? "Mis reservas" : "Reservar mesa"}
          </h2>
          <button type="button" className={s.close} onClick={onClose} aria-label="Cerrar">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className={s.body}>
          {loading && !reservation && view === "status" ? (
            <p className={s.muted}>Buscando tu reserva…</p>
          ) : view === "status" && reservation ? (
            <StatusView
              reservation={reservation}
              businessName={businessName}
              state={state}
              onNew={() => { state.setError(null); setPinned(false); setMode("form"); }}
              onHistory={hasHistory ? () => { state.setError(null); setMode("history"); } : undefined}
            />
          ) : view === "lookup" ? (
            <LookupView state={state} onDone={() => setMode("status")} onBack={() => setMode("auto")} />
          ) : view === "history" ? (
            <HistoryView slug={slug} state={state} onOpen={() => setMode("status")} onBack={() => setMode("auto")} />
          ) : (
            <ReservationForm
              config={config}
              state={state}
              onCreated={() => setMode("auto")}
              onLookup={() => { state.setError(null); setMode("lookup"); }}
              onHistory={hasHistory ? () => { state.setError(null); setMode("history"); } : undefined}
            />
          )}

          {whatsappTargets.length > 0 && (
            <div className={s.whatsapp}>
              <p className={s.muted}>¿Necesitás atención más personalizada?</p>
              <WaTargetPicker
                targets={whatsappTargets}
                message={reservation && view === "status" ? `Hola! Consulto por mi reserva ${reservation.code}.` : whatsappMessage}
                className={s.whatsappBtn}
                prompt="¿A cuál sucursal querés escribir?"
              >
                <span>Hablar por WhatsApp</span>
              </WaTargetPicker>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Formulario ───────────────────────────────

function ReservationForm({ config, state, onCreated, onLookup, onHistory }: {
  config: EnabledConfig;
  state: State;
  onCreated: () => void;
  onLookup: () => void;
  onHistory?: () => void;
}) {
  const today = todayBuenosAires();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const created = await state.create({
      name,
      phone: config.phoneMode === "off" ? undefined : phone,
      partySize: Number(partySize),
      date,
      time,
      notes: notes.trim() || undefined,
    });
    if (created) onCreated();
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <label className={s.field}>
        <span>Nombre</span>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={60} required autoComplete="name" />
      </label>

      <div className={s.row}>
        <label className={s.field}>
          <span>Personas</span>
          <input
            type="number" inputMode="numeric" min={1} max={config.maxPartySize}
            value={partySize} onChange={e => setPartySize(e.target.value)} required
          />
        </label>
        <label className={s.field}>
          <span>Fecha</span>
          <input
            type="date" min={today} max={addDays(today, config.maxDaysAhead)}
            value={date} onChange={e => setDate(e.target.value)} required
          />
        </label>
        <label className={s.field}>
          <span>Hora</span>
          <input type="time" step={900} value={time} onChange={e => setTime(e.target.value)} required />
        </label>
      </div>

      {config.phoneMode !== "off" && (
        <label className={s.field}>
          <span>Teléfono{config.phoneMode === "optional" ? " (opcional)" : ""}</span>
          <input
            type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
            maxLength={30} required={config.phoneMode === "required"} autoComplete="tel"
          />
        </label>
      )}

      <label className={s.field}>
        <span>Aclaraciones (opcional)</span>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} rows={2} placeholder="Cumpleaños, silla para bebé…" />
      </label>

      {state.error && <p className={s.error} role="alert">{state.error}</p>}

      <button type="submit" className={s.primary} disabled={state.busy}>
        {state.busy ? "Enviando…" : "Solicitar reserva"}
      </button>
      <p className={s.hint}>Te vamos a confirmar por esta misma pantalla: recibís un código para seguir tu reserva.</p>
      <button type="button" className={s.link} onClick={onLookup}>Ya tengo un código: consultar mi reserva</button>
      {onHistory && <button type="button" className={s.link} onClick={onHistory}>Ver mis reservas anteriores</button>}
    </form>
  );
}

// ── Consultar con código (otro dispositivo) ──

function LookupView({ state, onDone, onBack }: { state: State; onDone: () => void; onBack: () => void }) {
  const [value, setValue] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = await state.lookup(value);
    if (found) onDone();
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <p className={s.muted}>Ingresá el código que recibiste al reservar. Se guarda en este dispositivo y ves lo mismo que en el original.</p>
      <label className={s.field}>
        <span>Código de reserva</span>
        <input
          value={value} onChange={e => setValue(e.target.value.toUpperCase())} maxLength={9}
          placeholder="ABCD-EFGH" autoCapitalize="characters" autoComplete="off" spellCheck={false} className={s.codeInput} required
        />
      </label>
      {state.error && <p className={s.error} role="alert">{state.error}</p>}
      <button type="submit" className={s.primary} disabled={state.busy}>{state.busy ? "Buscando…" : "Ver mi reserva"}</button>
      <button type="button" className={s.link} onClick={onBack}>Volver</button>
    </form>
  );
}

// ── Estado de la reserva ─────────────────────

function StatusView({ reservation, businessName, state, onNew, onHistory }: {
  reservation: CustomerReservation;
  businessName: string;
  state: State;
  onNew: () => void;
  onHistory?: () => void;
}) {
  const { status } = reservation;
  const [copied, setCopied] = useState(false);
  // Confirmación propia (sin window.confirm).
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const when = `${formatReservationDate(reservation.date)} · ${reservation.time} hs`;
  const alt = reservation.altTime
    ? `${reservation.altDate && reservation.altDate !== reservation.date ? `${formatReservationDate(reservation.altDate)} · ` : ""}${reservation.altTime} hs`
    : null;
  const closed = status === "cancelled" || status === "completed" || status === "no_show";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reservation.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el código está a la vista para copiarlo a mano.
    }
  };

  return (
    <div className={s.status}>
      <div className={`${s.banner} ${s[`banner_${status}`]}`} role="status" aria-live="polite">
        <strong>{STATUS_LABEL[status]}</strong>
        <span>{bannerText(reservation, alt)}</span>
      </div>

      {reservation.message && <p className={s.message}>“{reservation.message}”</p>}

      <dl className={s.details}>
        <div><dt>Local</dt><dd>{businessName}</dd></div>
        <div><dt>A nombre de</dt><dd>{reservation.name}</dd></div>
        <div><dt>Cuándo</dt><dd>{when}</dd></div>
        <div><dt>Para</dt><dd>{formatPeople(reservation.partySize)}</dd></div>
        {reservation.tableLabel && <div><dt>Mesa</dt><dd>{reservation.tableLabel}</dd></div>}
      </dl>

      <div className={s.codeBox}>
        <span className={s.codeLabel}>Tu código de reserva</span>
        <span className={s.code}>{reservation.code}</span>
        <button type="button" className={s.link} onClick={copy}>{copied ? "¡Copiado!" : "Copiar código"}</button>
        <span className={s.hint}>Guardalo: con él podés ver tu reserva desde otro dispositivo.</span>
      </div>

      {state.error && <p className={s.error} role="alert">{state.error}</p>}

      {status === "rejected" && alt && (
        <button type="button" className={s.primary} onClick={() => void state.accept()} disabled={state.busy}>
          {state.busy ? "Enviando…" : `Solicitar ${reservation.altTime}`}
        </button>
      )}
      {!closed && !confirmingCancel && (
        <button type="button" className={s.danger} disabled={state.busy} onClick={() => setConfirmingCancel(true)}>
          Cancelar reserva
        </button>
      )}
      {!closed && confirmingCancel && (
        <div className={s.confirmBox} role="alertdialog" aria-label="Confirmar cancelación">
          <p className={s.confirmText}>¿Seguro que querés cancelar tu reserva?</p>
          <div className={s.confirmActions}>
            <button type="button" className={s.danger} disabled={state.busy} onClick={() => { void state.cancel().then(() => setConfirmingCancel(false)); }}>
              {state.busy ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button type="button" className={s.secondary} disabled={state.busy} onClick={() => setConfirmingCancel(false)}>Volver</button>
          </div>
        </div>
      )}
      {(closed || status === "rejected") && (
        <button type="button" className={s.secondary} onClick={onNew}>Hacer una nueva reserva</button>
      )}
      {onHistory && <button type="button" className={s.link} onClick={onHistory}>Ver mis reservas</button>}
    </div>
  );
}

// ── Historial de este dispositivo ────────────

function HistoryView({ slug, state, onOpen, onBack }: { slug: string; state: State; onOpen: () => void; onBack: () => void }) {
  const [items, setItems] = useState<CustomerReservation[] | null>(null);
  const { history, dropFromHistory } = state;
  const historyKey = history.join(",");

  useEffect(() => {
    const controller = new AbortController();
    const codes = historyKey.split(",").filter(Boolean);
    Promise.allSettled(codes.map(code => getReservation(slug, code, controller.signal)))
      .then(results => {
        if (controller.signal.aborted) return;
        const found: CustomerReservation[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") found.push(result.value.reservation);
          // Una reserva que ya no existe se saca del historial; un error de red se ignora.
          else if ((result.reason as { status?: number })?.status === 404) dropFromHistory(codes[index]);
        });
        setItems(found);
      });
    return () => controller.abort();
  }, [slug, historyKey, dropFromHistory]);

  return (
    <div className={s.status}>
      {items === null ? (
        <p className={s.muted}>Buscando tus reservas…</p>
      ) : items.length === 0 ? (
        <p className={s.muted}>No hay reservas guardadas en este dispositivo.</p>
      ) : (
        <ul className={s.historyList}>
          {items.map(item => (
            <li key={item.code}>
              <button type="button" className={s.historyItem} onClick={() => { state.select(item); onOpen(); }}>
                <span className={s.historyMain}>
                  <strong>{formatReservationDate(item.date)} · {item.time} hs</strong>
                  <span className={s.muted}>{formatPeople(item.partySize)} · {item.code}</span>
                </span>
                <span className={`${s.chip} ${s[`chip_${item.status}`]}`}>{STATUS_LABEL[item.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={s.link} onClick={onBack}>Volver</button>
    </div>
  );
}

function bannerText(reservation: CustomerReservation, alt: string | null): string {
  const time = `${reservation.time} hs`;
  switch (reservation.status) {
    case "pending":
      return "Recibimos tu solicitud. La estamos revisando: esta pantalla se actualiza sola cuando haya novedades.";
    case "confirmed":
      return "¡Listo! Tu mesa está reservada. Te esperamos.";
    case "rejected":
      return alt
        ? `Tu reserva no pudo ser confirmada: no hay disponibilidad a las ${time}, pero sí a las ${alt}.`
        : `Tu reserva no pudo ser confirmada: no hay disponibilidad a las ${time}.`;
    case "cancelled":
      return "Esta reserva fue cancelada.";
    case "completed":
      return "¡Gracias por tu visita!";
    case "no_show":
      return "Esta reserva figura como no asistida.";
  }
}
