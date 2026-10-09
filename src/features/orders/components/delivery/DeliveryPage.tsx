import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, MapPin, PackageCheck, UserPlus, X } from "lucide-react";
import {
  assignDelivery, completeDelivery, getDeliveryActive, getDeliveryTrail, listCouriers, revealDeliveryCode, unassignDelivery,
} from "../../api/ordersApi";
import { ownerHello, useLiveRefresh } from "../../hooks/useLiveRefresh";
import { ASSIGNMENT_LABEL, confirmByLabel, deliveryStageLabel, minutesFrom, minutesLabel } from "../../lib/delivery";
import { errorCode, errorMessage } from "../../lib/errors";
import { formatDateTime, formatTime } from "../../lib/format";
import type { Courier, DeliveryActiveResponse, DeliveryAssignment, DeliveryTrail, Order } from "../../types";
import { CustomerInfo } from "../panel/OrderCard";
import DeliveryTabs from "./DeliveryTabs";
import p from "../panel/panel.module.css";
import s from "./Delivery.module.css";

// Entregas en curso: los pedidos de delivery con repartidor (asignados o en
// camino) y los que todavía no tiene nadie. Desde acá el administrador asigna,
// reasigna, quita el pedido a un repartidor o —si el local lo permite— marca
// una entrega que no se pudo confirmar con el código (con motivo, auditado).
//
// La lista sale siempre de la API. El WebSocket solo avisa cuándo volver a
// pedirla y hay una consulta periódica de respaldo.

const POLL_MS = 15_000;

const EVENT_LABEL: Record<string, string> = {
  assigned: "Asignado",
  reassigned: "Reasignado",
  unassigned: "Pedido quitado al repartidor",
  released: "Liberado",
  picked_up: "Retirado por el repartidor",
  delivered: "Entregado con el código del cliente",
  admin_delivered: "Entregado por el administrador",
  code_failed: "Código incorrecto",
  code_locked: "Código bloqueado por intentos",
  code_viewed: "Código consultado por el administrador",
};

export default function DeliveryPage() {
  const [data, setData] = useState<DeliveryActiveResponse | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [completing, setCompleting] = useState<Order | null>(null);
  const [trailOrder, setTrailOrder] = useState<Order | null>(null);
  const [revealed, setRevealed] = useState<{ orderId: number; code: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [active, list] = await Promise.all([getDeliveryActive(), listCouriers()]);
      setData(active);
      setCouriers(list);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron cargar las entregas. Reintentando…"));
    }
  }, []);

  // Entregas al día con los avisos del servidor; sin conexión en vivo, cada POLL_MS.
  useLiveRefresh({ hello: ownerHello(), refresh, offlineMs: POLL_MS });

  const run = async (orderId: number, action: () => Promise<unknown>, fallback: string) => {
    setBusyId(orderId);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err, fallback));
    } finally {
      await refresh();
      setBusyId(null);
    }
  };

  const config = data?.config;
  const canAdminComplete = !!config && (config.confirmBy === "courier_admin" || config.adminOverride || !config.enabled);
  const reasonRequired = !!config && (config.confirmBy !== "courier_admin" || !config.enabled);
  const activeCouriers = useMemo(() => couriers.filter(courier => courier.active), [couriers]);

  const reveal = async (order: Order) => {
    setActionError(null);
    try {
      setRevealed({ orderId: order.id, code: await revealDeliveryCode(order.id) });
    } catch (err) {
      setActionError(errorCode(err) === "CODE_VISIBLE_TO_CUSTOMER"
        ? "Este cliente ve el código en el seguimiento de su pedido: no hace falta pasárselo."
        : errorMessage(err, "No se pudo consultar el código."));
    }
  };

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Entregas en curso</h1>
          <p className={p.subtitle}>
            {config
              ? `${config.assignMode === "open" ? "Asignación abierta: los repartidores toman los pedidos disponibles." : "Asignación manual: vos elegís el repartidor de cada pedido."} Entrega confirmada por: ${confirmByLabel(config.confirmBy, config.adminOverride).toLowerCase()}.`
              : "Pedidos de delivery asignados a repartidores."}
          </p>
        </div>
        <DeliveryTabs />
      </header>

      {config && !config.enabled && (
        <p className={p.notice} role="status" style={{ padding: "0.75rem 1rem", borderRadius: 16 }}>
          El delivery con repartidores está desactivado: no se asignan pedidos nuevos. Las entregas que ya salieron se pueden terminar de entregar
          desde acá. Podés volver a activarlo en <Link to="/pedidos/configuracion">Configuración de pedidos</Link>.
        </p>
      )}
      {error && <p className={p.error} role="alert">{error}</p>}
      {actionError && <p className={p.error} role="alert">{actionError}</p>}
      {!data && !error && <p className={p.loading}>Cargando entregas…</p>}

      {data && (
        <div className={s.columns}>
          <section className={s.column} aria-label="Sin repartidor">
            <h2 className={s.columnTitle}>Sin repartidor <span className={s.count}>{data.unassigned.length}</span></h2>
            {data.unassigned.length === 0 && <p className={s.empty}>No hay pedidos de delivery esperando repartidor.</p>}
            {data.unassigned.map(order => (
              <article key={order.id} className={s.card} aria-label={`Pedido ${order.number}`}>
                <OrderHead order={order} label={deliveryStageLabel(order)} />
                <CustomerInfo order={order} />
                {config?.enabled ? (
                  <AssignControl
                    couriers={activeCouriers}
                    busy={busyId === order.id}
                    openMode={config.assignMode === "open"}
                    onAssign={(courierId, force) => run(order.id, () => assignDelivery(order.id, { courierId, force }), "No se pudo asignar el pedido.")}
                  />
                ) : (
                  <p className={s.muted}>Delivery desactivado: lo gestionás por fuera.</p>
                )}
              </article>
            ))}
          </section>

          <section className={s.column} aria-label="Entregas con repartidor">
            <h2 className={s.columnTitle}>Con repartidor <span className={s.count}>{data.inProgress.length}</span></h2>
            {data.inProgress.length === 0 && <p className={s.empty}>No hay entregas en curso.</p>}
            {data.inProgress.map(({ order, assignment }) => (
              <InProgressCard
                key={order.id}
                order={order}
                assignment={assignment}
                now={now}
                busy={busyId === order.id}
                couriers={activeCouriers}
                enabled={config?.enabled === true}
                canComplete={canAdminComplete && assignment.status === "picked_up"}
                revealedCode={revealed?.orderId === order.id ? revealed.code : null}
                onDetail={() => setTrailOrder(order)}
                onReassign={(courierId, force, reason) => run(order.id, () => assignDelivery(order.id, { courierId, force, reason }), "No se pudo reasignar el pedido.")}
                onUnassign={reason => run(order.id, () => unassignDelivery(order.id, reason), "No se pudo quitar el pedido al repartidor.")}
                onComplete={() => setCompleting(order)}
                onReveal={() => reveal(order)}
              />
            ))}
          </section>
        </div>
      )}

      {completing && (
        <CompleteModal
          order={completing}
          reasonRequired={reasonRequired}
          onClose={() => setCompleting(null)}
          onDone={() => { setCompleting(null); void refresh(); }}
        />
      )}
      {trailOrder && <TrailModal order={trailOrder} onClose={() => setTrailOrder(null)} />}
    </div>
  );
}

function OrderHead({ order, label }: { order: Order; label: string }) {
  return (
    <header className={s.cardHead}>
      <div>
        <span className={s.number}>#{order.number}</span>
        <span className={s.hint}> · pedido de {formatTime(order.createdAt)}</span>
      </div>
      <span className={s.badge}>{label}</span>
    </header>
  );
}

function AssignControl({ couriers, busy, openMode, onAssign }: {
  couriers: Courier[];
  busy: boolean;
  openMode: boolean;
  onAssign: (courierId: number, force: boolean) => void;
}) {
  const [courierId, setCourierId] = useState("");
  const chosen = couriers.find(courier => String(courier.id) === courierId);
  return (
    <div className={s.assign}>
      <label className={s.assignField}>
        <span className="sr-only">Repartidor</span>
        <select className={p.select} value={courierId} disabled={busy} onChange={event => setCourierId(event.target.value)}>
          <option value="">{openMode ? "Esperando que lo tome un repartidor… (o elegí uno)" : "Elegí un repartidor"}</option>
          {couriers.map(courier => (
            <option key={courier.id} value={courier.id}>
              {courier.name} · {courier.available ? "disponible" : "no disponible"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={p.btnPrimary}
        disabled={busy || !chosen}
        // Un repartidor que no se marcó disponible se asigna a propósito (el backend lo exige explícito).
        onClick={() => chosen && onAssign(chosen.id, !chosen.available)}
      >
        <UserPlus size={16} aria-hidden /> Asignar
      </button>
    </div>
  );
}

function InProgressCard({
  order, assignment, now, busy, couriers, enabled, canComplete, revealedCode,
  onDetail, onReassign, onUnassign, onComplete, onReveal,
}: {
  order: Order;
  assignment: DeliveryAssignment;
  now: number;
  busy: boolean;
  couriers: Courier[];
  enabled: boolean;
  canComplete: boolean;
  revealedCode: string | null;
  onDetail: () => void;
  onReassign: (courierId: number, force: boolean, reason?: string) => void;
  onUnassign: (reason?: string) => void;
  onComplete: () => void;
  onReveal: () => void;
}) {
  const [mode, setMode] = useState<"none" | "reassign" | "unassign">("none");
  const [courierId, setCourierId] = useState("");
  const [reason, setReason] = useState("");
  const onTheRoad = assignment.status === "picked_up";
  const minutes = minutesFrom(assignment.pickedUpAt, now);
  const others = couriers.filter(courier => courier.id !== assignment.courierId);
  const chosen = others.find(courier => String(courier.id) === courierId);
  // Reasignar o quitar un pedido que ya salió exige un motivo.
  const needsReason = onTheRoad;

  const reset = () => { setMode("none"); setReason(""); setCourierId(""); };

  return (
    <article className={s.card} aria-label={`Pedido ${order.number}`}>
      <OrderHead order={order} label={ASSIGNMENT_LABEL[assignment.status]} />
      <dl className={s.facts}>
        <div><dt>Repartidor</dt><dd><strong>{assignment.courierName}</strong>{assignment.assignedVia === "open" ? " (lo tomó)" : ""}</dd></div>
        <div><dt>Asignado</dt><dd>{formatTime(assignment.assignedAt)}</dd></div>
        {assignment.pickedUpAt && <div><dt>Retirado</dt><dd>{formatTime(assignment.pickedUpAt)} · hace {minutesLabel(minutes)}</dd></div>}
        {order.deliveryAddress && <div><dt>Destino</dt><dd><MapPin size={13} aria-hidden /> {order.deliveryAddress}</dd></div>}
        <div><dt>Estado</dt><dd>{deliveryStageLabel({ ...order, delivery: { ...assignment, previousCouriers: [] } })}</dd></div>
      </dl>
      {assignment.codeLocked && <p className={s.warn}>El código de entrega está bloqueado por intentos fallidos.</p>}
      {revealedCode && (
        <p className={s.codeBox} role="status">Código de entrega para pasarle al cliente: <strong>{revealedCode}</strong></p>
      )}

      {mode === "none" ? (
        <div className={s.actions}>
          <button type="button" className={`${p.btn} ${p.small}`} onClick={onDetail}><Eye size={14} aria-hidden /> Detalle</button>
          {enabled && (
            <button type="button" className={`${p.btn} ${p.small}`} disabled={busy} onClick={() => setMode("reassign")}>Reasignar</button>
          )}
          <button type="button" className={`${p.btnGhost} ${p.small}`} disabled={busy} onClick={() => setMode("unassign")}>Quitar repartidor</button>
          {onTheRoad && (
            <button type="button" className={`${p.btnGhost} ${p.small}`} disabled={busy} onClick={onReveal}>Ver código</button>
          )}
          {canComplete && (
            <button type="button" className={`${p.btnPrimary} ${p.small}`} disabled={busy} onClick={onComplete}>
              <PackageCheck size={14} aria-hidden /> Marcar entregado
            </button>
          )}
        </div>
      ) : (
        <div className={s.assign}>
          {mode === "reassign" && (
            <label className={s.assignField}>
              <span className="sr-only">Nuevo repartidor</span>
              <select className={p.select} value={courierId} onChange={event => setCourierId(event.target.value)}>
                <option value="">Elegí al nuevo repartidor</option>
                {others.map(courier => (
                  <option key={courier.id} value={courier.id}>{courier.name} · {courier.available ? "disponible" : "no disponible"}</option>
                ))}
              </select>
            </label>
          )}
          {needsReason && (
            <label className={s.assignField}>
              <span className="sr-only">Motivo</span>
              <input className={p.input} value={reason} maxLength={200} placeholder="Motivo (obligatorio: el pedido ya salió)" onChange={event => setReason(event.target.value)} />
            </label>
          )}
          <div className={p.headerActions}>
            <button
              type="button"
              className={p.btnPrimary}
              disabled={busy || (mode === "reassign" && !chosen) || (needsReason && reason.trim().length < 3)}
              onClick={() => {
                if (mode === "reassign" && chosen) onReassign(chosen.id, !chosen.available, reason.trim() || undefined);
                if (mode === "unassign") onUnassign(reason.trim() || undefined);
                reset();
              }}
            >
              {mode === "reassign" ? "Reasignar" : "Quitar repartidor"}
            </button>
            <button type="button" className={p.btn} onClick={reset}>Cancelar</button>
          </div>
        </div>
      )}
    </article>
  );
}

// Entrega marcada por el administrador sin el código del cliente.
function CompleteModal({ order, reasonRequired, onClose, onDone }: {
  order: Order;
  reasonRequired: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = !reasonRequired || reason.trim().length >= 3;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await completeDelivery(order.id, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "No se pudo marcar la entrega."));
      setSaving(false);
    }
  };

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Marcar entregado el pedido ${order.number}`} onClick={onClose}>
      <form className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()} onSubmit={submit}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Marcar entregado #{order.number}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={`${p.modalBody} ${p.stack}`}>
          <p className={p.subtitle} style={{ lineHeight: 1.5 }}>
            Normalmente el repartidor confirma la entrega con el código que le da el cliente. Usá esto solo para resolver una incidencia: queda registrado
            quién lo hizo y por qué.
          </p>
          <label className={p.field}>
            <span className={p.label}>Motivo {reasonRequired ? "(obligatorio)" : "(opcional)"}</span>
            <input
              className={p.input}
              value={reason}
              maxLength={200}
              autoFocus
              placeholder="Ej: el cliente confirmó por teléfono, al repartidor se le trabó la app"
              onChange={event => setReason(event.target.value)}
            />
          </label>
          {error && <p className={p.error} role="alert">{error}</p>}
        </div>
        <footer className={p.modalFooter}>
          <button type="submit" className={p.btnPrimary} disabled={saving || !valid}>Confirmar entrega</button>
          <button type="button" className={p.btn} onClick={onClose}>Volver</button>
        </footer>
      </form>
    </div>
  );
}

// Quién fue responsable del pedido y qué pasó (auditoría).
function TrailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [trail, setTrail] = useState<DeliveryTrail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDeliveryTrail(order.id)
      .then(result => { if (!cancelled) setTrail(result); })
      .catch(err => { if (!cancelled) setError(errorMessage(err, "No se pudo cargar el detalle.")); });
    return () => { cancelled = true; };
  }, [order.id]);

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Detalle del pedido ${order.number}`} onClick={onClose}>
      <div className={p.modal} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Pedido #{order.number}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={`${p.modalBody} ${p.stack}`}>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {order.items.map(item => (
              <li key={item.id}>{item.quantity}× {item.title}{item.option ? ` · ${item.option}` : ""}{item.notes && <em> ({item.notes})</em>}</li>
            ))}
          </ul>
          <CustomerInfo order={order} />
          {error && <p className={p.error}>{error}</p>}
          {!trail && !error && <p className={p.loading}>Cargando…</p>}
          {trail && (
            <>
              <h3 className={p.cardTitle}>Responsables</h3>
              {trail.assignments.map(assignment => (
                <div key={assignment.id} className={p.switchRow}>
                  <div className={p.switchText}>
                    <span className={p.switchTitle}>{assignment.courierName} · {ASSIGNMENT_LABEL[assignment.status]}</span>
                    <span className={p.switchHint}>
                      Asignado {formatDateTime(assignment.assignedAt)}
                      {assignment.pickedUpAt && ` · retirado ${formatDateTime(assignment.pickedUpAt)}`}
                      {assignment.deliveredAt && ` · entregado ${formatDateTime(assignment.deliveredAt)}`}
                      {assignment.releasedAt && ` · liberado ${formatDateTime(assignment.releasedAt)}`}
                    </span>
                  </div>
                </div>
              ))}
              <h3 className={p.cardTitle}>Registro</h3>
              {trail.events.map(event => (
                <div key={event.id} className={p.switchRow}>
                  <div className={p.switchText}>
                    <span className={p.switchTitle}>{EVENT_LABEL[event.type] ?? event.type}</span>
                    <span className={p.switchHint}>
                      {formatDateTime(event.createdAt)} · {event.actorName ?? (event.actorType === "system" ? "Sistema" : "—")}
                      {event.reason && ` · Motivo: ${event.reason}`}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
