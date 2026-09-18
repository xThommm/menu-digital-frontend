import { LayoutGrid, List, Check } from "lucide-react";
import type { MenuStyle } from "../../../../lib/menuStyles";
import styles from "./MenuStylePicker.module.css";

const options = [
  { id: "classic", name: "Clásico", description: "Carta en lista, con fotos al costado y lectura compacta.", Icon: List },
  { id: "bistro", name: "Bistró", description: "Tarjetas redondeadas, fotos circulares y platos protagonistas.", Icon: LayoutGrid },
] as const;

export default function MenuStylePicker({ value, disabled, onChange }: {
  value: MenuStyle;
  disabled: boolean;
  onChange: (value: MenuStyle) => void;
}) {
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend>Diseño de carta</legend>
      <div className={styles.options}>
        {options.map(({ id, name, description, Icon }) => (
          <button key={id} type="button" aria-pressed={value === id}
            className={styles.option} onClick={() => onChange(id)}>
            <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
            <span className={styles.copy}><strong>{name}</strong><span>{description}</span></span>
            {value === id && <Check size={18} className={styles.check} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
