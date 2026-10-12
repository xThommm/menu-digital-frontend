import { useEffect, useState } from "react";
import type { PublicMenuPayload } from "../../../../types/index";
import { resolveMenuDisplay } from "../../../../lib/menuDisplay";
import { pickHighlights, type LandingHighlights } from "../../../../lib/landingHighlights";

export interface ShowcaseData extends LandingHighlights {
  hidePrices: boolean;
}

// La portada no trae productos: se piden a la carta pública. `track=0` la
// excluye de las estadísticas: mirar la portada no es una visita a la carta.
// Si falla, la portada queda sin vidriera y nada más.
export function useLandingHighlights(slug: string, enabled: boolean): ShowcaseData | null {
  const [state, setState] = useState<{ slug: string; data: ShowcaseData } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/users/${slug}/menu?v=2&track=0`, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then((payload: PublicMenuPayload | null) => {
        if (!payload) return;
        const { hidePrices } = resolveMenuDisplay(payload.user?.menuDisplay);
        setState({ slug, data: { ...pickHighlights(payload.menu, { hidePrices }), hidePrices } });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [slug, enabled]);

  return enabled && state?.slug === slug ? state.data : null;
}
