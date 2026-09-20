import { LayoutGrid, List, Check, Coffee, Sandwich, Flame, Wine, Croissant } from "lucide-react";
import { VISUAL_FAMILIES, type MenuStyle } from "../../../../lib/menuStyles";
import styles from "./MenuStylePicker.module.css";

const options = [
  { id: "classic", name: "Clásico", description: "Carta en lista, con fotos al costado y lectura compacta.", Icon: List },
  { id: "bistro", name: "Bistró", description: "Tarjetas redondeadas, fotos circulares y platos protagonistas.", Icon: LayoutGrid },
] as const;

const familyIcons = { coffee: Coffee, "fast-food": Sandwich, grill: Flame, premium: Wine, bakery: Croissant };

export default function MenuStylePicker({ value, disabled, onChange }: {
  value: MenuStyle;
  disabled: boolean;
  onChange: (value: MenuStyle) => void;
}) {
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend>Familia visual</legend>
      <p className={styles.hint}>Una misma identidad para la portada y la carta. Podés combinar cada familia con cualquiera de las paletas de tu plan.</p>
      <div className={styles.families}>
        {VISUAL_FAMILIES.map(family => {
          const Icon = familyIcons[family.id];
          return (
            <button key={family.id} type="button" aria-pressed={value === family.id}
              className={styles.family} onClick={() => onChange(family.id)}>
              <span className={styles.sample} data-template={family.samplePalette} data-menu-family={family.id}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span className={styles.sampleTitle}>{family.name}</span>
                <span className={styles.sampleCaption}>Portada + carta</span>
              </span>
              <span className={styles.familyCopy}>
                <span>{family.description}</span>
                <span className={styles.suggestion}>Paletas sugeridas: {family.palettes}.</span>
              </span>
              {value === family.id && <span className={styles.familyCheck}><Check size={15} aria-hidden="true" /> Activa</span>}
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>Elegir una familia conserva tu paleta actual. Los colores de las muestras son sugerencias.</p>
      <details className={styles.previous} open={value === "classic" || value === "bistro" ? true : undefined}>
        <summary>Diseños anteriores{value === "classic" || value === "bistro" ? " · uno en uso" : ""}</summary>
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
      </details>
    </fieldset>
  );
}
