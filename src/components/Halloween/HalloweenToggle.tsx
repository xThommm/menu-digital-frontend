import { useHalloween } from "../../hooks/useHalloween";

// Interruptor flotante, discreto. Solo existe durante la temporada.
export default function HalloweenToggle({ level }: { level: "full" | "low" }) {
  const { enabled, toggle } = useHalloween();
  const label = enabled ? "Apagar decoración de Halloween" : "Encender decoración de Halloween";
  return (
    <button
      type="button"
      className="hw-toggle"
      data-on={enabled}
      data-level={level}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">🎃</span>
    </button>
  );
}
