import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, BellRing, MonitorSmartphone, Trash2 } from "lucide-react";
import {
  getAdminPushPreferences,
  listAdminPushDevices,
  removeAdminPushDevice,
  updateAdminPushPreferences,
  type AdminPushDevice,
  type AdminPushPreferences,
} from "../../../api/adminPush";
import type { AdminNotificationType } from "../../../api/adminNotifications";
import { useNotifications } from "../../../context/useNotifications";
import {
  adminPushDevicesKey,
  adminPushPreferencesKey,
  useAdminPush,
} from "../../../hooks/useAdminPush";
import { getAdminPushFingerprint } from "../../../lib/adminPush";
import { extractServerMessage } from "../../../lib/apiErrors";
import { formatDateAR } from "../../../lib/dates";
import { describeDevice } from "../../../lib/pushDevices";
import s from "./PushSettings.module.css";

// Tipos que se pueden silenciar, en el orden en que se muestran. El backend
// manda la lista vigente: lo que no esté acá se muestra con su clave.
const TYPE_OPTIONS: Partial<Record<AdminNotificationType, { label: string; hint: string }>> = {
  registration: { label: "Nuevos registros", hint: "Alta gratuita o con prueba Pro" },
  payment: { label: "Pagos aprobados", hint: "Altas pagas, cambios de plan y renovaciones" },
  payment_failed: { label: "Pagos rechazados", hint: "Mercado Pago rechazó el cobro" },
  refund: { label: "Reembolsos y contracargos", hint: "Arrepentimientos y devoluciones" },
  subscription: { label: "Vencimientos y bajas", hint: "Planes por vencer, vencidos y pruebas sin pago" },
};

const formatSeen = (iso: string | null) => (iso
  ? formatDateAR(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  : "sin datos");

/**
 * Notificaciones push del admin: estado de este dispositivo, lista de
 * dispositivos que las reciben y qué tipos de aviso llegan como push.
 */
export default function PushSettings() {
  const push = useAdminPush();
  const toast = useNotifications();
  const queryClient = useQueryClient();
  const [removingID, setRemovingID] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const devices = useQuery({ queryKey: adminPushDevicesKey, queryFn: listAdminPushDevices });
  const preferences = useQuery({ queryKey: adminPushPreferencesKey, queryFn: getAdminPushPreferences });
  // Depende de `active`: al activar o desactivar cambia el token guardado.
  const fingerprint = useQuery({
    queryKey: [...adminPushDevicesKey, "fingerprint", push.active],
    queryFn: getAdminPushFingerprint,
  });

  const removeDevice = async (device: AdminPushDevice, isCurrent: boolean) => {
    const name = describeDevice(device.userAgent);
    if (!window.confirm(`¿Dejar de mandar avisos a "${name}"?`)) return;

    setRemovingID(device.id);
    try {
      await removeAdminPushDevice(device.id);
      if (isCurrent) push.markRemovedHere();
      toast.info("Dispositivo quitado");
    } catch (err) {
      toast.error(extractServerMessage(err, "No se pudo quitar el dispositivo."));
    } finally {
      setRemovingID(null);
      void queryClient.invalidateQueries({ queryKey: adminPushDevicesKey });
    }
  };

  const setTypeEnabled = async (type: AdminNotificationType, enabled: boolean) => {
    const current = preferences.data;
    if (!current) return;
    const mutedTypes = enabled
      ? current.mutedTypes.filter((muted) => muted !== type)
      : [...current.mutedTypes, type];

    // Cambio inmediato; si el servidor lo rechaza se vuelve al valor anterior.
    queryClient.setQueryData<AdminPushPreferences>(adminPushPreferencesKey, { ...current, mutedTypes });
    setSavingPreferences(true);
    try {
      const saved = await updateAdminPushPreferences(mutedTypes);
      queryClient.setQueryData(adminPushPreferencesKey, saved);
    } catch (err) {
      queryClient.setQueryData(adminPushPreferencesKey, current);
      toast.error(extractServerMessage(err, "No se pudo guardar la preferencia."));
    } finally {
      setSavingPreferences(false);
    }
  };

  const deviceList = devices.data ?? [];

  return (
    <section id="push-settings" className={s.settings} aria-label="Avisos en tus dispositivos">
      <div className={s.block}>
        <h2 className={s.blockTitle}>Este dispositivo</h2>
        {push.status === "loading" ? (
          <p className={s.muted}>Consultando el estado…</p>
        ) : push.available ? (
          <>
            <p className={s.stateLine}>
              <span className={`${s.stateIcon} ${push.active ? s.stateIconOn : ""}`} aria-hidden>
                {push.active ? <Bell size={18} strokeWidth={1.5} /> : <BellOff size={18} strokeWidth={1.5} />}
              </span>
              {push.active
                ? "Recibe avisos, incluso con el panel cerrado."
                : "No recibe avisos. Activalos para enterarte al instante."}
            </p>
            <div className={s.actions}>
              <button type="button" className={s.primaryButton} onClick={push.toggle} disabled={push.busy}>
                {push.active ? "Desactivar en este dispositivo" : "Activar notificaciones"}
              </button>
              {push.active && (
                <button type="button" className={s.secondaryButton} onClick={push.sendTest}>
                  <BellRing size={16} strokeWidth={1.75} aria-hidden /> Enviar prueba
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className={s.stateLine}>
              <span className={s.stateIcon} aria-hidden><BellOff size={18} strokeWidth={1.5} /></span>
              No se pueden activar los avisos acá.
            </p>
            {push.status === "ios-install" ? (
              <ol className={s.steps}>
                <li>Abrí este panel en Safari.</li>
                <li>Tocá el botón <strong>Compartir</strong>.</li>
                <li>Elegí <strong>Agregar a inicio</strong>.</li>
                <li>Abrí el panel desde el ícono nuevo, iniciá sesión y activá las notificaciones.</li>
              </ol>
            ) : (
              <p className={s.help}>{push.help}</p>
            )}
          </>
        )}
      </div>

      <div className={s.block}>
        <h2 className={s.blockTitle}>Tus dispositivos</h2>
        {devices.isPending ? (
          <p className={s.muted}>Cargando…</p>
        ) : devices.isError ? (
          <p className={s.help}>{extractServerMessage(devices.error, "No se pudieron cargar los dispositivos.")}</p>
        ) : deviceList.length === 0 ? (
          <p className={s.muted}>Todavía no activaste los avisos en ningún dispositivo.</p>
        ) : (
          <ul className={s.deviceList}>
            {deviceList.map((device) => {
              const isCurrent = Boolean(fingerprint.data) && device.fingerprint === fingerprint.data;
              const name = describeDevice(device.userAgent);
              return (
                <li key={device.id} className={s.device}>
                  <span className={s.deviceIcon} aria-hidden><MonitorSmartphone size={18} strokeWidth={1.5} /></span>
                  <span className={s.deviceText}>
                    <span className={s.deviceName}>
                      {name}
                      {isCurrent && <span className={s.currentTag}>Este dispositivo</span>}
                    </span>
                    <span className={s.deviceMeta}>Último uso del panel: {formatSeen(device.lastSeenAt)}</span>
                  </span>
                  <button
                    type="button"
                    className={s.removeButton}
                    onClick={() => removeDevice(device, isCurrent)}
                    disabled={removingID !== null}
                    aria-label={`Quitar ${name}`}
                    title="Quitar dispositivo"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={s.block}>
        <h2 className={s.blockTitle}>Qué avisos llegan al dispositivo</h2>
        <p className={s.muted}>La bandeja los guarda todos; esto solo define cuáles te suenan.</p>
        {preferences.isPending ? (
          <p className={s.muted}>Cargando…</p>
        ) : preferences.isError ? (
          <p className={s.help}>{extractServerMessage(preferences.error, "No se pudieron cargar las preferencias.")}</p>
        ) : (
          <ul className={s.typeList}>
            {preferences.data.types.map((type) => {
              const option = TYPE_OPTIONS[type] ?? { label: type, hint: "" };
              return (
                <li key={type}>
                  <label className={s.typeOption}>
                    <input
                      type="checkbox"
                      className="md-check"
                      checked={!preferences.data.mutedTypes.includes(type)}
                      onChange={(event) => setTypeEnabled(type, event.target.checked)}
                      disabled={savingPreferences}
                    />
                    <span className={s.typeText}>
                      <span className={s.typeLabel}>{option.label}</span>
                      {option.hint && <span className={s.typeHint}>{option.hint}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
