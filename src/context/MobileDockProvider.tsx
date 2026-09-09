import { useCallback, useMemo, useState, type ReactNode } from "react";
import { MobileDockContext } from "./MobileDockContext";

// Le da a vistas hijas full-screen (ej. el Gestor de imágenes dentro de
// MenuEditor) una forma de pedirle a DashboardLayout que oculte el dock de
// navegación mobile mientras están abiertas — tienen su propio botón de
// "volver" y el dock solo tapa contenido sin aportar nada ahí.
export function MobileDockProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);
  const value = useMemo(() => ({ hidden, hide, show }), [hidden, hide, show]);

  return <MobileDockContext.Provider value={value}>{children}</MobileDockContext.Provider>;
}
