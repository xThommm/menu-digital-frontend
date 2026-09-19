import { useCallback, useSyncExternalStore } from "react";

// Suscripción a una media query de CSS. Se usa cuando cambia la ESTRUCTURA
// (qué se renderiza), no solo el estilo: para lo visual alcanza con el
// @media del módulo CSS. Sin window (prerender) responde false.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
