import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  createAdminSeller,
  listAdminSellers,
  updateAdminSeller,
  type Seller,
} from "../../../api/adminSellers";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { useNotifications } from "../../../context/useNotifications";
import Spinner from "../../Common/Spinner";
import s from "./AdminSellers.module.css";

const ADMIN_SELLERS_QUERY_KEY = ["admin-sellers"] as const;

function normalizeText(value: string) {
  return value.trim();
}

function normalizeDni(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function isValidDni(value: string) {
  return /^\d{8,8}$/.test(value);
}

export default function AdminSellers() {
  const queryClient = useQueryClient();
  const sellers = useQuery({
    queryKey: ADMIN_SELLERS_QUERY_KEY,
    queryFn: ({ signal }) => listAdminSellers(signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    gcTime: 0,
  });

  const replaceSeller = (updated: Seller) => {
    queryClient.setQueryData<Seller[]>(ADMIN_SELLERS_QUERY_KEY, (current) =>
      current?.map((item) => (item._id === updated._id ? updated : item)),
    );
  };

  const prependSeller = (created: Seller) => {
    queryClient.setQueryData<Seller[]>(ADMIN_SELLERS_QUERY_KEY, (current) =>
      current ? [created, ...current] : [created],
    );
  };

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Administración de MenuDigital</p>
          <h1>Vendedores</h1>
          <p>
            Alta y edición de vendedores. El código se genera automáticamente al
            crear.
          </p>
        </header>

        <aside className={s.notice}>
          <strong>Nombre y DNI deben ser únicos.</strong>
          <p>
            El código (ej. ABC-123) lo genera el backend y no se puede editar.
          </p>
        </aside>

        <CreateSellerForm onCreated={prependSeller} />

        {sellers.isPending ? (
          <div className={s.loading}>
            <Spinner size={28} label="Cargando vendedores" />
          </div>
        ) : sellers.isError ? (
          <div className={s.error} role="alert">
            <p>No se pudieron cargar los vendedores.</p>
            <button
              className={s.secondaryButton}
              onClick={() => void sellers.refetch()}
              disabled={sellers.isFetching}
            >
              {sellers.isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          </div>
        ) : sellers.data.length === 0 ? (
          <div className={s.empty} role="status">
            Todavía no hay vendedores. Creá el primero arriba.
          </div>
        ) : (
          <section className={s.list} aria-label="Listado de vendedores">
            {sellers.data.map((seller) => (
              <SellerCard
                key={seller._id}
                seller={seller}
                onUpdated={replaceSeller}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function CreateSellerForm({
  onCreated,
}: {
  onCreated: (seller: Seller) => void;
}) {
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();

  const invalid =
    !normalizeText(name) || !isValidDni(dni) || !normalizeDni(dni);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const created = await createAdminSeller({
        name: normalizeText(name),
        dni: normalizeDni(dni),
      });
      notifications.success(
        `Vendedor ${created.name} creado · código ${created.code}`,
      );
      setName("");
      setDni("");
      onCreated(created);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const message = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(message || "Ya existe un vendedor con ese nombre o DNI.");
      } else {
        const serverMessage = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(
          serverMessage || "No se pudo crear el vendedor. Intentá de nuevo.",
        );
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <form className={s.createForm} onSubmit={submit} noValidate>
      <h2 className={s.sectionTitle}>Nuevo vendedor</h2>
      <div className={s.fields}>
        <label htmlFor="seller-create-name">
          Nombre
          <input
            id="seller-create-name"
            value={name}
            maxLength={80}
            disabled={saving}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
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
            onChange={(event) => {
              setDni(normalizeDni(event.target.value));
              setError("");
            }}
          />
        </label>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.actions}>
        <button
          className={s.primaryButton}
          type="submit"
          disabled={saving || invalid}
        >
          {saving && <Spinner />} {saving ? "Creando…" : "Crear vendedor"}
        </button>
      </div>
    </form>
  );
}

function SellerCard({
  seller,
  onUpdated,
}: {
  seller: Seller;
  onUpdated: (seller: Seller) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(seller.name);
  const [dni, setDni] = useState(seller.dni);
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();
  const invalid = !normalizeText(name) || !isValidDni(dni);

  const dirty = name !== seller.name || dni !== seller.dni;

  const reset = () => {
    setName(seller.name);
    setDni(seller.dni);
    setError("");
    setEditing(false);
  };

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
      });
      notifications.success(`Vendedor ${updated.name} actualizado.`);
      onUpdated(updated);
      setEditing(false);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const message = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(message || "Ya existe un vendedor con ese nombre o DNI.");
      } else {
        const serverMessage = isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message
          : null;
        setError(serverMessage || "No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <article className={s.card} aria-labelledby={`seller-${seller._id}-title`}>
      <header className={s.cardHeader}>
        <div>
          <p className={s.eyebrow}>Código</p>
          <h2 id={`seller-${seller._id}-title`} className={s.code}>
            {seller.code}
          </h2>
        </div>
        {!editing && (
          <button
            className={s.secondaryButton}
            type="button"
            onClick={() => setEditing(true)}
          >
            Editar
          </button>
        )}
      </header>

      {editing ? (
        <form className={s.editForm} onSubmit={submit} noValidate>
          <div className={s.fields}>
            <label htmlFor={`seller-${seller._id}-name`}>
              Nombre
              <input
                id={`seller-${seller._id}-name`}
                value={name}
                maxLength={80}
                disabled={saving}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
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
                onChange={(event) => {
    setDni(normalizeDni(event.target.value));
    setError("");
  }}
              />
            </label>
          </div>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <div className={s.actions}>
            <button
              className={s.primaryButton}
              type="submit"
              disabled={saving || !dirty || invalid}
            >
              {saving && <Spinner />} {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              className={s.secondaryButton}
              type="button"
              onClick={reset}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <dl className={s.meta}>
          <div>
            <dt>Nombre</dt>
            <dd>{seller.name}</dd>
          </div>
          <div>
            <dt>DNI</dt>
            <dd>{seller.dni}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}
