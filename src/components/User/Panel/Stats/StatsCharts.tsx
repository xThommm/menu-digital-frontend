import { useState, type ReactNode } from "react";
import DataTable from "../../../Common/DataTable/DataTable";
import s from "./UserStats.module.css";
import { parseLocalDate } from "./statsInsights";
import { niceMax } from "./salesReport";
import { formatDay, formatDayLong, formatPercent } from "./statsFormat";

// Piezas de gráfico compartidas por Visitas, Ventas y Caja. Sin librería: son
// barras en CSS, con el detalle exacto en un tooltip y en una tabla.

export interface DailyPoint {
  date: string;
  value: number;
}

// Tres marcas (tope, mitad y cero) alcanzan para leer la altura de una barra
// sin llenar el gráfico de líneas.
function YAxis({ max, format }: { max: number; format: (value: number) => string }) {
  return (
    <div className={s.yAxis} aria-hidden>
      <span>{format(max)}</span>
      <span>{format(max / 2)}</span>
      <span>{format(0)}</span>
    </div>
  );
}

function GridLines() {
  return (
    <>
      <span className={s.gridLine} style={{ bottom: "100%" }} aria-hidden />
      <span className={s.gridLine} style={{ bottom: "50%" }} aria-hidden />
    </>
  );
}

export function DailyChart({ days, previousDays, average, format, formatAxis, noun, valueHeader, detailLabel }: {
  days: DailyPoint[];
  // Mismo largo que `days`, día por día (el 1.º con el 1.º). null sin base
  // de comparación: antes del alta serían ceros que no son datos.
  previousDays: DailyPoint[] | null;
  average: number;
  format: (value: number) => string;
  formatAxis: (value: number) => string;
  // Sustantivo que acompaña al valor ("visita"/"visitas"); vacío si el formato ya lo dice (plata).
  noun: (value: number) => string;
  valueHeader: string;
  detailLabel: string;
}) {
  // Un índice activo en vez del atributo `title` nativo: `title` no existe en
  // touch, así que en el celular —que es donde el dueño mira esto— el detalle
  // de cada día no se podía ver. Con estado, el mismo tooltip sirve para
  // mouse y para tap.
  const [active, setActive] = useState<number | null>(null);
  const previous = previousDays && previousDays.length === days.length ? previousDays : null;
  const max = niceMax(Math.max(0, ...days.map(d => d.value), ...(previous ?? []).map(d => d.value)));
  const shown = active !== null ? days[active] : null;
  const shownPrevious = active !== null ? previous?.[active] : undefined;
  const withNoun = (value: number) => [format(value), noun(value)].filter(Boolean).join(" ");

  return (
    <div className={s.chartBlock}>
      <div className={s.chartFrame}>
        <YAxis max={max} format={formatAxis} />
        <div
          className={s.chart}
          role="group"
          aria-label={`${valueHeader} por día de los últimos ${days.length} días. El detalle está en la tabla siguiente.`}
          onMouseLeave={() => setActive(null)}
        >
          <GridLines />
          {/* Línea de promedio: da una referencia para leer cada barra como
              "arriba" o "abajo" de lo normal, en vez de solo alta o baja. */}
          {average > 0 && (
            <span
              className={s.averageLine}
              style={{ bottom: `${Math.min((average / max) * 100, 100)}%` }}
              aria-hidden
            >
              <small>prom. {format(Math.round(average * 10) / 10)}</small>
            </span>
          )}

          {days.map((d, i) => {
            const weekday = parseLocalDate(d.date)?.getUTCDay();
            const isWeekend = weekday === 0 || weekday === 6;
            const height = d.value > 0 ? Math.max((d.value / max) * 100, 4) : 2;
            const before = previous?.[i];
            return (
              <button
                type="button"
                key={d.date}
                aria-label={`${formatDayLong(d.date)}: ${withNoun(d.value)}${
                  before ? `; ${format(before.value)} el ${formatDayLong(before.date)}` : ""}`}
                aria-pressed={active === i}
                className={[s.barWrap, active === i ? s.barWrapActive : ""].join(" ").trim()}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}
                onClick={() => setActive(i)}
              >
                <span
                  className={[s.bar, d.value === 0 ? s.barEmpty : "", isWeekend ? s.barWeekend : ""].join(" ").trim()}
                  style={{ height: `${height}%`, animationDelay: `${i * 14}ms` }}
                />
                {/* Marca del mismo día del período anterior: una raya en vez
                    de otra barra, para que 30 pares entren en un celular y la
                    lectura sea "arriba o abajo de la raya". */}
                {before && before.value > 0 && (
                  <span
                    className={s.barPrevious}
                    style={{ bottom: `${Math.min((before.value / max) * 100, 100)}%` }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}

          {shown && active !== null && (
            <div
              className={s.tooltip}
              aria-hidden="true"
              // Se ancla en la barra y se corre en la misma proporción: centrado
              // en el medio, pegado al borde en los extremos. Nunca se sale de
              // la tarjeta, sea cual sea su ancho.
              style={{
                left: `${((active + 0.5) / days.length) * 100}%`,
                transform: `translateX(-${((active + 0.5) / days.length) * 100}%)`,
              }}
            >
              <span className={s.tooltipMain}>
                <strong>{format(shown.value)}</strong>
                {noun(shown.value) && <span>{noun(shown.value)}</span>}
                <small>{formatDayLong(shown.date)}</small>
              </span>
              {shownPrevious && (
                <small className={s.tooltipPrevious}>
                  {format(shownPrevious.value)} el {formatDay(shownPrevious.date)}
                </small>
              )}
            </div>
          )}
        </div>

        <div className={s.chartAxis}>
          <span>{formatDay(days[0]?.date)}</span>
          {previous && (
            <span className={s.chartLegend}>
              <i className={s.legendPrevious} aria-hidden /> Mismo día del período anterior
            </span>
          )}
          <span>{formatDay(days.at(-1)?.date)}</span>
        </div>
      </div>

      <details className={s.dailyDetails}>
        <summary>{detailLabel}</summary>
        <DataTable<{ day: DailyPoint; previous?: DailyPoint }>
          caption={`${valueHeader} por día de los últimos ${days.length} días`}
          rows={days.map((day, i) => ({ day, previous: previous?.[i] }))}
          columns={[
            { id: "day", header: "Día", resizable: false, sortValue: row => row.day.date, render: row => <span className={s.nowrap}>{formatDayLong(row.day.date)}</span> },
            { id: "value", header: valueHeader, align: "right", resizable: false, initialDirection: "desc", sortValue: row => row.day.value, render: row => format(row.day.value) },
            ...(previous ? [{
              id: "previous",
              // Corto: en el celular el encabezado (sin cortes) le robaba el ancho al día.
              header: "Anterior",
              align: "right" as const,
              resizable: false,
              initialDirection: "desc" as const,
              sortValue: (row: { previous?: DailyPoint }) => row.previous?.value,
              render: (row: { previous?: DailyPoint }) => (row.previous ? `${format(row.previous.value)} (${formatDay(row.previous.date)})` : "—"),
            }] : []),
          ]}
          getRowId={row => row.day.date}
        />
      </details>
    </div>
  );
}

// ── 24 horas ──────────────────────────────────────────────────────────────────

const HOUR_TICKS = [0, 6, 12, 18, 23];

export function HourBars({ values, peakStart, format, label }: {
  values: number[];
  // Primera hora de la franja pico de 3 horas; null si no hay una para marcar.
  peakStart: number | null;
  format: (value: number) => string;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const inPeak = (hour: number) => peakStart !== null && (hour - peakStart + 24) % 24 < 3;

  return (
    <div className={s.chartBlock}>
      <div className={s.hourChart} role="group" aria-label={label} onMouseLeave={() => setActive(null)}>
        {values.map((value, hour) => (
          <button
            type="button"
            key={hour}
            className={`${s.hourCol} ${active === hour ? s.barWrapActive : ""}`}
            aria-label={`${hour} a ${(hour + 1) % 24} h: ${format(value)}`}
            aria-pressed={active === hour}
            onMouseEnter={() => setActive(hour)}
            onFocus={() => setActive(hour)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}
            onClick={() => setActive(hour)}
          >
            <span
              className={`${s.hourBar} ${inPeak(hour) ? s.hourBarPeak : ""} ${value === 0 ? s.barEmpty : ""}`}
              style={{ height: `${value > 0 ? Math.max((value / max) * 100, 6) : 3}%` }}
            />
          </button>
        ))}
        {active !== null && (
          <div
            className={s.tooltip}
            aria-hidden="true"
            style={{
              left: `${((active + 0.5) / 24) * 100}%`,
              transform: `translateX(-${((active + 0.5) / 24) * 100}%)`,
            }}
          >
            <span className={s.tooltipMain}>
              <strong>{format(values[active])}</strong>
              <small>{active} a {(active + 1) % 24} h</small>
            </span>
          </div>
        )}
      </div>
      <div className={s.hourAxis} aria-hidden>
        {HOUR_TICKS.map(hour => (
          <span key={hour} style={{ gridColumn: hour + 1 }}>{hour} h</span>
        ))}
      </div>
    </div>
  );
}

// ── Lista de barras ───────────────────────────────────────────────────────────

export interface BarListRow {
  key: string;
  label: string;
  value: number;
  // Texto chico a la derecha, bajo el valor ("12 pedidos").
  detail?: string;
  // Texto chico bajo el nombre ("Pizzas · Grande").
  hint?: string;
}

/**
 * Partes de un total, de mayor a menor, cada una con su barra y su porcentaje.
 * Para repartos de pocas categorías (canales, operadores) se lee mejor que
 * una torta: las barras comparten base y el porcentaje está escrito.
 */
export function BarList({ rows, format, total, ranked = false }: {
  rows: BarListRow[];
  format: (value: number) => string;
  // Base del porcentaje; sin total no se muestra.
  total?: number;
  ranked?: boolean;
}) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return (
    <ol className={`${s.barList} ${ranked ? s.barListRanked : ""}`}>
      {rows.map((row, i) => (
        <li key={row.key} className={s.barListRow}>
          {ranked && <span className={s.topItemRank}>{i + 1}</span>}
          <div className={s.topItemMain}>
            <span className={s.barListLabel}>
              <span className={s.topItemName}>{row.label}</span>
              {row.hint && <small>{row.hint}</small>}
            </span>
            <span className={s.topItemBarWrap}>
              <span className={s.topItemBar} style={{ width: `${row.value > 0 ? Math.max((row.value / max) * 100, 2) : 0}%` }} />
            </span>
          </div>
          <span className={s.topItemCount}>
            {format(row.value)}
            {total !== undefined && total > 0 && <small>{formatPercent(row.value / total)}</small>}
            {row.detail && <small>{row.detail}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  // Texto chico junto al porcentaje en la leyenda ("86 pedidos").
  detail?: string;
  // Color propio (una variable CSS) para estados; sin él se usa la paleta por orden.
  color?: string;
}

// Cuatro tonos como máximo: es lo que la paleta distingue bien entre vecinos
// (también con daltonismo). Lo que sobra se junta en "Otras", en gris.
const DONUT_SLOTS = 4;
const DONUT_RADIUS = 42;

/**
 * Partes de un total. Cada porción tiene su fila en la leyenda con nombre,
 * valor y porcentaje, así el color nunca es lo único que la identifica. Con
 * `onSelect`, porciones y filas funcionan como filtro.
 */
export function Donut({ slices, format, centerLabel, selectedKey, onSelect, label }: {
  slices: DonutSlice[];
  format: (value: number) => string;
  centerLabel: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  label: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const positive = slices.filter(slice => slice.value > 0);
  const head = positive.slice(0, DONUT_SLOTS);
  const rest = positive.slice(DONUT_SLOTS);
  const shown: (DonutSlice & { tone: string })[] = [
    ...head.map((slice, i) => ({ ...slice, tone: slice.color ?? `var(--viz-${i + 1})` })),
    ...(rest.length > 0 ? [{
      key: "__rest",
      label: rest.length === 1 ? rest[0].label : "Otras",
      value: rest.reduce((sum, slice) => sum + slice.value, 0),
      tone: "var(--viz-rest)",
    }] : []),
  ];
  const total = shown.reduce((sum, slice) => sum + slice.value, 0);
  const activeKey = hovered ?? selectedKey ?? null;
  const active = shown.find(slice => slice.key === activeKey);
  // Separación entre porciones, en la misma unidad que pathLength (100 = vuelta entera).
  const gap = shown.length > 1 ? 1.4 : 0;
  const starts = shown.map((_, i) => shown.slice(0, i).reduce((sum, slice) => sum + (slice.value / total) * 100, 0));
  const selectable = (key: string) => !!onSelect && key !== "__rest";

  if (total === 0) return <p className={s.cardNote}>Sin datos en este período.</p>;

  return (
    <div className={s.donut}>
      <div className={s.donutFigure}>
        <svg viewBox="0 0 100 100" role="img" aria-label={label}>
          {shown.map((slice, i) => {
            const dash = Math.max((slice.value / total) * 100 - gap, 0.6);
            return (
              <circle
                key={slice.key}
                className={`${s.donutSlice} ${activeKey && activeKey !== slice.key ? s.donutSliceDim : ""} ${selectable(slice.key) ? s.donutSliceLink : ""}`}
                cx="50" cy="50" r={DONUT_RADIUS} pathLength={100}
                stroke={slice.tone}
                strokeDasharray={`${dash} ${100 - dash}`}
                strokeDashoffset={-(starts[i] + gap / 2)}
                onMouseEnter={() => setHovered(slice.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={selectable(slice.key) ? () => onSelect?.(slice.key) : undefined}
              />
            );
          })}
        </svg>
        <div className={s.donutCenter} aria-hidden>
          <strong>{active ? formatPercent(active.value / total) : format(total)}</strong>
          <span>{active ? active.label : centerLabel}</span>
        </div>
      </div>
      <ul className={s.donutLegend}>
        {shown.map((slice) => {
          const content = (
            <>
              <i style={{ background: slice.tone }} aria-hidden />
              <span className={s.donutName}>{slice.label}</span>
              <span className={s.donutValue}>
                {format(slice.value)}
                <small>{formatPercent(slice.value / total)}{slice.detail ? ` · ${slice.detail}` : ""}</small>
              </span>
            </>
          );
          return (
            <li
              key={slice.key}
              className={activeKey && activeKey !== slice.key ? s.donutRowDim : ""}
              onMouseEnter={() => setHovered(slice.key)}
              onMouseLeave={() => setHovered(null)}
            >
              {selectable(slice.key)
                ? <button type="button" aria-pressed={selectedKey === slice.key} onClick={() => onSelect?.(slice.key)}>{content}</button>
                : <div>{content}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Anillo (una proporción contra su tope) ────────────────────────────────────

export function Ring({ value, children, label, size = "md" }: {
  // 0 a 1; se recorta a ese rango.
  value: number;
  children: ReactNode;
  label: string;
  size?: "md" | "lg";
}) {
  const share = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div className={`${s.ring} ${size === "lg" ? s.ringLg : ""}`}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle className={s.ringTrack} cx="50" cy="50" r="44" />
        {share > 0 && (
          <circle className={s.ringFill} cx="50" cy="50" r="44" pathLength={100} strokeDasharray={`${share} ${100 - share}`} />
        )}
      </svg>
      <div className={s.ringCenter}>{children}</div>
    </div>
  );
}

// ── Encabezado con la cifra principal ─────────────────────────────────────────

// Curva suave por los puntos: cada tramo usa el punto medio como control.
function sparkPath(values: number[]) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values.map((value, i) => [(i / (values.length - 1)) * 100, 36 - (value / max) * 30] as const);
  let line = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mid = (x0 + x1) / 2;
    line += ` C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`;
  }
  return { line, area: `${line} L 100 40 L 0 40 Z` };
}

export interface HeroStat {
  label: string;
  value: string;
  trend?: number | null;
}

/**
 * La cifra del período en grande, con sus datos de apoyo en una línea y la
 * forma de la serie de fondo. `aside` es el bloque de la derecha (hoy).
 */
export function Hero({ label, value, trend, foot, stats, series, aside }: {
  label: string;
  value: string;
  trend?: number | null;
  foot: string;
  stats: HeroStat[];
  // Serie diaria, solo como forma decorativa: el gráfico con ejes está abajo.
  series: number[];
  aside?: ReactNode;
}) {
  const spark = sparkPath(series);
  return (
    <section className={s.hero} aria-label={label}>
      {spark && (
        <svg className={s.heroSpark} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <path className={s.heroSparkArea} d={spark.area} />
          <path className={s.heroSparkLine} d={spark.line} />
        </svg>
      )}
      <div className={s.heroMain}>
        <p className={s.heroLabel}>{label}</p>
        <p className={s.heroValue}>
          {value}
          {typeof trend === "number" && <TrendPill trend={trend} />}
        </p>
        <p className={s.heroFoot}>{foot}</p>
        <dl className={s.heroStats}>
          {stats.map(stat => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>
                {stat.value}
                {typeof stat.trend === "number" && <TrendPill trend={stat.trend} small />}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {aside && <div className={s.heroAside}>{aside}</div>}
    </section>
  );
}

function TrendPill({ trend, small }: { trend: number; small?: boolean }) {
  return (
    <span className={`${s.trendPill} ${small ? s.trendPillSmall : ""} ${trend > 0 ? s.trendUp : trend < 0 ? s.trendDown : ""}`}>
      {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}%
    </span>
  );
}
