import { createContext } from "react";
import type { AuthUser } from "../types";

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ✅ Solo exporta el contexto — con allowConstantExport: true en ESLint no genera warning
export const AuthContext = createContext<AuthContextType | undefined>(undefined);