import type { ReactElement } from "react";
import { Check, Lock } from "lucide-react";
import { PAGE_LAYOUT_OPTIONS, getPageLayoutFeature, type PageLayout } from "../../../../lib/pageLayouts";
import styles from "./PageLayoutPicker.module.css";

// Miniaturas: la portada a la izquierda y la carta a la derecha, en esquema.
// Muestran dónde va cada cosa, no colores ni tipografía (eso lo ponen la
// paleta y el diseño de carta). `photo` marca dónde va la foto de portada.
const thumbnails: Record<PageLayout, ReactElement> = {
  standard: (
    <>
      <rect className={styles.photo} x="12" y="16" width="52" height="34" rx="3" />
      <rect className={styles.ink} x="72" y="20" width="36" height="6" rx="2" />
      <rect className={styles.line} x="72" y="31" width="26" height="3" rx="1.5" />
      <rect className={styles.accent} x="72" y="40" width="34" height="8" rx="4" />
      <rect className={styles.block} x="12" y="60" width="18" height="18" rx="2" />
      <rect className={styles.block} x="34" y="60" width="18" height="18" rx="2" />
      <rect className={styles.block} x="56" y="60" width="18" height="18" rx="2" />
      <rect className={styles.block} x="82" y="60" width="26" height="18" rx="2" />

      <rect className={styles.ink} x="152" y="14" width="34" height="5" rx="2" />
      <rect className={styles.accent} x="152" y="24" width="16" height="6" rx="3" />
      <rect className={styles.block} x="171" y="24" width="16" height="6" rx="3" />
      <rect className={styles.block} x="152" y="36" width="34" height="12" rx="2" />
      <rect className={styles.block} x="190" y="36" width="34" height="12" rx="2" />
      <rect className={styles.block} x="152" y="52" width="34" height="12" rx="2" />
      <rect className={styles.block} x="190" y="52" width="34" height="12" rx="2" />
      <rect className={styles.block} x="152" y="68" width="34" height="12" rx="2" />
      <rect className={styles.block} x="190" y="68" width="34" height="12" rx="2" />
    </>
  ),
  immersive: (
    <>
      <rect className={styles.photo} x="4" y="4" width="112" height="54" rx="3" />
      <rect className={styles.ink} x="12" y="30" width="46" height="8" rx="2" />
      <rect className={styles.accent} x="12" y="43" width="26" height="8" rx="4" />
      <rect className={styles.block} x="42" y="43" width="26" height="8" rx="4" />
      <rect className={styles.block} x="12" y="64" width="34" height="18" rx="2" />
      <rect className={styles.block} x="50" y="64" width="16" height="8" rx="2" />
      <rect className={styles.block} x="50" y="74" width="16" height="8" rx="2" />
      <rect className={styles.block} x="78" y="64" width="30" height="18" rx="2" />

      <rect className={styles.photo} x="124" y="4" width="112" height="28" rx="3" />
      <rect className={styles.ink} x="132" y="18" width="40" height="7" rx="2" />
      <rect className={styles.accent} x="132" y="38" width="16" height="6" rx="3" />
      <rect className={styles.block} x="151" y="38" width="16" height="6" rx="3" />
      <rect className={styles.line} x="124" y="48" width="112" height="1" />
      <rect className={styles.block} x="132" y="54" width="30" height="13" rx="2" />
      <rect className={styles.block} x="165" y="54" width="30" height="13" rx="2" />
      <rect className={styles.block} x="198" y="54" width="30" height="13" rx="2" />
      <rect className={styles.block} x="132" y="70" width="30" height="13" rx="2" />
      <rect className={styles.block} x="165" y="70" width="30" height="13" rx="2" />
      <rect className={styles.block} x="198" y="70" width="30" height="13" rx="2" />
    </>
  ),
};

export default function PageLayoutPicker({
  value, disabled, locked, planLabel, onChange, onLocked,
}: {
  value: PageLayout;
  disabled: boolean;
  /** El plan vigente no incluye page_layouts: solo queda Estándar. */
  locked: boolean;
  /** Etiqueta real del plan que las ofrece, según el catálogo. */
  planLabel?: string;
  onChange: (value: PageLayout) => void;
  onLocked: () => void;
}) {
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend>Plantilla de página</legend>
      <p className={styles.hint}>
        {locked
          ? `Cómo se acomodan la portada y la carta en pantallas grandes. Estándar está en todos los planes; el resto se desbloquea con el plan ${planLabel ?? "superior"}.`
          : "Cómo se acomodan la portada y la carta en pantallas grandes. Se combina con cualquier diseño y cualquier paleta."}
      </p>
      <div className={styles.layouts}>
        {PAGE_LAYOUT_OPTIONS.map(option => {
          const optionLocked = locked && getPageLayoutFeature(option.id) !== null;
          return (
            <button key={option.id} type="button" aria-pressed={value === option.id}
              className={`${styles.layout} ${optionLocked ? styles.locked : ""}`}
              onClick={() => (optionLocked ? onLocked() : onChange(option.id))}>
              <span className={styles.sample}>
                <svg viewBox="0 0 240 88" role="img" aria-label={`Esquema de la plantilla ${option.name}: portada y carta`}>
                  <rect className={styles.frame} x="4" y="4" width="112" height="80" rx="4" />
                  <rect className={styles.frame} x="124" y="4" width="112" height="80" rx="4" />
                  {thumbnails[option.id]}
                </svg>
                <span className={styles.sampleCaption}><span>Portada</span><span>Carta</span></span>
                {optionLocked && <span className={styles.lockOverlay}><Lock size={22} aria-hidden="true" /></span>}
              </span>
              <span className={styles.copy}>
                <strong>{option.name}</strong>
                <span>{option.description}</span>
              </span>
              {optionLocked
                ? <span className={styles.plan}>{planLabel ?? "No disponible"}</span>
                : value === option.id && <span className={styles.check}><Check size={15} aria-hidden="true" /> Activa</span>}
            </button>
          );
        })}
      </div>
      <p className={styles.hint}>En el celular todas las plantillas se ven igual: la diferencia está en la computadora y la tablet apaisada.</p>
    </fieldset>
  );
}
