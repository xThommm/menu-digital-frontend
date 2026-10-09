import { useState } from "react";
import { CheckCircle2, Clock, HandHelping, MapPin, MessageSquareText, Navigation, PackageCheck, Phone, UserRound } from "lucide-react";
import { courierAction, isCodeComplete, mapsUrl, minutesFrom, minutesLabel, phoneHref, sanitizeCodeInput, waitText } from "../../lib/delivery";
import { formatTime } from "../../lib/format";
import type { CourierOrder } from "../../types";
import p from "../panel/panel.module.css";
import s from "./CourierApp.module.css";

// Tarjeta de un pedido en la app del repartidor. Según de quién sea muestra
// lo necesario para retirarlo y entregarlo; los pedidos disponibles para tomar
// solo muestran el destino (los datos del cliente aparecen al tomarlo).

type Mode = "mine" | "open" | "history";

interface Props {
  order: CourierOrder;
  mode: Mode;
  now: number;
  busy: boolean;
  // Hay otra acción en curso: nada más se puede tocar hasta que termine.
  disabled: boolean;
  notice: { tone: "ok" | "error"; text: string } | null;
  onPickup: (order: CourierOrder) => void;
  onClaim: (order: CourierOrder) => void;
  onDeliver: (order: CourierOrder, code: string) => void;
}

export default function CourierOrderCard({ order, mode, now, busy, disabled, notice, onPickup, onClaim, onDeliver }: Props) {
  const [code, setCode] = useState("");
  const action = mode === "mine" ? courierAction(order) : "none";
  const assignment = order.assignment;
  const phone = phoneHref(order.customerPhone);
  const sinceReady = minutesFrom(order.readyAt, now);
  const sincePickup = minutesFrom(assignment?.pickedUpAt, now);
  const locked = assignment?.codeLocked === true;

  return (
    <article className={s.card} aria-label={`Pedido ${order.number}`}>
      <header className={s.cardHead}>
        <span className={s.number}>#{order.number}</span>
        <span className={`${s.badge} ${action === "deliver" ? s.badgeRoad : order.orderStatus === "ready" ? s.badgeReady : ""}`}>
          {mode === "history"
            ? "Entregado"
            : action === "deliver"
              ? "En camino"
              : order.orderStatus === "ready" ? "Listo para retirar" : "En preparación"}
        </span>
      </header>

      {order.address ? (
        <div className={s.address}>
          <MapPin size={18} aria-hidden />
          <span>{order.address}</span>
          <a className={s.mapBtn} href={mapsUrl(order.address)} target="_blank" rel="noopener noreferrer">
            <Navigation size={15} aria-hidden /> Abrir en mapas
          </a>
        </div>
      ) : (
        <p className={s.muted}>Sin dirección cargada.</p>
      )}

      {mode !== "open" && (order.deliveryNotes || order.customerName || order.customerPhone) && (
        <div className={s.details}>
          {order.deliveryNotes && <span><MessageSquareText size={14} aria-hidden /> {order.deliveryNotes}</span>}
          {order.customerName && <span><UserRound size={14} aria-hidden /> {order.customerName}</span>}
          {order.customerPhone && (
            <span>
              <Phone size={14} aria-hidden />{" "}
              {phone ? <a href={phone}>{order.customerPhone}</a> : order.customerPhone}
            </span>
          )}
        </div>
      )}

      {order.items && order.items.length > 0 && (
        <ul className={s.items}>
          {order.items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <strong>{item.quantity}×</strong> {item.title}{item.option ? ` · ${item.option}` : ""}
              {item.notes && <em> ({item.notes})</em>}
            </li>
          ))}
        </ul>
      )}
      {mode === "open" && order.itemsCount !== undefined && (
        <p className={s.muted}>{order.itemsCount} {order.itemsCount === 1 ? "producto" : "productos"}. Los datos del cliente los ves al tomarlo.</p>
      )}
      {order.notes && <p className={s.orderNote}><MessageSquareText size={14} aria-hidden /> {order.notes}</p>}

      <p className={s.times}>
        <Clock size={13} aria-hidden />{" "}
        {mode === "history"
          ? <>Entregado {assignment?.deliveredAt ? formatTime(assignment.deliveredAt) : ""}{order.durationMinutes != null ? ` · ${minutesLabel(order.durationMinutes)} de viaje` : ""}</>
          : <>
            {assignment ? `Asignado ${formatTime(assignment.assignedAt)}` : `Pedido ${formatTime(order.createdAt)}`}
            {assignment?.pickedUpAt && ` · retirado ${formatTime(assignment.pickedUpAt)} (hace ${minutesLabel(sincePickup)})`}
            {!assignment?.pickedUpAt && order.orderStatus === "ready" && sinceReady !== null && ` · listo hace ${minutesLabel(sinceReady)}`}
          </>}
      </p>

      {notice && (
        <p className={notice.tone === "ok" ? p.success : p.error} role={notice.tone === "ok" ? "status" : "alert"} style={{ margin: 0, padding: "0.6rem 0.85rem", borderRadius: 14 }}>
          {notice.text}
        </p>
      )}

      {action === "wait" && <p className={s.wait}>{waitText(order)}</p>}

      {action === "pickup" && (
        <button type="button" className={`${p.btnPrimary} ${s.bigBtn}`} disabled={disabled || busy} onClick={() => onPickup(order)}>
          <PackageCheck size={18} aria-hidden /> {busy ? "Retirando…" : "Retirar pedido"}
        </button>
      )}

      {action === "deliver" && (
        <form
          className={s.deliverForm}
          onSubmit={event => {
            event.preventDefault();
            if (isCodeComplete(code) && !locked) onDeliver(order, code);
          }}
        >
          <label className={p.field}>
            <span className={p.label}>Código de entrega que te da el cliente</span>
            <input
              className={`${p.input} ${s.codeInput}`}
              value={code}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="000000"
              disabled={disabled || busy || locked}
              onChange={event => setCode(sanitizeCodeInput(event.target.value))}
              aria-label="Código de entrega de 6 dígitos"
            />
          </label>
          {locked && <p className={p.error} role="alert" style={{ margin: 0, padding: "0.6rem 0.85rem", borderRadius: 14 }}>Demasiados intentos. Esperá unos minutos o pedile ayuda al local.</p>}
          <button type="submit" className={`${p.btnPrimary} ${s.bigBtn}`} disabled={disabled || busy || locked || !isCodeComplete(code)}>
            <CheckCircle2 size={18} aria-hidden /> {busy ? "Confirmando…" : "Confirmar entrega"}
          </button>
        </form>
      )}

      {mode === "open" && (
        <button type="button" className={`${p.btnPrimary} ${s.bigBtn}`} disabled={disabled || busy} onClick={() => onClaim(order)}>
          <HandHelping size={18} aria-hidden /> {busy ? "Tomando…" : "Tomar pedido"}
        </button>
      )}
    </article>
  );
}
