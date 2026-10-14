import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Plus } from "lucide-react";
import {
  assignOrderWaiter, dispatchOrder, getBoard, getOrderTickets, markOwnerTicketPrinted, openShift, removeOrderItem, restoreOrderItem,
  setOrderItemDelivered, updateOrderStatus,
} from "../../api/ordersApi";
import { useContextMenu } from "../../../contextMenu/hooks/useContextMenu";
import { useMenuEnv } from "../../../contextMenu/hooks/useMenuEnv";
import { MenuActionError } from "../../../contextMenu/lib/contextMenu";
import { ownerHello, useLiveRefresh } from "../../hooks/useLiveRefresh";
import { useOrderSettings, useWaiters } from "../../hooks/usePanelData";
import { errorMessage } from "../../lib/errors";
import { formatTime, placeLabel } from "../../lib/format";
import { PrintError, printTicket } from "../../lib/print/printers";
import { reprintOrderTickets, ReprintError } from "../../lib/print/reprint";
import type { Order, OrderStatus, Shift } from "../../types";
import { useOwnerAlerts } from "../../../ownerAlerts/useOwnerAlerts";
import ManualOrderModal from "./ManualOrderModal";
import OrderCard from "./OrderCard";
import {
  buildBoardMenu, buildOrderItemMenu, buildOrderMenu, type OrderItemMenuActions, type OrderMenuActions,
} from "./ordersBoardMenu";
import type { ItemActions } from "./OrderItemsList";
import RefundModal from "./RefundModal";
import p from "./panel.module.css";
import s from "./OrdersBoard.module.css";

// Panel de pedidos: lo que llega y lo que está en curso, del turno/día.
// Se actualiza solo, en tiempo real. Al entregar o cancelar un pedido
// sale de acá (queda en el Historial).

const POLL_MS = 5_000;

const COLUMNS: { status: OrderStatus; title: string; empty: string }[] = [
  { status: "pending", title: "Sin confirmar", empty: "No hay pedidos nuevos." },
  { status: "confirmed", title: "En preparación", empty: "Nada en preparación." },
  { status: "ready", title: "Listos para entregar", empty: "No hay pedidos listos." },
];

// Aviso de un pedido sin confirmar que vio la consulta (por si el aviso en vivo
// no llegó). Si ya sonó por el socket, el proveedor de avisos no lo repite.
const pendingAlert = (order: Order) => ({
  key: `order:${order.id}`,
  orderId: order.id,
  kind: "order" as const,
  title: `🛎️ Nuevo pedido #${order.number}`,
  body: placeLabel(order),
  url: "/pedidos",
});

export default function OrdersBoard() {
  const settings = useOrderSettings();
  const waiters = useWaiters();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [newIds, setNewIds] = useState<Set<number>>(() => new Set());
  const [manualOpen, setManualOpen] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<OrderStatus>("pending");
  const { soundOn: sound, setSoundOn, announce } = useOwnerAlerts();
  const [refunding, setRefunding] = useState<{ order: Order; cancel: boolean; amount?: number } | null>(null);
  const knownIds = useRef<Set<number> | null>(null);
  const announceRef = useRef(announce);
  useEffect(() => { announceRef.current = announce; }, [announce]);

  const refresh = useCallback(async () => {
    try {
      const board = await getBoard();
      const ids = new Set(board.orders.map(order => order.id));
      if (knownIds.current) {
        const fresh = board.orders.filter(order => !knownIds.current!.has(order.id));
        if (fresh.length > 0) {
          setNewIds(prev => new Set([...prev, ...fresh.map(order => order.id)]));
          fresh.filter(order => order.status === "pending").forEach(order => announceRef.current(pendingAlert(order)));
        }
      }
      knownIds.current = ids;
      setOrders(board.orders);
      setShift(board.openShift);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudieron actualizar los pedidos. Reintentando…"));
    }
  }, []);

  // Se actualiza con los avisos del servidor (pedido nuevo, cambio de estado, avance de
  // un sector…). La consulta cada POLL_MS queda solo para cuando no hay conexión en vivo.
  useLiveRefresh({ hello: ownerHello(), refresh, offlineMs: POLL_MS });

  // El resaltado de "nuevo" dura un rato y se va solo.
  useEffect(() => {
    if (newIds.size === 0) return;
    const timer = setTimeout(() => setNewIds(new Set()), 15_000);
    return () => clearTimeout(timer);
  }, [newIds]);

  // Título de la pestaña con la cantidad sin confirmar (se ve desde otra pestaña).
  const pendingCount = orders?.filter(order => order.status === "pending").length ?? 0;
  useEffect(() => {
    const previous = document.title;
    document.title = pendingCount > 0 ? `(${pendingCount}) Pedidos · menudigital` : "Pedidos · menudigital";
    return () => { document.title = previous; };
  }, [pendingCount]);

  const replaceOrder = (updated: Order) => {
    setOrders(prev => (prev ?? [])
      .map(order => (order.id === updated.id ? updated : order))
      .filter(order => ["pending", "confirmed", "ready"].includes(order.status)));
  };

  const changeStatus = async (order: Order, status: OrderStatus, reason?: string) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      replaceOrder(await updateOrderStatus(order.id, status, reason));
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo actualizar el pedido."));
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  // Un producto del pedido: quitarlo, restaurarlo o entregarlo antes que el resto.
  const changeItem = async (order: Order, action: () => Promise<Order>, fallback: string) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      replaceOrder(await action());
    } catch (err) {
      setActionError(errorMessage(err, fallback));
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const itemActions: ItemActions = {
    onRemove: (order, item, data) => changeItem(order, () => removeOrderItem(order.id, item.id, data), "No se pudo quitar el producto."),
    onRestore: (order, item) => changeItem(order, () => restoreOrderItem(order.id, item.id), "No se pudo restaurar el producto."),
    onDelivered: (order, item, delivered) =>
      changeItem(order, () => setOrderItemDelivered(order.id, item.id, delivered), "No se pudo marcar el producto."),
  };

  const dispatch = async (order: Order) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      replaceOrder(await dispatchOrder(order.id));
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo marcar que el pedido salió."));
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const changeWaiter = async (order: Order, waiterId: number | null) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      replaceOrder(await assignOrderWaiter(order.id, waiterId));
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo asignar el operador."));
    } finally {
      setBusyId(null);
    }
  };

  const startShift = async () => {
    setActionError(null);
    try {
      setShift(await openShift());
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo abrir el turno."));
    }
  };

  const toggleSound = () => setSoundOn(!sound);

  // ── Menú contextual: las mismas acciones de los botones, más copiar, mapas,
  // reimprimir e ir a la mesa (ordersBoardMenu.ts).
  const env = useMenuEnv();
  const orderMenu = useMemo(() => buildOrderMenu(env), [env]);
  const itemMenu = useMemo(() => buildOrderItemMenu(), []);
  const boardMenu = useMemo(() => buildBoardMenu(env), [env]);
  const openOrderMenu = useContextMenu(orderMenu, { highlightTarget: true });
  const openItemMenu = useContextMenu(itemMenu, { highlightTarget: true });
  const openBoardMenu = useContextMenu(boardMenu);

  const orderActions: OrderMenuActions = {
    refunds: true,
    dispatch: true,
    setStatus: changeStatus,
    markDispatched: dispatch,
    refund: (order, cancel, amount) => setRefunding({ order, cancel, amount }),
    reprint: async (order) => {
      try {
        await reprintOrderTickets(order.id, { load: getOrderTickets, print: printTicket, markPrinted: markOwnerTicketPrinted });
      } catch (err) {
        if (err instanceof ReprintError || err instanceof PrintError) throw new MenuActionError(err.message);
        throw err;
      }
    },
  };
  const itemMenuActions: OrderItemMenuActions = {
    remove: itemActions.onRemove,
    restore: itemActions.onRestore,
    setDelivered: itemActions.onDelivered,
  };

  const tableCount = settings.data?.settings.tableCount ?? 0;

  return (
    <div
      className={p.page}
      onContextMenu={event => openBoardMenu(event, {
        hasShift: shift !== null,
        sound,
        canCreate: Boolean(settings.data),
        actions: { createOrder: () => setManualOpen(true), openShift: startShift, setSound: setSoundOn, refresh },
      })}
    >
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Panel de pedidos</h1>
          <p className={p.subtitle}>
            <span className={`${s.shiftDot} ${shift ? s.shiftDotOpen : ""}`} aria-hidden />
            {shift ? <>Turno abierto: <strong>{shift.label}</strong> · desde las {formatTime(shift.openedAt)}</> : "No hay un turno abierto. Se abre solo con el primer pedido."}
          </p>
        </div>
        <div className={p.headerActions}>
          <button
            type="button"
            className={p.btn}
            onClick={toggleSound}
            aria-pressed={sound}
            title={sound ? "Silenciar aviso de pedidos nuevos" : "Activar aviso sonoro"}
          >
            {sound ? <Bell size={16} aria-hidden /> : <BellOff size={16} aria-hidden />}
            {sound ? "Sonido" : "Silencio"}
          </button>
          {!shift && <button type="button" className={p.btn} onClick={startShift}>Abrir turno</button>}
          <button type="button" className={p.btnPrimary} onClick={() => setManualOpen(true)} disabled={!settings.data}>
            <Plus size={16} aria-hidden /> Nuevo pedido
          </button>
        </div>
      </header>

      {error && <p className={p.error} role="alert">{error}</p>}
      {actionError && <p className={p.error} role="alert">{actionError}</p>}

      {orders === null && !error && <p className={p.loading}>Cargando pedidos…</p>}

      {orders !== null && (
        <div className={s.boardArea}>
          <div className={`${p.segmented} ${s.mobileTabs}`} role="tablist" aria-label="Estado">
            {COLUMNS.map(column => {
              const count = orders.filter(order => order.status === column.status).length;
              return (
                <button
                  key={column.status}
                  type="button"
                  role="tab"
                  aria-selected={mobileColumn === column.status}
                  className={`${p.segment} ${mobileColumn === column.status ? p.segmentActive : ""}`}
                  onClick={() => setMobileColumn(column.status)}
                >
                  {column.title} ({count})
                </button>
              );
            })}
          </div>

          <div className={s.board}>
            {COLUMNS.map(column => {
              const list = orders.filter(order => order.status === column.status);
              return (
                <section
                  key={column.status}
                  className={`${s.column} ${s[`column_${column.status}`] ?? ""} ${mobileColumn === column.status ? s.columnActive : ""}`}
                  aria-label={column.title}
                >
                  <h2 className={s.columnTitle}>
                    {column.title} <span className={s.columnCount}>{list.length}</span>
                  </h2>
                  {list.length === 0 ? (
                    <p className={s.columnEmpty}>{column.empty}</p>
                  ) : (
                    list.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        waiters={waiters.data ?? []}
                        now={now}
                        highlight={newIds.has(order.id)}
                        busy={busyId === order.id}
                        onStatus={changeStatus}
                        onWaiter={changeWaiter}
                        onDispatch={dispatch}
                        onRefund={(target, cancel, amount) => setRefunding({ order: target, cancel, amount })}
                        itemActions={itemActions}
                        onContextMenu={(event, target) => openOrderMenu(event, { order: target, busy: busyId === target.id, actions: orderActions })}
                        onItemContextMenu={(event, target, item, removed) =>
                          openItemMenu(event, { order: target, item, removed, busy: busyId === target.id, actions: itemMenuActions })}
                      />
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {refunding && (
        <RefundModal
          order={refunding.order}
          cancelOrder={refunding.cancel}
          suggestedAmount={refunding.amount}
          onClose={() => setRefunding(null)}
          onChanged={refresh}
        />
      )}

      {manualOpen && (
        <ManualOrderModal
          tableCount={tableCount}
          waiters={waiters.data ?? []}
          onClose={() => setManualOpen(false)}
          onCreated={order => {
            setManualOpen(false);
            setOrders(prev => [...(prev ?? []), order]);
            knownIds.current?.add(order.id);
            refresh();
          }}
        />
      )}
    </div>
  );
}
