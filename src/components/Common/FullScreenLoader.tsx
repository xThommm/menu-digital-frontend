import Spinner from "./Spinner";

export default function FullScreenLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="pageLoaderScreen">
      <Spinner size={36} label={label} />
    </div>
  );
}
