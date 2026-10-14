import {
  CalendarClock, CalendarPlus, Check, CircleCheck, Columns3, Eraser, MessageCircle, RotateCcw, Settings, Table2, UserX, X,
} from "lucide-react";
import { buildWaLink } from "../../../../lib/whatsapp.ts";
import { copySubmenu, openUrlItem, type MenuEnv } from "../../../contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../contextMenu/types";
import { formatPeople, formatReservationDate, STATUS_LABEL } from "../../lib/format.ts";
import type { OwnerReservation } from "../../types";

// Clic derecho en una reserva (fila de la tabla o tarjeta del kanban) y en el
// fondo del panel de reservas. Confirmar, rechazar, cancelar y "no asistió"
// abren los mismos modales que los botones (cada uno es su confirmación);
// volver a pendiente una reserva cerrada confirma acá.

export interface ReservationMenuActions {
  confirm: (reservation: OwnerReservation) => void;
  reject: (reservation: OwnerReservation) => void;
  cancel: (reservation: OwnerReservation) => void;
  noShow: (reservation: OwnerReservation) => void;
  complete: (reservation: OwnerReservation) => Promise<void>;
  reopen: (reservation: OwnerReservation) => Promise<void>;
}

export interface ReservationMenuContext {
  reservation: OwnerReservation;
  busy: boolean;
  actions: ReservationMenuActions;
}

const BUSY = "Se está actualizando la reserva";
const is = (...statuses: OwnerReservation["status"][]) => ({ reservation }: ReservationMenuContext) => statuses.includes(reservation.status);
const idle = ({ busy }: ReservationMenuContext) => busy && BUSY;

/** Los datos de la reserva en texto, para pegarlos en un chat o una nota. */
export function reservationSummary(reservation: OwnerReservation): string {
  return [
    `Reserva ${reservation.code} · ${STATUS_LABEL[reservation.status]}`,
    `${reservation.name} · ${formatPeople(reservation.partySize)}`,
    `${formatReservationDate(reservation.date)} · ${reservation.time} hs`,
    reservation.tableLabel ? `Mesa: ${reservation.tableLabel}` : "",
    reservation.phone ? `Teléfono: ${reservation.phone}` : "",
    reservation.notes ? `Nota: ${reservation.notes}` : "",
  ].filter(Boolean).join("\n");
}

const greeting = (reservation: OwnerReservation) =>
  `¡Hola ${reservation.name}! Te escribimos por tu reserva del ${formatReservationDate(reservation.date)} a las ${reservation.time} hs (código ${reservation.code}).`;

export function buildReservationMenu(env: MenuEnv): ContextMenuItem<ReservationMenuContext>[] {
  return [
    { id: "confirm", label: "Confirmar…", icon: Check, visible: is("pending"), disabled: idle, run: ({ reservation, actions }) => actions.confirm(reservation) },
    { id: "complete", label: "Marcar completada", icon: CircleCheck, visible: is("confirmed"), disabled: idle, run: ({ reservation, actions }) => actions.complete(reservation), successMessage: "Reserva completada.", errorMessage: "No se pudo actualizar la reserva." },
    { id: "no-show", label: "No asistió…", icon: UserX, visible: is("confirmed"), disabled: idle, run: ({ reservation, actions }) => actions.noShow(reservation) },
    {
      id: "reject",
      label: ({ reservation }) => (reservation.status === "confirmed" ? "Cambiar horario…" : "Horario no disponible…"),
      icon: CalendarClock,
      visible: is("pending", "confirmed"),
      disabled: idle,
      run: ({ reservation, actions }) => actions.reject(reservation),
    },
    {
      id: "reopen",
      label: "Volver a pendiente",
      icon: RotateCcw,
      visible: is("rejected", "completed", "no_show"),
      disabled: idle,
      // Una rechazada vuelve sin más (se liberó lugar); una cerrada, confirmando.
      confirm: ({ reservation }) => (reservation.status === "rejected" ? null : {
        title: `¿Volver a pendiente la reserva de ${reservation.name}?`,
        message: `Hoy figura como "${STATUS_LABEL[reservation.status]}". Vuelve a la columna de pendientes para confirmarla de nuevo.`,
        confirmLabel: "Volver a pendiente",
      }),
      run: ({ reservation, actions }) => actions.reopen(reservation),
      successMessage: "La reserva volvió a pendiente.",
      errorMessage: "No se pudo actualizar la reserva.",
    },
    {
      id: "cancel",
      label: "Cancelar reserva…",
      icon: X,
      danger: true,
      visible: is("pending", "confirmed", "rejected"),
      disabled: idle,
      // Abre el modal de cancelación (pide el mensaje para el cliente).
      run: ({ reservation, actions }) => actions.cancel(reservation),
    },
    { type: "separator" },
    openUrlItem<ReservationMenuContext>(env, {
      id: "whatsapp",
      label: "Enviar por WhatsApp",
      icon: MessageCircle,
      url: ({ reservation }) => (reservation.phone ? buildWaLink(reservation.phone, greeting(reservation)) : null),
    }),
    copySubmenu<ReservationMenuContext>(env, [
      { id: "phone", label: "Teléfono", value: ({ reservation }) => reservation.phone, done: "Teléfono copiado." },
      { id: "code", label: "Código", value: ({ reservation }) => reservation.code, done: "Código copiado." },
      { id: "summary", label: "Datos de la reserva", value: ({ reservation }) => reservationSummary(reservation), done: "Datos de la reserva copiados." },
    ]),
  ];
}

// ── Fondo ──

export interface ReservationsPageMenuContext {
  view: "table" | "kanban";
  activeFilters: number;
  actions: { create: () => void; setView: (view: "table" | "kanban") => void; clearFilters: () => void; openSettings: () => void };
}

export function buildReservationsPageMenu(): ContextMenuItem<ReservationsPageMenuContext>[] {
  return [
    { id: "create", label: "Nueva reserva", icon: CalendarPlus, run: ({ actions }) => actions.create() },
    { type: "separator" },
    { id: "table", label: "Vista tabla", icon: Table2, disabled: ({ view }) => view === "table" && "Es la vista actual", run: ({ actions }) => actions.setView("table") },
    { id: "kanban", label: "Vista kanban", icon: Columns3, disabled: ({ view }) => view === "kanban" && "Es la vista actual", run: ({ actions }) => actions.setView("kanban") },
    { id: "clear", label: "Limpiar filtros", icon: Eraser, disabled: ({ activeFilters }) => activeFilters === 0 && "No hay filtros aplicados", run: ({ actions }) => actions.clearFilters() },
    { type: "separator" },
    { id: "settings", label: "Configuración", icon: Settings, run: ({ actions }) => actions.openSettings() },
  ];
}
