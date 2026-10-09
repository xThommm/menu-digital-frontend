import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { disconnectMpConnection, getMpConnection, startMpConnection } from "../../api/ordersApi";
import { errorMessage } from "../../lib/errors";
import { formatDateTime } from "../../lib/format";
import type { MpConnection } from "../../types";
import p from "./panel.module.css";

// Configuración → Pagos: conectar la cuenta de Mercado Pago del local para
// cobrar pedidos de take away / delivery. El dinero entra directo a esa
// cuenta; Menú Digital no cobra comisión ni toca los fondos.

const RESULT_MESSAGE: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Mercado Pago quedó conectado." },
  denied: { ok: false, text: "No autorizaste la conexión en Mercado Pago. Podés intentarlo de nuevo." },
  in_use: { ok: false, text: "Esa cuenta de Mercado Pago ya está conectada a otro local." },
  invalid: { ok: false, text: "La autorización venció o ya se usó. Volvé a conectar." },
  unavailable: { ok: false, text: "Los pagos con Mercado Pago todavía no están disponibles." },
  error: { ok: false, text: "No se pudo conectar Mercado Pago. Intentá de nuevo." },
};

interface Props {
  // Cuando la conexión cambia, la pantalla de configuración ajusta lo que depende de ella.
  onChange?: (connection: MpConnection | null) => void;
}

export default function PaymentsSection({ onChange }: Props) {
  const [params, setParams] = useSearchParams();
  const [connection, setConnection] = useState<MpConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Vuelta desde Mercado Pago: ?mp=<resultado>. Se lee una vez al montar y se limpia de la URL.
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(() => {
    const returned = params.get("mp");
    return returned ? RESULT_MESSAGE[returned] ?? RESULT_MESSAGE.error : null;
  });
  const hadResult = params.has("mp");
  useEffect(() => {
    if (!hadResult) return;
    const next = new URLSearchParams(params);
    next.delete("mp");
    setParams(next, { replace: true });
  }, [hadResult, params, setParams]);

  const load = useCallback(async () => {
    try {
      const data = await getMpConnection();
      setConnection(data);
      onChange?.(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo consultar la conexión con Mercado Pago."));
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await startMpConnection();
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err, "No se pudo iniciar la conexión con Mercado Pago."));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Se desconecta tu cuenta de Mercado Pago y los clientes dejan de poder pagar online. Para devolver pagos anteriores vas a tener que volver a conectarla. ¿Desconectar?")) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectMpConnection();
      setNotice({ ok: true, text: "Mercado Pago quedó desconectado." });
      await load();
    } catch (err) {
      setError(errorMessage(err, "No se pudo desconectar Mercado Pago."));
    } finally {
      setBusy(false);
    }
  };

  const connected = connection?.connected === true;
  const needsReconnect = connection?.status === "revoked" || connection?.status === "error";

  return (
    <section className={p.card}>
      <h2 className={p.cardTitle}>Pagos con Mercado Pago</h2>
      <p className={p.cardDesc}>
        Tus clientes pagan los pedidos de take away y delivery con Mercado Pago y la plata se acredita directo en tu cuenta.
        Menú Digital no cobra comisión por estas operaciones ni administra tu dinero.
      </p>

      {notice && <p className={notice.ok ? p.success : p.error} role="status" style={{ marginBottom: "0.75rem" }}>{notice.text}</p>}
      {error && <p className={p.error} role="alert" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {loading ? (
        <p className={p.loading}>Cargando…</p>
      ) : connection && !connection.configured ? (
        <p className={p.notice}>Esta función todavía no está disponible. Estamos terminando de configurarla.</p>
      ) : (
        <div className={p.stack}>
          <div className={p.connRow}>
            <span className={`${p.pay} ${connected ? p.pay_APPROVED : needsReconnect ? p.pay_REJECTED : ""}`}>
              <CreditCard size={12} aria-hidden /> {connected ? "Conectado" : needsReconnect ? "Hay que reconectar" : "Sin conectar"}
            </span>
            {connected && connection?.connectedAt && (
              <span className={p.switchHint}>
                Cuenta Nº {connection.mpUserId} · desde {formatDateTime(connection.connectedAt)}
                {connection.liveMode === false && " · modo de prueba"}
              </span>
            )}
          </div>

          {needsReconnect && connection?.lastError && <p className={p.notice}>{connection.lastError}</p>}

          <div className={p.headerActions}>
            <button type="button" className={connected ? p.btn : p.btnPrimary} disabled={busy} onClick={connect}>
              {connected || needsReconnect ? "Reconectar cuenta" : "Conectar Mercado Pago"}
            </button>
            {connected && (
              <button type="button" className={p.btnDanger} disabled={busy} onClick={disconnect}>Desconectar</button>
            )}
          </div>
          <span className={p.switchHint}>
            Vas a iniciar sesión en Mercado Pago y autorizar a Menú Digital. No compartimos ni vemos tu contraseña.
          </span>
        </div>
      )}
    </section>
  );
}
