import { LayoutGrid, List, Check, Coffee, Sandwich, Flame, Wine, Croissant, Lock, Shapes, Hand } from "lucide-react";
import { MENU_STYLE_OPTIONS, isLegacyMenuStyle, isPremiumMenuStyle, getMenuStyleFeature, type MenuStyle } from "../../../../lib/menuStyles";
import { TEMPLATES, templateName } from "../../../../lib/templates";
import styles from "./MenuStylePicker.module.css";

const styleIcons: Record<MenuStyle, typeof List> = {
  classic: List, bistro: LayoutGrid,
  coffee: Coffee, "fast-food": Sandwich, grill: Flame, premium: Wine, bakery: Croissant,
  "neo-brutalism": Shapes, tactile: Hand,
};

type StyleFeature = NonNullable<ReturnType<typeof getMenuStyleFeature>>;

// "Aurora, Natural o Terracotta" — misma forma que la copy original.
function listPalettes(ids: readonly number[]) {
  const names = ids.map(templateName);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

export default function MenuStylePicker({
  value, template, disabled, onChange, templateIds, lockedFeatures, planLabels, onLocked,
}: {
  value: MenuStyle;
  /** Paleta que el local tiene puesta, para no sugerirle otra como si fuera la suya. */
  template: number;
  disabled: boolean;
  onChange: (value: MenuStyle) => void;
  /** Paletas del plan vigente. Ausente mientras carga el catálogo: no se filtra. */
  templateIds?: number[];
  /** Features de diseño que el plan vigente NO incluye (familias, premium). */
  lockedFeatures: Record<StyleFeature, boolean>;
  /** Etiqueta real del plan que ofrece cada feature, según el catálogo. */
  planLabels: Partial<Record<StyleFeature, string>>;
  onLocked: (feature: StyleFeature) => void;
}) {
  const familiesLocked = lockedFeatures.menu_styles;
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend>Diseño de carta</legend>
      <p className={styles.hint}>
        {familiesLocked
          ? `Una misma identidad para la portada y la carta. Clásico y Bistró están en todos los planes; el resto se desbloquea con el plan ${planLabels.menu_styles ?? "superior"}.`
          : lockedFeatures.premium_menu_styles
            ? `Una misma identidad para la portada y la carta. Los diseños premium se desbloquean con el plan ${planLabels.premium_menu_styles ?? "superior"}.`
            : "Una misma identidad para la portada y la carta. Podés combinar cualquier diseño con las paletas de tu plan."}
      </p>
      <div className={styles.families}>
        {MENU_STYLE_OPTIONS.map(option => {
          const Icon = styleIcons[option.id];
          // Los dos diseños originales no dependen de ninguna feature; las
          // familias de menu_styles y las premium de premium_menu_styles.
          const legacy = isLegacyMenuStyle(option.id);
          const premium = isPremiumMenuStyle(option.id);
          const feature = getMenuStyleFeature(option.id);
          const locked = feature !== null && lockedFeatures[feature];
          // La muestra tiene que pintarse con una paleta que el local pueda
          // elegir de verdad: si ninguna de las sugeridas está en su plan, cae
          // a la que ya tiene puesta —que el backend garantiza dentro del
          // plan—, no a una cualquiera. Nunca queda sin ID: sin [data-template]
          // los tokens --t-* no existen y la muestra se ve rota.
          const allowed = templateIds ?? TEMPLATES.map(item => item.id);
          const available = option.palettes.filter(id => allowed.includes(id));
          const sample = available[0] ?? template;
          return (
            <button key={option.id} type="button" aria-pressed={value === option.id}
              className={`${styles.family} ${locked ? styles.locked : ""}`}
              onClick={() => (locked && feature ? onLocked(feature) : onChange(option.id))}>
              {/* Las familias se previsualizan con data-menu-family (tokens de
                  globals.css); los diseños originales con data-menu-style, que
                  es como los marca la carta real. */}
              <span className={styles.sample} data-template={sample}
                data-menu-family={legacy ? undefined : option.id}
                data-menu-style={legacy ? option.id : undefined}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span className={styles.sampleTitle}>{option.name}</span>
                <span className={styles.sampleCaption}>Portada + carta</span>
                {premium && <span className={styles.premiumTag}>Premium</span>}
                {locked && <span className={styles.lockOverlay}><Lock size={22} aria-hidden="true" /></span>}
              </span>
              <span className={styles.familyCopy}>
                <span>{option.description}</span>
                <span className={styles.suggestion}>
                  {available.length > 0
                    ? `Paletas sugeridas: ${listPalettes(available)}.`
                    : `Combina con tu paleta ${templateName(sample)}.`}
                </span>
              </span>
              {locked
                ? <span className={styles.familyPlan}>{(feature && planLabels[feature]) ?? "No disponible"}</span>
                : value === option.id && <span className={styles.familyCheck}><Check size={15} aria-hidden="true" /> Activa</span>}
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>Cambiar de diseño conserva tu paleta actual. Los colores de las muestras son sugerencias.</p>
    </fieldset>
  );
}
