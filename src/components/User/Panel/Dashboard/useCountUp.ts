import { useEffect, useRef, useState } from "react";

// ── Número que sube hasta su valor ────────────────────────────────────────────
// Arranca desde lo último que se mostró (0 la primera vez), así un refresco
// anima solo la diferencia. Todo el setState pasa dentro de
// requestAnimationFrame; con movimiento reducido salta directo al valor.

export function useCountUp(value: number | undefined, duration = 900) {
  const [display, setDisplay] = useState(0);
  const shownRef = useRef(0);
  useEffect(() => {
    if (value === undefined) return;
    const from = shownRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduce || from === value ? 0 : duration;
    let start: number | null = null;
    let raf = 0;
    const tick = (time: number) => {
      start ??= time;
      const progress = total === 0 ? 1 : Math.min((time - start) / total, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}
