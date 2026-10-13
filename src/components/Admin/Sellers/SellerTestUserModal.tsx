import { useRef, useState, type FormEvent } from "react";
import {
  createAdminSellerTestUser,
  type Seller,
  type SellerTestUser,
} from "../../../api/adminSellers";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { useNotifications } from "../../../context/useNotifications";
import { extractServerMessage } from "../../../lib/apiErrors";
import Spinner from "../../Common/Spinner";
import { generateTestPassword, isValidTestUsername, suggestTestUsername } from "./sellerTestUser";
import s from "./AdminSellers.module.css";

// Alta del usuario de prueba de un vendedor: una cuenta de comercio (no de
// vendedor) con plan Pro sin vencimiento para que la use en sus demos. El
// backend le pone el mail, el teléfono y el sellerID del vendedor; acá solo
// se eligen usuario y contraseña, que después se muestran para pasárselos.
export default function SellerTestUserModal({ seller, onClose }: { seller: Seller; onClose: () => void }) {
  const [username, setUsername] = useState(() => suggestTestUsername(seller.code));
  const [password, setPassword] = useState(generateTestPassword);
  const [created, setCreated] = useState<SellerTestUser | null>(null);
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();

  const invalid = !isValidTestUsername(username) || password.length < 8;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const user = await createAdminSellerTestUser(seller._id, { username: username.trim(), password });
      notifications.success(`Usuario de prueba ${user.username} creado para ${seller.name}.`);
      setCreated(user);
    } catch (cause) {
      setError(extractServerMessage(cause, "No se pudo crear el usuario de prueba. Intentá de nuevo."));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`Usuario: ${created.username}\nContraseña: ${password}`);
      notifications.success("Usuario y contraseña copiados.");
    } catch {
      notifications.error("No se pudieron copiar los datos.");
    }
  };

  return (
    <div
      className={s.modalOverlay}
      onClick={() => { if (!saving) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-test-user-title"
    >
      {created ? (
        <div className={s.modal} onClick={(event) => event.stopPropagation()}>
          <h2 id="seller-test-user-title" className={s.modalTitle}>Usuario de prueba creado</h2>
          <p className={s.modalHint}>
            Pasale estos datos a {seller.name}. La contraseña no se vuelve a mostrar.
          </p>
          <dl className={s.meta}>
            <div>
              <dt>Usuario</dt>
              <dd className={s.profileValue}>{created.username}</dd>
            </div>
            <div>
              <dt>Contraseña</dt>
              <dd className={s.profileValue}>{password}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>Pro · sin vencimiento</dd>
            </div>
            <div>
              <dt>Mail</dt>
              <dd className={s.profileValue}>{created.mail}</dd>
            </div>
          </dl>
          <div className={s.modalActions}>
            <button className={s.secondaryButton} type="button" onClick={() => void copyCredentials()}>
              Copiar usuario y contraseña
            </button>
            <button className={s.primaryButton} type="button" onClick={onClose}>
              Listo
            </button>
          </div>
        </div>
      ) : (
        <form
          className={s.modal}
          onSubmit={submit}
          onClick={(event) => event.stopPropagation()}
          noValidate
        >
          <h2 id="seller-test-user-title" className={s.modalTitle}>Usuario de prueba de {seller.name}</h2>
          <p className={s.modalHint}>
            Crea una cuenta de comercio vacía con plan Pro sin vencimiento para sus demos, asociada a
            este vendedor. Usa su mail ({seller.mail}){seller.number ? ` y su teléfono (${seller.number})` : ""}.
            No cuenta en las estadísticas ni aparece en el CRM.
          </p>

          <div className={s.modalFields}>
            <label htmlFor="seller-test-user-username">
              Usuario (sin guiones)
              <input
                id="seller-test-user-username"
                value={username}
                maxLength={40}
                disabled={saving}
                autoComplete="off"
                autoFocus
                onChange={(event) => { setUsername(event.target.value); setError(""); }}
              />
            </label>
            <label htmlFor="seller-test-user-password">
              Contraseña (mínimo 8 caracteres)
              <input
                id="seller-test-user-password"
                value={password}
                disabled={saving}
                autoComplete="off"
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
              />
            </label>
          </div>

          {error && <p className={s.error} role="alert">{error}</p>}

          <div className={s.modalActions}>
            <button className={s.secondaryButton} type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button className={s.primaryButton} type="submit" disabled={saving || invalid}>
              {saving && <Spinner />} {saving ? "Creando…" : "Crear usuario de prueba"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
