import { useRef, useState } from "react";
import { useCart } from "../../../../context/useCart";
import { createOnlineCheckout } from "../../api/publicOrdersApi";
import { errorMessage } from "../../lib/errors";
import { uuid } from "../../lib/storage";
import { estimateSentence } from "../../lib/orderTracking";
import type { OnlineOrderingConfig, OnlineServiceType } from "../../types";
import s from "./OnlineCheckout.module.css";

// "Pagar con Mercado Pago" en el carrito de la carta pública (take away y
// delivery). El precio y el total los calcula el servidor; acá solo se
// mandan productos y datos de contacto. La configuración (si el local cobra
// online) llega ya resuelta desde useOnlineOrdering; sin ella no se muestra
// nada y la carta sigue pidiendo por WhatsApp.

const SERVICE_LABEL: Record<OnlineServiceType, string> = { takeaway: "Retiro en el local", delivery: "Delivery" };
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

interface Props {
  slug: string;
  config: OnlineOrderingConfig;
  // Estilo del botón que abre el formulario (el panel de escritorio usa el suyo).
  className?: string;
  // El formulario abierto es alto: el carrito lo usa para dejarle todo el lugar.
  onOpenChange?: (open: boolean) => void;
}

// Lugar reservado mientras se sabe si el local cobra online: evita que los
// botones aparezcan de a uno.
export function CheckoutSkeleton({ className }: { className?: string }) {
  return <div className={`${s.skeleton} ${className ?? ""}`} aria-hidden />;
}

export default function OnlineCheckout({ slug, config, className, onOpenChange }: Props) {
  const { items, totalPrice } = useCart();
  const [open, setOpenState] = useState(false);
  const [mode, setMode] = useState<OnlineServiceType>(config.modes[0] ?? "takeaway");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mismo contenido = mismo id de envío: un doble toque no crea dos checkouts.
  const request = useRef<{ key: string; id: string } | null>(null);

  const setOpen = (value: boolean) => {
    setOpenState(value);
    onOpenChange?.(value);
  };

  if (!config.enabled || config.modes.length === 0 || items.length === 0) return null;

  const needsAddress = mode === "delivery";
  const ready = name.trim().length > 0 && phone.trim().length > 0 && (!needsAddress || address.trim().length > 0);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const lines = items.map(line => ({ itemId: line.itemId, option: line.selectedOption, quantity: line.quantity }));
      const key = JSON.stringify([mode, name, phone, address, notes, lines]);
      if (request.current?.key !== key) request.current = { key, id: uuid() };
      const checkout = await createOnlineCheckout(slug, {
        serviceType: mode,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        deliveryAddress: needsAddress ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        items: lines,
        clientRequestId: request.current.id,
      });
      if (!checkout.checkoutUrl) {
        setError(checkout.status === "APPROVED" ? "Este pedido ya está pagado." : "Este pago ya no está disponible. Armá el pedido de nuevo.");
        setBusy(false);
        return;
      }
      // Sigue en Mercado Pago; al volver, la carta consulta el resultado al servidor.
      window.location.assign(checkout.checkoutUrl);
    } catch (err) {
      setError(errorMessage(err, "No se pudo iniciar el pago. Intentá de nuevo."));
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className={className ?? s.mpBtn} onClick={() => setOpen(true)}>
        Pagar con Mercado Pago
      </button>
    );
  }

  return (
    <form className={s.form} onSubmit={event => { event.preventDefault(); if (ready && !busy) void pay(); }}>
      <h3 className={s.formTitle}>Pagá online y retirá o recibí tu pedido</h3>

      {config.modes.length > 1 && (
        <div className={s.modes} role="radiogroup" aria-label="Cómo querés recibirlo">
          {config.modes.map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={mode === option}
              className={`${s.mode} ${mode === option ? s.modeActive : ""}`}
              onClick={() => setMode(option)}
            >
              {SERVICE_LABEL[option]}
            </button>
          ))}
        </div>
      )}
      {config.modes.length === 1 && <p className={s.hint}>{SERVICE_LABEL[config.modes[0]]}</p>}

      <label className={s.field}>
        <span>Tu nombre</span>
        <input value={name} maxLength={60} autoComplete="name" onChange={event => setName(event.target.value)} />
      </label>
      <label className={s.field}>
        <span>Teléfono de contacto</span>
        <input value={phone} maxLength={30} inputMode="tel" autoComplete="tel" onChange={event => setPhone(event.target.value)} />
      </label>
      {needsAddress && (
        <label className={s.field}>
          <span>Dirección de entrega</span>
          <input value={address} maxLength={140} autoComplete="street-address" onChange={event => setAddress(event.target.value)} />
        </label>
      )}
      <label className={s.field}>
        <span>Aclaración del pedido (opcional)</span>
        <textarea value={notes} rows={2} maxLength={200} onChange={event => setNotes(event.target.value)} />
      </label>

      {estimateSentence(config.estimate) && <p className={s.eta}>{estimateSentence(config.estimate)}</p>}

      <p className={s.hint}>
        Total a pagar: {fmt(totalPrice)}. Te llevamos a Mercado Pago para pagar y el pedido le llega al local cuando
        el pago se aprueba. Si el local no puede cumplirlo, te devuelve el dinero.
      </p>
      {error && <p className={s.error} role="alert">{error}</p>}

      {/* Pegado al borde de abajo del área que scrollea: el botón siempre se ve,
          sin importar la altura de la pantalla ni el teclado. */}
      <div className={s.actions}>
        <button type="button" className={s.back} disabled={busy} onClick={() => setOpen(false)}>Volver</button>
        <button type="submit" className={s.mpBtn} style={{ flex: 1 }} disabled={!ready || busy}>
          {busy ? "Abriendo Mercado Pago…" : "Ir a pagar"}
        </button>
      </div>
    </form>
  );
}
