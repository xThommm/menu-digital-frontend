import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { regenerateQr, updateOrderSettings } from "../../api/ordersApi";
import { useOrderSettings } from "../../hooks/usePanelData";
import { errorMessage } from "../../lib/errors";
import { ORDERS_SETTINGS_CHANGED } from "../../lib/delivery";
import { venueQrUrl } from "../../lib/qrUrls";
import type { DeliveryAssignMode, DeliveryConfirmBy, MpConnection, OrderSettings, PeriodMode, QrMode, SettingsResponse, ShiftScheduleEntry } from "../../types";
import PaymentsSection from "./PaymentsSection";
import p from "./panel.module.css";

// Configuración de Gestión de pedidos: QR general o por mesa, cantidad de
// mesas, si los comensales pueden pedir solos, historial en su navegador y
// cómo se organizan los turnos.

type Draft = Pick<OrderSettings, "qrMode" | "customerOrdering" | "customerHistory" | "tableCount" | "periodMode" | "shiftSchedule" | "options">;

const toDraft = (settings: OrderSettings): Draft => ({
  qrMode: settings.qrMode,
  customerOrdering: settings.customerOrdering,
  customerHistory: settings.customerHistory,
  tableCount: settings.tableCount,
  periodMode: settings.periodMode,
  shiftSchedule: settings.shiftSchedule,
  options: settings.options,
});

export default function OrdersSettingsPage() {
  const settings = useOrderSettings();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Estado de la cuenta de Mercado Pago (lo informa la sección de pagos).
  const [mp, setMp] = useState<MpConnection | null>(null);

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
      window.dispatchEvent(new Event(ORDERS_SETTINGS_CHANGED));
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
                carta y le piden al personal.
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
          <div className={p.switchRow}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Pedir el número de mesa con el QR general</span>
              <span className={p.switchHint}>
                Si lo desactivás, el cliente también puede elegir "Estoy en la barra" y el pedido llega como Barra.
                Con un QR por mesa la mesa ya viene indicada.
              </span>
            </div>
            <input
              type="checkbox"
              className={p.switch}
              checked={draft.options.requireTableNumber}
              onChange={e => update({ options: { ...draft.options, requireTableNumber: e.target.checked } })}
              aria-label="Pedir el número de mesa con el QR general"
            />
          </div>
          <label className={p.field} style={{ marginTop: "0.85rem" }}>
            <span className={p.label}>Espera mínima entre pedidos del mismo celular (segundos)</span>
            <input
              className={p.input}
              type="number"
              min={0}
              max={600}
              inputMode="numeric"
              value={draft.options.customerOrderCooldownSeconds}
              onChange={e => update({
                options: { ...draft.options, customerOrderCooldownSeconds: Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))) },
              })}
            />
            <span className={p.switchHint}>Evita pedidos repetidos o de prueba. 0 = sin espera.</span>
          </label>
          <p className={p.cardDesc} style={{ marginTop: "0.75rem" }}>
            Quien entra a la carta por el link (sin escanear el QR del local) sigue pidiendo por WhatsApp, como siempre.
          </p>
        </section>

        <PaymentsSection onChange={setMp} />

        <section className={p.card}>
          <h2 className={p.cardTitle}>Pedidos online con pago</h2>
          <div className={p.switchRow}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Cobrar pedidos de take away y delivery desde la carta</span>
              <span className={p.switchHint}>
                {mp?.connected
                  ? "Los clientes arman el pedido en tu carta y lo pagan con Mercado Pago. Llega al panel recién cuando el pago está aprobado. Se ofrecen las modalidades que tengas activadas en tu carta (delivery y retiro en el local)."
                  : "Primero conectá tu cuenta de Mercado Pago en la sección de pagos."}
              </span>
            </div>
            <input
              type="checkbox"
              className={p.switch}
              checked={draft.options.onlineOrdering === true}
              disabled={!mp?.connected && draft.options.onlineOrdering !== true}
              onChange={e => update({ options: { ...draft.options, onlineOrdering: e.target.checked } })}
              aria-label="Cobrar pedidos de take away y delivery desde la carta"
            />
          </div>
          <div className={p.switchRow}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Sacar el botón «Pedir por WhatsApp» del carrito</span>
              <span className={p.switchHint}>
                Los clientes solo pueden pagar con Mercado Pago. Solo tiene efecto mientras el pago online esté activo y
                funcionando; si no, el botón de WhatsApp se sigue mostrando para que nadie se quede sin poder pedir.
              </span>
            </div>
            <input
              type="checkbox"
              className={p.switch}
              checked={draft.options.hideWhatsappOrder === true}
              disabled={draft.options.onlineOrdering !== true}
              onChange={e => update({ options: { ...draft.options, hideWhatsappOrder: e.target.checked } })}
              aria-label="Sacar el botón Pedir por WhatsApp del carrito"
            />
          </div>
          <div className={p.field} style={{ marginTop: "0.85rem" }}>
            <span className={p.label}>Tiempo estimado de preparación (minutos)</span>
            <div className={p.row}>
              <label className={p.field}>
                <span className={p.switchHint}>Mínimo</span>
                <input
                  className={p.input}
                  type="number"
                  min={0}
                  max={600}
                  inputMode="numeric"
                  value={draft.options.prepMinMinutes}
                  disabled={draft.options.onlineOrdering !== true}
                  onChange={e => update({ options: { ...draft.options, prepMinMinutes: Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))) } })}
                />
              </label>
              <label className={p.field}>
                <span className={p.switchHint}>Máximo</span>
                <input
                  className={p.input}
                  type="number"
                  min={0}
                  max={600}
                  inputMode="numeric"
                  value={draft.options.prepMaxMinutes}
                  disabled={draft.options.onlineOrdering !== true}
                  onChange={e => update({ options: { ...draft.options, prepMaxMinutes: Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))) } })}
                />
              </label>
            </div>
            <span className={p.switchHint}>
              {draft.options.prepMinMinutes > 0 && draft.options.prepMaxMinutes >= draft.options.prepMinMinutes
                ? `El cliente ve: «Tu pedido estará listo entre ${draft.options.prepMinMinutes} y ${draft.options.prepMaxMinutes} minutos».`
                : "Cargá los dos para mostrarle al cliente cuánto tarda su pedido. Con 0 y 0 no se muestra ninguna estimación."}
            </span>
          </div>
          <p className={p.cardDesc} style={{ marginTop: "0.75rem" }}>
            Los pedidos pagados quedan sin confirmar hasta que los aceptes: el pago aprobado no acepta el pedido. Si lo rechazás,
            podés devolver el dinero desde el pedido.
          </p>
        </section>

        <section className={p.card}>
          <h2 className={p.cardTitle}>Delivery con repartidores</h2>
          <div className={p.switchRow}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Gestionar los envíos con repartidores desde Menú Digital</span>
              <span className={p.switchHint}>
                Suma a la barra lateral las secciones Entregas en curso, Repartidores e Historial de envíos, y una app para el celular de cada repartidor.
                Apagado, tus pedidos de delivery funcionan como siempre y los envíos los gestionás por fuera.
              </span>
            </div>
            <input
              type="checkbox"
              className={p.switch}
              checked={draft.options.deliveryEnabled === true}
              onChange={e => update({ options: { ...draft.options, deliveryEnabled: e.target.checked } })}
              aria-label="Gestionar los envíos con repartidores desde Menú Digital"
            />
          </div>

          <div className={p.field} style={{ marginTop: "0.85rem" }}>
            <span className={p.label}>Cómo se asignan los pedidos</span>
            <Segmented<DeliveryAssignMode>
              value={draft.options.deliveryAssignMode}
              onChange={deliveryAssignMode => update({ options: { ...draft.options, deliveryAssignMode } })}
              options={[["manual", "Manual"], ["open", "Abierta"]]}
            />
            <span className={p.switchHint}>
              {draft.options.deliveryAssignMode === "manual"
                ? "Vos elegís el repartidor de cada pedido."
                : "Los pedidos de delivery aparecen en una lista compartida y los repartidores disponibles los toman. Si dos tocan a la vez, solo uno se lo queda. Un pedido que ya tiene repartidor no queda disponible para otro al cambiar de modo."}
            </span>
          </div>

          <div className={p.field} style={{ marginTop: "0.85rem" }}>
            <span className={p.label}>Quién puede marcar un pedido como entregado</span>
            <Segmented<DeliveryConfirmBy>
              value={draft.options.deliveryConfirmBy}
              onChange={deliveryConfirmBy => update({ options: { ...draft.options, deliveryConfirmBy } })}
              options={[["courier", "Solo el repartidor"], ["courier_admin", "Repartidor y administrador"]]}
            />
            <span className={p.switchHint}>
              {draft.options.deliveryConfirmBy === "courier"
                ? "La entrega se confirma con el código de 6 dígitos que recibe el cliente. El panel de pedidos no puede marcar entregado un pedido que lleva un repartidor."
                : "Además del repartidor, el administrador puede marcar la entrega desde Entregas en curso (queda registrado quién lo hizo)."}
            </span>
          </div>

          <div className={p.switchRow} style={{ marginTop: "0.5rem" }}>
            <div className={p.switchText}>
              <span className={p.switchTitle}>Permitir al administrador resolver incidencias</span>
              <span className={p.switchHint}>
                Si el repartidor no pudo confirmar con el código (celular roto, cliente sin batería), el administrador puede marcar la entrega indicando
                un motivo obligatorio. Queda en el registro del pedido.
              </span>
            </div>
            <input
              type="checkbox"
              className={p.switch}
              checked={draft.options.deliveryAdminOverride === true}
              disabled={draft.options.deliveryConfirmBy === "courier_admin"}
              onChange={e => update({ options: { ...draft.options, deliveryAdminOverride: e.target.checked } })}
              aria-label="Permitir al administrador resolver incidencias"
            />
          </div>

          <p className={p.cardDesc} style={{ marginTop: "0.75rem" }}>
            Al apagar Delivery, los pedidos asignados que todavía no se retiraron vuelven a quedar sin repartidor; los que ya salieron se pueden terminar
            de entregar (con el código o por el administrador, con motivo). No se cancela ni se borra nada del historial.
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
                {" "}Los QR de las mesas no cambian al pasar de un tipo a otro ni al cambiar la cantidad de mesas: solo si los regenerás.
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
        <div key={index} className={p.shiftEntry}>
          <label className={p.field}>
            <span className={p.label}>Nombre</span>
            <input className={p.input} value={entry.name} maxLength={40} onChange={e => set(index, { name: e.target.value })} placeholder="Mediodía" />
          </label>
          <label className={p.field}>
            <span className={p.label}>Desde</span>
            <input className={p.input} type="time" value={entry.from} onChange={e => set(index, { from: e.target.value })} />
          </label>
          <label className={p.field}>
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
