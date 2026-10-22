import { useState } from "react";
import { ListFilter, X } from "lucide-react";
import {
  allergenInfo, dietaryInfo, isDietFilterActive, itemHasDietInfo as hasDietInfo, labelOfAllergen, labelOfDietary,
  type MenuDietFilter,
} from "../../../../lib/allergens";
import styles from "./ItemDietInfo.module.css";

interface DietItem {
  allergens?: string[];
  mayContain?: string[];
  dietary?: string[];
}

const joinLabels = (codes: string[]) => codes.map(labelOfAllergen).join(", ").toLowerCase();

// ── Tarjeta de la carta: etiquetas y una línea corta ──────────────────────────
export function ItemDietSummary({ item }: { item: DietItem }) {
  if (!hasDietInfo(item)) return null;
  const allergens = item.allergens ?? [];
  const mayContain = item.mayContain ?? [];
  return (
    <div className={styles.summary}>
      {(item.dietary ?? []).map(code => {
        const Icon = dietaryInfo(code)?.Icon;
        return (
          <span key={code} className={styles.dietPill}>
            {Icon && <Icon size={11} strokeWidth={2} aria-hidden="true" />}
            {labelOfDietary(code)}
          </span>
        );
      })}
      {allergens.length > 0 && (
        <span className={styles.summaryText}>Contiene {joinLabels(allergens)}</span>
      )}
      {allergens.length === 0 && mayContain.length > 0 && (
        <span className={styles.summaryText}>Puede contener {joinLabels(mayContain)}</span>
      )}
    </div>
  );
}

// ── Detalle del producto: todo, con íconos ────────────────────────────────────
export function ItemDietDetails({ item }: { item: DietItem }) {
  if (!hasDietInfo(item)) return null;
  const row = (title: string, codes: string[]) => codes.length > 0 && (
    <div className={styles.detailRow}>
      <dt>{title}</dt>
      <dd className={styles.detailChips}>
        {codes.map(code => {
          const Icon = allergenInfo(code)?.Icon;
          return (
            <span key={code} className={styles.allergenChip}>
              {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden="true" />}
              {labelOfAllergen(code)}
            </span>
          );
        })}
      </dd>
    </div>
  );
  return (
    <section className={styles.details} aria-label="Alérgenos">
      {(item.dietary?.length ?? 0) > 0 && (
        <div className={styles.detailChips}>
          {item.dietary!.map(code => {
            const Icon = dietaryInfo(code)?.Icon;
            return (
              <span key={code} className={styles.dietPill}>
                {Icon && <Icon size={12} strokeWidth={2} aria-hidden="true" />}
                {labelOfDietary(code)}
              </span>
            );
          })}
        </div>
      )}
      <dl className={styles.detailList}>
        {row("Contiene", item.allergens ?? [])}
        {row("Puede contener", item.mayContain ?? [])}
      </dl>
      <p className={styles.disclaimer}>Ante alergias severas, consultá al personal antes de pedir.</p>
    </section>
  );
}

// ── Filtro de la carta ────────────────────────────────────────────────────────
// Un botón que despliega las opciones. Solo ofrece etiquetas y alérgenos que
// aparecen en la carta (los pasa MenuPage).
export function DietFilterBar({
  filter,
  onChange,
  dietaryCodes,
  allergenCodes,
  resultCount,
}: {
  filter: MenuDietFilter;
  onChange: (next: MenuDietFilter) => void;
  dietaryCodes: string[];
  allergenCodes: string[];
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);
  const active = isDietFilterActive(filter);
  const activeCount = filter.dietary.length + filter.avoid.length;

  const toggle = (field: keyof MenuDietFilter, code: string) => {
    const list = filter[field];
    onChange({ ...filter, [field]: list.includes(code) ? list.filter(c => c !== code) : [...list, code] });
  };

  return (
    <div className={styles.filter}>
      <div className={styles.filterHead}>
        <button
          type="button"
          className={`${styles.filterToggle} ${active ? styles.filterToggleOn : ""}`}
          aria-expanded={open}
          aria-controls="mp-diet-filter"
          onClick={() => setOpen(prev => !prev)}
        >
          <ListFilter size={15} strokeWidth={2} aria-hidden="true" />
          Alérgenos y dietas
          {active && <span className={styles.filterCount}>{activeCount}</span>}
        </button>
        {active && (
          <>
            <span className={styles.filterResult} role="status">
              {resultCount} {resultCount === 1 ? "producto" : "productos"}
            </span>
            <button type="button" className={styles.filterClear} onClick={() => onChange({ dietary: [], avoid: [] })}>
              <X size={13} strokeWidth={2} aria-hidden="true" /> Quitar filtro
            </button>
          </>
        )}
      </div>

      {open && (
        <div id="mp-diet-filter" className={styles.filterPanel}>
          {dietaryCodes.length > 0 && (
            <fieldset className={styles.filterGroup}>
              <legend>Mostrar solo</legend>
              <div className={styles.filterChips}>
                {dietaryCodes.map(code => {
                  const Icon = dietaryInfo(code)?.Icon;
                  const on = filter.dietary.includes(code);
                  return (
                    <button key={code} type="button" aria-pressed={on}
                      className={`${styles.filterChip} ${on ? styles.filterChipOn : ""}`}
                      onClick={() => toggle("dietary", code)}>
                      {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden="true" />}
                      {labelOfDietary(code)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {allergenCodes.length > 0 && (
            <fieldset className={styles.filterGroup}>
              <legend>Sin</legend>
              <div className={styles.filterChips}>
                {allergenCodes.map(code => {
                  const Icon = allergenInfo(code)?.Icon;
                  const on = filter.avoid.includes(code);
                  return (
                    <button key={code} type="button" aria-pressed={on}
                      className={`${styles.filterChip} ${on ? styles.filterChipOn : ""}`}
                      onClick={() => toggle("avoid", code)}>
                      {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden="true" />}
                      {labelOfAllergen(code)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <p className={styles.disclaimer}>
            "Sin" también deja afuera lo que puede contener trazas, y no se muestran los productos que el local
            no informó. Ante alergias severas, consultá al personal.
          </p>
        </div>
      )}
    </div>
  );
}
