import { createContext } from "react";

export type Subscription = "none" | "monthly" | "semestral" | "annual";

export interface User {
  id: string;
  name: string;
  role: "admin" | "user";
  slug: string;
  subscription: Subscription;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  updateSubscription: (subscription: Subscription) => Promise<void>;
  isAuthenticated: boolean;
}

// ✅ Solo exporta el contexto — con allowConstantExport: true en ESLint no genera warning
export const AuthContext = createContext<AuthContextType | undefined>(undefined);