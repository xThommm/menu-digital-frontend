import { useHalloweenActive } from "../../hooks/useHalloween";
import Pumpkin from "./Pumpkin";

const BAT_PATH = "M12 6c-1-2-2-3-3-3 0 1 0 2 .5 3C6 5 3 6 0 9c2 0 3 .5 4 2 1-1 2-1 3 0 1-1.500 2-1.500 3 0 .5 1 1 2 2 3 1-1 1.500-2 2-3 1-1.500 2-1.500 3 0 1-1 2-1 3 0 1-1.500 2-2 4-2-3-3-6-4-9.500-3 .5-1 .5-2 .5-3-1 0-2 1-3 3z";

// Cielo del hero de la landing: luna llena con nubes que pasan, murciélagos
// que cruzan de tanto en tanto, un relámpago muy tenue y dos calabazas al
// pie. Va dentro de la sección (position: relative; overflow: hidden), por
// debajo del contenido.
export default function HalloweenSky() {
  if (!useHalloweenActive()) return null;
  return (
    <div className="hw-sky" aria-hidden="true">
      <div className="hw-lightning" />
      <div className="hw-moon" />
      <div className="hw-cloud hw-cloud-a" />
      <div className="hw-cloud hw-cloud-b" />
      {[0, 1, 2].map((i) => (
        <svg key={i} className={`hw-skybat hw-skybat-${i}`} width="34" height="20" viewBox="0 0 24 14" focusable="false">
          <path d={BAT_PATH} fill="currentColor" />
        </svg>
      ))}
      <Pumpkin size={58} className="hw-pumpkin-bl" />
      <Pumpkin size={44} className="hw-pumpkin-br" />
    </div>
  );
}
