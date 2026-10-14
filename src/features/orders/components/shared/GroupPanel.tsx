import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Send, Users, X } from "lucide-react";
import { errorCode, errorMessage } from "../../lib/errors";
import { formatMoney } from "../../lib/format";
import { formatJoinCode } from "../../lib/groupSession";
import { groupJoinUrl } from "../../lib/qrUrls";
import { uuid } from "../../lib/storage";
import type { GroupSession, GroupStaffApi } from "../../types";
import p from "../panel/panel.module.css";
import s from "./Bill.module.css";
import { useDialogs } from "../../../../context/useDialogs";

// Pedido grupal de una mesa, visto por el personal (app del operador y Mesas
// del panel): abrirlo, mostrar el QR / código para que los comensales se
// sumen desde su celular, ver lo que va cargando cada uno y enviarlo. Al
// enviarlo sale un pedido común de la mesa (con el autor de cada producto) y
// se suma solo a la cuenta.

interface Props {
  api: GroupStaffApi;
  slug: string;
  tableNumber: number;
  // null: la mesa no tiene un pedido grupal abierto.
  group: GroupSession | null;
  onChanged: () => void;
  onAuthError?: (err: unknown) => boolean;
  onNotice?: (message: string) => void;
}

export default function GroupPanel({ api, slug, tableNumber, group, onChanged, onAuthError, onNotice }: Props) {
  const dialogs = useDialogs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  // Mismo carrito = mismo id de envío: un reintento no duplica el pedido.
  const request = useRef<{ key: string; id: string } | null>(null);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      if (onAuthError?.(err)) return;
      // Otro dispositivo lo envió o lo cambió recién: se muestra cómo quedó.
      if (errorCode(err) === "GROUP_CART_CHANGED" || errorCode(err) === "GROUP_CART_EMPTY") onChanged();
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  if (!group) {
    return (
      <div className={s.rowActions}>
        <button
          type="button"
          className={`${p.btnGhost} ${p.small}`}
          disabled={busy}
          onClick={() => run(async () => { await api.open(tableNumber); setShowJoin(true); }, "No se pudo abrir el pedido grupal.")}
        >
          <Users size={14} aria-hidden /> Abrir pedido grupal
        </button>
        {error && <p className={p.error} role="alert">{error}</p>}
      </div>
    );
  }

  const send = () => {
    const key = group.cart.map(item => `${item.id}:${item.quantity}`).join(",");
    if (request.current?.key !== key) request.current = { key, id: uuid() };
    const id = request.current.id;
    void run(async () => {
      const { order } = await api.send(group.id, id);
      request.current = null;
      onNotice?.(`Pedido grupal #${order.number} enviado · Mesa ${tableNumber}.`);
    }, "No se pudo enviar el pedido del grupo.");
  };

  const close = async () => {
    const pending = group.cart.length > 0 ? "Lo que cargaron y no se envió se descarta. " : "";
    if (!(await dialogs.confirm({
      title: `¿Cerrar el pedido grupal de la mesa ${tableNumber}?`,
      message: `${pending}La mesa sigue abierta.`,
      confirmLabel: "Cerrar pedido grupal",
      danger: group.cart.length > 0,
    }))) return;
    void run(() => api.close(group.id), "No se pudo cerrar el pedido grupal.");
  };

  return (
    <div className={s.group} aria-label={`Pedido grupal de la mesa ${tableNumber}`}>
      <div className={s.groupHead}>
        <span className={s.groupTitle}>
          <Users size={15} aria-hidden /> Pedido grupal · {group.members.length} {group.members.length === 1 ? "integrante" : "integrantes"}
        </span>
        <button type="button" className={`${p.btn} ${p.small}`} onClick={() => setShowJoin(true)}>
          <QrCode size={14} aria-hidden /> QR y código
        </button>
      </div>

      {group.members.length > 0 && (
        <div className={s.chips}>
          {group.members.map(member => <span key={member.id} className={`${s.chip} ${s.chipStatic}`}>{member.name}</span>)}
        </div>
      )}

      {group.cart.length === 0 ? (
        <p className={s.hint}>
          {group.members.length === 0
            ? "Mostrá el QR o el código para que se sumen desde su celular."
            : "Todavía no cargaron nada nuevo."}
        </p>
      ) : (
        <>
          <ul className={s.list}>
            {group.cart.map(item => (
              <li key={item.id} className={s.cartLine}>
                <span className={s.cartQty}>{item.quantity}×</span>
                <span className={s.cartText}>
                  <span>{item.title}{item.option && ` · ${item.option}`}</span>
                  <small>{item.authorName}{item.notes && ` · ${item.notes}`}</small>
                </span>
                {item.shared ? <span className={s.tag}>Compartido</span> : <span />}
                <button
                  type="button"
                  className={p.iconBtn}
                  disabled={busy}
                  aria-label={`Sacar ${item.title} de ${item.authorName}`}
                  onClick={() => run(() => api.removeItem(group.id, item.id), "No se pudo sacar el producto.")}
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={p.btnPrimary} disabled={busy} onClick={send}>
            <Send size={16} aria-hidden /> {busy ? "Enviando…" : `Enviar pedido del grupo · ${formatMoney(group.cartTotal)}`}
          </button>
        </>
      )}

      {error && <p className={p.error} role="alert">{error}</p>}

      <button type="button" className={`${p.btnGhost} ${p.small}`} style={{ alignSelf: "flex-start" }} disabled={busy} onClick={close}>
        Cerrar pedido grupal
      </button>

      {showJoin && <JoinModal slug={slug} group={group} onClose={() => setShowJoin(false)} />}
    </div>
  );
}

// Abre el pedido grupal de una mesa por su número (sirve para una que todavía no pidió nada).
export function OpenGroupForm({ api, onOpened, onAuthError }: {
  api: GroupStaffApi;
  onOpened: () => void;
  onAuthError?: (err: unknown) => boolean;
}) {
  const [table, setTable] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.open(Number(table));
      setTable("");
      onOpened();
    } catch (err) {
      if (!onAuthError?.(err)) setError(errorMessage(err, "No se pudo abrir el pedido grupal."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={p.row} onSubmit={event => { event.preventDefault(); void open(); }}>
      <label className={p.guestsField}>
        Mesa
        <input className={p.input} type="number" min={1} inputMode="numeric" value={table} onChange={event => setTable(event.target.value)} />
      </label>
      <button type="submit" className={p.btn} disabled={busy || !(Number(table) >= 1)}>Abrir pedido grupal</button>
      {error && <p className={p.error} role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
    </form>
  );
}

// QR, enlace y código para que los comensales se sumen.
function JoinModal({ slug, group, onClose }: { slug: string; group: GroupSession; onClose: () => void }) {
  const url = groupJoinUrl(slug, group.joinToken);
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 480, margin: 1 })
      .then(data => { if (!cancelled) setImage(data); })
      .catch(() => { /* queda el código para tipear */ });
    return () => { cancelled = true; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: queda el QR y el código.
    }
  };

  return (
    <div className={p.overlay} role="dialog" aria-modal="true" aria-label={`Sumarse al pedido de la mesa ${group.tableNumber}`} onClick={onClose}>
      <div className={`${p.modal} ${p.modalSmall}`} onClick={event => event.stopPropagation()}>
        <header className={p.modalHeader}>
          <h2 className={p.modalTitle}>Pedido grupal · Mesa {group.tableNumber}</h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden /></button>
        </header>
        <div className={`${p.modalBody} ${s.joinBox}`}>
          <p className={p.subtitle} style={{ lineHeight: 1.5 }}>
            Cada comensal escanea este QR con su celular y carga lo suyo. Quien ya escaneó el QR de la mesa
            puede tocar «Pedir en grupo» en la carta y tipear el código.
          </p>
          {image ? <img src={image} alt="QR para sumarse al pedido grupal" className={s.joinQr} /> : <p className={p.loading}>Generando…</p>}
          <span className={s.code} aria-label={`Código ${group.code.split("").join(" ")}`}>{formatJoinCode(group.code)}</span>
          <button type="button" className={`${p.btnGhost} ${p.small}`} onClick={copy}>
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
        </div>
      </div>
    </div>
  );
}
