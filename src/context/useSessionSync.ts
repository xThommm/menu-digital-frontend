import { useEffect } from "react";
import { useAuth } from "./useAuth";

// La expiración se resuelve en el servidor en cada request. Este refresco
// mantiene la sesión alineada sin exigir que el usuario cierre y vuelva a
// abrir el panel justo cuando vence el plan: sincroniza al entrar, al volver
// a la pestaña y en el instante de vencimiento (con chequeos diarios para
// fechas muy lejanas). Las cuentas legacy sin fecha no generan timers.
//
// Lo llaman los guards del panel (UserRoute, AdminRoute) y no AuthProvider:
// ese envuelve toda la app, incluida la carta pública (/:slug/menu), y ahí
// no hay panel que mantener alineado — cada carga de la carta disparaba un
// GET /users/me completo que nadie usaba. SellerRoute sincroniza las cuentas
// de vendedor contra /sellers/me por su cuenta.
export function useSessionSync() {
  const { token, user, refreshUser } = useAuth();

  useEffect(() => {
    if (!token || user?.role === "seller") return;

    let cancelled = false;
    let expiryTimer: number | undefined;
    const maxTimerDelay = 24 * 60 * 60 * 1000;

    const sync = () => {
      if (!cancelled) void refreshUser().catch(() => {});
    };

    const expiresAt = user?.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt).getTime()
      : Number.NaN;
    if (user?.subscription !== "free" && Number.isFinite(expiresAt)) {
      const scheduleExpiryCheck = () => {
        if (cancelled) return;
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
          sync();
          return;
        }
        expiryTimer = window.setTimeout(scheduleExpiryCheck, Math.min(remaining + 100, maxTimerDelay));
      };
      scheduleExpiryCheck();
    }

    const onFocus = () => sync();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    sync();

    return () => {
      cancelled = true;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshUser, token, user?.role, user?.subscription, user?.subscriptionExpiresAt, user?.subscriptionStatus]);
}
