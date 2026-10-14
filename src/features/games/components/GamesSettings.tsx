import { useEffect, useId, useState, type ReactNode } from "react";
import { errorCode, errorMessage } from "../../orders/lib/errors";
import { uuid } from "../../orders/lib/storage";
import { getGamesSettings, saveGamesSettings } from "../api/gamesApi";
import {
  categoryInPool, GAME_COPY, inPool, poolCount, questionsToText, textToQuestions, togglePoolCategory, togglePoolItem,
} from "../lib/games";
import type { GamePool, GamesCatalog, GamesSettings as Settings, GamesSettingsPayload } from "../types";
import p from "../../orders/components/panel/panel.module.css";
import s from "./GamesSettings.module.css";
import { useDialogs } from "../../../context/useDialogs";

// Sección "Juegos" de Configuración: habilitar cada juego para comensales y
// administrar sus opciones (productos y categorías que participan, preguntas,
// reglas, promociones). Se edita todo junto y se guarda con un botón.

type Games = Settings["games"];

// Un juego: su interruptor y, encendido, sus opciones.
function GameBlock({ title, desc, enabled, onToggle, disabled, children }: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const descId = useId();
  return (
    <div className={s.game}>
      <div className={p.switchRow}>
        <div className={p.switchText}>
          <span className={p.switchTitle}>{title}</span>
          <span className={p.switchHint} id={descId}>{desc}</span>
        </div>
        <input
          type="checkbox"
          role="switch"
          className={p.switch}
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
          aria-label={`Habilitar ${title}`}
          aria-describedby={descId}
        />
      </div>
      {enabled && <div className={s.options}>{children}</div>}
    </div>
  );
}

// Qué categorías y productos de la carta participan de un juego.
function PoolPicker({ label, pool, catalog, onChange, disabled }: {
  label: string;
  pool: GamePool;
  catalog: GamesCatalog;
  onChange: (pool: GamePool) => void;
  disabled: boolean;
}) {
  const allCategoryIds = catalog.categories.map(category => category.id);
  const count = poolCount(pool, catalog.products);
  const available = catalog.products.filter(product => product.available).length;

  if (catalog.categories.length === 0) return <p className={s.hint}>Tu carta todavía no tiene productos visibles.</p>;

  return (
    <details className={s.details}>
      <summary>
        {label}
        <span className={s.summaryMeta}>{count === available ? `Todos (${count})` : `${count} de ${available}`}</span>
      </summary>
      <div className={s.detailsBody}>
        <p className={s.hint}>Desmarcá una categoría entera o productos puntuales. Los pausados o fuera de horario no participan hasta volver a estar disponibles.</p>
        {catalog.categories.map(category => {
          const checked = categoryInPool(pool, category.id);
          const products = catalog.products.filter(product => product.categoryId === category.id);
          return (
            <div key={category.id} className={s.poolCategory}>
              <label className={`${s.check} ${s.checkCategory}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(togglePoolCategory(pool, category.id, allCategoryIds))}
                />
                {category.title}
              </label>
              {checked && (
                <div className={s.poolItems}>
                  {products.map(product => (
                    <label key={product.id} className={s.check}>
                      <input
                        type="checkbox"
                        checked={inPool(pool, product)}
                        disabled={disabled}
                        onChange={() => onChange(togglePoolItem(pool, product.id))}
                      />
                      {product.title}{!product.available && <span className={s.paused}> · no disponible ahora</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function NumberField({ label, value, min, max, onChange, disabled }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void; disabled: boolean;
}) {
  return (
    <label className={p.field}>
      <span className={p.label}>{label}</span>
      <select className={p.select} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))}>
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export default function GamesSettings() {
  const dialogs = useDialogs();
  const [payload, setPayload] = useState<GamesSettingsPayload | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  // Las preguntas se editan como texto (una por renglón) y se pasan a lista al guardar.
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);

  const load = (next: GamesSettingsPayload) => {
    setPayload(next);
    setDraft(next.settings);
    setTexts(Object.fromEntries(next.settings.games.questions.categories.map(category => [category.id, questionsToText(category.questions)])));
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    getGamesSettings()
      .then(next => { if (!cancelled) load(next); })
      .catch(err => {
        if (cancelled) return;
        if (errorCode(err) === "FEATURE_NOT_INCLUDED") setLocked(true);
        else setError(errorMessage(err, "No se pudo cargar la configuración de los juegos."));
      });
    return () => { cancelled = true; };
  }, []);

  if (locked) return <p className={s.hint}>Los juegos para comensales están disponibles con el plan Pro.</p>;
  if (!payload || !draft) return error ? <p className={p.error} role="alert">{error}</p> : <p className={s.hint}>Cargando…</p>;

  const { catalog, limits } = payload;
  const { roulette, questions, duel } = draft.games;

  const change = (next: Settings) => {
    setDraft(next);
    setDirty(true);
    setSaved(false);
  };
  const setGame = <K extends keyof Games>(id: K, patch: Partial<Games[K]>) =>
    change({ ...draft, games: { ...draft.games, [id]: { ...draft.games[id], ...patch } } });
  const setCategories = (categories: Games["questions"]["categories"]) => setGame("questions", { categories });
  const setText = (id: string, text: string) => {
    setTexts(prev => ({ ...prev, [id]: text }));
    setDirty(true);
    setSaved(false);
  };

  const addCategory = () => {
    const id = uuid().slice(0, 8);
    setCategories([...questions.categories, { id, name: "", enabled: true, questions: [] }]);
    setTexts(prev => ({ ...prev, [id]: "" }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const categories = questions.categories.map(category => ({ ...category, questions: textToQuestions(texts[category.id] ?? "") }));
      load(await saveGamesSettings({
        venueOnly: draft.venueOnly,
        games: { roulette, duel, questions: { ...questions, categories } },
      }));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron guardar los juegos."));
    } finally {
      setSaving(false);
    }
  };

  const maxCategories = limits.questionCategories ?? 12;

  return (
    <div>
      <GameBlock
        title={GAME_COPY.roulette.title}
        desc="Sortea productos de tu carta para quien no sabe qué pedir, con un botón para sumarlos al pedido."
        enabled={roulette.enabled}
        onToggle={() => setGame("roulette", { enabled: !roulette.enabled })}
        disabled={saving}
      >
        <div className={s.fields}>
          <NumberField label="Productos por tirada" value={roulette.picks} min={1} max={limits.roulettePicksMax ?? 3} disabled={saving} onChange={picks => setGame("roulette", { picks })} />
        </div>
        <label className={p.field}>
          <span className={p.label}>Promoción (opcional)</span>
          <input className={p.input} value={roulette.promoText} maxLength={limits.promoLength ?? 140} disabled={saving} placeholder="Ej: si pedís lo que salió, 10% de descuento" onChange={event => setGame("roulette", { promoText: event.target.value })} />
        </label>
        <PoolPicker label="Productos que participan" pool={roulette.pool} catalog={catalog} disabled={saving} onChange={pool => setGame("roulette", { pool })} />
      </GameBlock>

      <GameBlock
        title={GAME_COPY.questions.title}
        desc="Tarjetas con preguntas para citas, parejas y grupos. Podés editar las categorías y sumar las tuyas."
        enabled={questions.enabled}
        onToggle={() => setGame("questions", { enabled: !questions.enabled })}
        disabled={saving}
      >
        {questions.categories.map((category, index) => (
          <details key={category.id} className={s.details}>
            <summary>
              {category.name || "Categoría nueva"}
              <span className={s.summaryMeta}>
                {category.enabled ? `${textToQuestions(texts[category.id] ?? "").length} preguntas` : "Apagada"}
              </span>
            </summary>
            <div className={s.detailsBody}>
              <label className={p.field}>
                <span className={p.label}>Nombre</span>
                <input
                  className={p.input}
                  value={category.name}
                  maxLength={limits.questionCategoryNameLength ?? 40}
                  disabled={saving}
                  onChange={event => setCategories(questions.categories.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)))}
                />
              </label>
              <label className={p.field}>
                <span className={p.label}>Preguntas (una por renglón)</span>
                <textarea
                  className={p.textarea}
                  rows={8}
                  value={texts[category.id] ?? ""}
                  disabled={saving}
                  onChange={event => setText(category.id, event.target.value)}
                />
              </label>
              <div className={s.rowActions}>
                <label className={s.check}>
                  <input
                    type="checkbox"
                    checked={category.enabled}
                    disabled={saving}
                    onChange={() => setCategories(questions.categories.map((entry, i) => (i === index ? { ...entry, enabled: !entry.enabled } : entry)))}
                  />
                  Mostrar esta categoría
                </label>
                <button
                  type="button"
                  className={`${p.btnGhost} ${p.small}`}
                  disabled={saving}
                  onClick={async () => {
                    const accepted = await dialogs.confirm({
                      title: `¿Eliminar la categoría "${category.name || "nueva"}"?`,
                      message: "Se eliminan también sus preguntas. El cambio se aplica al guardar.",
                      confirmLabel: "Eliminar categoría",
                      danger: true,
                    });
                    if (accepted) setCategories(questions.categories.filter((_, i) => i !== index));
                  }}
                >
                  Eliminar categoría
                </button>
              </div>
            </div>
          </details>
        ))}
        {questions.categories.length < maxCategories && (
          <button type="button" className={`${p.btn} ${p.small}`} style={{ alignSelf: "flex-start" }} disabled={saving} onClick={addCategory}>
            Agregar categoría
          </button>
        )}

        <label className={s.check}>
          <input
            type="checkbox"
            checked={questions.challenges.enabled}
            disabled={saving}
            onChange={() => setGame("questions", { challenges: { ...questions.challenges, enabled: !questions.challenges.enabled } })}
          />
          Intercalar desafíos con productos de la carta (con botón para pedirlos)
        </label>
        {questions.challenges.enabled && (
          <>
            <div className={s.fields}>
              <NumberField
                label="Un desafío cada tantas preguntas"
                value={questions.challenges.every}
                min={limits.challengeEveryMin ?? 2}
                max={limits.challengeEveryMax ?? 12}
                disabled={saving}
                onChange={every => setGame("questions", { challenges: { ...questions.challenges, every } })}
              />
            </div>
            <PoolPicker
              label="Productos de los desafíos"
              pool={questions.challenges.pool}
              catalog={catalog}
              disabled={saving}
              onChange={pool => setGame("questions", { challenges: { ...questions.challenges, pool } })}
            />
          </>
        )}
      </GameBlock>

      <GameBlock
        title={GAME_COPY.duel.title}
        desc="Compiten entre ellos, cada uno desde su celular: rondas rápidas de preguntas sobre tu carta (precios, categorías, descripciones). Gana quien acierta más y más rápido."
        enabled={duel.enabled}
        onToggle={() => setGame("duel", { enabled: !duel.enabled })}
        disabled={saving}
      >
        <div className={s.fields}>
          <NumberField label="Rondas por partida" value={duel.rounds} min={limits.duelRoundsMin ?? 3} max={limits.duelRoundsMax ?? 10} disabled={saving} onChange={rounds => setGame("duel", { rounds })} />
          <NumberField label="Segundos por ronda" value={duel.seconds} min={limits.duelSecondsMin ?? 8} max={limits.duelSecondsMax ?? 30} disabled={saving} onChange={seconds => setGame("duel", { seconds })} />
        </div>
        <label className={p.field}>
          <span className={p.label}>Premio para quien gana (opcional)</span>
          <input className={p.input} value={duel.prizeText} maxLength={limits.promoLength ?? 140} disabled={saving} placeholder="Ej: un café de regalo" onChange={event => setGame("duel", { prizeText: event.target.value })} />
        </label>
        <PoolPicker label="Productos sobre los que se pregunta" pool={duel.pool} catalog={catalog} disabled={saving} onChange={pool => setGame("duel", { pool })} />
        <p className={s.hint}>Con «Ocultar precios» activado en tu carta, el duelo no pregunta precios.</p>
      </GameBlock>

      <div className={p.switchRow}>
        <div className={p.switchText}>
          <span className={p.switchTitle}>Solo para quien está en el local</span>
          <span className={p.switchHint}>Los juegos aparecen únicamente a quien escaneó el QR de tu local (el de las mesas, de Gestión de pedidos). Apagado, los ve cualquiera que abra tu carta.</span>
        </div>
        <input
          type="checkbox"
          role="switch"
          className={p.switch}
          checked={draft.venueOnly}
          disabled={saving}
          aria-label="Mostrar los juegos solo a quien está en el local"
          onChange={() => change({ ...draft, venueOnly: !draft.venueOnly })}
        />
      </div>

      {error && <p className={p.error} role="alert">{error}</p>}
      <div className={s.actions}>
        <button type="button" className={p.btnPrimary} disabled={saving || !dirty} onClick={save}>
          {saving ? "Guardando…" : "Guardar juegos"}
        </button>
        {saved && !dirty && <span className={s.hint} role="status">Guardado.</span>}
        {dirty && !saving && <span className={s.hint}>Tenés cambios sin guardar.</span>}
      </div>
    </div>
  );
}
