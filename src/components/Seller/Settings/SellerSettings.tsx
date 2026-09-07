import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuth } from "../../../context/useAuth";
import { getMySellerProfile, changeMySellerPassword, uploadMySellerPhoto } from "../../../api/sellers";
import { useFeedbackMessage } from "../../../hooks/useFeedbackMessage";
import { useNotifications } from "../../../context/useNotifications";
import Spinner from "../../Common/Spinner";
import s from "../sellerPanel.module.css";

const SELLER_ME_QUERY_KEY = ["seller-me"] as const;

export default function SellerSettings() {
  const { user } = useAuth();

  return (
    <main className={s.page}>
      <div className={s.inner}>
        <header className={s.header}>
          <p className={s.eyebrow}>Panel de vendedor</p>
          <h1>Configuración</h1>
          <p>Cambiá tu contraseña y tu foto de perfil.</p>
        </header>

        {user?.role === "seller" ? (
          <SellerSettingsForm />
        ) : (
          <p className={s.emptyState}>Esta sección es exclusiva de cuentas de vendedor.</p>
        )}
      </div>
    </main>
  );
}

function SellerSettingsForm() {
  const profile = useQuery({
    queryKey: SELLER_ME_QUERY_KEY,
    queryFn: getMySellerProfile,
    staleTime: 30_000,
  });

  return (
    <>
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Foto de perfil</h2>
        <div className={s.card}>
          <PhotoUploadForm profilePicture={profile.data?.profilePicture ?? null} />
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Cambiar contraseña</h2>
        <div className={s.card}>
          <PasswordForm />
        </div>
      </section>
    </>
  );
}

function PhotoUploadForm({ profilePicture }: { profilePicture: string | null }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<string | null>(profilePicture);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifications = useNotifications();

  const onFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { profilePicture: uploaded } = await uploadMySellerPhoto(file);
      setPreview(uploaded);
      queryClient.setQueryData(SELLER_ME_QUERY_KEY, (current: unknown) =>
        current && typeof current === "object" ? { ...current, profilePicture: uploaded } : current,
      );
      notifications.success("Foto de perfil actualizada.");
    } catch {
      notifications.error("No se pudo subir la foto. Intentá de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={s.avatarRow}>
      {preview ? (
        <img className={s.avatar} src={preview} alt="Foto de perfil" />
      ) : (
        <div className={s.avatarPlaceholder}>Sin foto</div>
      )}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(event) => void onFileSelected(event.target.files?.[0])}
        />
        <button
          className={s.secondaryButton}
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading && <Spinner />} {uploading ? "Subiendo…" : "Cambiar foto"}
        </button>
        <p className={s.hint}>JPG, PNG o WebP, hasta 8MB.</p>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useFeedbackMessage("error");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const notifications = useNotifications();

  const invalid =
    !currentPassword ||
    newPassword.length < 8 ||
    newPassword !== confirmPassword;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || invalid) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await changeMySellerPassword(currentPassword, newPassword);
      notifications.success("Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (cause) {
      const serverMessage = isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message
        : null;
      setError(serverMessage || "No se pudo cambiar la contraseña.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={s.fields}>
        <label htmlFor="seller-current-password">
          Contraseña actual
          <input
            id="seller-current-password"
            type="password"
            value={currentPassword}
            disabled={saving}
            autoComplete="current-password"
            onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }}
          />
        </label>
        <label htmlFor="seller-new-password">
          Nueva contraseña
          <input
            id="seller-new-password"
            type="password"
            value={newPassword}
            disabled={saving}
            autoComplete="new-password"
            onChange={(event) => { setNewPassword(event.target.value); setError(""); }}
          />
        </label>
        <label htmlFor="seller-confirm-password">
          Repetir nueva contraseña
          <input
            id="seller-confirm-password"
            type="password"
            value={confirmPassword}
            disabled={saving}
            autoComplete="new-password"
            onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }}
          />
        </label>
      </div>

      {error && <p className={s.error} role="alert">{error}</p>}

      <div className={s.actions}>
        <button className={s.primaryButton} type="submit" disabled={saving || invalid}>
          {saving && <Spinner />} {saving ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}
