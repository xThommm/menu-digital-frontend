import { useRef } from "react";
import { setHalloweenEnabled, useHalloween } from "../../hooks/useHalloween";
import { SWARM_CLICKS, SWARM_EVENT } from "../../lib/halloween";

// Clics más separados que esto no cuentan como seguidos.
const STREAK_MS = 700;

// Interruptor flotante, discreto. Solo existe durante la temporada.
export default function HalloweenToggle({ lift = false }: { lift?: boolean }) {
  const { enabled, toggle } = useHalloween();
  const streak = useRef({ count: 0, last: 0 });
  const label = enabled ? "Apagar decoración de Halloween" : "Encender decoración de Halloween";

  const onClick = () => {
    const now = performance.now();
    const s = streak.current;
    s.count = now - s.last < STREAK_MS ? s.count + 1 : 1;
    s.last = now;
    if (s.count < SWARM_CLICKS) {
      toggle();
      return;
    }
    // Quinto clic seguido: queda encendido y llueven murciélagos. La demora
    // le da tiempo al canvas a montarse si venía apagado.
    s.count = 0;
    setHalloweenEnabled(true);
    window.setTimeout(() => window.dispatchEvent(new Event(SWARM_EVENT)), 350);
  };

  return (
    <button
      type="button"
      className="hw-toggle"
      data-on={enabled}
      data-lift={lift}
      onClick={onClick}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">🎃</span>
    </button>
  );
}
