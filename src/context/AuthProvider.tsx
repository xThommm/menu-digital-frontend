import { useState, type ReactNode } from "react";
import { AuthContext, type User, } from "./AuthContext";
import type { AuthResponse, Subscription } from '../types';


function readAuthFromStorage(): { user: User | null; token: string | null } {
  const savedToken = localStorage.getItem("token");
  const savedUser  = localStorage.getItem("user");
  const expiry     = localStorage.getItem("tokenExpiry");

  const isExpired = !expiry || Date.now() > Number(expiry);

  if (savedToken && savedUser && !isExpired) {
    try {
      return { token: savedToken, user: JSON.parse(savedUser) as User };
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

  const setUser  = (u: User | null)   => setAuth(prev => ({ ...prev, user: u }));
  const setToken = (t: string | null) => setAuth(prev => ({ ...prev, token: t }));

  // ✅ Parámetro `username` no choca con ningún estado
  const login = async (username: string, password: string): Promise<User> => {
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

      const loggedUser: User = {
        id: data._id,
        name: data.username,
        role: data.admin ? "admin" : "user",
        slug: data.slug,
        subscription: data.subscription ?? "none",
      };

      setToken(data.token);
      setUser(loggedUser);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(loggedUser));
      localStorage.setItem("tokenExpiry", String(Date.now() + 1000 * 60 * 60 * 24 * 7));

      return loggedUser;
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

  const updateSubscription = async (subscription: Subscription): Promise<void> => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/users/subscription`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) throw new Error("No se pudo actualizar la suscripción");

    const updated: User = { ...user!, subscription };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateSubscription, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}