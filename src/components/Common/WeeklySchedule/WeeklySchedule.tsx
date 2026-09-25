import { useState } from "react";
import type { DayKey, TimeRange } from "../../../types";
import {
  ALL_DAY_RANGE,
  DAY_INITIAL,
  DAY_LABEL,
  DAY_PRESETS,
  DEFAULT_RANGE,
  WEEK_DAYS,
  cloneRanges,
  describeWeek,
  isAllDay,
  readWeek,
  writeWeek,
} from "./weekSchedule";
import type { WeekRanges, WeekState } from "./weekSchedule";
import styles from "./WeeklySchedule.module.css";

// Editor semanal estilo "alarma del celular": se carga un horario una sola
// vez y se prenden o apagan los días en los que rige. Los días que necesitan
// otro horario se marcan como excepción sin salir de la pantalla.
//
// Habla el shape plano que ya guardan el backend y el modelo Item
// (`{ mon: [{from,to}], ... }`). El horario de atención del negocio, que
// guarda sus turnos junto a open/close por compatibilidad, lo adapta
// UserEditor.

interface RangeRowProps {
  range: TimeRange;
  idPrefix: string;
  dayLabel: string;
  allDayLabel: string;
  onChange: (next: TimeRange) => void;
  onRemove?: () => void;
}

function RangeRow({ range, idPrefix, dayLabel, allDayLabel, onChange, onRemove }: RangeRowProps) {
  const allDay = isAllDay(range);
  return (
    <div className={styles.rangeRow}>
      <div className={styles.rangeTimes}>
        <input
          type="time"
          id={`${idPrefix}-from`}
          value={range.from}
          disabled={allDay}
          aria-label={`${dayLabel}, desde`}
          onChange={e => onChange({ ...range, from: e.target.value })}
        />
        <span className={styles.rangeSep}>a</span>
        <input
          type="time"
          id={`${idPrefix}-to`}
          value={range.to}
          disabled={allDay}
          aria-label={`${dayLabel}, hasta`}
          onChange={e => onChange({ ...range, to: e.target.value })}
        />
      </div>
      <div className={styles.rangeActions}>
        <button
          type="button"
          className={`${styles.chip} ${allDay ? styles.chipOn : ""}`}
          aria-pressed={allDay}
          onClick={() => onChange(allDay ? { ...DEFAULT_RANGE } : { ...ALL_DAY_RANGE })}
        >
          {allDayLabel}
        </button>
        {onRemove && (
          <button type="button" className={styles.linkBtn} onClick={onRemove}>
            Quitar
          </button>
        )}
      </div>
      {!allDay && range.to < range.from && (
        <p className={styles.rangeNote}>Termina al día siguiente.</p>
      )}
    </div>
  );
}

export interface WeeklyScheduleProps {
  value: WeekRanges;
  onChange: (next: WeekRanges) => void;
  /** Prefijo de ids/aria — único por instancia dentro de la pantalla. */
  idPrefix: string;
  /** Mismo tope que el backend (MAX_RANGES_PER_DAY en utils/itemAvailability.js). */
  maxRangesPerDay?: number;
  timeLabel?: string;
  daysLabel?: string;
  allDayLabel?: string;
  addRangeLabel?: string;
  emptyLabel?: string;
  exceptionLabel?: string;
}

export default function WeeklySchedule({
  value,
  onChange,
  idPrefix,
  maxRangesPerDay = 4,
  timeLabel = "Horario",
  daysLabel = "Días",
  allDayLabel = "Todo el día",
  addRangeLabel = "+ Agregar otro horario",
  emptyLabel = "Elegí al menos un día.",
  exceptionLabel = "Algún día tiene un horario distinto",
}: WeeklyScheduleProps) {
  // El estado arranca del valor recibido y después manda el componente: el
  // padre recibe el shape plano en cada cambio. Para reiniciarlo con otro
  // producto alcanza con un `key` distinto en el punto de uso.
  const [state, setState] = useState<WeekState>(() => readWeek(value));
  const [showExceptions, setShowExceptions] = useState(
    () => Object.keys(readWeek(value).custom).length > 0,
  );

  const apply = (next: WeekState) => {
    setState(next);
    onChange(writeWeek(next));
  };

  const toggleDay = (day: DayKey) => {
    const active = state.active.includes(day)
      ? state.active.filter(d => d !== day)
      : WEEK_DAYS.filter(d => d === day || state.active.includes(d));
    // Apagar un día también descarta su excepción: al volver a prenderlo
    // arranca con el horario general, que es lo que se espera.
    const custom = { ...state.custom };
    if (!active.includes(day)) delete custom[day];
    apply({ ...state, active, custom });
  };

  const applyPreset = (days: DayKey[]) => {
    const alreadyExact = days.length === state.active.length
      && days.every(day => state.active.includes(day));
    apply({
      ...state,
      active: alreadyExact ? [] : days,
      custom: alreadyExact ? {} : Object.fromEntries(
        Object.entries(state.custom).filter(([day]) => days.includes(day as DayKey)),
      ),
    });
  };

  const setRange = (index: number, range: TimeRange, day?: DayKey) => {
    const current = day ? (state.custom[day] ?? state.base) : state.base;
    const next = current.map((item, i) => (i === index ? range : item));
    apply(day
      ? { ...state, custom: { ...state.custom, [day]: next } }
      : { ...state, base: next });
  };

  const addRange = (day?: DayKey) => {
    const current = day ? (state.custom[day] ?? state.base) : state.base;
    const next = [...current, { ...DEFAULT_RANGE }];
    apply(day
      ? { ...state, custom: { ...state.custom, [day]: next } }
      : { ...state, base: next });
  };

  const removeRange = (index: number, day?: DayKey) => {
    const current = day ? (state.custom[day] ?? state.base) : state.base;
    const next = current.filter((_, i) => i !== index);
    apply(day
      ? { ...state, custom: { ...state.custom, [day]: next } }
      : { ...state, base: next });
  };

  const customizeDay = (day: DayKey) =>
    apply({ ...state, custom: { ...state.custom, [day]: cloneRanges(state.base) } });

  const resetDay = (day: DayKey) => {
    const custom = { ...state.custom };
    delete custom[day];
    apply({ ...state, custom });
  };

  const toggleExceptions = () => {
    if (!showExceptions) { setShowExceptions(true); return; }
    setShowExceptions(false);
    apply({ ...state, custom: {} });
  };

  const summary = describeWeek(writeWeek(state));

  return (
    <div className={styles.root}>
      <div className={styles.block}>
        <p className={styles.blockLabel}>{daysLabel}</p>
        <div className={styles.dayPills} role="group" aria-label={daysLabel}>
          {WEEK_DAYS.map(day => {
            const on = state.active.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`${styles.dayPill} ${on ? styles.dayPillOn : ""}`}
                aria-pressed={on}
                aria-label={DAY_LABEL[day]}
                title={DAY_LABEL[day]}
                onClick={() => toggleDay(day)}
              >
                {DAY_INITIAL[day]}
              </button>
            );
          })}
        </div>
        <div className={styles.presets}>
          {DAY_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              className={styles.linkBtn}
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>{timeLabel}</p>
        {state.base.map((range, index) => (
          <RangeRow
            key={index}
            range={range}
            idPrefix={`${idPrefix}-base-${index}`}
            dayLabel={timeLabel}
            allDayLabel={allDayLabel}
            onChange={next => setRange(index, next)}
            onRemove={state.base.length > 1 ? () => removeRange(index) : undefined}
          />
        ))}
        {state.base.length < maxRangesPerDay && (
          <button type="button" className={styles.linkBtn} onClick={() => addRange()}>
            {addRangeLabel}
          </button>
        )}
      </div>

      {state.active.length > 0 && (
        <div className={styles.block}>
          <label className={styles.exceptionToggle}>
            <input type="checkbox" checked={showExceptions} onChange={toggleExceptions} />
            <span>{exceptionLabel}</span>
          </label>

          {showExceptions && (
            <ul className={styles.exceptionList}>
              {state.active.map(day => {
                const ranges = state.custom[day];
                return (
                  <li key={day} className={styles.exceptionRow}>
                    <div className={styles.exceptionHead}>
                      <span className={styles.exceptionDay}>{DAY_LABEL[day]}</span>
                      {ranges
                        ? (
                          <button type="button" className={styles.linkBtn} onClick={() => resetDay(day)}>
                            Usar el horario general
                          </button>
                        )
                        : (
                          <button type="button" className={styles.linkBtn} onClick={() => customizeDay(day)}>
                            Cambiar
                          </button>
                        )}
                    </div>
                    {ranges
                      ? (
                        <>
                          {ranges.map((range, index) => (
                            <RangeRow
                              key={index}
                              range={range}
                              idPrefix={`${idPrefix}-${day}-${index}`}
                              dayLabel={DAY_LABEL[day]}
                              allDayLabel={allDayLabel}
                              onChange={next => setRange(index, next, day)}
                              onRemove={ranges.length > 1 ? () => removeRange(index, day) : undefined}
                            />
                          ))}
                          {ranges.length < maxRangesPerDay && (
                            <button type="button" className={styles.linkBtn} onClick={() => addRange(day)}>
                              {addRangeLabel}
                            </button>
                          )}
                        </>
                      )
                      : <p className={styles.exceptionSame}>Mismo horario general</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className={styles.summary}>
        {summary.length === 0
          ? <p className={styles.summaryEmpty}>{emptyLabel}</p>
          : summary.map(line => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}
