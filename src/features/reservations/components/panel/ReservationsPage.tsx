import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import { isSubscriptionExpired } from "../../../../lib/plans";
import { buildWaHref, sanitizePhoneForWa } from "../../../../lib/whatsapp";
import DataTable, { type DataTableColumn } from "../../../../components/Common/DataTable/DataTable";
import { KanbanIcon, ListIcon } from "../../../../components/Seller/Crm/crmIcons";
import { beep } from "../../../orders/lib/beep";
import { errorCode, errorMessage } from "../../../orders/lib/errors";
import { readJson, writeJson } from "../../../orders/lib/storage";
import {
  getReservationSettings, listReservations, runReservationAction, type ReservationList, type SettingsResponse,
} from "../../api/reservationsApi";
import { useReservationSocket } from "../../hooks/useReservationSocket";
import { codeMessage, formatPeople, formatReservationDate, STATUS_LABEL, todayBuenosAires } from "../../lib/format";
import type { OwnerAction, OwnerReservation, ReservationSettings, ReservationStatus, SocketMessage } from "../../types";
import { CancelModal, ConfirmDialog, ConfirmModal, ManualReservationModal, RejectModal } from "./ReservationModals";
import ReservationsSettings from "./ReservationsSettings";
import p from "../../../orders/components/panel/panel.module.css";
import r from "./Reservations.module.css";

// Panel de reservas del dueño. La pantalla "Reservas" se ve como tabla
// (DataTable, el mismo componente del CRM) o como kanban por estado, con los
// mismos filtros en las dos. Se actualiza en vivo por WebSocket (y consulta
// cada tanto si el socket no está disponible).

type Tab = "reservations" | "settings";
type ViewMode = "table" | "kanban";

const VIEW_KEY = "md:reservations:view";
const FALLBACK_POLL_MS = 15_000;

const KANBAN_COLUMNS: { id: string; title: string; statuses: ReservationStatus[]; empty: string }[] = [
  { id: "pending", title: "Pendientes", statuses: ["pending"], empty: "Nada por responder." },
  { id: "rejected", title: "Esperando al cliente", statuses: ["rejected"], empty: "Ninguna en espera." },
  { id: "confirmed", title: "Confirmadas", statuses: ["confirmed"], empty: "Sin confirmadas." },
  { id: "closed", title: "Cerradas", statuses: ["completed", "no_show", "cancelled"], empty: "Sin reservas cerradas." },
];

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as ReservationStatus[]).map(value => ({ value, label: STATUS_LABEL[value] }));

interface Filters {
  search: string;
  status: "" | ReservationStatus;
  source: "" | "web" | "manual";
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { search: "", status: "", source: "", from: "", to: "" };

const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-AR").trim();

const searchText = (reservation: OwnerReservation) =>
  `${reservation.name} ${reservation.code} ${reservation.phone ?? ""} ${reservation.tableLabel ?? ""} ${reservation.notes ?? ""}`;

const byWhen = (a: OwnerReservation, b: OwnerReservation) =>
  a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);

export default function ReservationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const expired = user ? isSubscriptionExpired(user.subscription, user.subscriptionExpiresAt, user.subscriptionStatus) : true;
  const isPro = !expired && user?.subscription === "pro";

  const [tab, setTab] = useState<Tab>("reservations");
  // En el celular la tabla es incómoda como primera vista: arranca en kanban.
  const [view, setView] = useState<ViewMode>(
    () => readJson(VIEW_KEY, (v): v is ViewMode => v === "table" || v === "kanban") ?? (window.innerWidth < 768 ? "kanban" : "table")
  );
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [list, setList] = useState<ReservationList | null>(null);
  const [fetchFrom, setFetchFrom] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<OwnerReservation | null>(null);
  const [rejecting, setRejecting] = useState<OwnerReservation | null>(null);
  const [cancelling, setCancelling] = useState<OwnerReservation | null>(null);
  const [noShowing, setNoShowing] = useState<OwnerReservation | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [created, setCreated] = useState<OwnerReservation | null>(null);
  const known = useRef<Set<number> | null>(null);
  const fromRef = useRef(fetchFrom);
  useEffect(() => { fromRef.current = fetchFrom; });

  const changeView = (next: ViewMode) => {
    setView(next);
    writeJson(VIEW_KEY, next);
  };

  const refresh = useCallback(async () => {
    try {
      const result = await listReservations(fromRef.current);
      // Reservas web nuevas desde la última consulta: aviso sonoro.
      const ids = new Set(result.reservations.map(item => item.id));
      if (known.current && result.reservations.some(item => !known.current!.has(item.id) && item.status === "pending" && item.source === "web")) {
        beep();
      }
      known.current = ids;
      setList(result);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron actualizar las reservas. Reintentando…"));
    }
  }, []);

  // Configuración (también dice si el plan alcanza: 403 = no es Pro).
  const loadSettings = useCallback(async () => {
    try {
      setSettings(await getReservationSettings());
    } catch (err) {
      setError(errorCode(err) === "FEATURE_NOT_INCLUDED"
        ? "Las reservas están disponibles en el plan Pro."
        : errorMessage(err, "No se pudo cargar la configuración de reservas."));
    }
  }, []);

  useEffect(() => {
    if (!isPro) return;
    const timer = setTimeout(loadSettings, 0);
    return () => clearTimeout(timer);
  }, [isPro, loadSettings]);

  useEffect(() => {
    if (!isPro) return;
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [isPro, fetchFrom, refresh]);

  const token = localStorage.getItem("token");
  const hello = useMemo(() => (token ? { type: "auth" as const, token } : null), [token]);

  const onMessage = useCallback((message: SocketMessage) => {
    if (message.type === "reservation") void refresh();
  }, [refresh]);

  const connected = useReservationSocket({ enabled: isPro, hello, onMessage, onOpen: () => { void refresh(); } });

  useEffect(() => {
    if (!isPro || connected) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [isPro, connected, refresh]);

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    // Una fecha anterior a lo cargado pide más historial al servidor.
    if (patch.from && list && patch.from < list.from) setFetchFrom(patch.from);
  };

  const rows = useMemo(() => {
    if (!list) return [];
    const term = normalize(filters.search);
    return list.reservations.filter(item =>
      (!term || normalize(searchText(item)).includes(term))
      && (!filters.status || item.status === filters.status)
      && (!filters.source || item.source === filters.source)
      && (!filters.from || item.date >= filters.from)
      && (!filters.to || item.date <= filters.to)
    );
  }, [list, filters]);

  const activeFilters = [filters.status, filters.source, filters.from, filters.to].filter(Boolean).length;

  const simpleAction = async (reservation: OwnerReservation, action: OwnerAction) => {
    setBusyId(reservation.id);
    setActionError(null);
    try {
      await runReservationAction(reservation.id, action);
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo actualizar la reserva."));
      void refresh();
    } finally {
      setBusyId(null);
    }
  };

  const confirmNoShow = async () => {
    if (!noShowing) return;
    const target = noShowing;
    setNoShowing(null);
    await simpleAction(target, "no-show");
  };

  const done = () => {
    setConfirming(null);
    setRejecting(null);
    setCancelling(null);
    void refresh();
  };

  if (!isPro) {
    return (
      <div className={p.page}>
        <div className={p.card} style={{ maxWidth: 480, margin: "3rem auto", textAlign: "center" }}>
          <h1 className={p.title}>Reservas</h1>
          <p className={p.subtitle} style={{ margin: "0.75rem 0 1.25rem", lineHeight: 1.55 }}>
            Recibí reservas de tus clientes desde tu página, confirmalas con su mesa y avisales en tiempo real.
            Esta función está disponible en el plan Pro.
          </p>
          <button type="button" className={p.btnPrimary} onClick={() => navigate("/dashboard")}>Ver planes en el panel</button>
        </div>
      </div>
    );
  }

  const createdPhone = created ? sanitizePhoneForWa(created.phone) : null;
  const pendingCount = list?.pendingCount ?? settings?.pendingCount ?? 0;

  const actions = (reservation: OwnerReservation) => (
    <ReservationActions
      reservation={reservation}
      busy={busyId === reservation.id}
      onConfirm={() => setConfirming(reservation)}
      onReject={() => setRejecting(reservation)}
      onCancel={() => setCancelling(reservation)}
      onNoShow={() => setNoShowing(reservation)}
      onSimple={action => void simpleAction(reservation, action)}
    />
  );

  const columns: DataTableColumn<OwnerReservation>[] = [
    {
      id: "when", header: "Fecha y hora", width: "170px", initialDirection: "asc",
      sortValue: item => `${item.date} ${item.time}`,
      render: item => (
        <span className={r.cellStack}>
          <strong>{item.time} hs</strong>
          <span className={r.cellMuted}>{formatReservationDate(item.date)}</span>
        </span>
      ),
    },
    {
      id: "client", header: "Cliente", width: "200px", sortValue: item => item.name,
      render: item => {
        const phone = sanitizePhoneForWa(item.phone);
        return (
          <span className={r.cellStack}>
            <strong>{item.name}</strong>
            {item.phone && (phone
              ? <a className={r.cellMuted} href={buildWaHref(phone)} target="_blank" rel="noopener noreferrer">{item.phone}</a>
              : <span className={r.cellMuted}>{item.phone}</span>)}
            {item.notes && <span className={r.cellMuted}>“{item.notes}”</span>}
          </span>
        );
      },
    },
    { id: "party", header: "Personas", width: "100px", align: "right", sortValue: item => item.partySize, render: item => item.partySize },
    { id: "table", header: "Mesa", width: "110px", sortValue: item => item.tableLabel, render: item => item.tableLabel ?? "—" },
    {
      id: "status", header: "Estado", width: "170px", sortValue: item => STATUS_LABEL[item.status],
      render: item => (
        <span className={r.cellStack}>
          <span className={`${p.status} ${r[`chip_${item.status}`]}`}>{STATUS_LABEL[item.status]}</span>
          {item.status === "rejected" && <span className={r.cellMuted}>{statusNote(item)}</span>}
          {item.message && item.status !== "rejected" && <span className={r.cellMuted}>{item.message}</span>}
        </span>
      ),
    },
    { id: "source", header: "Origen", width: "140px", sortValue: item => item.source, render: item => (item.source === "manual" ? "Cargada por el local" : "Landing") },
    { id: "code", header: "Código", width: "130px", render: item => <span className={r.code}>{item.code}</span> },
    { id: "actions", header: "", headerLabel: "Acciones", width: "300px", resizable: false, render: actions },
  ];

  const filterControls = (
    <>
      <select className={r.filterSelect} aria-label="Filtrar por estado" value={filters.status} onChange={e => updateFilters({ status: e.target.value as Filters["status"] })}>
        <option value="">Todos los estados</option>
        {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select className={r.filterSelect} aria-label="Filtrar por origen" value={filters.source} onChange={e => updateFilters({ source: e.target.value as Filters["source"] })}>
        <option value="">Todos los orígenes</option>
        <option value="web">Desde la landing</option>
        <option value="manual">Cargadas por el local</option>
      </select>
      <label className={r.filterDate}>
        Desde
        <input type="date" value={filters.from} max={filters.to || undefined} onChange={e => updateFilters({ from: e.target.value })} />
      </label>
      <label className={r.filterDate}>
        Hasta
        <input type="date" value={filters.to} min={filters.from || undefined} onChange={e => updateFilters({ to: e.target.value })} />
      </label>
      <button type="button" className={r.filterBtn} onClick={() => { const today = todayBuenosAires(); updateFilters({ from: today, to: today }); }}>Hoy</button>
    </>
  );

  const viewToggle = (
    <div className={r.viewToggle} role="group" aria-label="Tipo de vista">
      <button type="button" className={`${r.viewToggleBtn} ${view === "table" ? r.viewToggleBtnActive : ""}`} onClick={() => changeView("table")} aria-label="Vista tabla" aria-pressed={view === "table"}>
        <ListIcon />
      </button>
      <button type="button" className={`${r.viewToggleBtn} ${view === "kanban" ? r.viewToggleBtnActive : ""}`} onClick={() => changeView("kanban")} aria-label="Vista kanban" aria-pressed={view === "kanban"}>
        <KanbanIcon />
      </button>
    </div>
  );

  const clearFilters = () => setFilters(NO_FILTERS);

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Reservas</h1>
          <p className={p.subtitle}>
            <span className={`${r.live} ${connected ? r.liveOn : ""}`}>
              <span className={r.liveDot} aria-hidden />
              {connected ? "En vivo" : "Actualizando cada pocos segundos"}
            </span>
          </p>
        </div>
        <div className={p.headerActions}>
          <button type="button" className={p.btnPrimary} onClick={() => setManualOpen(true)}>
            <Plus size={16} aria-hidden /> Nueva reserva
          </button>
        </div>
      </header>

      {settings && !settings.settings.enabled && (
        <p className={p.notice} style={{ marginBottom: "1rem" }}>
          Las reservas online están desactivadas: tus clientes todavía no ven el formulario en tu página.{" "}
          <button type="button" className={p.btnGhost} onClick={() => setTab("settings")}>Activarlas en Configuración</button>
        </p>
      )}

      <div className={`${p.segmented} ${r.tabs}`} role="tablist" aria-label="Secciones de reservas">
        <button type="button" role="tab" aria-selected={tab === "reservations"} className={`${p.segment} ${tab === "reservations" ? p.segmentActive : ""}`} onClick={() => setTab("reservations")}>
          Reservas
          {pendingCount > 0 && <span className={r.badge} aria-label={`${pendingCount} pendientes`}>{pendingCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "settings"} className={`${p.segment} ${tab === "settings" ? p.segmentActive : ""}`} onClick={() => setTab("settings")}>
          Configuración
        </button>
      </div>

      {created && (
        <div className={r.codeBanner} role="status">
          <span>Reserva cargada. Código para el cliente: <strong>{created.code}</strong></span>
          <span className={p.headerActions}>
            <button type="button" className={`${p.btn} ${p.small}`} onClick={() => { void navigator.clipboard?.writeText(created.code).catch(() => {}); }}>Copiar código</button>
            {createdPhone && (
              <a
                className={`${p.btn} ${p.small}`}
                href={buildWaHref(createdPhone, codeMessage(user?.name || "nuestro local", created.code, created.date, created.time))}
                target="_blank"
                rel="noopener noreferrer"
              >
                Enviar por WhatsApp
              </a>
            )}
            <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={() => setCreated(null)}>Cerrar</button>
          </span>
        </div>
      )}

      {error && <p className={p.error} role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}
      {actionError && <p className={p.error} role="alert" style={{ marginBottom: "1rem" }}>{actionError}</p>}
      {list?.truncated && (
        <p className={p.notice} style={{ marginBottom: "1rem" }}>
          Hay más reservas de las que se pueden mostrar. Acotá el rango con "Desde" y "Hasta" para ver el resto.
        </p>
      )}

      {tab === "settings" ? (
        settings ? (
          <ReservationsSettings key={JSON.stringify(settings.settings)} initial={settings} onSaved={(next: ReservationSettings) => setSettings({ ...settings, settings: next })} />
        ) : !error && <div className={p.loading}>Cargando…</div>
      ) : view === "table" ? (
        <DataTable<OwnerReservation>
          caption="Reservas"
          rows={rows}
          columns={columns}
          getRowId={item => String(item.id)}
          defaultSort={{ columnId: "when", direction: "asc" }}
          layout="fixed"
          minWidth={1260}
          loading={!list && !error}
          search={{ value: filters.search, onChange: value => updateFilters({ search: value }), accessor: searchText, placeholder: "Nombre, código, teléfono o mesa…", label: "Buscar reservas" }}
          filters={filterControls}
          actions={viewToggle}
          activeFilterCount={activeFilters}
          onClearFilters={clearFilters}
          countLabel={visible => `${visible} de ${list?.reservations.length ?? 0} reservas`}
          emptyMessage={error ? "No se pudo cargar el listado." : "Todavía no hay reservas."}
          noResultsMessage="No hay reservas que coincidan con los filtros."
        />
      ) : (
        <>
          <div className={r.kanbanToolbar}>
            <input
              className={r.filterSearch} type="search" aria-label="Buscar reservas" placeholder="Nombre, código, teléfono o mesa…"
              value={filters.search} onChange={e => updateFilters({ search: e.target.value })}
            />
            {filterControls}
            {(activeFilters > 0 || filters.search) && <button type="button" className={r.filterBtn} onClick={clearFilters}>Limpiar filtros</button>}
            {viewToggle}
          </div>
          {!list ? (!error && <div className={p.loading}>Cargando…</div>) : (
            <div className={r.kanbanBoard}>
              {KANBAN_COLUMNS.map(column => {
                const items = rows
                  .filter(item => column.statuses.includes(item.status))
                  .sort(column.id === "closed" ? (a, b) => byWhen(b, a) : byWhen);
                return (
                  <section key={column.id} className={r.kanbanColumn} aria-label={column.title}>
                    <h2 className={r.kanbanHeader}>
                      {column.title}
                      <span className={r.kanbanCount}>{items.length}</span>
                    </h2>
                    <div className={r.kanbanCards}>
                      {items.map(item => <ReservationCard key={item.id} reservation={item} actions={actions(item)} />)}
                      {items.length === 0 && <p className={r.kanbanEmpty}>{column.empty}</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {confirming && <ConfirmModal reservation={confirming} onClose={() => setConfirming(null)} onDone={done} />}
      {rejecting && <RejectModal reservation={rejecting} onClose={() => setRejecting(null)} onDone={done} />}
      {cancelling && <CancelModal reservation={cancelling} onClose={() => setCancelling(null)} onDone={done} />}
      {noShowing && (
        <ConfirmDialog
          title="Marcar como no asistió"
          text={`¿Confirmás que ${noShowing.name} no se presentó a su reserva del ${formatReservationDate(noShowing.date)} a las ${noShowing.time} hs?`}
          confirmLabel="Sí, no asistió"
          onConfirm={() => void confirmNoShow()}
          onClose={() => setNoShowing(null)}
        />
      )}
      {manualOpen && (
        <ManualReservationModal
          onClose={() => setManualOpen(false)}
          onCreated={reservation => {
            setManualOpen(false);
            setCreated(reservation);
            void refresh();
            void loadSettings();
          }}
        />
      )}
    </div>
  );
}

function statusNote(reservation: OwnerReservation): string {
  if (!reservation.altTime) return "Sin horario alternativo";
  const day = reservation.altDate && reservation.altDate !== reservation.date ? `${formatReservationDate(reservation.altDate)} ` : "";
  return `Propusiste ${day}${reservation.altTime} hs`;
}

// ── Acciones según el estado (tabla y tarjeta) ──

function ReservationActions({ reservation, busy, onConfirm, onReject, onCancel, onNoShow, onSimple }: {
  reservation: OwnerReservation;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onSimple: (action: OwnerAction) => void;
}) {
  const { status } = reservation;
  return (
    <div className={r.actions}>
      {status === "pending" && (
        <>
          <button type="button" className={`${p.btnPrimary} ${p.small}`} disabled={busy} onClick={onConfirm}>Confirmar</button>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={busy} onClick={onReject}>Horario no disponible</button>
          <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={onCancel}>Cancelar</button>
        </>
      )}
      {status === "confirmed" && (
        <>
          <button type="button" className={`${p.btnPrimary} ${p.small}`} disabled={busy} onClick={() => onSimple("complete")}>Completada</button>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={busy} onClick={onNoShow}>No asistió</button>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={busy} onClick={onReject}>Cambiar horario</button>
          <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={onCancel}>Cancelar</button>
        </>
      )}
      {status === "rejected" && (
        <>
          <button type="button" className={`${p.btn} ${p.small}`} disabled={busy} onClick={() => onSimple("reopen")}>Volver a pendiente</button>
          <button type="button" className={`${p.btnDanger} ${p.small}`} disabled={busy} onClick={onCancel}>Cancelar</button>
        </>
      )}
    </div>
  );
}

// ── Tarjeta de una reserva (kanban) ──

function ReservationCard({ reservation, actions }: { reservation: OwnerReservation; actions: React.ReactNode }) {
  const { status } = reservation;
  const phone = sanitizePhoneForWa(reservation.phone);

  return (
    <article className={r.item} aria-label={`Reserva de ${reservation.name}`}>
      <div className={r.itemTop}>
        <div className={r.when}>
          <span className={r.time}>{reservation.time} hs</span>
          <span className={r.date}>{formatReservationDate(reservation.date)}</span>
        </div>
        <span className={`${p.status} ${r[`chip_${status}`]}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className={r.who}>
        <strong>{reservation.name}</strong>
        <span>{formatPeople(reservation.partySize)}{reservation.tableLabel ? ` · ${reservation.tableLabel}` : ""}</span>
      </div>

      <div className={r.meta}>
        <span className={r.code}>{reservation.code}</span>
        <span>{reservation.source === "manual" ? "Cargada por el local" : "Desde la landing"}</span>
        {reservation.phone && (phone
          ? <a href={buildWaHref(phone)} target="_blank" rel="noopener noreferrer">{reservation.phone}</a>
          : <span>{reservation.phone}</span>)}
      </div>

      {reservation.notes && <p className={r.note}>“{reservation.notes}”</p>}
      {status === "rejected" && (
        <p className={r.note}>
          {reservation.altTime ? `Esperando respuesta del cliente. ${statusNote(reservation)}.` : "Rechazada sin horario alternativo."}
          {reservation.message ? ` Mensaje: ${reservation.message}` : ""}
        </p>
      )}
      {status === "cancelled" && reservation.message && <p className={r.note}>Motivo: {reservation.message}</p>}

      {actions}
    </article>
  );
}
