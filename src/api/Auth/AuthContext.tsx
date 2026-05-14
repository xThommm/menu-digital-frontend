import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface User {
  id: string;
  name: string;
  role: "admin" | "user";
  slug: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const savedToken = localStorage.getItem("token");
  const savedUser  = localStorage.getItem("user");
  const expiry     = localStorage.getItem("tokenExpiry");

  const isExpired = !expiry || Date.now() > Number(expiry);

  if (savedToken && savedUser && !isExpired) {
    setToken(savedToken);
    setUsername(JSON.parse(savedUser));
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("tokenExpiry");
  }
  setIsLoading(false);
}, []);

  const login = async (username: string, password: string) => {
  setIsLoading(true);
  try {
    const response = await fetch("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    // Primero lee el body como texto para debug
    const text = await response.text();

    if (!response.ok) {
      let errorMsg = "Error en el servidor";
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.message || errorData.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    // Si llegó aquí, es JSON válido
  const data = JSON.parse(text);
  

const user = {
  id: data._id,
  name: data.username,
  role: (data.admin === true ? "admin" : "user") as "admin" | "user",
  slug: data.slug,
};

setToken(data.token);
setUsername(user);
localStorage.setItem("token", data.token);
localStorage.setItem("user", JSON.stringify(user));
localStorage.setItem("tokenExpiry", String(Date.now() + 1000 * 60 * 30)); // 30 minutos
    
  } catch (err: any) {
    console.error("Login error:", err);
    throw err;
  } finally {
    setIsLoading(false);
  }
};

  const logout = () => {
  setUsername(null);
  setToken(null);
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("tokenExpiry");
};

  return (
    <AuthContext.Provider
      value={{
        user: username,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!username,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}