import { useState } from "react";
import { LayoutGrid, List, Check, Coffee, Sandwich, Flame, Wine, Croissant, Lock } from "lucide-react";
import { VISUAL_FAMILIES, isLegacyMenuStyle, type MenuStyle } from "../../../../lib/menuStyles";
import { TEMPLATES, templateName } from "../../../../lib/templates";
import styles from "./MenuStylePicker.module.css";

const options = [
  { id: "classic", name: "Clásico", description: "Carta en lista, con fotos al costado y lectura compacta.", Icon: List },
  { id: "bistro", name: "Bistró", description: "Tarjetas redondeadas, fotos circulares y platos protagonistas.", Icon: LayoutGrid },
] as const;

const familyIcons = { coffee: Coffee, "fast-food": Sandwich, grill: Flame, premium: Wine, bakery: Croissant };

// "Aurora, Natural o Terracotta" — misma forma que la copy original.
function listPalettes(ids: readonly number[]) {
  const names = ids.map(templateName);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

export default function MenuStylePicker({
  value, disabled, onChange, templateIds, familiesLocked, lockedPlanLabel, onLockedFamily,
}: {
  value: MenuStyle;
  disabled: boolean;
  onChange: (value: MenuStyle) => void;
  /** Paletas del plan vigente. Ausente mientras carga el catálogo: no se filtra. */
  templateIds?: number[];
  /** El plan vigente no incluye la feature menu_styles. */
  familiesLocked: boolean;
  /** Etiqueta real del plan que sí las ofrece, según el catálogo. */
  lockedPlanLabel?: string;
  onLockedFamily: () => void;
}) {
  // Se congela al montar: si dependiera de `value`, React reescribiría el
  // atributo en cada cambio de diseño y cerraría el bloque de golpe (además
  // de pisar el toggle manual del usuario).
  const [legacyOpen] = useState(() => isLegacyMenuStyle(value));
  const usingLegacy = isLegacyMenuStyle(value);

  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend>Familia visual</legend>
      <p className={styles.hint}>
        {familiesLocked
          ? `Una misma identidad para la portada y la carta. Las familias visuales vienen con el plan ${lockedPlanLabel ?? "superior"}; tu carta sigue funcionando con los diseños de abajo.`
          : "Una misma identidad para la portada y la carta. Podés combinar cada familia con cualquiera de las paletas de tu plan."}
      </p>
      <div className={styles.families}>
        {VISUAL_FAMILIES.map(family => {
          const Icon = familyIcons[family.id];
          // La muestra tiene que pintarse con una paleta que el local pueda
          // elegir de verdad: si ninguna de las sugeridas está en su plan, cae
          // a la primera disponible. Nunca queda sin ID: sin [data-template]
          // los tokens --t-* no existen y la muestra se ve rota.
          const allowed = templateIds ?? TEMPLATES.map(template => template.id);
          const available = family.palettes.filter(id => allowed.includes(id));
          const sample = available[0] ?? allowed[0] ?? 1;
          return (
            <button key={family.id} type="button" aria-pressed={value === family.id}
              className={`${styles.family} ${familiesLocked ? styles.locked : ""}`}
              onClick={() => (familiesLocked ? onLockedFamily() : onChange(family.id))}>
              <span className={styles.sample} data-template={sample} data-menu-family={family.id}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span className={styles.sampleTitle}>{family.name}</span>
                <span className={styles.sampleCaption}>Portada + carta</span>
                {familiesLocked && (
                  <span className={styles.lockOverlay}><Lock size={22} aria-hidden="true" /></span>
                )}
              </span>
              <span className={styles.familyCopy}>
                <span>{family.description}</span>
                <span className={styles.suggestion}>
                  {available.length > 0
                    ? `Paletas sugeridas: ${listPalettes(available)}.`
                    : `Combina con tu paleta ${templateName(sample)}.`}
                </span>
              </span>
              {familiesLocked
                ? <span className={styles.familyPlan}>{lockedPlanLabel ?? "No disponible"}</span>
                : value === family.id && <span className={styles.familyCheck}><Check size={15} aria-hidden="true" /> Activa</span>}
            </button>
          );
        })}
      </div>
      {!familiesLocked && (
        <p className={styles.hint}>Elegir una familia conserva tu paleta actual. Los colores de las muestras son sugerencias.</p>
      )}
      <details className={styles.previous} open={legacyOpen}>
        <summary>Diseños anteriores{usingLegacy ? " · uno en uso" : ""}</summary>
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
