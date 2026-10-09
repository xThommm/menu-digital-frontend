import Spinner from "./Spinner";
import { useHalloweenActive } from "../../hooks/useHalloween";

export default function FullScreenLoader({ label = "Cargando..." }: { label?: string }) {
  const halloween = useHalloweenActive();
  return (
    <div className="pageLoaderScreen">
      <Spinner size={36} label={label} />
      {halloween && <p className="hw-loader-text" aria-hidden="true">Preparando pociones…</p>}
    </div>
  );
}
