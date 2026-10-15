import { useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, Send, Share2, Trash2, Users } from "lucide-react";
import { useCart } from "../../../../context/useCart";
import {
  addGroupItems, joinGroup, leaveGroup, openVenueGroup, removeGroupItem, sendGroupOrder, updateGroupItem,
} from "../../api/publicOrdersApi";
import type { GroupState } from "../../hooks/useGroupSession";
import { useCartUnitLines } from "../../hooks/useCartUnitLines";
import { errorCode, errorMessage, errorStatus } from "../../lib/errors";
import { formatMoney, STATUS_LABEL } from "../../lib/format";
import {
  cleanJoinCode, formatJoinCode, groupByAuthor, isJoinCode, toGroupLines, type JoinParam,
} from "../../lib/groupSession";
import { groupJoinUrl } from "../../lib/qrUrls";
import { uuid } from "../../lib/storage";
import { toOrderLines } from "../../lib/units";
import { readChosenTable, saveChosenTable, type InVenueContext } from "../../lib/venueSession";
import type { GroupCartItem, GroupSession } from "../../types";
import UnitLinesEditor from "../shared/UnitLinesEditor";
import cart from "../../../../components/User/Home/Menu/CartDrawer.module.css";
import s from "./VenueOrder.module.css";
import { useDialogs } from "../../../../context/useDialogs";

// Pedido grupal del comensal: varios de la mesa arman un pedido entre todos,
// cada uno desde su celular.
//   · GroupJoinDialog: abrir el pedido de la mesa o sumarse (QR, enlace o código).
//   · GroupBanner: aviso arriba de la carta mientras es parte de uno.
//   · GroupOrderDrawer: el carrito, que acá es de todos. Lo que cada uno elige
//     en la carta se suma al pedido del grupo (para él o para compartir) y
//     cualquiera lo envía. Sale un solo pedido a la mesa.
// No se paga desde acá: la cuenta la cobra el personal.

const NAME_MAX = 30;

// ── Abrir o sumarse ──────────────────────────────────────────────────────────

interface JoinProps {
  slug: string;
  // Escaneó el QR del local: puede abrir (o sumarse a) el pedido de su mesa.
  venue: { token: string; context: InVenueContext } | null;
  // Llegó con el QR / enlace del grupo, o con el código en el enlace.
  joinParam: JoinParam | null;
  group: GroupState;
  onClose: () => void;
  onJoined: () => void;
}

export function GroupJoinDialog({ slug, venue, joinParam, group, onClose, onJoined }: JoinProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(joinParam && "code" in joinParam ? joinParam.code : "");
  const [table, setTable] = useState<string>(() => String(venue?.context.tableNumber ?? readChosenTable(slug) ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkToken = joinParam && "joinToken" in joinParam ? joinParam.joinToken : null;
  const named = name.trim().length > 0;
  const tableNumber = venue?.context.tableNumber ?? (table ? Number(table) : null);

  const run = async (action: () => Promise<{ memberToken: string; group: GroupSession }>) => {
    setBusy(true);
    setError(null);
    try {
      const joined = await action();
      group.enter(joined.memberToken, name.trim(), joined.group);
      onJoined();
    } catch (err) {
      setError(errorMessage(err, "No pudimos sumarte al pedido. Probá de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  const openMine = () => {
    if (!venue || !tableNumber) return;
    if (!venue.context.tableNumber) saveChosenTable(slug, tableNumber);
    void run(() => openVenueGroup(slug, {
      token: venue.token, tableNumber: venue.context.tableNumber ? undefined : tableNumber, name: name.trim(),
    }));
  };

  return (
    <div className={`${cart.overlay} ${s.scope}`} onClick={onClose} role="dialog" aria-modal="true" aria-label="Pedir en grupo">
      <div className={cart.drawer} onClick={event => event.stopPropagation()}>
        <header className={cart.header}>
          <h2 className={`${cart.title} t-family-heading`}>Pedir en grupo</h2>
          <button className={cart.close} onClick={onClose} aria-label="Cerrar" type="button">✕</button>
        </header>
        <div className={s.body}>
          <p className={s.hint}>
            Arman el pedido entre todos, cada uno desde su celular, y sale junto a la mesa. Después es más fácil dividir la cuenta.
          </p>
          <label className={s.tableField}>
            <span>Tu nombre</span>
            <input
              className={s.textInput}
              value={name}
              maxLength={NAME_MAX}
              autoComplete="given-name"
              placeholder="Para saber quién pidió cada cosa"
              onChange={event => setName(event.target.value)}
            />
          </label>

          {linkToken ? (
            <button type="button" className={s.sendBtn} disabled={busy || !named} onClick={() => run(() => joinGroup(slug, { joinToken: linkToken, name: name.trim() }))}>
              <Users size={17} aria-hidden /> {busy ? "Entrando…" : "Sumarme al pedido"}
            </button>
          ) : (
            <>
              {venue && (
                <>
                  {!venue.context.tableNumber && (
                    <label className={s.tableField}>
                      <span>¿En qué mesa estás?</span>
                      <select value={table} onChange={event => setTable(event.target.value)}>
                        <option value="">Elegí tu mesa</option>
                        {Array.from({ length: venue.context.tableCount }, (_, index) => (
                          <option key={index + 1} value={index + 1}>Mesa {index + 1}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="button" className={s.sendBtn} disabled={busy || !named || !tableNumber} onClick={openMine}>
                    <Users size={17} aria-hidden /> {busy ? "Entrando…" : tableNumber ? `Pedir en grupo en la mesa ${tableNumber}` : "Pedir en grupo en mi mesa"}
                  </button>
                  <p className={s.hint}>Si alguien de tu mesa ya lo abrió, entrás al mismo pedido.</p>
                </>
              )}
              <label className={s.tableField}>
                <span>{venue ? "¿Te pasaron un código?" : "Código del pedido"}</span>
                <input
                  className={`${s.textInput} ${s.codeInput}`}
                  value={formatJoinCode(code)}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ABC-DEF"
                  onChange={event => setCode(cleanJoinCode(event.target.value))}
                />
              </label>
              <button type="button" className={venue ? s.ghostBtn : s.sendBtn} disabled={busy || !named || !isJoinCode(code)} onClick={() => run(() => joinGroup(slug, { code, name: name.trim() }))}>
                Sumarme con el código
              </button>
            </>
          )}
          {error && <p className={s.error} role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Aviso arriba de la carta ─────────────────────────────────────────────────

export function GroupBanner({ group, onOpen }: { group: GroupState; onOpen: () => void }) {
  const current = group.view?.group;
  const pending = current?.cart.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  return (
    <div className={`${s.banner} ${s.scope}`} role="note">
      <span className={s.bannerIcon}><Users size={18} aria-hidden /></span>
      <span className={s.bannerText}>
        <strong>Pedido grupal{current ? ` · Mesa ${current.tableNumber}` : ""}</strong>
        <span>
          {!current && "Cargando…"}
          {current && !current.open && "Este pedido grupal ya se cerró."}
          {current?.open && `${current.members.length} en el grupo · ${pending === 0 ? "nada por enviar" : `${pending} sin enviar`}`}
        </span>
      </span>
      <button type="button" className={s.bannerBtn} onClick={onOpen}>Ver pedido</button>
    </div>
  );
}

// ── Carrito del grupo ────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  group: GroupState;
  hidePrices: boolean;
}

export function GroupOrderDrawer({ open, onClose, slug, group, hidePrices }: DrawerProps) {
  const dialogs = useDialogs();
  const { clearCart } = useCart();
  const { lines, onLinesChange, resetNotes } = useCartUnitLines();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [shared, setShared] = useState<"copied" | null>(null);
  // Mismo contenido = mismo id: un reintento tras un corte de red no duplica nada.
  const addRequest = useRef<{ key: string; lines: ReturnType<typeof toGroupLines> } | null>(null);
  const sendRequest = useRef<{ key: string; id: string } | null>(null);

  const token = group.token;
  const view = group.view;
  if (!open || !token) return null;

  const current = view?.group ?? null;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const status = errorStatus(err);
      // Ya no es parte (lo sacaron o el local cortó la función): vuelve a la carta común.
      if (status === 401) { group.drop(); return; }
      // Otro lo envió o lo cambió recién: se muestra cómo quedó.
      if (["GROUP_CART_CHANGED", "GROUP_CART_EMPTY", "GROUP_ITEM_GONE", "GROUP_CLOSED"].includes(errorCode(err) ?? "")) void group.refresh();
      setError(errorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  // Lo elegido en la carta pasa al pedido del grupo, para uno o para compartir.
  const add = (forSharing: boolean) => {
    const orderLines = toOrderLines(lines);
    const key = JSON.stringify([forSharing, orderLines]);
    if (addRequest.current?.key !== key) addRequest.current = { key, lines: toGroupLines(orderLines, forSharing, uuid) };
    const payload = addRequest.current.lines;
    void run(async () => {
      group.setGroup((await addGroupItems(token, payload)).group);
      clearCart();
      resetNotes();
      addRequest.current = null;
      setSent(null);
    }, "No pudimos sumar tus productos. Probá de nuevo.");
  };

  const change = (item: GroupCartItem, body: { quantity?: number; shared?: boolean }) =>
    void run(async () => { group.setGroup((await updateGroupItem(token, item.id, body)).group); }, "No se pudo cambiar el producto.");

  const remove = (item: GroupCartItem) =>
    void run(async () => { group.setGroup((await removeGroupItem(token, item.id)).group); }, "No se pudo sacar el producto.");

  const send = () => {
    if (!current) return;
    const key = current.cart.map(item => `${item.id}:${item.quantity}:${item.shared}`).join(",");
    if (sendRequest.current?.key !== key) sendRequest.current = { key, id: uuid() };
    const id = sendRequest.current.id;
    void run(async () => {
      const result = await sendGroupOrder(token, id);
      sendRequest.current = null;
      group.setGroup(result.group);
      setSent(result.order.number);
    }, "No pudimos enviar el pedido. Probá de nuevo o pedíselo al personal.");
  };

  const share = async () => {
    if (!current) return;
    const url = groupJoinUrl(slug, current.joinToken);
    try {
      if (navigator.share) await navigator.share({ title: "Pedido grupal", text: `Sumate al pedido de la mesa ${current.tableNumber}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared("copied");
      }
    } catch {
      // Canceló el compartir o no hay portapapeles: queda el código.
    }
  };

  const leave = async () => {
    if (!(await dialogs.confirm({
      title: "¿Salir del pedido grupal?",
      message: "Lo que cargaste y todavía no se envió se saca.",
      confirmLabel: "Salir",
      danger: true,
    }))) return;
    void run(async () => {
      await leaveGroup(token).catch(() => { /* igual sale en este celular */ });
      group.drop();
      onClose();
    }, "No se pudo salir del pedido.");
  };

  const authors = current ? groupByAuthor(current.cart) : [];
  const closed = current !== null && !current.open;

  return (
    <div className={`${cart.overlay} ${s.scope}`} onClick={onClose} role="dialog" aria-modal="true" aria-label="Pedido grupal">
      <div className={cart.drawer} onClick={event => event.stopPropagation()}>
        <header className={cart.header}>
          <h2 className={`${cart.title} t-family-heading`}>Pedido grupal{current ? ` · Mesa ${current.tableNumber}` : ""}</h2>
          <button className={cart.close} onClick={onClose} aria-label="Cerrar" type="button">✕</button>
        </header>

        <div className={s.body}>
          {!current && <p className={s.hint}>Cargando…</p>}

          {closed && (
            <>
              <p className={s.error} role="status">Este pedido grupal ya se cerró. Lo que se envió sigue su curso.</p>
              <button type="button" className={s.ghostBtn} onClick={() => { group.drop(); onClose(); }}>Volver a la carta</button>
            </>
          )}

          {current?.open && (
            <>
              <div className={s.groupShare}>
                <span className={s.groupCode} aria-label={`Código ${current.code.split("").join(" ")}`}>{formatJoinCode(current.code)}</span>
                <span className={s.hint}>Pasales este código a los de tu mesa, o compartí el enlace.</span>
                <button type="button" className={s.ghostBtn} onClick={share}>
                  <Share2 size={15} aria-hidden /> {shared === "copied" ? "Enlace copiado" : "Compartir enlace"}
                </button>
                <div className={s.groupMembers}>
                  {current.members.map(member => (
                    <span key={member.id} className={s.groupMember}>{member.name}{member.me && " (vos)"}</span>
                  ))}
                </div>
              </div>

              {sent !== null && (
                <p className={s.groupNotice} role="status">
                  <CheckCircle2 size={16} aria-hidden /> Pedido #{sent} enviado. Ya lo recibieron en el local.
                </p>
              )}

              {/* Lo que este comensal eligió en la carta y todavía no sumó al pedido de todos. */}
              {lines.length > 0 && (
                <section className={s.groupSection} aria-label="Lo que elegiste">
                  <h3 className={s.groupTitle}>Lo que elegiste</h3>
                  <p className={s.hint}>Tocá el globito para agregar aclaraciones. Después sumalo al pedido de la mesa.</p>
                  <UnitLinesEditor lines={lines} onChange={onLinesChange} hidePrices={hidePrices} />
                  <button type="button" className={s.sendBtn} disabled={busy} onClick={() => add(false)}>
                    <Plus size={17} aria-hidden /> Sumar al pedido (para mí)
                  </button>
                  <button type="button" className={s.ghostBtn} disabled={busy} onClick={() => add(true)}>
                    Sumar para compartir entre todos
                  </button>
                </section>
              )}

              <section className={s.groupSection} aria-label="Pedido de la mesa">
                <h3 className={s.groupTitle}>Pedido de la mesa</h3>
                {authors.length === 0 && (
                  <p className={s.hint}>
                    {lines.length > 0 ? "Todavía no hay nada sumado." : "Elegí productos en la carta y sumalos acá. Vas a ver también lo que carguen los demás."}
                  </p>
                )}
                {authors.map(author => (
                  <div key={author.memberId} className={s.historyItem}>
                    <div className={s.historyHead}>
                      <strong>{author.authorName}{author.mine && " (vos)"}</strong>
                      {!hidePrices && <span>{formatMoney(author.total)}</span>}
                    </div>
                    <ul className={s.historyLines}>
                      {author.items.map(item => (
                        <li key={item.id} className={s.groupLine}>
                          <span>
                            <span className={s.historyQty}>{item.quantity}×</span>{item.title}{item.option ? ` · ${item.option}` : ""}
                            {item.notes && <em> ({item.notes})</em>}
                            {item.shared && <span className={s.groupTag}>Para compartir</span>}
                          </span>
                          {author.mine && (
                            <span className={s.groupActions}>
                              <button type="button" className={s.groupIcon} disabled={busy || item.quantity <= 1} aria-label={`Una unidad menos de ${item.title}`} onClick={() => change(item, { quantity: item.quantity - 1 })}>
                                <Minus size={14} aria-hidden />
                              </button>
                              <button type="button" className={s.groupIcon} disabled={busy || item.quantity >= 20} aria-label={`Una unidad más de ${item.title}`} onClick={() => change(item, { quantity: item.quantity + 1 })}>
                                <Plus size={14} aria-hidden />
                              </button>
                              <button type="button" className={s.groupToggle} disabled={busy} aria-pressed={item.shared} onClick={() => change(item, { shared: !item.shared })}>
                                Compartir
                              </button>
                              <button type="button" className={s.groupIcon} disabled={busy} aria-label={`Sacar ${item.title}`} onClick={() => remove(item)}>
                                <Trash2 size={14} aria-hidden />
                              </button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              {current.orders.length > 0 && (
                <section className={s.groupSection} aria-label="Ya enviado">
                  <h3 className={s.groupTitle}>Ya enviado</h3>
                  {current.orders.map(order => (
                    <div key={order.id} className={s.historyItem}>
                      <div className={s.historyHead}>
                        <strong>Pedido #{order.number}</strong>
                        <span>{STATUS_LABEL[order.status]}</span>
                      </div>
                      <ul className={s.historyLines}>
                        {order.items.map((item, index) => (
                          <li key={index}>
                            <span className={s.historyQty}>{item.quantity}×</span>{item.title}{item.option ? ` · ${item.option}` : ""}
                            {item.authorName && <em> · {item.authorName}</em>}
                          </li>
                        ))}
                      </ul>
                      {!hidePrices && <div className={s.historyTotal}><span>Total</span><strong>{formatMoney(order.total)}</strong></div>}
                    </div>
                  ))}
                </section>
              )}

              <button type="button" className={cart.clearBtn} onClick={leave} disabled={busy}>Salir del pedido grupal</button>
            </>
          )}
        </div>

        {current?.open && current.cart.length > 0 && (
          <>
            {!hidePrices && (
              <div className={cart.total}>
                <span>Total sin enviar</span>
                <span>{formatMoney(current.cartTotal)}</span>
              </div>
            )}
            <div className={cart.checkoutActions}>
              {error && <p className={s.error} role="alert">{error}</p>}
              {view?.ordering ? (
                <>
                  {lines.length > 0 && <p className={s.hint}>Tenés productos elegidos sin sumar: no van en este envío.</p>}
                  <button type="button" className={s.sendBtn} onClick={send} disabled={busy}>
                    <Send size={17} aria-hidden /> {busy ? "Enviando…" : "Enviar pedido de la mesa"}
                  </button>
                </>
              ) : (
                <p className={s.hint}>Cuando esté listo, avisale a quien los atiende: en este local el pedido lo envía el personal.</p>
              )}
            </div>
          </>
        )}
        {error && !(current?.open && current.cart.length > 0) && (
          <div className={cart.checkoutActions}><p className={s.error} role="alert">{error}</p></div>
        )}
      </div>
    </div>
  );
}
