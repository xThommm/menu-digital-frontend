import { useId, useState } from "react";
import { ArrowUpRight, CalendarCheck, ClipboardList, Ellipsis, Lock } from "lucide-react";
import Cobweb from "../../../Halloween/Cobweb";
import type { Order } from "../../../../features/orders/types";
import type { OwnerReservation } from "../../../../features/reservations/types";
import { STATUS_LABEL, elapsedLabel, formatMoney, formatTime, placeLabel } from "../../../../features/orders/lib/format";
import { formatPeople } from "../../../../features/reservations/lib/format";
import { formatCount, type OrdersSummary, type ReservationsSummary, type VisitsSummary } from "./todayActivity";
import { useCountUp } from "./useCountUp";
import s from "./UserDashboard.module.css";

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

// ── KPI del encabezado ────────────────────────────────────────────────────────

export interface Kpi {
  key: string;
  icon: React.ReactNode;
  label: string;
  // undefined = cargando; null = no aplica (se muestra "—").
  value: number | null | undefined;
  suffix?: string;
  onClick?: () => void;
}

export function KpiStat({ icon, label, value, suffix, onClick }: Omit<Kpi, "key">) {
  const shown = useCountUp(value ?? undefined);
  const content = (
    <>
      <span className={s.kpiValue}>
        {value === undefined
          ? <span className={s.kpiSkeleton} aria-hidden />
          : value === null ? "—" : formatCount(shown)}
        {suffix && value !== undefined && value !== null && <small>{suffix}</small>}
      </span>
      <span className={s.kpiLabel}>
        <span className={s.kpiIcon}>{icon}</span>
        {label}
      </span>
    </>
  );
  return onClick
    ? <button type="button" className={`${s.kpi} ${s.kpiLink}`} onClick={onClick} aria-busy={value === undefined}>{content}</button>
    : <div className={s.kpi}>{content}</div>;
}

// ── Medidor (arco de 270°, como un velocímetro) ───────────────────────────────

const GAUGE = { cx: 100, cy: 100, r: 76, start: 135, sweep: 270 };

function polar(angle: number, radius = GAUGE.r) {
  const rad = (angle * Math.PI) / 180;
  return { x: GAUGE.cx + radius * Math.cos(rad), y: GAUGE.cy + radius * Math.sin(rad) };
}

const ARC_START = polar(GAUGE.start);
const ARC_END = polar(GAUGE.start + GAUGE.sweep);
const ARC_PATH = `M ${ARC_START.x} ${ARC_START.y} A ${GAUGE.r} ${GAUGE.r} 0 1 1 ${ARC_END.x} ${ARC_END.y}`;
const GAUGE_TICKS = [0, 20, 40, 60, 80, 100];

export function Gauge({ value, title, caption }: { value: number; title: string; caption: string }) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const percent = Math.round(clamped * 100);
  const shown = useCountUp(percent, 1200);
  const knob = polar(GAUGE.start + GAUGE.sweep * clamped);

  return (
    <figure className={s.gauge} aria-label={`${title}: ${percent}%. ${caption}`}>
      <svg viewBox="0 0 200 172" className={s.gaugeSvg} aria-hidden>
        <path d={ARC_PATH} className={s.gaugeTrack} pathLength={100} />
        <path
          d={ARC_PATH}
          className={s.gaugeValue}
          pathLength={100}
          strokeDasharray={`${percent} 100`}
        />
        {GAUGE_TICKS.map(tick => {
          const point = polar(GAUGE.start + GAUGE.sweep * (tick / 100), GAUGE.r + 18);
          return (
            <text key={tick} x={point.x} y={point.y} className={s.gaugeTick} textAnchor="middle" dominantBaseline="middle">
              {tick}
            </text>
          );
        })}
        <circle cx={knob.x} cy={knob.y} r={8} className={s.gaugeKnob} />
      </svg>
      <figcaption className={s.gaugeCenter}>
        <strong>{shown}%</strong>
        <span>{title}</span>
      </figcaption>
      <p className={s.gaugeCaption}>{caption}</p>
    </figure>
  );
}

// ── Botones chicos de las tarjetas ────────────────────────────────────────────

export function MoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={s.moreBtn} onClick={onClick} aria-label={label} title={label}>
      <Ellipsis size={16} strokeWidth={2} />
    </button>
  );
}

export function GoButton({ label, onClick, light }: { label: string; onClick: () => void; light?: boolean }) {
  return (
    <button type="button" className={`${s.goBtn} ${light ? s.goBtnLight : ""}`} onClick={onClick} aria-label={label} title={label}>
      <ArrowUpRight size={16} strokeWidth={1.75} />
    </button>
  );
}

// ── Agenda: reservas y pedidos de hoy ─────────────────────────────────────────

const RESERVATION_STATUS: Partial<Record<OwnerReservation["status"], string>> = {
  pending: "Por confirmar",
  confirmed: "Confirmada",
};

interface AgendaCardProps {
  dateLabel: string;
  reservations: ReservationsSummary | null | undefined;
  orders: OrdersSummary | null | undefined;
  onOpenReservations: () => void;
  onOpenOrders: () => void;
}

type AgendaTab = "reservas" | "pedidos";

export function AgendaCard({ dateLabel, reservations, orders, onOpenReservations, onOpenOrders }: AgendaCardProps) {
  const [tab, setTab] = useState<AgendaTab>("reservas");
  const open = tab === "reservas" ? onOpenReservations : onOpenOrders;
  const loading = tab === "reservas" ? reservations === undefined : orders === undefined;

  return (
    <section className={`${s.card} ${s.agendaCard}`} aria-label="Agenda de hoy">
      <header className={s.agendaHeader}>
        <span className={s.datePill}>{dateLabel}</span>
        <h2 className={s.cardTitle}>Agenda</h2>
        <MoreButton label={tab === "reservas" ? "Ir a reservas" : "Ir a pedidos"} onClick={open} />
      </header>

      <div className={s.tabs} role="tablist" aria-label="Qué mostrar">
        {(["reservas", "pedidos"] as const).map(key => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`${s.tab} ${tab === key ? s.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {key === "reservas" ? "Reservas" : "Pedidos"}
            <span className={s.tabCount}>
              {key === "reservas" ? reservations?.list.length ?? 0 : orders?.list.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className={s.agendaList} role="tabpanel">
        {loading ? (
          <>
            <span className={s.agendaSkeleton} aria-hidden />
            <span className={s.agendaSkeleton} aria-hidden />
          </>
        ) : tab === "reservas" ? (
          reservations && reservations.list.length > 0
            ? reservations.list.map((reservation, index) => (
              <AgendaItem
                key={reservation.id}
                featured={index === 0}
                title={reservation.name}
                subtitle={[formatPeople(reservation.partySize), reservation.tableLabel && `Mesa ${reservation.tableLabel}`]
                  .filter(Boolean).join(" · ")}
                chips={[`${reservation.time} hs`, RESERVATION_STATUS[reservation.status] ?? ""]}
                alert={reservation.status === "pending"}
                onClick={onOpenReservations}
              />
            ))
            : <AgendaEmpty icon={<CalendarCheck size={18} strokeWidth={1.5} />} text="No hay reservas para hoy." />
        ) : orders && orders.list.length > 0 ? (
          orders.list.map((order, index) => (
            <AgendaItem
              key={order.id}
              featured={index === 0}
              title={`Pedido #${order.number}`}
              subtitle={[placeLabel(order), order.customerName].filter(Boolean).join(" · ")}
              chips={[STATUS_LABEL[order.status], elapsedLabel(order.createdAt)]}
              alert={order.status === "pending"}
              onClick={onOpenOrders}
            />
          ))
        ) : (
          <AgendaEmpty
            icon={<ClipboardList size={18} strokeWidth={1.5} />}
            text={orders && !orders.shiftOpen ? "No hay un turno abierto." : "No hay pedidos en curso."}
          />
        )}
      </div>
    </section>
  );
}

interface AgendaItemProps {
  featured: boolean;
  title: string;
  subtitle: string;
  chips: string[];
  alert: boolean;
  onClick: () => void;
}

function AgendaItem({ featured, title, subtitle, chips, alert, onClick }: AgendaItemProps) {
  return (
    <article className={`${s.agendaItem} ${featured ? s.agendaItemFeatured : ""}`}>
      <div className={s.agendaItemTop}>
        <div className={s.agendaItemText}>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <GoButton label={`Abrir ${title}`} onClick={onClick} light={!featured} />
      </div>
      <div className={s.agendaChips}>
        {chips.filter(Boolean).map((chip, index) => (
          <span key={chip} className={`${s.chip} ${alert && index === 1 ? s.chipAlert : ""}`}>{chip}</span>
        ))}
      </div>
    </article>
  );
}

function AgendaEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className={s.agendaEmpty}>
      <span className={s.agendaEmptyIcon}>{icon}</span>
      {text}
    </div>
  );
}

// ── Visitas de la semana (gráfico de línea) ───────────────────────────────────

const CHART = { w: 300, h: 120, top: 10 };
const weekdayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" });

function weekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const label = weekdayFormatter.format(new Date(Date.UTC(year, month - 1, day))).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function VisitsChartCard({ visits, onOpen }: { visits: VisitsSummary | undefined; onOpen: () => void }) {
  // useId trae caracteres que no sirven dentro de url(#…).
  const gradientId = `visits-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const week = useCountUp(visits?.week);
  const series = visits?.series ?? [];
  const max = Math.max(...series, 1);
  const step = series.length > 1 ? CHART.w / (series.length - 1) : CHART.w;
  const points = series.map((value, index) => ({
    x: index * step,
    y: CHART.top + (CHART.h - CHART.top) * (1 - value / max),
  }));
  const line = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <section className={`${s.card} ${s.chartCard}`} aria-label="Visitas de la semana">
      <Cobweb corner="tr" size={64} />
      <header className={s.chartHeader}>
        <div>
          <p className={s.chartValue}>
            {visits ? formatCount(week) : <span className={s.kpiSkeleton} aria-hidden />}
            {visits && visits.delta !== null && visits.delta !== 0 && (
              <span className={visits.delta > 0 ? s.trendUp : s.trendDown}>
                {visits.delta > 0 ? "▲" : "▼"} {Math.abs(visits.delta)}%
              </span>
            )}
          </p>
          <p className={s.chartLabel}>Visitas a la carta · últimos 7 días</p>
        </div>
        <GoButton label="Ver estadísticas" onClick={onOpen} light />
      </header>

      <div className={s.chartArea}>
        {visits && points.length > 1 && (
          <>
            <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} preserveAspectRatio="none" className={s.chartSvg} aria-hidden>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map(fraction => (
                <line
                  key={fraction}
                  x1={0} x2={CHART.w}
                  y1={CHART.top + (CHART.h - CHART.top) * fraction}
                  y2={CHART.top + (CHART.h - CHART.top) * fraction}
                  className={s.chartGrid}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <polygon
                className={s.chartFill}
                points={`0,${CHART.h} ${line} ${CHART.w},${CHART.h}`}
                fill={`url(#${gradientId})`}
              />
              <polyline
                className={s.chartLine}
                points={line}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {/* El punto va en HTML: dentro del SVG estirado quedaría ovalado. */}
            <span
              className={s.chartDot}
              style={{ left: "100%", top: `${(last.y / CHART.h) * 100}%` }}
              aria-hidden
            />
          </>
        )}
        {!visits && <span className={s.chartSkeleton} aria-hidden />}
      </div>

      <div className={s.chartAxis} aria-hidden>
        {(visits?.dates ?? []).map(date => <span key={date}>{weekday(date)}</span>)}
      </div>
    </section>
  );
}

export function LockedChartCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section className={`${s.card} ${s.chartCard} ${s.lockedCard}`} aria-label="Estadísticas">
      <div className={s.lockedGhost} aria-hidden>
        <svg viewBox="0 0 300 120" preserveAspectRatio="none">
          <polyline points="0,96 50,80 100,88 150,52 200,64 250,30 300,40" fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className={s.lockedContent}>
        <span className={s.lockedIcon}><Lock size={18} strokeWidth={1.75} /></span>
        <h2 className={s.cardTitle}>Mirá quién abre tu carta</h2>
        <p>Visitas por día, productos más vistos y cuántos llegan por el QR.</p>
        <button type="button" className={s.primaryBtn} onClick={onUpgrade}>Mejorar plan</button>
      </div>
    </section>
  );
}

// ── Estado de los pedidos (barras) ────────────────────────────────────────────

export function OrdersBarsCard({ orders, onOpen }: { orders: OrdersSummary | undefined; onOpen: () => void }) {
  const active = useCountUp(orders?.active);
  const bars = [
    { key: "pending", label: "Por confirmar", value: orders?.pending ?? 0, tone: s.barAccent },
    { key: "confirmed", label: "En cocina", value: orders?.confirmed ?? 0, tone: s.barStrong },
    { key: "ready", label: "Listos", value: orders?.ready ?? 0, tone: s.barSoft },
  ];
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const max = Math.max(...bars.map(bar => bar.value), 1);

  return (
    <section className={`${s.card} ${s.barsCard}`} aria-label="Estado de los pedidos">
      <header className={s.barsHeader}>
        <h2 className={s.cardTitle}>Estado de pedidos</h2>
        <MoreButton label="Ir a gestión de pedidos" onClick={onOpen} />
      </header>
      <p className={s.barsTotal}>
        <strong>{orders ? formatCount(active) : "—"}</strong>
        <span>{orders && !orders.shiftOpen ? "Sin turno abierto" : "Pedidos en curso"}</span>
      </p>
      <div className={s.bars}>
        {bars.map((bar, index) => {
          const share = total > 0 ? bar.value / total : 0;
          return (
            <div key={bar.key} className={s.barCol}>
              <div
                className={`${s.bar} ${bar.tone}`}
                style={{ height: `${28 + (bar.value / max) * 72}%`, animationDelay: `${0.2 + index * 0.08}s` }}
              >
                <span className={s.barBubble}>{total > 0 ? formatPercent(share) : "0"}</span>
                <span className={s.barLabel}>
                  <strong>{bar.value}</strong>
                  {bar.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Accesos rápidos (fila de tarjetas chicas) ─────────────────────────────────

interface QuickTileProps {
  label: string;
  value: string;
  action: string;
  onClick: () => void;
  alert?: boolean;
}

export function QuickTile({ label, value, action, onClick, alert }: QuickTileProps) {
  return (
    <button type="button" className={`${s.quickTile} ${alert ? s.quickTileAlert : ""}`} onClick={onClick}>
      <span className={s.quickDot} aria-hidden />
      <span className={s.quickLabel}>{label}</span>
      <strong className={s.quickValue}>{value}</strong>
      <span className={s.quickFooter}>
        {action}
        <span className={s.quickArrow} aria-hidden><ArrowUpRight size={14} strokeWidth={1.75} /></span>
      </span>
    </button>
  );
}

// ── Tabla de pedidos en curso ─────────────────────────────────────────────────

const STATUS_TONE: Partial<Record<Order["status"], string>> = {
  pending: s.statusPending,
  confirmed: s.statusConfirmed,
  ready: s.statusReady,
};

export function OrdersTable({ orders, onOpen }: { orders: OrdersSummary | undefined; onOpen: () => void }) {
  return (
    <section className={`${s.card} ${s.tableCard}`} aria-label="Pedidos en curso">
      <header className={s.tableHeader}>
        <h2 className={s.cardTitle}>Pedidos en curso</h2>
        <button type="button" className={s.ghostBtn} onClick={onOpen}>
          Ver todos
          <ArrowUpRight size={14} strokeWidth={1.75} />
        </button>
      </header>
      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Lugar</th>
              <th scope="col">Cliente</th>
              <th scope="col">Productos</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
              <th scope="col">Hora</th>
              <th scope="col"><span className="sr-only">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            {orders === undefined ? (
              <tr><td colSpan={8}><span className={s.agendaSkeleton} aria-hidden /></td></tr>
            ) : orders.list.length === 0 ? (
              <tr>
                <td colSpan={8} className={s.tableEmpty}>
                  {orders.shiftOpen
                    ? "No hay pedidos en curso."
                    : "No hay un turno abierto. Abrilo desde Gestión de pedidos para empezar a recibir pedidos."}
                </td>
              </tr>
            ) : orders.list.map(order => (
              <tr key={order.id}>
                <td className={s.tableStrong}>#{order.number}</td>
                <td>{placeLabel(order)}</td>
                <td>{order.customerName || order.waiterName || "—"}</td>
                <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td className={s.tableStrong}>{formatMoney(order.total)}</td>
                <td>
                  <span className={`${s.statusPill} ${STATUS_TONE[order.status] ?? ""}`}>{STATUS_LABEL[order.status]}</span>
                </td>
                <td>{formatTime(order.createdAt)}</td>
                <td className={s.tableAction}>
                  <MoreButton label={`Abrir pedido #${order.number}`} onClick={onOpen} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
