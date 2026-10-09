import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useHalloween } from "../../hooks/useHalloween";
import { halloweenLevelFor } from "../../lib/halloween";
import HalloweenToggle from "./HalloweenToggle";

// Los murciélagos van en su propio chunk: fuera de temporada, o con el
// interruptor apagado, no se descargan.
const Bats = lazy(() => import("./Bats"));

// Montado una vez en App. Marca <html data-halloween="full|low" > y todo el
// adorno de CSS (cursor, botones, telarañas) se engancha a ese atributo.
export default function HalloweenEffects() {
  const { season, enabled } = useHalloween();
  const { pathname } = useLocation();
  const level = halloweenLevelFor(pathname);
  const active = enabled && level !== null;

  const [motionOk, setMotionOk] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setMotionOk(!mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.halloween = level!;
    else delete root.dataset.halloween;
    return () => { delete root.dataset.halloween; };
  }, [active, level]);

  if (!season || level === null) return null;
  return (
    <>
      {active && motionOk && (
        <Suspense fallback={null}>
          <Bats level={level} />
        </Suspense>
      )}
      <HalloweenToggle level={level} />
    </>
  );
}
