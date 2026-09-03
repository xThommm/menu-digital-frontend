import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { AuthResponse, AuthUser } from '../types';

type AuthUserPayload = {
  _id: string
  username: string
  admin: boolean
  slug: string
  subscription?: AuthUser["subscription"]
  subscriptionExpiresAt?: string | null
  subscriptionStatus?: AuthUser["subscriptionStatus"]
  previousSubscription?: AuthUser["previousSubscription"]
  downgradeReason?: AuthUser["downgradeReason"]
  downgradedAt?: string | null
}

const toAuthUser = (data: AuthUserPayload): AuthUser => ({
  id: data._id,
  name: data.username,
  role: data.admin ? "admin" : "user",
  slug: data.slug,
  subscription: data.subscription ?? "free",
  subscriptionExpiresAt: data.subscriptionExpiresAt ?? null,
  subscriptionStatus: data.subscriptionStatus,
  previousSubscription: data.previousSubscription ?? null,
  downgradeReason: data.downgradeReason ?? null,
  downgradedAt: data.downgradedAt ?? null,
});


function readAuthFromStorage(): { user: AuthUser | null; token: string | null } {
  const savedToken = localStorage.getItem("token");
  const savedUser  = localStorage.getItem("user");
  const expiry     = localStorage.getItem("tokenExpiry");

  const isExpired = !expiry || Date.now() > Number(expiry);

  if (savedToken && savedUser && !isExpired) {
    try {
      return { token: savedToken, user: JSON.parse(savedUser) as AuthUser };
    } catch {
      // JSON corrupto — caer al cleareo
    }
  }

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("tokenExpiry");
  return { user: null, token: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // ✅ Estado combinado: una sola inicialización de localStorage
  const [auth, setAuth] = useState(() => readAuthFromStorage());
  const [isLoading, setIsLoading] = useState(false);

  const user  = auth.user;
  const token = auth.token;

  const setUser  = (u: AuthUser | null) => setAuth(prev => ({ ...prev, user: u }));
  const setToken = (t: string | null)   => setAuth(prev => ({ ...prev, token: t }));

  const completeLogin = useCallback((data: AuthResponse): AuthUser => {
    const loggedUser = toAuthUser(data);

    setAuth({ token: data.token, user: loggedUser });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(loggedUser));
    localStorage.setItem("tokenExpiry", String(Date.now() + 1000 * 60 * 60 * 24 * 7));
    return loggedUser;
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    if (!token) return null;

    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;

    const data = await response.json() as AuthUserPayload;
    const refreshedUser = toAuthUser(data);

    setAuth(prev => ({ ...prev, user: refreshedUser }));
    localStorage.setItem("user", JSON.stringify(refreshedUser));
    return refreshedUser;
  }, [token]);

  // La expiración se resuelve en el servidor en cada request. Este refresco
  // mantiene la sesión alineada sin exigir que el usuario cierre y vuelva a
  // abrir el panel justo cuando vence el plan: sincroniza al entrar, al volver
  // a la pestaña y en el instante de vencimiento (con chequeos diarios para
  // fechas muy lejanas). Las cuentas legacy sin fecha no generan timers.
  useEffect(() => {
    if (!token) return;

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
  }, [refreshUser, token, user?.subscription, user?.subscriptionExpiresAt, user?.subscriptionStatus]);

  // ✅ Parámetro `username` no choca con ningún estado
  const login = async (username: string, password: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const text = await response.text();

      if (!response.ok) {
        let errorMsg = "Error en el servidor";
        try {
          const errorData = JSON.parse(text) as { message?: string; error?: string };
          errorMsg = errorData.message ?? errorData.error ?? errorMsg;
        } catch { /* respuesta no-JSON */ }
        throw new Error(errorMsg);
      }

      const data = JSON.parse(text) as AuthResponse;

      return completeLogin(data);
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("tokenExpiry");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, completeLogin, refreshUser, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
