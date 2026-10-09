import { Bike, GlassWater, ShoppingBag, UtensilsCrossed } from "lucide-react";
import type { ServiceDraft } from "../../lib/service";
import type { ServiceType } from "../../types";
import p from "../panel/panel.module.css";

// Dónde va el pedido (mesa, barra, take away o delivery) y, para take away
// y delivery, los datos de quien retira o recibe. Lo usan el alta manual del
// panel y el tomador del operador. El borrador y su conversión viven en
// lib/service.ts.

const OPTIONS: { value: ServiceType; label: string; icon: React.ReactNode }[] = [
  { value: "table", label: "Mesa", icon: <UtensilsCrossed size={14} aria-hidden /> },
  { value: "counter", label: "Barra", icon: <GlassWater size={14} aria-hidden /> },
  { value: "takeaway", label: "Take away", icon: <ShoppingBag size={14} aria-hidden /> },
  { value: "delivery", label: "Delivery", icon: <Bike size={14} aria-hidden /> },
];

interface Props {
  value: ServiceDraft;
  onChange: (value: ServiceDraft) => void;
  tableCount: number;
  // Tipos que se pueden elegir (por defecto todos). Con uno solo no se muestra el selector.
  allowed?: ServiceType[];
}

export default function ServiceFields({ value, onChange, tableCount, allowed }: Props) {
  const set = (patch: Partial<ServiceDraft>) => onChange({ ...value, ...patch });
  const withCustomer = value.serviceType === "takeaway" || value.serviceType === "delivery";
  const options = allowed ? OPTIONS.filter(option => allowed.includes(option.value)) : OPTIONS;

  return (
    <div className={p.stack} style={{ gap: "0.75rem" }}>
      {options.length > 1 && (
      <div className={p.field}>
        <span className={p.label}>Tipo de pedido</span>
        <div className={p.segmented} role="radiogroup" aria-label="Tipo de pedido">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value.serviceType === option.value}
              className={`${p.segment} ${value.serviceType === option.value ? p.segmentActive : ""}`}
              onClick={() => set({ serviceType: option.value })}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {value.serviceType === "table" && (
        <label className={p.field}>
          <span className={p.label}>Mesa</span>
          <select className={p.select} value={value.table} onChange={event => set({ table: event.target.value })} required>
            <option value="">Elegí la mesa</option>
            {Array.from({ length: tableCount }, (_, index) => (
              <option key={index + 1} value={index + 1}>Mesa {index + 1}</option>
            ))}
          </select>
        </label>
      )}

      {withCustomer && (
        <>
          <div className={p.row}>
            <label className={p.field}>
              <span className={p.label}>{value.serviceType === "delivery" ? "Quién recibe" : "Quién retira"} (opcional)</span>
              <input className={p.input} value={value.customerName} maxLength={60} autoComplete="off" onChange={event => set({ customerName: event.target.value })} />
            </label>
            <label className={p.field}>
              <span className={p.label}>Teléfono (opcional)</span>
              <input className={p.input} value={value.customerPhone} maxLength={30} inputMode="tel" autoComplete="off" onChange={event => set({ customerPhone: event.target.value })} />
            </label>
          </div>
          {value.serviceType === "delivery" && (
            <label className={p.field}>
              <span className={p.label}>Dirección de entrega (opcional)</span>
              <input className={p.input} value={value.deliveryAddress} maxLength={200} autoComplete="off" onChange={event => set({ deliveryAddress: event.target.value })} placeholder="Calle, número, piso, depto" />
            </label>
          )}
          <label className={p.field}>
            <span className={p.label}>{value.serviceType === "delivery" ? "Notas del envío" : "Notas del retiro"} (opcional)</span>
            <input
              className={p.input}
              value={value.deliveryNotes}
              maxLength={200}
              onChange={event => set({ deliveryNotes: event.target.value })}
              placeholder={value.serviceType === "delivery" ? "Ej: timbre 3B, paga con $20.000" : "Ej: retira a las 21:30"}
            />
          </label>
        </>
      )}
    </div>
  );
}
