import { useState, useRef } from "react";
import { useAuth } from "../api/Auth/AuthContext";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ResumenItem {
  fila: number;
  codigo?: string;
  titulo?: string;
  cambios?: string[];
  razon?: string;
}

interface Resumen {
  categorias: { crear: ResumenItem[]; actualizar: ResumenItem[]; errores: ResumenItem[] };
  productos:  { crear: ResumenItem[]; actualizar: ResumenItem[]; errores: ResumenItem[] };
}

interface Resultado {
  categorias: { creadas: ResumenItem[]; actualizadas: ResumenItem[]; errores: ResumenItem[] };
  productos:  { creados: ResumenItem[]; actualizados: ResumenItem[]; errores: ResumenItem[] };
}

type Step = "upload" | "preview" | "success";

// ── Props ──────────────────────────────────────────────────────────────────────
interface MassiveImportProps {
  onBack: () => void;
  onSuccess: () => void; // llama a refetch del padre
}

// ── Componente ─────────────────────────────────────────────────────────────────
export default function MassiveImport({ onBack, onSuccess }: MassiveImportProps) {
  const { token } = useAuth();

  const [step, setStep]           = useState<Step>("upload");
  const [file, setFile]           = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [resumen, setResumen]     = useState<Resumen | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── Descarga el template desde el backend ──────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const res = await fetch("/api/massive/template", { headers: authHeaders });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "menu-digital-plantilla.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar la plantilla.");
    }
  };

  // ── Manejo del archivo ────────────────────────────────────────────────────
  const handleFileSelect = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("El archivo supera el límite de 5 MB."); return; }
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) { setError("Solo se aceptan archivos .xlsx o .xls."); return; }
    setFile(f);
    setError("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files[0] ?? null);
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const preview = async () => {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.append("archivo", file);
      const res  = await fetch("/api/massive/preview", { method: "POST", headers: authHeaders, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al procesar el archivo.");
      setResumen(data.resumen);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Error al procesar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm ───────────────────────────────────────────────────────────────
  const confirm = async () => {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.append("archivo", file);
      const res  = await fetch("/api/massive/confirm", { method: "POST", headers: authHeaders, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al confirmar la importación.");
      setResultado(data.resultado);
      setStep("success");
      onSuccess(); // refresca el menú en el padre
    } catch (err: any) {
      setError(err.message || "Error al confirmar.");
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setFile(null); setResumen(null); setResultado(null);
    setError(""); setStep("upload");
  };

  // ── Totales de resumen ────────────────────────────────────────────────────
  const totalCrear      = (resumen?.categorias.crear.length     ?? 0) + (resumen?.productos.crear.length     ?? 0);
  const totalActualizar = (resumen?.categorias.actualizar.length ?? 0) + (resumen?.productos.actualizar.length ?? 0);
  const totalErrores    = (resumen?.categorias.errores.length    ?? 0) + (resumen?.productos.errores.length    ?? 0);

  const totalCreados      = (resultado?.categorias.creadas.length      ?? 0) + (resultado?.productos.creados.length      ?? 0);
  const totalActualizados = (resultado?.categorias.actualizadas.length  ?? 0) + (resultado?.productos.actualizados.length  ?? 0);
  const totalFallidos     = (resultado?.categorias.errores.length       ?? 0) + (resultado?.productos.errores.length       ?? 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="me">

      {/* Top bar */}
      <header className="top-bar">
        <button className="back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="top-title">Importar desde Excel</span>
        <div style={{ width: 36 }} />
      </header>

      {/* ── Indicador de pasos ─────────────────────────────────────────── */}
      <div className="step-bar">
        {(["upload", "preview", "success"] as Step[]).map((s, i) => {
          const labels = ["Subir archivo", "Revisar cambios", "Listo"];
          const idx    = ["upload", "preview", "success"].indexOf(step);
          const done   = i < idx;
          const active = s === step;
          return (
            <div key={s} className="step-item">
              <div className={`step-dot ${active ? "active" : done ? "done" : ""}`}>
                {done
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : i + 1}
              </div>
              <span className={`step-label ${active ? "active" : ""}`}>{labels[i]}</span>
              {i < 2 && <div className={`step-line ${done ? "done" : ""}`} />}
            </div>
          );
        })}
      </div>

      <div className="content">
        {error && <div className="error-banner">{error}</div>}

        {/* ══════════════════════════════════════════
            PASO 1: SUBIR ARCHIVO
        ══════════════════════════════════════════ */}
        {step === "upload" && (
          <>
            {/* Descarga de plantilla */}
            <div className="info-card">
              <div className="info-card-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9 15 12 18 15 15" />
                </svg>
                <div>
                  <p className="info-card-title">Descargá la plantilla actualizada</p>
                  <p className="info-card-desc">Incluye tus categorías y productos actuales para que puedas editarlos directamente.</p>
                </div>
              </div>
              <button className="outline-btn" onClick={downloadTemplate}>Descargar</button>
            </div>

            {/* Drop zone */}
            <div
              className={`drop-zone ${dragging ? "dragover" : ""} ${file ? "has-file" : ""}`}
              onClick={() => !file && inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {file ? (
                <div className="file-selected">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7ec850" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{Math.round(file.size / 1024)} KB</span>
                  </div>
                  <button className="remove-file-btn" onClick={e => { e.stopPropagation(); reset(); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#3d3a33", marginBottom: "0.5rem" }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  <p className="drop-title">Arrastrá tu .xlsx aquí</p>
                  <p className="drop-sub">o tocá para seleccionar · Máx. 5 MB</p>
                </>
              )}
            </div>

            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={e => handleFileSelect(e.target.files?.[0] ?? null)} />

            <button className="save-btn" onClick={preview} disabled={!file || loading}>
              {loading ? "Procesando..." : "Ver resumen de cambios →"}
            </button>
          </>
        )}

        {/* ══════════════════════════════════════════
            PASO 2: PREVIEW / RESUMEN
        ══════════════════════════════════════════ */}
        {step === "preview" && resumen && (
          <>
            {/* Métricas */}
            <div className="metrics-grid">
              <div className="metric-card green">
                <span className="metric-num">{totalCrear}</span>
                <span className="metric-lbl">a crear</span>
              </div>
              <div className="metric-card amber">
                <span className="metric-num">{totalActualizar}</span>
                <span className="metric-lbl">a actualizar</span>
              </div>
              <div className={`metric-card ${totalErrores > 0 ? "red" : "neutral"}`}>
                <span className="metric-num">{totalErrores}</span>
                <span className="metric-lbl">con errores</span>
              </div>
            </div>

            {/* Categorías */}
            <ResumenSection
              titulo="Categorías"
              crear={resumen.categorias.crear}
              actualizar={resumen.categorias.actualizar}
              errores={resumen.categorias.errores}
            />

            {/* Productos */}
            <ResumenSection
              titulo="Productos"
              crear={resumen.productos.crear}
              actualizar={resumen.productos.actualizar}
              errores={resumen.productos.errores}
            />

            {totalErrores > 0 && (
              <div className="warn-banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Las filas con errores serán ignoradas. El resto se importará igual.
              </div>
            )}

            <div className="form-btns">
              <button className="delete-btn" onClick={() => setStep("upload")} disabled={loading}>
                ← Volver
              </button>
              <button className="save-btn" onClick={confirm} disabled={loading || (totalCrear + totalActualizar === 0)}>
                {loading ? "Importando..." : `Confirmar importación`}
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            PASO 3: ÉXITO
        ══════════════════════════════════════════ */}
        {step === "success" && resultado && (
          <>
            <div className="success-card">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7ec850" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <p className="success-title">Importación completada</p>
              <p className="success-sub">
                {totalCreados} creados · {totalActualizados} actualizados
                {totalFallidos > 0 ? ` · ${totalFallidos} con errores` : ""}
              </p>
            </div>

            {/* Detalle del resultado */}
            <ResultadoSection
              titulo="Categorías"
              creados={resultado.categorias.creadas}
              actualizados={resultado.categorias.actualizadas}
              errores={resultado.categorias.errores}
            />
            <ResultadoSection
              titulo="Productos"
              creados={resultado.productos.creados}
              actualizados={resultado.productos.actualizados}
              errores={resultado.productos.errores}
            />

            <div className="form-btns">
              <button className="outline-btn" onClick={reset}>Importar otro</button>
              <button className="save-btn" onClick={onBack}>Volver al menú</button>
            </div>
          </>
        )}
      </div>

      {/* ── Estilos (mismo design system que MenuEditorPage) ───────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .me {
          min-height: 100vh; background: #0c0b09;
          font-family: 'DM Sans', system-ui, sans-serif; color: #d4c9b0;
          display: flex; flex-direction: column;
          max-width: 600px; margin: 0 auto;
        }

        /* Top bar */
        .top-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem; border-bottom: 0.5px solid #1e1c18;
          background: #0c0b09; position: sticky; top: 0; z-index: 10;
        }
        .top-title { font-size: 1rem; font-weight: 500; color: #ede4d0; }
        .back-btn {
          width: 36px; height: 36px; background: #181614; border: 0.5px solid #272420;
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #a09070; transition: border-color .15s, color .15s;
        }
        .back-btn:hover { border-color: #c9a84c; color: #c9a84c; }

        /* Step bar */
        .step-bar {
          display: flex; align-items: center; padding: 1rem 1rem 0;
          gap: 0;
        }
        .step-item { display: flex; align-items: center; gap: 6px; }
        .step-dot {
          width: 22px; height: 22px; border-radius: 50%;
          background: #181614; border: 0.5px solid #272420;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 500; color: #5c5649;
          flex-shrink: 0; transition: all .2s;
        }
        .step-dot.active { background: #1e1a10; border-color: #c9a84c; color: #c9a84c; }
        .step-dot.done   { background: #0d2b18; border-color: #4c7a2e; color: #7ec850; }
        .step-label { font-size: 0.75rem; color: #3d3a33; white-space: nowrap; }
        .step-label.active { color: #c9a84c; }
        .step-line { flex: 1; height: 0.5px; background: #272420; min-width: 20px; margin: 0 6px; }
        .step-line.done { background: #4c7a2e; }

        /* Content */
        .content { flex: 1; padding: 1rem; display: flex; flex-direction: column; gap: .9rem; }

        /* Info card */
        .info-card {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          background: #131210; border: 0.5px solid #272420; border-radius: 12px;
          padding: .9rem 1rem;
        }
        .info-card-left { display: flex; align-items: flex-start; gap: 10px; color: #c9a84c; }
        .info-card-title { font-size: .88rem; font-weight: 500; color: #ede4d0; margin-bottom: 2px; }
        .info-card-desc  { font-size: .75rem; color: #5c5649; line-height: 1.4; }

        /* Drop zone */
        .drop-zone {
          border: 1.5px dashed #272420; border-radius: 12px;
          padding: 2rem 1.5rem; text-align: center; cursor: pointer;
          transition: border-color .2s, background .2s;
          display: flex; flex-direction: column; align-items: center;
        }
        .drop-zone:hover, .drop-zone.dragover { border-color: #c9a84c44; background: #1e1a1044; }
        .drop-zone.has-file { border-style: solid; border-color: #4c7a2e; background: #0d2b1833; cursor: default; }
        .drop-title { font-size: .88rem; font-weight: 500; color: #ede4d0; margin-bottom: .25rem; }
        .drop-sub   { font-size: .75rem; color: #3d3a33; }

        /* File selected */
        .file-selected { display: flex; align-items: center; gap: 10px; width: 100%; }
        .file-info { flex: 1; text-align: left; }
        .file-name { display: block; font-size: .88rem; font-weight: 500; color: #ede4d0; }
        .file-size { display: block; font-size: .72rem; color: #5c5649; margin-top: 2px; }
        .remove-file-btn {
          background: #1e1209; border: 0.5px solid #4a2010; border-radius: 8px;
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #b86040; flex-shrink: 0;
        }

        /* Buttons */
        .save-btn {
          width: 100%; background: #c9a84c; border: none; border-radius: 12px;
          padding: .9rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: .95rem; font-weight: 500; color: #0c0b09;
          cursor: pointer; transition: background .2s;
        }
        .save-btn:hover:not(:disabled) { background: #dabb62; }
        .save-btn:disabled { opacity: .4; cursor: not-allowed; }
        .outline-btn {
          background: none; border: 0.5px solid #3a3020; border-radius: 10px;
          padding: .7rem 1.1rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: .88rem; color: #c9a84c; cursor: pointer; transition: border-color .15s;
          white-space: nowrap;
        }
        .outline-btn:hover { border-color: #c9a84c; }
        .delete-btn {
          width: 100%; background: none; border: 0.5px solid #272420; border-radius: 12px;
          padding: .9rem; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: .95rem; font-weight: 500; color: #6b6457;
          cursor: pointer; transition: border-color .2s;
        }
        .delete-btn:hover:not(:disabled) { border-color: #5c5649; color: #a09070; }
        .delete-btn:disabled { opacity: .4; cursor: not-allowed; }
        .form-btns { display: flex; gap: .6rem; margin-top: .25rem; }
        .form-btns .save-btn { flex: 2; }
        .form-btns .delete-btn { flex: 1; }

        /* Metrics */
        .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; }
        .metric-card {
          border-radius: 10px; padding: .75rem; text-align: center;
          border: 0.5px solid #1e1c18;
        }
        .metric-card.green  { background: #0d2b1855; border-color: #1a4a2a; }
        .metric-card.amber  { background: #1e1a1055; border-color: #3a3020; }
        .metric-card.red    { background: #1c100955; border-color: #4a2010; }
        .metric-card.neutral{ background: #131210;   border-color: #1e1c18; }
        .metric-num {
          display: block; font-size: 1.5rem; font-weight: 500;
          color: #ede4d0; margin-bottom: 2px;
        }
        .metric-card.green  .metric-num { color: #7ec850; }
        .metric-card.amber  .metric-num { color: #c9a84c; }
        .metric-card.red    .metric-num { color: #c97070; }
        .metric-lbl { font-size: .72rem; color: #5c5649; }

        /* Resumen/Resultado sections */
        .rs-block {
          background: #131210; border: 0.5px solid #272420; border-radius: 12px; overflow: hidden;
        }
        .rs-header {
          padding: .75rem 1rem; border-bottom: 0.5px solid #1e1c18;
          display: flex; align-items: center; gap: 8px;
        }
        .rs-titulo { font-size: .82rem; font-weight: 500; color: #ede4d0; }
        .rs-group { border-bottom: 0.5px solid #1e1c18; }
        .rs-group:last-child { border-bottom: none; }
        .rs-group-title {
          padding: .5rem 1rem; font-size: .68rem; letter-spacing: .1em;
          text-transform: uppercase; color: #3d3a33;
          display: flex; align-items: center; gap: 6px;
        }
        .rs-row {
          display: flex; align-items: flex-start; gap: 8px;
          padding: .5rem 1rem; border-top: 0.5px solid #18160f;
        }
        .rs-fila { font-size: .72rem; color: #3d3a33; flex-shrink: 0; min-width: 42px; }
        .rs-codigo { font-size: .82rem; color: #d4c9b0; font-weight: 500; }
        .rs-titulo-item { font-size: .75rem; color: #5c5649; }
        .rs-cambios { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
        .rs-tag {
          font-size: .65rem; padding: 2px 6px; border-radius: 4px;
          background: #1e1a10; border: 0.5px solid #3a3020; color: #c9a84c;
        }
        .rs-error { font-size: .75rem; color: #c97070; margin-top: 2px; }
        .rs-empty { padding: .6rem 1rem; font-size: .78rem; color: #3d3a33; font-style: italic; }

        /* Badges count */
        .badge-count {
          font-size: .68rem; padding: 1px 7px; border-radius: 20px; font-weight: 500;
        }
        .badge-count.green  { background: #0d2b18; color: #7ec850; border: 0.5px solid #1a4a2a; }
        .badge-count.amber  { background: #1e1a10; color: #c9a84c; border: 0.5px solid #3a3020; }
        .badge-count.red    { background: #1c1009; color: #c97070; border: 0.5px solid #4a2010; }
        .badge-count.neutral{ background: #181614; color: #5c5649; border: 0.5px solid #272420; }

        /* Banners */
        .error-banner {
          background: #1c1009; border: 0.5px solid #4a2010; border-radius: 8px;
          padding: .65rem 1rem; font-size: .82rem; color: #b86040;
        }
        .warn-banner {
          background: #1e1a10; border: 0.5px solid #3a3020; border-radius: 8px;
          padding: .65rem 1rem; font-size: .78rem; color: #a09070;
          display: flex; align-items: flex-start; gap: 8px; line-height: 1.4;
        }

        /* Success card */
        .success-card {
          background: #0d2b18; border: 0.5px solid #1a4a2a; border-radius: 14px;
          padding: 2rem; text-align: center; display: flex; flex-direction: column;
          align-items: center; gap: .5rem;
        }
        .success-title { font-size: 1rem; font-weight: 500; color: #ede4d0; }
        .success-sub   { font-size: .82rem; color: #5c9040; }
      `}</style>
    </div>
  );
}

// ── Sub-componente: sección de resumen (preview) ───────────────────────────────
function ResumenSection({ titulo, crear, actualizar, errores }: {
  titulo: string;
  crear: ResumenItem[];
  actualizar: ResumenItem[];
  errores: ResumenItem[];
}) {
  const total = crear.length + actualizar.length + errores.length;
  if (total === 0) return null;

  return (
    <div className="rs-block">
      <div className="rs-header">
        <span className="rs-titulo">{titulo}</span>
        {crear.length > 0      && <span className="badge-count green">{crear.length} nuevos</span>}
        {actualizar.length > 0 && <span className="badge-count amber">{actualizar.length} cambios</span>}
        {errores.length > 0    && <span className="badge-count red">{errores.length} errores</span>}
      </div>

      {crear.length > 0 && (
        <div className="rs-group">
          <div className="rs-group-title">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7ec850" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            A crear
          </div>
          {crear.map((r, i) => (
            <div key={i} className="rs-row">
              <span className="rs-fila">fila {r.fila}</span>
              <div>
                <span className="rs-codigo">{r.codigo}</span>
                {r.titulo && <span className="rs-titulo-item"> — {r.titulo}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {actualizar.length > 0 && (
        <div className="rs-group">
          <div className="rs-group-title">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2.5"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.33" /></svg>
            A actualizar
          </div>
          {actualizar.map((r, i) => (
            <div key={i} className="rs-row">
              <span className="rs-fila">fila {r.fila}</span>
              <div>
                <span className="rs-codigo">{r.codigo}</span>
                {r.cambios && (
                  <div className="rs-cambios">
                    {r.cambios.map(c => <span key={c} className="rs-tag">{c}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {errores.length > 0 && (
        <div className="rs-group">
          <div className="rs-group-title">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c97070" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            Errores (se omitirán)
          </div>
          {errores.map((r, i) => (
            <div key={i} className="rs-row">
              <span className="rs-fila">fila {r.fila}</span>
              <div>
                {r.codigo && <span className="rs-codigo">{r.codigo}</span>}
                <p className="rs-error">{r.razon}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-componente: sección de resultado (post-confirm) ────────────────────────
function ResultadoSection({ titulo, creados, actualizados, errores }: {
  titulo: string;
  creados: ResumenItem[];
  actualizados: ResumenItem[];
  errores: ResumenItem[];
}) {
  const total = creados.length + actualizados.length + errores.length;
  if (total === 0) return null;

  return (
    <div className="rs-block">
      <div className="rs-header">
        <span className="rs-titulo">{titulo}</span>
        {creados.length > 0      && <span className="badge-count green">{creados.length} creados</span>}
        {actualizados.length > 0 && <span className="badge-count amber">{actualizados.length} actualizados</span>}
        {errores.length > 0      && <span className="badge-count red">{errores.length} fallidos</span>}
      </div>
      {errores.length > 0 && (
        <div className="rs-group">
          <div className="rs-group-title">Fallidos</div>
          {errores.map((r, i) => (
            <div key={i} className="rs-row">
              <span className="rs-fila">fila {r.fila}</span>
              <div>
                {r.codigo && <span className="rs-codigo">{r.codigo}</span>}
                <p className="rs-error">{r.razon}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}