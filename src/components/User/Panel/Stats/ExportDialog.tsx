import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../../context/useAuth";
import s from "./ExportDialog.module.css";
import {
  presetRange, rangeError, requestReportFile, SALES_SHEETS, SHEET_LABEL, VISIT_SHEETS,
  type ExportPreset, type ReportSheet,
} from "./salesReport";
import { formatDayLong } from "./statsFormat";

const PRESETS: { value: ExportPreset; label: string }[] = [
  { value: "period7", label: "Últimos 7 días" },
  { value: "period30", label: "Últimos 30 días" },
  { value: "today", label: "Hoy" },
  { value: "month", label: "Este mes" },
  { value: "lastMonth", label: "Mes pasado" },
  { value: "custom", label: "Elegir fechas" },
];

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // El navegador necesita la URL viva hasta que arranca la descarga.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function ExportDialog({ today, initialPreset, salesAvailable, slug, onClose }: {
  // "Hoy" en Buenos Aires (YYYY-MM-DD), según el servidor.
  today: string;
  initialPreset: "period7" | "period30";
  // false sin plan Pro: las hojas de ventas y caja se muestran bloqueadas.
  salesAvailable: boolean;
  slug?: string | null;
  onClose: () => void;
}) {
  const { token, logout } = useAuth();
  const titleId = useId();
  const [preset, setPreset] = useState<ExportPreset>(initialPreset);
  const [custom, setCustom] = useState(() => presetRange(initialPreset, today));
  const [sheets, setSheets] = useState<Set<ReportSheet>>(
    () => new Set<ReportSheet>([...(salesAvailable ? SALES_SHEETS : []), ...VISIT_SHEETS]),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const range = preset === "custom" ? custom : presetRange(preset, today);
  const invalid = rangeError(range.from, range.to, today);
  const canExport = !busy && !invalid && sheets.size > 0;

  const toggle = (sheet: ReportSheet) => {
    setDone(false);
    setSheets(current => {
      const next = new Set(current);
      if (next.has(sheet)) next.delete(sheet); else next.add(sheet);
      return next;
    });
  };

  const exportFile = async () => {
    if (!canExport || !token) return;
    setBusy(true);
    setError(null);
    setDone(false);
    const result = await requestReportFile(range, [...sheets], token);
    setBusy(false);
    if (result.kind === "unauthorized") {
      logout();
      window.location.href = "/login";
      return;
    }
    if (result.kind === "error") { setError(result.message); return; }
    saveFile(result.blob, `reporte-${slug || "menu-digital"}-${range.from}-a-${range.to}.xlsx`);
    setDone(true);
  };

  const group = (title: string, keys: readonly ReportSheet[], locked: boolean) => (
    <fieldset className={s.group} disabled={locked}>
      <legend>
        {title}
        {locked && <span className={s.planTag}>Plan Pro</span>}
      </legend>
      {keys.map(key => (
        <label key={key} className={s.option}>
          <input type="checkbox" checked={!locked && sheets.has(key)} onChange={() => toggle(key)} />
          <span>
            <strong>{SHEET_LABEL[key].title}</strong>
            <small>{SHEET_LABEL[key].detail}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );

  return createPortal(
    <div className={s.overlay} onClick={() => { if (!busy) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <h2 id={titleId} className={s.title}>Exportar a Excel</h2>
        <p className={s.lead}>Un archivo .xlsx con una hoja por reporte, listo para filtrar y sumar.</p>

        <fieldset className={s.presets}>
          <legend>Período</legend>
          {PRESETS.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preset === option.value}
              onClick={() => {
                // Al pasar a fechas propias se parte del rango que estaba elegido.
                if (option.value === "custom" && preset !== "custom") setCustom(range);
                setPreset(option.value);
                setDone(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        {preset === "custom" ? (
          <div className={s.dates}>
            <label>
              Desde
              <input type="date" value={custom.from} max={today}
                onChange={event => { setCustom(current => ({ ...current, from: event.target.value })); setDone(false); }} />
            </label>
            <label>
              Hasta
              <input type="date" value={custom.to} max={today}
                onChange={event => { setCustom(current => ({ ...current, to: event.target.value })); setDone(false); }} />
            </label>
          </div>
        ) : (
          <p className={s.rangeText}>
            {range.from === range.to ? formatDayLong(range.from) : `${formatDayLong(range.from)} al ${formatDayLong(range.to)}`}
          </p>
        )}
        {invalid && preset === "custom" && <p className={s.error} role="alert">{invalid}</p>}

        {group("Ventas y caja", SALES_SHEETS, !salesAvailable)}
        {group("Carta", VISIT_SHEETS, false)}

        {error && <p className={s.error} role="alert">{error}</p>}
        {done && <p className={s.done} role="status">Listo: el archivo se descargó.</p>}

        <div className={s.actions}>
          <button type="button" className={s.secondary} onClick={onClose} disabled={busy}>Cerrar</button>
          <button type="button" className={s.primary} onClick={() => { void exportFile(); }} disabled={!canExport}>
            {busy ? "Generando…" : "Descargar Excel"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
