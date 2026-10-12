import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import {
  DEFAULT_PANEL_PREFERENCES, PANEL_ACCENTS, PANEL_FONT_SIZES,
  type PanelAccent, type PanelFontSize, type PanelPreferences,
} from "../../../../lib/panelPreferences";
import type { PanelTheme } from "../../../../hooks/useTheme";
import styles from "./PanelAppearanceDialog.module.css";

// Preferencias de apariencia del panel: tema, color de acento y tamaño de
// letra. Cada cambio se aplica al instante (el panel de fondo es la vista
// previa) y se guarda en el dispositivo; no hay botón de guardar.
export default function PanelAppearanceDialog({
  theme, preferences, onTheme, onAccent, onFontSize, onReset, onClose,
}: {
  theme: PanelTheme;
  preferences: PanelPreferences;
  onTheme: (theme: PanelTheme) => void;
  onAccent: (accent: PanelAccent) => void;
  onFontSize: (size: PanelFontSize) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  const isDefault = preferences.accent === DEFAULT_PANEL_PREFERENCES.accent
    && preferences.fontSize === DEFAULT_PANEL_PREFERENCES.fontSize;

  return createPortal(
    <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="panel-appearance-title">
        <header className={styles.header}>
          <div>
            <h2 id="panel-appearance-title" className={styles.title}>Apariencia del panel</h2>
            <p className={styles.description}>Se aplica a todo tu panel y se guarda en este dispositivo.</p>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        <fieldset className={styles.group}>
          <legend>Tema</legend>
          <div className={styles.segmented}>
            {(["dark", "light"] as const).map(option => (
              <button key={option} type="button" className={styles.segment}
                aria-pressed={theme === option} onClick={() => onTheme(option)}>
                {option === "dark" ? "Oscuro" : "Claro"}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Color</legend>
          <div className={styles.swatches}>
            {PANEL_ACCENTS.map(accent => {
              const active = preferences.accent === accent.id;
              return (
                <button key={accent.id} type="button" className={styles.swatch}
                  aria-pressed={active} onClick={() => onAccent(accent.id)}>
                  <span className={styles.swatchColor} style={{ background: accent.swatch[theme] }}>
                    {active && <Check size={16} strokeWidth={2.5} aria-hidden />}
                  </span>
                  {accent.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Tamaño de letra</legend>
          <div className={styles.segmented}>
            {PANEL_FONT_SIZES.map(size => (
              <button key={size.id} type="button" className={styles.segment}
                aria-pressed={preferences.fontSize === size.id} onClick={() => onFontSize(size.id)}>
                <span className={styles.sizeSample} data-size={size.id} aria-hidden>A</span>
                {size.name}
              </button>
            ))}
          </div>
        </fieldset>

        <footer className={styles.footer}>
          <button type="button" className={styles.reset} onClick={onReset} disabled={isDefault}>
            Restablecer color y tamaño
          </button>
          <button type="button" className={styles.done} onClick={onClose}>Listo</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
