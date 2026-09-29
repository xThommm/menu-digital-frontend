import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { regenerateQr, updateOrderSettings } from "../../api/ordersApi";
import { useOrderSettings } from "../../hooks/usePanelData";
import { errorMessage } from "../../lib/errors";
import { venueQrUrl } from "../../lib/qrUrls";
import type { OrderSettings, PeriodMode, QrMode, SettingsResponse, ShiftScheduleEntry } from "../../types";
import p from "./panel.module.css";

// Configuración de Gestión de pedidos: QR general o por mesa, cantidad de
// mesas, si los comensales pueden pedir solos, historial en su navegador y
// cómo se organizan los turnos.

type Draft = Pick<OrderSettings, "qrMode" | "customerOrdering" | "customerHistory" | "tableCount" | "periodMode" | "shiftSchedule">;

const toDraft = (settings: OrderSettings): Draft => ({
  qrMode: settings.qrMode,
  customerOrdering: settings.customerOrdering,
  customerHistory: settings.customerHistory,
  tableCount: settings.tableCount,
  periodMode: settings.periodMode,
  shiftSchedule: settings.shiftSchedule,
});

export default function OrdersSettingsPage() {
  const settings = useOrderSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // El borrador arranca de lo guardado (ajuste de estado durante el render,
  // no en un efecto).
  const [loadedFrom, setLoadedFrom] = useState<SettingsResponse | null>(null);
  if (settings.data && settings.data !== loadedFrom) {
    setLoadedFrom(settings.data);
    setDraft(toDraft(settings.data.settings));
  }

  const update = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      settings.setData(await updateOrderSettings(draft));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar la configuración."));
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async (target: string, question: string) => {
    if (!window.confirm(question)) return;
    try {
      settings.setData(await regenerateQr(target));
    } catch (err) {
      setError(errorMessage(err, "No se pudo regenerar el QR."));
    }
  };

  if (settings.loading) return <div className={p.page}><p className={p.loading}>Cargando…</p></div>;
  if (settings.error || !settings.data || !draft) {
    return <div className={p.page}><p className={p.error}>{settings.error ?? "No se pudo cargar la configuración."}</p></div>;
  }

  const saved_ = settings.data;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved_.settings));

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Configuración de pedidos</h1>
          <p className={p.subtitle}>Cómo llegan los pedidos al panel y cómo se organiza el trabajo.</p>
        </div>
        <div className={p.headerActions}>
          <button type="button" className={p.btnPrimary} onClick={save} disabled={saving || !dirty}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </header>

      {error && <p className={p.error} role="alert">{error}</p>}
      {saved && !dirty && <p className={p.success} role="status">Cambios guardados.</p>}

      <div className={p.grid} style={{ marginTop: "1rem" }}>
        <section className={p.card}>
          <h2 className={p.cardTitle}>Pedidos desde la mesa</h2>
          <div className={p.switchRow}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Permitir que los clientes pidan desde su mesa</span>
              <span className={p.switchHint}>
                Al escanear el QR del local pueden armar el pedido y enviarlo al panel. Si lo desactivás, ven la
                carta y le piden al mozo.
              </span>
            </div>
            <input type="checkbox" className={p.switch} checked={draft.customerOrdering} onChange={e => update({ customerOrdering: e.target.checked })} aria-label="Permitir pedidos desde la mesa" />
          </div>
          <div className={p.switchRow}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Guardar historial en el navegador del cliente</span>
              <span className={p.switchHint}>El cliente puede ver lo que ya pidió, con fecha y hora. No se guardan datos personales.</span>
            </div>
            <input type="checkbox" className={p.switch} checked={draft.customerHistory} onChange={e => update({ customerHistory: e.target.checked })} aria-label="Guardar historial en el navegador del cliente" />
          </div>
          <p className={p.cardDesc} style={{ marginTop: "0.75rem" }}>
            Quien entra a la carta por el link (sin escanear el QR del local) sigue pidiendo por WhatsApp, como siempre.
          </p>
        </section>

        <section className={p.card}>
          <h2 className={p.cardTitle}>Mesas y QR</h2>
          <div className={p.stack}>
            <div className={p.field}>
              <span className={p.label}>Tipo de QR</span>
              <Segmented<QrMode>
                value={draft.qrMode}
                onChange={qrMode => update({ qrMode })}
                options={[["general", "Un QR general"], ["per_table", "Un QR por mesa"]]}
              />
              <span className={p.switchHint}>
                {draft.qrMode === "general"
                  ? "Un solo QR para todo el local: el cliente indica su número de mesa al pedir."
                  : "Cada mesa tiene su QR y el pedido llega con la mesa ya indicada."}
              </span>
            </div>
            <label className={p.field}>
              <span className={p.label}>Cantidad de mesas</span>
              <input
                className={p.input}
                type="number"
                min={1}
                max={300}
                inputMode="numeric"
                value={draft.tableCount}
                onChange={e => update({ tableCount: Math.max(1, Math.min(300, Number(e.target.value) || 1)) })}
              />
            </label>
          </div>
        </section>

        <section className={p.card}>
          <h2 className={p.cardTitle}>Turnos</h2>
          <div className={p.stack}>
            <Segmented<PeriodMode>
              value={draft.periodMode}
              onChange={periodMode => update({ periodMode })}
              options={[["shift", "Por turnos"], ["day", "Por día"]]}
            />
            <span className={p.switchHint}>
              {draft.periodMode === "day"
                ? "Cada día es un período: cerrá la caja al terminar la jornada."
                : "El turno toma el nombre según el horario en que se abre. Cerrá la caja al terminar cada turno."}
            </span>
            {draft.periodMode === "shift" && (
              <ScheduleEditor value={draft.shiftSchedule} onChange={shiftSchedule => update({ shiftSchedule })} />
            )}
          </div>
        </section>
      </div>

      <QrSection data={saved_} onRegenerate={regenerate} pendingChanges={dirty && (draft.qrMode !== saved_.settings.qrMode || draft.tableCount !== saved_.settings.tableCount)} />
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: [T, string][] }) {
  return (
    <div className={p.segmented} role="radiogroup">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`${p.segment} ${value === option ? p.segmentActive : ""}`}
          onClick={() => onChange(option)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ScheduleEditor({ value, onChange }: { value: ShiftScheduleEntry[]; onChange: (value: ShiftScheduleEntry[]) => void }) {
  const set = (index: number, patch: Partial<ShiftScheduleEntry>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <div className={p.stack} style={{ gap: "0.6rem" }}>
      {value.length === 0 && <p className={p.switchHint}>Sin horarios cargados: cada turno se nombra con la fecha y hora de apertura.</p>}
      {value.map((entry, index) => (
        <div key={index} className={p.row}>
          <label className={p.field}>
            <span className={p.label}>Nombre</span>
            <input className={p.input} value={entry.name} maxLength={40} onChange={e => set(index, { name: e.target.value })} placeholder="Mediodía" />
          </label>
          <label className={p.field} style={{ flex: "0 1 110px" }}>
            <span className={p.label}>Desde</span>
            <input className={p.input} type="time" value={entry.from} onChange={e => set(index, { from: e.target.value })} />
          </label>
          <label className={p.field} style={{ flex: "0 1 110px" }}>
            <span className={p.label}>Hasta</span>
            <input className={p.input} type="time" value={entry.to} onChange={e => set(index, { to: e.target.value })} />
          </label>
          <button type="button" className={p.iconBtn} onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Quitar turno ${entry.name}`}>
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
      {value.length < 6 && (
        <button
          type="button"
          className={`${p.btn} ${p.small}`}
          style={{ alignSelf: "flex-start" }}
          onClick={() => onChange([...value, { name: value.length === 0 ? "Mediodía" : "Noche", from: value.length === 0 ? "11:00" : "19:00", to: value.length === 0 ? "16:00" : "01:00" }])}
        >
          <Plus size={14} aria-hidden /> Agregar turno
        </button>
      )}
    </div>
  );
}

interface QrItem { label: string; url: string; image: string; target: string }

function QrSection({ data, onRegenerate, pendingChanges }: {
  data: SettingsResponse;
  onRegenerate: (target: string, question: string) => void;
  pendingChanges: boolean;
}) {
  const [items, setItems] = useState<QrItem[]>([]);
  const { settings, tables, slug } = data;

  useEffect(() => {
    let cancelled = false;
    const sources = settings.qrMode === "general"
      ? [{ label: "QR general", token: settings.generalQrToken, target: "general" }]
      : tables.map(table => ({ label: `Mesa ${table.number}`, token: table.qrToken, target: String(table.number) }));
    Promise.all(sources.map(async source => {
      const url = venueQrUrl(slug, source.token);
      return { label: source.label, url, target: source.target, image: await QRCode.toDataURL(url, { width: 480, margin: 1 }) };
    })).then(result => { if (!cancelled) setItems(result); });
    return () => { cancelled = true; };
  }, [settings.qrMode, settings.generalQrToken, tables, slug]);

  const download = (item: QrItem) => {
    const link = document.createElement("a");
    link.href = item.image;
    link.download = `qr-${slug}-${item.label.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  };

  const printAll = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const doc = win.document;
    doc.title = `QR de ${slug}`;
    const style = doc.createElement("style");
    style.textContent = "body{font-family:sans-serif;margin:0;padding:16px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;border:1px dashed #999;padding:12px;text-align:center;break-inside:avoid}img{width:100%;max-width:220px}figcaption{font-size:20px;font-weight:700;margin-top:6px}small{display:block;color:#555}";
    doc.head.appendChild(style);
    const main = doc.createElement("main");
    for (const item of items) {
      const figure = doc.createElement("figure");
      const img = doc.createElement("img");
      img.src = item.image;
      img.alt = item.label;
      const caption = doc.createElement("figcaption");
      caption.textContent = item.label;
      const hint = doc.createElement("small");
      hint.textContent = "Escaneá para ver la carta y pedir";
      figure.append(img, caption, hint);
      main.appendChild(figure);
    }
    doc.body.appendChild(main);
    setTimeout(() => win.print(), 300);
  };

  return (
    <section className={p.card} style={{ marginTop: "1rem" }}>
      <div className={p.header} style={{ marginBottom: "0.75rem" }}>
        <div className={p.titleBlock}>
          <h2 className={p.cardTitle} style={{ margin: 0 }}>QR para imprimir</h2>
          <p className={p.subtitle}>
            Estos QR identifican que el cliente está en el local. Si un QR se filtra (por ejemplo, una foto en redes), regeneralo:
            el anterior deja de servir para pedir.
          </p>
        </div>
        <div className={p.headerActions}>
          <button type="button" className={p.btn} onClick={printAll} disabled={items.length === 0}><Printer size={16} aria-hidden /> Imprimir</button>
          <button
            type="button"
            className={p.btnGhost}
            onClick={() => onRegenerate(
              settings.qrMode === "general" ? "general" : "all",
              "Los QR impresos actuales van a dejar de servir para pedir. ¿Regenerar?",
            )}
          >
            <RefreshCw size={16} aria-hidden /> Regenerar {settings.qrMode === "general" ? "QR" : "todos"}
          </button>
        </div>
      </div>
      {pendingChanges && <p className={p.notice} style={{ marginBottom: "0.75rem" }}>Guardá los cambios para ver los QR actualizados.</p>}
      <div className={p.qrGrid}>
        {items.map(item => (
          <div key={item.target} className={p.qrCard}>
            <img src={item.image} alt={item.label} className={p.qrImage} />
            <span className={p.qrLabel}>{item.label}</span>
            <div className={p.headerActions} style={{ justifyContent: "center" }}>
              <button type="button" className={`${p.btn} ${p.small}`} onClick={() => download(item)} aria-label={`Descargar ${item.label}`}>
                <Download size={14} aria-hidden />
              </button>
              {item.target !== "general" && (
                <button
                  type="button"
                  className={`${p.btnGhost} ${p.small}`}
                  onClick={() => onRegenerate(item.target, `El QR impreso de la ${item.label} va a dejar de servir. ¿Regenerar?`)}
                  aria-label={`Regenerar ${item.label}`}
                >
                  <RefreshCw size={14} aria-hidden />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
