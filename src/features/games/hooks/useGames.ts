import { useEffect, useState } from "react";
import { getPublicGames } from "../api/gamesApi";
import type { PublicGames } from "../types";

// Juegos habilitados del local, para la carta pública. null mientras carga, si
// el local no tiene juegos o si la consulta falla: la carta sigue como siempre.

export function useGames(slug: string | undefined): PublicGames | null {
  const [state, setState] = useState<{ slug: string; games: PublicGames } | null>(null);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    getPublicGames(slug, controller.signal)
      .then(games => setState({ slug, games }))
      .catch(() => { /* sin juegos */ });
    return () => controller.abort();
  }, [slug]);

  // Lo cargado es de otro local (se navegó de una carta a otra): todavía no hay nada.
  return state && state.slug === slug && state.games.enabled ? state.games : null;
}
