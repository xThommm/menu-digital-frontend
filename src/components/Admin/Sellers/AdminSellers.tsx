import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  createAdminSeller,
  deactivateAdminSeller,
  listAdminSellers,
  resetAdminSellerPassword,
  updateAdminSeller,
  type Seller,
  type SellerCreatePayload,
} from "../../../api/adminSellers";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { useNotifications } from "../../../context/useNotifications";
import { formatPaymentDate } from "../../../lib/adminPayments";
import DataTable, { type DataTableColumn } from "../../Common/DataTable/DataTable";
import Spinner from "../../Common/Spinner";
import s from "./AdminSellers.module.css";

const ADMIN_SELLERS_QUERY_KEY = (includeInactive: boolean) => ["admin-sellers", includeInactive] as const;

function normalizeText(value: string) {
  return value.trim();
}

function normalizeDni(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function isValidDni(value: string) {
  return /^\d{8,8}$/.test(value);
}

function isValidMail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// El input HTML type="date" trabaja con "YYYY-MM-DD"; el backend guarda un
// Date completo. Se convierte en el borde, no se arrastra el formato adentro.
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function AdminSellers() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const queryKey = ADMIN_SELLERS_QUERY_KEY(includeInactive);
  const sellers = useQuery({
    queryKey,
    queryFn: ({ signal }) => listAdminSellers(includeInactive, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    gcTime: 0,
  });

  const replaceSeller = (updated: Seller) => {
    queryClient.setQueryData<Seller[]>(queryKey, (current) =>
      current?.map((item) => (item._id === updated._id ? updated : item)),
    );
  };

  const prependSeller = (created: Seller) => {
    queryClient.setQueryData<Seller[]>(queryKey, (current) =>
      current ? [created, ...current] : [created],
    );
  };

  const removeSellerFromView = (id: string) => {
    // "Dar de baja" solo saca al vendedor de la vista si no se están
    // mostrando los dados de baja — si se muestran, se refleja el active:false.
    if (includeInactive) {
      queryClient.setQueryData<Seller[]>(queryKey, (current) =>
        current?.map((item) => (item._id === id ? { ...item, active: false } : item)),
      );
    } else {
      queryClient.setQueryData<Seller[]>(queryKey, (current) =>
        current?.filter((item) => item._id !== id),
      );
    }
  };

  const columns = useMemo<DataTableColumn<Seller>[]>(() => [
    {
      id: "seller",
      header: "Vendedor",
      width: "220px",
      sortValue: (seller) => seller.name,
      render: (seller) => (
        <span className={s.rowName}>
          <strong>{seller.name}</strong>
          <span>DNI {seller.dni}</span>
        </span>
      ),
    },
    {
      id: "code",
      header: "Código",
      width: "120px",
      sortValue: (seller) => seller.code,
      render: (seller) => <code className={s.codeCell}>{seller.code}</code>,
    },
    {
      id: "mail",
      header: "Contacto",
      width: "220px",
      sortValue: (seller) => seller.mail,
      render: (seller) => (
        <span className={s.rowName}>
          <strong>{seller.mail}</strong>
          {seller.number ? <span>{seller.number}</span> : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      width: "110px",
      sortValue: (seller) => (seller.active ? 1 : 0),
      render: (seller) => (
        <span className={`${s.statusBadge} ${seller.active ? s.statusOk : s.statusMuted}`}>
          {seller.active ? "Activo" : "Dado de baja"}
        </span>
      ),
    },
    {
      id: "startDate",
      header: "Vendedor desde",
      width: "140px",
      sortValue: (seller) => Date.parse(seller.startDate ?? "") || null,
      render: (seller) => (
        <span className={s.dateCell}>
          {seller.startDate ? formatPaymentDate(seller.startDate) : "Sin definir"}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Alta",
      width: "120px",
      sortValue: (seller) => Date.parse(seller.createdAt) || null,
      render: (seller) => <span className={s.dateCell}>{formatPaymentDate(seller.createdAt)}</span>,
    },
  ], []);

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Administración de MenuDigital</p>
          <h1>Vendedores</h1>
          <p>Alta, baja y modificación del equipo de ventas.</p>
        </header>

        <aside className={s.notice}>
          <strong>Nombre y DNI deben ser únicos.</strong>
          <p>
            El código (ej. ABC-123) lo genera el backend. Las comisiones,
            métricas y el CRM de cada vendedor viven en su propio panel
            (/sellers), no acá.
          </p>
        </aside>

        <DataTable<Seller>
          caption="Listado de vendedores"
          rows={sellers.data ?? []}
          columns={columns}
          getRowId={(seller) => seller._id}
          minWidth={900}
          defaultSort={{ columnId: "seller" }}
          search={{
            accessor: (seller) => `${seller.name} ${seller.code} ${seller.dni} ${seller.mail}`,
            placeholder: "Nombre, código, DNI o mail",
          }}
          countLabel={(visible, total) => `${visible} de ${total} vendedores`}
          loading={sellers.isPending}
          error={sellers.isError ? "No se pudieron cargar los vendedores." : null}
          onRetry={() => void sellers.refetch()}
          retrying={sellers.isFetching}
          emptyMessage={
            <div className={s.emptyState}>
              <p>Todavía no hay vendedores.</p>
              <button className={s.primaryButton} type="button" onClick={() => setCreating(true)}>
                Crear el primero
              </button>
            </div>
          }
          noResultsMessage="No hay vendedores que coincidan con la búsqueda."
          filters={
            <label className={s.inlineCheckbox}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Mostrar dados de baja
            </label>
          }
          actions={
            <button className={s.newSellerButton} type="button" onClick={() => setCreating(true)}>
              + Nuevo vendedor
            </button>
          }
          expandable={{
            label: (seller) => `Ver detalle de ${seller.name}`,
            renderPanel: (seller) => (
              <SellerEditPanel
                seller={seller}
                onUpdated={replaceSeller}
                onDeactivated={removeSellerFromView}
              />
            ),
          }}
        />

        {creating && (
          <CreateSellerModal onCreated={prependSeller} onClose={() => setCreating(false)} />
        )}
      </div>
    </main>
  );
}

function CreateSellerModal({
  onCreated,
  onClose,
}: {
  onCreated: (seller: Seller) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [mail, setMail] = useState("");
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const invalid =
    !normalizeText(name) ||
    !isValidDni(dni) ||
    !isValidMail(mail) ||
    password.length < 8;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const payload: SellerCreatePayload = {
        name: normalizeText(name),
        dni: normalizeDni(dni),
        mail: normalizeText(mail),
        password,
      };
      if (number.trim()) payload.number = Number(number);
      if (startDate) payload.startDate = startDate;

      const created = await createAdminSeller(payload);
      notifications.success(`Vendedor ${created.name} creado · código ${created.code}`);
      onCreated(created);
      onClose();
    } catch (cause) {
      const serverMessage = isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message
        : null;
      if (isAxiosError(cause) && cause.response?.status === 409) {
        setError(serverMessage || "Ya existe un vendedor con ese nombre o DNI.");
      } else {
        setError(serverMessage || "No se pudo crear el vendedor. Intentá de nuevo.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className={s.modalOverlay}
      onClick={() => { if (!saving) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-create-title"
    >
      <form
        className={s.modal}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        noValidate
      >
        <h2 id="seller-create-title" className={s.modalTitle}>Nuevo vendedor</h2>
        <p className={s.modalHint}>
          Nombre y DNI deben ser únicos. El código (ej. ABC-123) lo genera el backend.
        </p>

        <div className={s.modalFields}>
          <label htmlFor="seller-create-name">
            Nombre
            <input
              id="seller-create-name"
              ref={firstFieldRef}
              value={name}
              maxLength={80}
              disabled={saving}
              autoComplete="off"
              onChange={(event) => { setName(event.target.value); setError(""); }}
            />
          </label>
          <label htmlFor="seller-create-dni">
            DNI
            <input
              id="seller-create-dni"
              value={dni}
              maxLength={20}
              disabled={saving}
              inputMode="numeric"
              autoComplete="off"
              onChange={(event) => { setDni(normalizeDni(event.target.value)); setError(""); }}
            />
          </label>
          <label htmlFor="seller-create-mail">
            Mail
            <input
              id="seller-create-mail"
              type="email"
              value={mail}
              disabled={saving}
              autoComplete="off"
              onChange={(event) => { setMail(event.target.value); setError(""); }}
            />
          </label>
          <label htmlFor="seller-create-number">
            Teléfono (opcional)
            <input
              id="seller-create-number"
              inputMode="numeric"
              value={number}
              disabled={saving}
              autoComplete="off"
              onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label htmlFor="seller-create-startdate">
            Fecha de inicio (opcional — ancla su ciclo mensual de comisión)
            <input
              id="seller-create-startdate"
              type="date"
              value={startDate}
              disabled={saving}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label htmlFor="seller-create-password">
            Contraseña
            <input
              id="seller-create-password"
              type="password"
              value={password}
              disabled={saving}
              autoComplete="new-password"
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
            {saving && <Spinner />} {saving ? "Creando…" : "Crear vendedor"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SellerEditPanel({
  seller,
  onUpdated,
  onDeactivated,
}: {
  seller: Seller;
  onUpdated: (seller: Seller) => void;
  onDeactivated: (id: string) => void;
}) {
  const [name, setName] = useState(seller.name);
  const [dni, setDni] = useState(seller.dni);
  const [mail, setMail] = useState(seller.mail);
  const [number, setNumber] = useState(seller.number ? String(seller.number) : "");
  const [startDate, setStartDate] = useState(toDateInputValue(seller.startDate));
  const [admin, setAdmin] = useState(seller.admin);
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();

  const invalid = !normalizeText(name) || !isValidDni(dni) || !isValidMail(mail);
  const dirty =
    name !== seller.name ||
    dni !== seller.dni ||
    mail !== seller.mail ||
    number !== (seller.number ? String(seller.number) : "") ||
    startDate !== toDateInputValue(seller.startDate) ||
    admin !== seller.admin;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !dirty || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminSeller(seller._id, {
        name: normalizeText(name),
        dni: normalizeDni(dni),
        mail: normalizeText(mail),
        number: number.trim() ? Number(number) : null,
        startDate: startDate || null,
        admin,
      });
      notifications.success(`Vendedor ${updated.name} actualizado.`);
      onUpdated(updated);
    } catch (cause) {
      const serverMessage = isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message
        : null;
      if (isAxiosError(cause) && cause.response?.status === 409) {
        setError(serverMessage || "Ya existe un vendedor con ese nombre o DNI.");
      } else {
        setError(serverMessage || "No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(seller.code);
      notifications.success(`Código ${seller.code} copiado.`);
    } catch {
      notifications.error("No se pudo copiar el código.");
    }
  };

  const toggleActive = async () => {
    if (!seller.active) return; // reactivar se hace editando (o no está soportado aún)
    if (!window.confirm(`¿Dar de baja a ${seller.name}? Deja de poder iniciar sesión, pero se conserva su historial.`)) {
      return;
    }
    setDeactivating(true);
    try {
      const updated = await deactivateAdminSeller(seller._id);
      notifications.success(`${seller.name} dado de baja.`);
      onUpdated(updated);
      onDeactivated(seller._id);
    } catch {
      notifications.error("No se pudo dar de baja al vendedor.");
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <>
      <div className={s.panelActions}>
        <button className={s.secondaryButton} type="button" onClick={() => void copyCode()}>
          Copiar código
        </button>
        <button
          className={s.secondaryButton}
          type="button"
          onClick={() => setResettingPassword(true)}
        >
          Restablecer contraseña
        </button>
        {seller.active && (
          <button
            className={s.dangerButton}
            type="button"
            onClick={() => void toggleActive()}
            disabled={deactivating}
          >
            {deactivating && <Spinner />} {deactivating ? "Dando de baja…" : "Dar de baja"}
          </button>
        )}
      </div>

      <form className={s.editForm} onSubmit={submit} noValidate>
        <div className={s.fields}>
          <label htmlFor={`seller-${seller._id}-name`}>
            Nombre
            <input
              id={`seller-${seller._id}-name`}
              value={name}
              maxLength={80}
              disabled={saving}
              onChange={(event) => { setName(event.target.value); setError(""); }}
            />
          </label>
          <label htmlFor={`seller-${seller._id}-dni`}>
            DNI
            <input
              id={`seller-${seller._id}-dni`}
              value={dni}
              maxLength={20}
              disabled={saving}
              inputMode="numeric"
              onChange={(event) => { setDni(normalizeDni(event.target.value)); setError(""); }}
            />
          </label>
          <label htmlFor={`seller-${seller._id}-mail`}>
            Mail
            <input
              id={`seller-${seller._id}-mail`}
              type="email"
              value={mail}
              disabled={saving}
              onChange={(event) => { setMail(event.target.value); setError(""); }}
            />
          </label>
          <label htmlFor={`seller-${seller._id}-number`}>
            Teléfono
            <input
              id={`seller-${seller._id}-number`}
              value={number}
              disabled={saving}
              inputMode="numeric"
              onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label htmlFor={`seller-${seller._id}-startdate`}>
            Fecha de inicio (ancla su ciclo mensual de comisión)
            <input
              id={`seller-${seller._id}-startdate`}
              type="date"
              value={startDate}
              disabled={saving}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className={s.inlineCheckbox} htmlFor={`seller-${seller._id}-admin`}>
            <input
              id={`seller-${seller._id}-admin`}
              type="checkbox"
              checked={admin}
              disabled={saving}
              onChange={(event) => setAdmin(event.target.checked)}
            />
            Admin
          </label>
        </div>

        {error && <p className={s.error} role="alert">{error}</p>}

        <div className={s.actions}>
          <button className={s.primaryButton} type="submit" disabled={saving || !dirty || invalid}>
            {saving && <Spinner />} {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>

      <dl className={s.meta}>
        <div>
          <dt>Vendedor desde (alta)</dt>
          <dd>{formatPaymentDate(seller.createdAt)}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{seller.active ? "Activo" : "Dado de baja"}</dd>
        </div>
      </dl>

      {resettingPassword && (
        <ResetPasswordModal
          seller={seller}
          onClose={() => setResettingPassword(false)}
        />
      )}
    </>
  );
}

function ResetPasswordModal({ seller, onClose }: { seller: Seller; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();
  const invalid = newPassword.length < 8;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await resetAdminSellerPassword(seller._id, newPassword);
      notifications.success(`Contraseña de ${seller.name} restablecida.`);
      onClose();
    } catch (cause) {
      const serverMessage = isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message
        : null;
      setError(serverMessage || "No se pudo restablecer la contraseña.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className={s.modalOverlay}
      onClick={() => { if (!saving) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`reset-password-title-${seller._id}`}
    >
      <form
        className={s.modal}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        noValidate
      >
        <h2 id={`reset-password-title-${seller._id}`} className={s.modalTitle}>
          Restablecer contraseña de {seller.name}
        </h2>
        <p className={s.modalHint}>No hace falta la contraseña actual.</p>

        <div className={s.modalFields}>
          <label htmlFor={`reset-password-${seller._id}`}>
            Nueva contraseña
            <input
              id={`reset-password-${seller._id}`}
              type="password"
              value={newPassword}
              disabled={saving}
              autoComplete="new-password"
              onChange={(event) => { setNewPassword(event.target.value); setError(""); }}
            />
          </label>
        </div>

        {error && <p className={s.error} role="alert">{error}</p>}

        <div className={s.modalActions}>
          <button className={s.secondaryButton} type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className={s.primaryButton} type="submit" disabled={saving || invalid}>
            {saving && <Spinner />} {saving ? "Guardando…" : "Restablecer"}
          </button>
        </div>
      </form>
    </div>
  );
}
