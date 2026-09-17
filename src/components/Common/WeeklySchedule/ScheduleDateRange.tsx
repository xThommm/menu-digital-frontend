import { useState } from "react";
import { EMPTY_DATE_RANGE, hasDateRange } from "./weekSchedule";
import type { DateRangeValue } from "./weekSchedule";
import styles from "./WeeklySchedule.module.css";

// Rango de fechas opcional de una programación de producto. Vacío = la
// programación rige siempre; con fechas, solo se aplica entre ellas.

interface ScheduleDateRangeProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  idPrefix: string;
  label?: string;
  hint?: string;
}

export default function ScheduleDateRange({
  value,
  onChange,
  idPrefix,
  label = "Solo entre estas fechas",
  hint = "Opcional. Fuera de estas fechas la programación no se aplica.",
}: ScheduleDateRangeProps) {
  const [open, setOpen] = useState(() => hasDateRange(value));

  return (
    <div className={styles.block}>
      <label className={styles.exceptionToggle}>
        <input
          type="checkbox"
          checked={open}
          onChange={() => {
            if (open) onChange({ ...EMPTY_DATE_RANGE });
            setOpen(!open);
          }}
        />
        <span>{label}</span>
      </label>

      {open
        ? (
          <div className={styles.dateFields}>
            <div className={styles.dateField}>
              <label htmlFor={`${idPrefix}-date-from`}>Desde</label>
              <input
                id={`${idPrefix}-date-from`}
                type="date"
                value={value.from}
                max={value.to || undefined}
                onChange={e => onChange({ ...value, from: e.target.value })}
              />
            </div>
            <div className={styles.dateField}>
              <label htmlFor={`${idPrefix}-date-to`}>Hasta</label>
              <input
                id={`${idPrefix}-date-to`}
                type="date"
                value={value.to}
                min={value.from || undefined}
                onChange={e => onChange({ ...value, to: e.target.value })}
              />
            </div>
            <p className={styles.dateHint}>
              Podés completar solo una: sin fecha de fin la programación sigue
              vigente, y sin fecha de inicio arranca enseguida.
            </p>
          </div>
        )
        : <p className={styles.dateHint}>{hint}</p>}
    </div>
  );
}
