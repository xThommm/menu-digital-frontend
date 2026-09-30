import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../../context/useAuth";
import { createPanelOrder } from "../../api/ordersApi";
import { useOrderingMenu } from "../../hooks/usePanelData";
import { errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/format";
import { uuid } from "../../lib/storage";
import { lineKey, toOrderLines, unitsCount, unitsTotal, type UnitLine } from "../../lib/units";
import type { Order, Waiter } from "../../types";
import ProductPicker, { type PickedProduct } from "../shared/ProductPicker";
import { emptyService, serviceReady, toServiceInput, type ServiceDraft } from "../../lib/service";
import ServiceFields from "../shared/ServiceFields";
import UnitLinesEditor from "../shared/UnitLinesEditor";
import p from "./panel.module.css";
import s from "./OrdersBoard.module.css";

// Alta manual de un pedido desde el panel (ej. un pedido en la barra, por
// teléfono o un delivery). Entra confirmado.

interface Props {
  tableCount: number;
  waiters: Waiter[];
  onClose: () => void;
  onCreated: (order: Order) => void;
}

export default function ManualOrderModal({ tableCount, waiters, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const menu = useOrderingMenu(user?.slug);
  const [lines, setLines] = useState<UnitLine[]>([]);
  const [service, setService] = useState<ServiceDraft>(() => emptyService("counter"));
  const [waiterId, setWaiterId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mismo contenido = mismo id de envío: un doble clic o un reintento tras
  // un corte de red no duplica el pedido.
  const request = useRef<{ key: string; id: string } | null>(null);
  const hidePrices = menu.data?.user.menuDisplay?.hidePrices === true;

  const addProduct = (product: PickedProduct) => {
    setLines(prev => {
      const key = lineKey(product.itemId, product.option);
      const existing = prev.find(line => lineKey(line.itemId, line.option) === key);
      if (existing) return prev.map(line => (line === existing ? { ...line, quantity: Math.min(20, line.quantity + 1) } : line));
      return [...prev, { ...product, quantity: 1, unitNotes: [] }];
    });
  };

  const submit = async () => {
    if (lines.length === 0 || !serviceReady(service)) return;
    const items = toOrderLines(lines);
    const payload = { ...toServiceInput(service), items, waiterId: waiterId ? Number(waiterId) : null, notes: notes.trim() || undefined };
    const key = JSON.stringify(payload);
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    setSaving(true);
    setError(null);
    try {
      const order = await createPanelOrder({ ...payload, clientRequestId: request.current.id });
      request.current = null;
      onCreated(order);
    } catch (err) {
      setError(errorMessage(err, "No se pudo cargar el pedido."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label="Nuevo pedido" onClick={onClose}>
      <div className={`${p.modal} ${s.manualModal}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Nuevo pedido</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>

        <div className={`${p.modalBody} ${s.manualBody}`}>
          <section className={s.manualPicker} aria-label="Productos">
            {menu.loading && <p className={p.loading}>Cargando carta…</p>}
            {menu.error && <p className={p.error}>{menu.error}</p>}
            {menu.data && <ProductPicker menu={menu.data.menu} hidePrices={hidePrices} onPick={addProduct} />}
          </section>

          <section className={s.manualCart} aria-label="Pedido">
            <ServiceFields value={service} onChange={setService} tableCount={tableCount} />

            <label className={p.field}>
              <span className={p.label}>Operador</span>
              <select className={p.select} value={waiterId} onChange={event => setWaiterId(event.target.value)}>
                <option value="">Sin asignar</option>
                {waiters.filter(waiter => waiter.active).map(waiter => (
                  <option key={waiter.id} value={waiter.id}>{waiter.name}</option>
                ))}
              </select>
            </label>

            <UnitLinesEditor lines={lines} onChange={setLines} hidePrices={hidePrices} />

            <label className={p.field}>
              <span className={p.label}>Nota del pedido (opcional)</span>
              <input
                className={p.input}
                value={notes}
                maxLength={200}
                onChange={event => setNotes(event.target.value)}
                placeholder="Ej: traer todo junto"
              />
            </label>

            {error && <p className={p.error}>{error}</p>}
          </section>
        </div>

        <footer className={p.modalFooter}>
          <span className={s.manualSummary}>
            {unitsCount(lines)} producto(s){!hidePrices && ` · ${formatMoney(unitsTotal(lines))}`}
          </span>
          <button type="button" className={p.btn} onClick={onClose}>Cancelar</button>
          <button type="button" className={p.btnPrimary} disabled={saving || lines.length === 0 || !serviceReady(service)} onClick={submit}>
            {saving ? "Guardando…" : service.serviceType === "table" && !service.table ? "Elegí la mesa" : "Cargar pedido"}
          </button>
        </footer>
      </div>
    </div>
  );
}
