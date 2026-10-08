import { useState } from "react";
import { updateReservationSettings, type SettingsResponse } from "../../api/reservationsApi";
import { errorMessage } from "../../../orders/lib/errors";
import type { PhoneMode, ReservationSettings } from "../../types";
import p from "../../../orders/components/panel/panel.module.css";

// Configuración de las reservas online del local.

const PHONE_OPTIONS: { value: PhoneMode; label: string }[] = [
  { value: "optional", label: "Pedirlo, pero es opcional" },
  { value: "required", label: "Pedirlo y que sea obligatorio" },
  { value: "off", label: "No pedirlo" },
];

export default function ReservationsSettings({ initial, onSaved }: {
  initial: SettingsResponse;
  onSaved: (settings: ReservationSettings) => void;
}) {
  const [draft, setDraft] = useState<ReservationSettings>(initial.settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.settings);

  const update = (patch: Partial<ReservationSettings>) => {
    setSaved(false);
    setDraft(prev => ({ ...prev, ...patch }));
  };

  const number = (value: string, fallback: number) => (value === "" ? fallback : Number(value));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateReservationSettings(draft);
      setDraft(result.settings);
      onSaved(result.settings);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar la configuración."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={p.stack}>
      {error && <p className={p.error} role="alert">{error}</p>}
      {saved && !dirty && <p className={p.success} role="status">Cambios guardados.</p>}

      <section className={p.card}>
        <h2 className={p.cardTitle}>Reservas online</h2>
        <div className={p.switchRow}>
          <div className={p.switchText}>
            <span className={p.switchTitle}>Recibir reservas desde la landing</span>
            <span className={p.switchHint}>
              Los clientes reservan sin cuenta desde tu página (/{initial.slug}) y ven el estado en vivo. El botón de
              WhatsApp sigue disponible dentro del formulario.
            </span>
          </div>
          <input type="checkbox" className={p.switch} checked={draft.enabled} onChange={e => update({ enabled: e.target.checked })} aria-label="Recibir reservas desde la landing" />
        </div>
      </section>

      <section className={p.card}>
        <h2 className={p.cardTitle}>Reglas del formulario</h2>
        <div className={p.stack}>
          <label className={p.field}>
            <span className={p.label}>Teléfono del cliente</span>
            <select className={p.select} value={draft.phoneMode} onChange={e => update({ phoneMode: e.target.value as PhoneMode })}>
              {PHONE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className={p.row}>
            <label className={p.field}>
              <span className={p.label}>Máximo de personas por reserva</span>
              <input className={p.input} type="number" min={1} max={100} value={draft.maxPartySize} onChange={e => update({ maxPartySize: number(e.target.value, 1) })} />
            </label>
            <label className={p.field}>
              <span className={p.label}>Reservar hasta (días de anticipación)</span>
              <input className={p.input} type="number" min={1} max={365} value={draft.maxDaysAhead} onChange={e => update({ maxDaysAhead: number(e.target.value, 1) })} />
            </label>
            <label className={p.field}>
              <span className={p.label}>Anticipación mínima (minutos)</span>
              <input className={p.input} type="number" min={0} max={10080} step={15} value={draft.minNoticeMinutes} onChange={e => update({ minNoticeMinutes: number(e.target.value, 0) })} />
            </label>
          </div>
          <p className={p.cardDesc} style={{ margin: 0 }}>
            Para grupos más grandes que el máximo, el formulario le sugiere al cliente escribirte por WhatsApp.
          </p>
        </div>
      </section>

      <div>
        <button type="button" className={p.btnPrimary} onClick={save} disabled={saving || !dirty}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
