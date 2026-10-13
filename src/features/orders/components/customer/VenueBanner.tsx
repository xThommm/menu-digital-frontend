import { useState } from "react";
import { MapPin, Users } from "lucide-react";
import { formatDateTime, formatMoney } from "../../lib/format";
import { readOrderHistory } from "../../lib/venueSession";
import type { InVenueContext } from "../../lib/venueSession";
import cart from "../../../../components/User/Home/Menu/CartDrawer.module.css";
import s from "./VenueOrder.module.css";

// Aviso arriba de la carta cuando el comensal escaneó el QR del local: su
// mesa, si puede pedir desde acá o tiene que pedírselo al personal, y acceso a
// los pedidos que ya hizo (historial en su navegador). La sesión dura unas
// horas (ver venueSession.ts): quien vuelve a abrir la carta desde su casa
// sale con "No estoy en el local" y la carta queda como para cualquiera.

interface Props {
  slug: string;
  context: InVenueContext;
  hidePrices: boolean;
  // Cambia con cada pedido enviado para releer el historial.
  historyVersion: number;
  onLeave: () => void;
  // Abre "Pedir en grupo" (ausente: el comensal ya es parte de un pedido grupal).
  onGroup?: () => void;
}

export default function VenueBanner({ slug, context, hidePrices, historyVersion, onLeave, onGroup }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  // Se relee del localStorage en cada render: el padre cambia historyVersion
  // después de cada envío justamente para provocar ese render.
  const history = context.history && historyVersion >= 0 ? readOrderHistory(slug) : [];

  const where = context.tableNumber ? `Mesa ${context.tableNumber}` : "Estás en el local";
  const message = context.ordering
    ? "Armá tu pedido y envialo desde acá."
    : "Para pedir, llamá a alguien del personal.";

  return (
    <>
      <div className={`${s.banner} ${s.scope}`} role="note">
        <span className={s.bannerIcon}><MapPin size={18} aria-hidden /></span>
        <span className={s.bannerText}>
          <strong>{where}</strong>
          <span>{message}</span>
          <button type="button" className={s.bannerLeave} onClick={onLeave}>
            No estoy en el local
          </button>
        </span>
        {(onGroup || history.length > 0) && (
          <span className={s.bannerActions}>
            {onGroup && (
              <button type="button" className={s.bannerBtn} onClick={onGroup}>
                <Users size={14} aria-hidden /> Pedir en grupo
              </button>
            )}
            {history.length > 0 && (
              <button type="button" className={s.bannerBtn} onClick={() => setHistoryOpen(true)}>
                Mis pedidos ({history.length})
              </button>
            )}
          </span>
        )}
      </div>

      {historyOpen && (
        <div className={`${cart.overlay} ${s.scope}`} onClick={() => setHistoryOpen(false)} role="dialog" aria-modal="true" aria-label="Mis pedidos">
          <div className={cart.drawer} onClick={event => event.stopPropagation()}>
            <header className={cart.header}>
              <h2 className={`${cart.title} t-family-heading`}>Mis pedidos</h2>
              <button className={cart.close} onClick={() => setHistoryOpen(false)} aria-label="Cerrar" type="button">✕</button>
            </header>
            <div className={s.body}>
              <p className={s.hint}>Se guardan solo en este teléfono.</p>
              <ul className={s.historyList}>
                {history.map(entry => (
                  <li key={`${entry.createdAt}-${entry.number}`} className={s.historyItem}>
                    <div className={s.historyHead}>
                      <strong>Pedido #{entry.number}{entry.tableNumber ? ` · Mesa ${entry.tableNumber}` : ""}</strong>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <ul className={s.historyLines}>
                      {entry.items.map((item, index) => (
                        <li key={index}>
                          <span className={s.historyQty}>{item.quantity}×</span>{item.title}{item.option ? ` · ${item.option}` : ""}
                          {item.notes && <em> ({item.notes})</em>}
                        </li>
                      ))}
                    </ul>
                    {!hidePrices && <div className={s.historyTotal}><span>Total</span><strong>{formatMoney(entry.total)}</strong></div>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
