import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { listOrders } from "../../../../features/orders/api/ordersApi";
import type { Order, OrderStatus } from "../../../../features/orders/types";
import type { OwnerReservation, ReservationStatus } from "../../../../features/reservations/types";
import { STATUS_LABEL, elapsedLabel, formatTime, placeLabel } from "../../../../features/orders/lib/format";
import { STATUS_LABEL as RESERVATION_LABEL, addDays, formatPeople, formatReservationDate } from "../../../../features/reservations/lib/format";
import {
  addMonths, dayOfMonth, dayRangeBuenosAires, formatMonth, monthGrid, weekDays,
} from "./agendaCalendar";
import { GoButton, MoreButton } from "./DashboardWidgets";
import type { OrdersSummary, ReservationsSummary } from "./todayActivity";
import s from "./UserDashboard.module.css";

// ── Agenda: calendario de reservas y pedidos ──────────────────────────────────

type AgendaTab = "reservas" | "pedidos";
type CalendarView = "semana" | "mes";

interface Filter<S extends string> {
  key: string;
  label: string;
  statuses: readonly S[] | null; // null = todos
}

const RESERVATION_FILTERS: Filter<ReservationStatus>[] = [
  { key: "activas", label: "En pie", statuses: ["pending", "confirmed"] },
  { key: "pendientes", label: "Por confirmar", statuses: ["pending"] },
  { key: "confirmadas", label: "Confirmadas", statuses: ["confirmed"] },
  { key: "todas", label: "Todas", statuses: null },
];

const ORDER_FILTERS: Filter<OrderStatus>[] = [
  { key: "curso", label: "En curso", statuses: ["pending", "confirmed", "ready"] },
  { key: "entregados", label: "Entregados", statuses: ["delivered"] },
  { key: "cancelados", label: "Cancelados", statuses: ["cancelled", "returned"] },
  { key: "todos", label: "Todos", statuses: null },
];

const matches = <S extends string>(filter: Filter<S>, status: S) =>
  filter.statuses === null || filter.statuses.includes(status);

const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

// Pedidos de un día que no es hoy: se piden al historial al seleccionarlo.
interface DayOrders {
  date: string;
  // null = falló.
  result: { orders: Order[]; total: number } | null;
}

interface AgendaCardProps {
  // Hoy en Buenos Aires (YYYY-MM-DD).
  today: string;
  reservations: ReservationsSummary | null | undefined;
  orders: OrdersSummary | null | undefined;
  onOpenReservations: () => void;
  onOpenOrders: () => void;
}

export function AgendaCard({ today, reservations, orders, onOpenReservations, onOpenOrders }: AgendaCardProps) {
  const [tab, setTab] = useState<AgendaTab>("reservas");
  const [view, setView] = useState<CalendarView>("semana");
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [reservationFilter, setReservationFilter] = useState(RESERVATION_FILTERS[0]);
  const [orderFilter, setOrderFilter] = useState(ORDER_FILTERS[0]);
  const [dayOrders, setDayOrders] = useState<DayOrders | null>(null);

  // Si cambia el día (pasó la medianoche con el panel abierto), "hoy" se mueve.
  const [prevToday, setPrevToday] = useState(today);
  if (prevToday !== today) {
    setPrevToday(today);
    if (selected === prevToday) {
      setSelected(today);
      setMonth(today.slice(0, 7));
    }
  }

  const select = (date: string) => {
    setSelected(date);
    setMonth(date.slice(0, 7));
  };

  const days = view === "semana" ? weekDays(selected) : monthGrid(month);
  const step = (delta: number) => {
    if (view === "semana") select(addDays(selected, delta * 7));
    else setMonth(addMonths(month, delta));
  };

  // Reservas por día según el filtro, para marcar el calendario.
  const reservationsByDay = useMemo(() => {
    const map = new Map<string, OwnerReservation[]>();
    for (const reservation of reservations?.all ?? []) {
      if (!matches(reservationFilter, reservation.status)) continue;
      const list = map.get(reservation.date);
      if (list) list.push(reservation);
      else map.set(reservation.date, [reservation]);
    }
    return map;
  }, [reservations, reservationFilter]);

  // Pedidos de otro día que hoy: del historial (hoy sale del tablero en vivo).
  const needsHistory = tab === "pedidos" && selected < today && orders !== null;
  useEffect(() => {
    if (!needsHistory) return;
    let cancelled = false;
    listOrders(dayRangeBuenosAires(selected))
      .then(({ orders: list, total }) => {
        if (!cancelled) setDayOrders({ date: selected, result: { orders: [...list].reverse(), total } });
      })
      .catch(() => {
        if (!cancelled) setDayOrders({ date: selected, result: null });
      });
    return () => { cancelled = true; };
  }, [needsHistory, selected]);

  const isToday = selected === today;

  // ── Contenido del día elegido ──
  let loading: boolean;
  let content: React.ReactNode;
  if (tab === "reservas") {
    loading = reservations === undefined;
    const list = reservationsByDay.get(selected) ?? [];
    content = list.length > 0
      ? list.map((reservation, index) => (
        <AgendaItem
          key={reservation.id}
          featured={index === 0}
          title={reservation.name}
          subtitle={[formatPeople(reservation.partySize), reservation.tableLabel && `Mesa ${reservation.tableLabel}`]
            .filter(Boolean).join(" · ")}
          chips={[`${reservation.time} hs`, RESERVATION_LABEL[reservation.status]]}
          alert={reservation.status === "pending"}
          onClick={onOpenReservations}
        />
      ))
      : (
        <AgendaEmpty
          icon={<CalendarCheck size={18} strokeWidth={1.5} />}
          text={reservations && selected < reservations.from
            ? `Las reservas anteriores al ${formatReservationDate(reservations.from)} se ven en Reservas.`
            : `No hay reservas ${reservationFilter.statuses === null ? "" : `${reservationFilter.label.toLowerCase()} `}${isToday ? "para hoy" : "para este día"}.`}
        />
      );
  } else if (selected > today) {
    loading = false;
    content = <AgendaEmpty icon={<ClipboardList size={18} strokeWidth={1.5} />} text="Los pedidos aparecen el mismo día." />;
  } else {
    const source = isToday
      ? orders && { orders: orders.all, total: orders.all.length }
      : dayOrders?.date === selected ? dayOrders.result : undefined;
    loading = source === undefined || orders === undefined;
    const list = source ? source.orders.filter(order => matches(orderFilter, order.status)) : [];
    const hidden = source ? source.total - source.orders.length : 0;
    content = list.length > 0 ? (
      <>
        {list.map((order, index) => (
          <AgendaItem
            key={order.id}
            featured={index === 0}
            title={`Pedido #${order.number}`}
            subtitle={[placeLabel(order), order.customerName].filter(Boolean).join(" · ")}
            chips={[STATUS_LABEL[order.status], isToday ? elapsedLabel(order.createdAt) : `${formatTime(order.createdAt)} hs`]}
            alert={order.status === "pending"}
            onClick={onOpenOrders}
          />
        ))}
        {hidden > 0 && (
          <button type="button" className={s.agendaMore} onClick={onOpenOrders}>
            Hay {hidden} pedidos más de este día · Ver en Pedidos
          </button>
        )}
      </>
    ) : (
      <AgendaEmpty
        icon={<ClipboardList size={18} strokeWidth={1.5} />}
        text={source === null
          ? "No pudimos cargar los pedidos de este día."
          : isToday && orders && !orders.shiftOpen && orders.all.length === 0
            ? "No hay un turno abierto."
            : `No hay pedidos ${orderFilter.statuses === null ? "" : `${orderFilter.label.toLowerCase()} `}${isToday ? "hoy" : "este día"}.`}
      />
    );
  }

  const filters = tab === "reservas" ? RESERVATION_FILTERS : ORDER_FILTERS;
  const activeFilter = tab === "reservas" ? reservationFilter : orderFilter;
  const setFilter = (key: string) => {
    if (tab === "reservas") setReservationFilter(RESERVATION_FILTERS.find(filter => filter.key === key)!);
    else setOrderFilter(ORDER_FILTERS.find(filter => filter.key === key)!);
  };

  return (
    <section className={`${s.card} ${s.agendaCard}`} aria-label="Agenda">
      <header className={s.agendaHeader}>
        {isToday
          ? <span className={s.datePill}>Hoy</span>
          : (
            <button type="button" className={`${s.datePill} ${s.datePillBtn}`} onClick={() => select(today)} title="Volver a hoy">
              Ir a hoy
            </button>
          )}
        <h2 className={s.cardTitle}>Agenda</h2>
        <MoreButton label={tab === "reservas" ? "Ir a reservas" : "Ir a pedidos"} onClick={tab === "reservas" ? onOpenReservations : onOpenOrders} />
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
          </button>
        ))}
      </div>

      {/* ── Calendario ── */}
      <div className={s.calendar}>
        <div className={s.calendarNav}>
          <button type="button" className={s.calendarArrow} onClick={() => step(-1)} aria-label={view === "semana" ? "Semana anterior" : "Mes anterior"}>
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <span className={s.calendarMonth}>{formatMonth(view === "semana" ? selected.slice(0, 7) : month)}</span>
          <button type="button" className={s.calendarArrow} onClick={() => step(1)} aria-label={view === "semana" ? "Semana siguiente" : "Mes siguiente"}>
            <ChevronRight size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={s.calendarViewBtn}
            onClick={() => {
              setMonth(selected.slice(0, 7));
              setView(view === "semana" ? "mes" : "semana");
            }}
            aria-label={view === "semana" ? "Ver el mes" : "Ver la semana"}
            title={view === "semana" ? "Ver el mes" : "Ver la semana"}
          >
            {view === "semana" ? <CalendarDays size={15} strokeWidth={1.75} /> : <CalendarRange size={15} strokeWidth={1.75} />}
            {view === "semana" ? "Mes" : "Semana"}
          </button>
        </div>

        <div className={s.calendarGrid} role="group" aria-label="Elegir día">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <span key={index} className={s.calendarWeekday} aria-hidden>{initial}</span>
          ))}
          {days.map(date => {
            const count = reservationsByDay.get(date)?.length ?? 0;
            const outside = view === "mes" && date.slice(0, 7) !== month;
            const className = [
              s.calendarDay,
              date === selected && s.calendarDaySelected,
              date === today && s.calendarDayToday,
              outside && s.calendarDayOutside,
            ].filter(Boolean).join(" ");
            return (
              <button
                key={date}
                type="button"
                className={className}
                onClick={() => select(date)}
                aria-pressed={date === selected}
                aria-current={date === today ? "date" : undefined}
                aria-label={`${formatReservationDate(date)}${count > 0 ? `, ${count} ${count === 1 ? "reserva" : "reservas"}` : ""}`}
              >
                {dayOfMonth(date)}
                {count > 0 && <span className={s.calendarDot} aria-hidden>{count > 9 ? "9+" : count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filtro por estado ── */}
      <div className={s.agendaFilters} role="group" aria-label="Filtrar por estado">
        {filters.map(filter => (
          <button
            key={filter.key}
            type="button"
            className={`${s.filterChip} ${activeFilter.key === filter.key ? s.filterChipActive : ""}`}
            aria-pressed={activeFilter.key === filter.key}
            onClick={() => setFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <h3 className={s.agendaDayTitle}>
        {isToday ? `Hoy, ${formatReservationDate(selected)}` : formatReservationDate(selected)}
      </h3>

      <div className={s.agendaList} role="tabpanel">
        {loading ? (
          <>
            <span className={s.agendaSkeleton} aria-hidden />
            <span className={s.agendaSkeleton} aria-hidden />
          </>
        ) : content}
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
