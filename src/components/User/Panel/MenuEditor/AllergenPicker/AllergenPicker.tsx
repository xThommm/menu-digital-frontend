import {
  ALLERGENS, DIETARY, blockingAllergen, blockingDietary, labelOfAllergen, toggleAllergen, toggleDietary,
  type AllergenSelection,
} from "../../../../../lib/allergens";
import styles from "./AllergenPicker.module.css";

// Alérgenos y etiquetas de un producto en el formulario del editor: tres
// grupos de chips ("Apto para", "Contiene", "Puede contener trazas de").
// Las combinaciones que el backend rechaza (Sin TACC con gluten, vegano con
// lácteos) se deshabilitan acá con el motivo, en vez de esperar el error al
// guardar.
export default function AllergenPicker({
  value,
  onChange,
}: {
  value: AllergenSelection;
  onChange: (next: AllergenSelection) => void;
}) {
  const allergenGroup = (field: "allergens" | "mayContain", title: string, hint: string) => (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{title}</legend>
      <p className={styles.hint}>{hint}</p>
      <div className={styles.chips}>
        {ALLERGENS.map(({ code, label, Icon }) => {
          const selected = value[field].includes(code);
          const blocker = selected ? null : blockingDietary(code, value.dietary);
          // Una traza de algo que el producto ya contiene no agrega nada.
          const alreadyContained = field === "mayContain" && value.allergens.includes(code);
          const reason = blocker
            ? `No se puede: el producto está marcado como ${blocker.label}`
            : alreadyContained ? "Ya figura en Contiene" : undefined;
          return (
            <button
              key={code}
              type="button"
              className={`${styles.chip} ${selected ? (field === "allergens" ? styles.chipOn : styles.chipTrace) : ""}`}
              aria-pressed={selected}
              disabled={Boolean(reason)}
              title={reason}
              onClick={() => onChange(toggleAllergen(value, field, code))}
            >
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className={styles.picker}>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Apto para</legend>
        <div className={styles.chips}>
          {DIETARY.map(({ code, label, Icon }) => {
            const selected = value.dietary.includes(code);
            const blocker = selected ? null : blockingAllergen(code, value);
            return (
              <button
                key={code}
                type="button"
                className={`${styles.chip} ${selected ? styles.chipDiet : ""}`}
                aria-pressed={selected}
                disabled={Boolean(blocker)}
                title={blocker ? `No se puede: el producto tiene ${labelOfAllergen(blocker).toLowerCase()}` : undefined}
                onClick={() => onChange(toggleDietary(value, code))}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
        {value.dietary.includes("sin_tacc") && (
          <p className={styles.hint}>
            Sin TACC significa que también se cuida la contaminación cruzada en la cocina.
          </p>
        )}
      </fieldset>

      {allergenGroup("allergens", "Contiene", "Ingredientes alérgenos de la receta.")}
      {allergenGroup("mayContain", "Puede contener trazas de", "Por contaminación cruzada en la cocina o en los insumos.")}
    </div>
  );
}
