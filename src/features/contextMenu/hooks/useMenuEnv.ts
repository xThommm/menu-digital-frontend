import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { MenuEnv } from "../lib/menuEnv";

/** Copiar, abrir links y navegar, para armar menús con lib/menuEnv. */
export function useMenuEnv(): MenuEnv {
  const navigate = useNavigate();
  return useMemo<MenuEnv>(() => ({
    copy: (text) => navigator.clipboard.writeText(text),
    openUrl: (url) => { window.open(url, "_blank", "noopener,noreferrer"); },
    navigate: (path, state) => { void navigate(path, state === undefined ? undefined : { state }); },
  }), [navigate]);
}
