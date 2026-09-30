import type { InheritedSector } from "../../hooks/useMenuSectors";
import type { Sector, SectorTargetType } from "../../types";

// Selector "a qué sector va" del editor de menú (sección, categoría o
// producto). La primera opción es heredar, y dice qué sector se hereda y de
// dónde, así el dueño ve el resultado sin tener que recorrer la cascada.

const FROM_LABEL: Record<InheritedSector["from"], string> = {
  item: "del producto",
  category: "de la categoría",
  section: "de la sección",
  default: "sector por defecto",
};

const TARGET_LABEL: Record<SectorTargetType, string> = {
  item: "este producto",
  category: "esta categoría",
  section: "esta sección",
};

interface Props {
  id: string;
  targetType: SectorTargetType;
  sectors: Sector[];
  value: number | null;
  inherited: InheritedSector | null;
  onChange: (sectorId: number | null) => void;
  disabled?: boolean;
  // Clases del formulario que lo contiene (el editor tiene las suyas).
  className?: string;
  hintClassName?: string;
}

export default function SectorField({
  id, targetType, sectors, value, inherited, onChange, disabled = false, className, hintClassName,
}: Props) {
  if (sectors.length === 0) return null;
  const inheritLabel = inherited
    ? `Heredar: ${inherited.sector.name} (${FROM_LABEL[inherited.from]})`
    : "Heredar";

  return (
    <div className={className}>
      <label htmlFor={id}>Sector de la comanda</label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">{inheritLabel}</option>
        {sectors.map(sector => (
          <option key={sector.id} value={sector.id}>{sector.name}</option>
        ))}
      </select>
      <p className={hintClassName}>
        {targetType === "item"
          ? "Al confirmar un pedido, este producto sale en la comanda de ese sector."
          : `Todo lo que está adentro de ${TARGET_LABEL[targetType]} va a ese sector, salvo lo que tenga otro elegido.`}
      </p>
    </div>
  );
}
