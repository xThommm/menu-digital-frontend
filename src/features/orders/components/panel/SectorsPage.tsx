import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, KeyRound, Monitor, Pencil, Star, Trash2, X } from "lucide-react";
import {
  createSector, deleteSector, issueSectorPairingCode, listSectors, revokeSectorSession, updateSector,
} from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { durationLabel, elapsedLabel } from "../../lib/format";
import type { PaperWidth, PrintMode, Sector } from "../../types";
import p from "./panel.module.css";

// Sectores del local (cocina, barra, postres…) y sus comandas.
//
// Con sectores, cada pedido confirmado se parte en una comanda por sector y
// cada sector la ve en su propia pantalla (/comandas), en una PC o tablet
// que se vincula con un código que se tipea. Sin sectores no cambia nada:
// todo el pedido se maneja en el panel de pedidos.

const REFRESH_LIST_MS = 30_000;

const PRINT_MODE_LABEL: Record<PrintMode, string> = {
  none: "Solo pantalla",
  browser: "Impresora del equipo",
  escpos: "Comandera directa (experimental)",
};

const PRINT_MODE_HINT: Record<PrintMode, string> = {
  none: "Las comandas se ven y se marcan en la pantalla del sector.",
  browser: "Las comandas se imprimen en la impresora del equipo (sirve la comandera con su driver). Para que salgan solas, sin el diálogo de impresión, el navegador tiene que estar en modo kiosco (--kiosk-printing).",
  escpos: "La pantalla habla directo con la comandera por USB. Todavía no se probó con una impresora real.",
};

const stationUrl = (sectorId?: number) =>
  `${window.location.origin}/comandas${sectorId ? `?sector=${sectorId}` : ""}`;

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [assignedCount, setAssignedCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [pairing, setPairing] = useState<Sector | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const data = await listSectors();
      setSectors(data.sectors);
      setAssignedCount(data.assignments.length);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "No se pudieron cargar los sectores."));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    // Equipos conectados y su última actividad, al día.
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      load();
    }, REFRESH_LIST_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const list = sectors ?? [];
  const replace = (updated: Sector) => setSectors(list.map(sector => (sector.id === updated.id ? updated : sector)));

  const run = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await run(async () => {
      setSectors([...list, await createSector(name.trim())]);
      setName("");
    }, "No se pudo crear el sector.");
    setSaving(false);
  };

  const rename = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editing.name.trim()) return;
    run(async () => {
      replace(await updateSector(editing.id, { name: editing.name.trim() }));
      setEditing(null);
    }, "No se pudo renombrar el sector.");
  };

  // Marcar otro por defecto desmarca al anterior: se recarga la lista.
  const makeDefault = (sector: Sector) => run(async () => {
    await updateSector(sector.id, { isDefault: true });
    await load();
  }, "No se pudo cambiar el sector por defecto.");

  const remove = (sector: Sector) => run(async () => {
    await deleteSector(sector.id);
    setConfirmDelete(null);
    await load();
  }, "No se pudo eliminar el sector.");

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Sectores y comandas</h1>
          <p className={p.subtitle}>
            Cocina, barra, postres… Cada pedido confirmado se reparte en una comanda por sector, así cada uno
            prepara solo lo suyo. Si no creás sectores, todo el pedido se maneja en el panel de pedidos.
          </p>
        </div>
        <div className={p.headerActions}>
          <a className={p.btn} href={stationUrl()} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden /> Abrir pantalla de comandas
          </a>
        </div>
      </header>

      {error && <p className={p.error} role="alert">{error}</p>}

      <div className={p.grid}>
        <div className={p.stack}>
          <form className={`${p.card} ${p.stack}`} onSubmit={add}>
            <h2 className={p.cardTitle}>Agregar sector</h2>
            <label className={p.field}>
              <span className={p.label}>Nombre</span>
              <input
                className={p.input}
                value={name}
                maxLength={40}
                placeholder="Ej: Cocina, Barra, Postres"
                onChange={event => setName(event.target.value)}
              />
            </label>
            <div className={p.headerActions}>
              <button type="submit" className={p.btnPrimary} disabled={saving || !name.trim()}>Agregar</button>
            </div>
          </form>

          <section className={`${p.card} ${p.stack}`} aria-label="Cómo funciona">
            <h2 className={p.cardTitle}>Qué va a cada sector</h2>
            <p className={p.cardDesc}>
              En el <Link to="/menu/editor">editor de menú</Link> elegí el sector de cada sección, categoría o
              producto. Se hereda de afuera hacia adentro: si la sección <em>Comidas</em> va a Cocina, todas sus
              categorías y productos van a Cocina salvo los que tengan otro sector.
            </p>
            <p className={p.cardDesc}>
              Lo que no tenga sector va al sector <strong>por defecto</strong>.
              {sectors && ` Hoy hay ${assignedCount === 1 ? "1 elemento" : `${assignedCount} elementos`} del menú con sector propio.`}
            </p>
            <p className={p.cardDesc}>
              Cuando un sector termina, marca su comanda como lista. En el panel de pedidos ves el avance de
              cada sector y marcás el pedido listo para entregar.
            </p>
          </section>
        </div>

        <section className={p.card} aria-label="Sectores">
          <h2 className={p.cardTitle}>Sectores ({list.length})</h2>
          {!sectors && !loadError && <p className={p.loading}>Cargando…</p>}
          {loadError && <p className={p.error}>{loadError}</p>}
          {sectors && list.length === 0 && (
            <p className={p.empty}>Sin sectores: todo el pedido se prepara desde el panel de pedidos.</p>
          )}

          {list.map(sector => (
            <div key={sector.id} className={p.switchRow}>
              <div className={p.switchText} style={{ minWidth: 0, flex: 1 }}>
                {editing?.id === sector.id ? (
                  <form className={p.row} onSubmit={rename}>
                    <input
                      className={p.input}
                      value={editing.name}
                      maxLength={40}
                      autoFocus
                      aria-label="Nuevo nombre del sector"
                      onChange={event => setEditing({ id: sector.id, name: event.target.value })}
                    />
                    <button type="submit" className={`${p.btnPrimary} ${p.small}`} disabled={!editing.name.trim()}>Guardar</button>
                    <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setEditing(null)}>Cancelar</button>
                  </form>
                ) : (
                  <span className={p.switchTitle}>
                    {sector.name}
                    {sector.isDefault && <span className={`${p.status} ${p.status_confirmed}`} style={{ marginLeft: "0.5rem" }}>Por defecto</span>}
                  </span>
                )}

                <div className={p.row} style={{ marginTop: "0.5rem", alignItems: "flex-end" }}>
                  <label className={p.field} style={{ flex: "2 1 220px" }}>
                    <span className={p.label}>Impresión</span>
                    <select
                      className={p.select}
                      value={sector.printMode}
                      onChange={event => run(
                        async () => replace(await updateSector(sector.id, { printMode: event.target.value as PrintMode })),
                        "No se pudo guardar la impresión."
                      )}
                    >
                      {(Object.keys(PRINT_MODE_LABEL) as PrintMode[]).map(mode => (
                        <option key={mode} value={mode}>{PRINT_MODE_LABEL[mode]}</option>
                      ))}
                    </select>
                  </label>
                  {sector.printMode !== "none" && (
                    <>
                      <label className={p.field} style={{ flex: "1 1 100px" }}>
                        <span className={p.label}>Papel</span>
                        <select
                          className={p.select}
                          value={sector.paperWidth}
                          onChange={event => run(
                            async () => replace(await updateSector(sector.id, { paperWidth: Number(event.target.value) as PaperWidth })),
                            "No se pudo guardar el papel."
                          )}
                        >
                          <option value={80}>80 mm</option>
                          <option value={58}>58 mm</option>
                        </select>
                      </label>
                      <label className={p.field} style={{ flex: "1 1 80px" }}>
                        <span className={p.label}>Copias</span>
                        <select
                          className={p.select}
                          value={sector.printCopies}
                          onChange={event => run(
                            async () => replace(await updateSector(sector.id, { printCopies: Number(event.target.value) })),
                            "No se pudieron guardar las copias."
                          )}
                        >
                          {[1, 2, 3].map(copies => <option key={copies} value={copies}>{copies}</option>)}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                <span className={p.switchHint}>{PRINT_MODE_HINT[sector.printMode]}</span>

                {sector.sessions.length === 0 ? (
                  <span className={p.switchHint}>Sin equipos vinculados.</span>
                ) : (
                  <ul className={p.stack} style={{ gap: "0.35rem", margin: "0.35rem 0 0", padding: 0, listStyle: "none" }}>
                    {sector.sessions.map(session => (
                      <li key={session.id} className={p.switchHint} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.5rem" }}>
                        <Monitor size={13} aria-hidden />
                        <strong style={{ fontWeight: 600 }}>{session.deviceLabel ?? "Equipo"}</strong>
                        <span>
                          · vinculado hace {durationLabel(session.startedAt, null, now)} · última actividad {elapsedLabel(session.lastSeenAt, now)}
                        </span>
                        <button
                          type="button"
                          className={`${p.btnGhost} ${p.small}`}
                          style={{ minHeight: 28 }}
                          onClick={() => run(async () => {
                            await revokeSectorSession(sector.id, session.id);
                            const sessions = sector.sessions.filter(item => item.id !== session.id);
                            replace({ ...sector, sessions, activeDevices: sessions.length });
                          }, "No se pudo desvincular el equipo.")}
                          aria-label={`Desvincular ${session.deviceLabel ?? "el equipo"} de ${sector.name}`}
                        >
                          Desvincular
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={p.headerActions} style={{ marginTop: "0.5rem" }}>
                  <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setPairing(sector)}>
                    <KeyRound size={14} aria-hidden /> Vincular equipo
                  </button>
                  <a className={`${p.btnGhost} ${p.small}`} href={stationUrl(sector.id)} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden /> Ver pantalla
                  </a>
                  <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setEditing({ id: sector.id, name: sector.name })}>
                    <Pencil size={14} aria-hidden /> Renombrar
                  </button>
                  {!sector.isDefault && (
                    <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => makeDefault(sector)}>
                      <Star size={14} aria-hidden /> Hacer por defecto
                    </button>
                  )}
                  {confirmDelete === sector.id ? (
                    <>
                      <button type="button" className={`${p.btnDanger} ${p.small}`} onClick={() => remove(sector)}>Sí, eliminar</button>
                      <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setConfirmDelete(null)}>No</button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`${p.btnGhost} ${p.small}`}
                      onClick={() => setConfirmDelete(sector.id)}
                      aria-label={`Eliminar el sector ${sector.name}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {list.length > 0 && (
            <p className={p.cardDesc} style={{ margin: "0.75rem 0 0" }}>
              Eliminar un sector desvincula sus equipos y lo que tenía asignado pasa a heredar. Sus comandas quedan en el historial.
            </p>
          )}
        </section>
      </div>

      {pairing && <PairingCodeModal sector={pairing} onClose={() => { setPairing(null); load(); }} />}
    </div>
  );
}

// Código para vincular un equipo del sector. Se tipea en la pantalla de
// comandas del equipo (sirve en una PC, que no escanea QR). Vence a los 10
// minutos y sirve una vez; "Generar otro" invalida el anterior.
function PairingCodeModal({ sector, onClose }: { sector: Sector; onClose: () => void }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const generate = useCallback(async () => {
    try {
      setCode(await issueSectorPairingCode(sector.id));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar el código."));
    }
  }, [sector.id]);

  useEffect(() => {
    const first = setTimeout(generate, 0);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(tick); };
  }, [generate]);

  const secondsLeft = code ? Math.max(0, Math.round((new Date(code.expiresAt).getTime() - now) / 1000)) : 0;
  const expired = code !== null && secondsLeft === 0;

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Vincular un equipo a ${sector.name}`} onClick={onClose}>
      <div className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Vincular un equipo a {sector.name}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={p.modalBody} style={{ textAlign: "center" }}>
          <p className={p.subtitle} style={{ marginBottom: "1rem", lineHeight: 1.5 }}>
            En la PC o tablet del sector, abrí <strong>{stationUrl().replace(/^https?:\/\//, "")}</strong> y tipeá este código.
            El equipo queda mostrando las comandas de {sector.name}, sin tu usuario ni contraseña.
          </p>
          {error && <p className={p.error}>{error}</p>}
          {code ? (
            <p
              aria-label={`Código ${code.code.split("").join(" ")}`}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "2.25rem", fontWeight: 700, letterSpacing: "0.12em", margin: "0.5rem 0",
                opacity: expired ? 0.35 : 1,
              }}
            >
              {code.code}
            </p>
          ) : (
            !error && <p className={p.loading}>Generando…</p>
          )}
          {code && (
            <p className={p.label} style={{ marginTop: "0.25rem" }}>
              {expired
                ? "El código venció."
                : `Vence en ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} · sirve para un solo equipo`}
            </p>
          )}
          <button type="button" className={`${p.btn} ${p.small}`} style={{ marginTop: "0.75rem" }} onClick={generate}>
            Generar otro
          </button>
        </div>
      </div>
    </div>
  );
}
