import { useCallback, useEffect, useState } from "react";
import { listAdminSellerTestUsers, type Seller, type SellerTestUserSummary } from "../../../api/adminSellers";
import { setCrmClientActive } from "../../../api/crm";
import { useDialogs } from "../../../context/useDialogs";
import { useNotifications } from "../../../context/useNotifications";
import { extractServerMessage } from "../../../lib/apiErrors";
import { formatPaymentDate } from "../../../lib/adminPayments";
import Spinner from "../../Common/Spinner";
import s from "./AdminSellers.module.css";

// Usuarios de prueba de un vendedor (menú contextual del ABM): no aparecen en
// el CRM ni en las estadísticas, así que esta es la única pantalla donde se
// ven. Darlos de baja (o volver a activarlos) usa el mismo endpoint que el
// CRM para activar/desactivar una cuenta, y pide confirmación.
export default function SellerTestUsersModal({ seller, onCreate, onClose }: {
  seller: Seller;
  /** Abre el alta de un usuario de prueba nuevo. */
  onCreate: () => void;
  onClose: () => void;
}) {
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const [users, setUsers] = useState<SellerTestUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await listAdminSellerTestUsers(seller._id));
      setError(null);
    } catch (cause) {
      setError(extractServerMessage(cause, "No se pudieron cargar los usuarios de prueba."));
    }
  }, [seller._id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const setActive = async (user: SellerTestUserSummary, active: boolean) => {
    if (!(await dialogs.confirm(active
      ? {
        title: `¿Volver a activar ${user.username}?`,
        message: "La cuenta y su carta vuelven a estar accesibles.",
        confirmLabel: "Activar",
      }
      : {
        title: `¿Dar de baja ${user.username}?`,
        message: "Deja de poder iniciar sesión y su carta deja de estar accesible. Se puede volver a activar.",
        confirmLabel: "Dar de baja",
        danger: true,
      }))) return;
    setBusyId(user._id);
    try {
      const result = await setCrmClientActive(user._id, active);
      setUsers((current) => current?.map((entry) => (entry._id === user._id ? { ...entry, active: result } : entry)) ?? current);
      notifications.success(result ? `${user.username} activo de nuevo.` : `${user.username} dado de baja.`);
    } catch (cause) {
      notifications.error(extractServerMessage(cause, "No se pudo cambiar el estado de la cuenta."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={s.modalOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="seller-test-users-title">
      <div className={s.modal} onClick={(event) => event.stopPropagation()}>
        <h2 id="seller-test-users-title" className={s.modalTitle}>Usuarios de prueba de {seller.name}</h2>

        {error ? (
          <p className={s.error} role="alert">{error}</p>
        ) : users === null ? (
          <p className={s.modalHint}><Spinner size={14} /> Cargando…</p>
        ) : users.length === 0 ? (
          <p className={s.modalHint}>Todavía no tiene un usuario de prueba.</p>
        ) : (
          <dl className={s.meta}>
            {users.map((user) => (
              <div key={user._id}>
                <dt>{user.active ? "Activo" : "Dado de baja"} · desde {formatPaymentDate(user.createdAt)}</dt>
                <dd className={s.profileValue}>
                  {user.username} · {user.mail}
                  <span className={s.modalActions} style={{ marginTop: "0.4rem" }}>
                    {user.slug && user.active && (
                      <a className={s.secondaryButton} href={`/${user.slug}/menu`} target="_blank" rel="noopener noreferrer">Ver carta</a>
                    )}
                    <button
                      className={s.secondaryButton}
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void setActive(user, !user.active)}
                    >
                      {busyId === user._id ? <Spinner size={14} /> : null}
                      {user.active ? "Dar de baja" : "Volver a activar"}
                    </button>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className={s.modalActions}>
          {users !== null && users.length === 0 && seller.active && (
            <button className={s.secondaryButton} type="button" onClick={onCreate}>Crear usuario de prueba</button>
          )}
          <button className={s.primaryButton} type="button" onClick={onClose} autoFocus>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
