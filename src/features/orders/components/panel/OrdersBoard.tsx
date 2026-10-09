import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Plus } from "lucide-react";
import { assignOrderWaiter, dispatchOrder, getBoard, openShift, updateOrderStatus } from "../../api/ordersApi";
import { useOrderSettings, useWaiters } from "../../hooks/usePanelData";
import { beep } from "../../lib/beep";
import { errorMessage } from "../../lib/errors";
import { formatTime } from "../../lib/format";
import { readJson, writeJson } from "../../lib/storage";
import type { Order, OrderStatus, Shift } from "../../types";
import ManualOrderModal from "./ManualOrderModal";
import OrderCard from "./OrderCard";
import RefundModal from "./RefundModal";
import p from "./panel.module.css";
import s from "./OrdersBoard.module.css";

// Panel de pedidos: lo que llega y lo que está en curso, del turno/día.
// Se actualiza solo cada pocos segundos. Al entregar o cancelar un pedido
// sale de acá (queda en el Historial).

const POLL_MS = 5_000;

const COLUMNS: { status: OrderStatus; title: string; empty: string }[] = [
  { status: "pending", title: "Sin confirmar", empty: "No hay pedidos nuevos." },
  { status: "confirmed", title: "En preparación", empty: "Nada en preparación." },
  { status: "ready", title: "Listos para entregar", empty: "No hay pedidos listos." },
];

const SOUND_KEY = "md:orders:sound";

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
  const [sound, setSound] = useState(() => readJson(SOUND_KEY, (v): v is boolean => typeof v === "boolean") ?? true);
  const [refunding, setRefunding] = useState<{ order: Order; cancel: boolean } | null>(null);
  const knownIds = useRef<Set<number> | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const refresh = useCallback(async () => {
    try {
      const board = await getBoard();
      const ids = new Set(board.orders.map(order => order.id));
      if (knownIds.current) {
        const fresh = board.orders.filter(order => !knownIds.current!.has(order.id));
        if (fresh.length > 0) {
          setNewIds(prev => new Set([...prev, ...fresh.map(order => order.id)]));
          if (soundRef.current && fresh.some(order => order.status === "pending")) beep();
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

  useEffect(() => {
    // Primera carga inmediata y después cada POLL_MS mientras la pestaña esté visible.
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

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

  const changeStatus = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id);
    setActionError(null);
    try {
      replaceOrder(await updateOrderStatus(order.id, status));
    } catch (err) {
      setActionError(errorMessage(err, "No se pudo actualizar el pedido."));
      refresh();
    } finally {
      setBusyId(null);
    }
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

  const toggleSound = () => {
    setSound(prev => {
      writeJson(SOUND_KEY, !prev);
      if (!prev) beep();
      return !prev;
    });
  };

  const tableCount = settings.data?.settings.tableCount ?? 0;

  return (
    <div className={p.page}>
      <header className={p.header}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>Panel de pedidos</h1>
          <p className={p.subtitle}>
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
        <>
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
                  className={`${s.column} ${mobileColumn === column.status ? s.columnActive : ""}`}
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
                        onRefund={(target, cancel) => setRefunding({ order: target, cancel })}
                      />
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {refunding && (
        <RefundModal
          order={refunding.order}
          cancelOrder={refunding.cancel}
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
