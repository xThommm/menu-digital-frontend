import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Spinner from "./Spinner";
import panelStyles from "./ConfirmDialog.module.css";
import menuStyles from "./ConfirmDialogMenu.module.css";

// Ventana de confirmación propia de la app (reemplaza window.confirm y
// window.prompt). La usan el menú contextual, "Vaciar pedido" y useDialogs().
// Dos estilos: "panel" (tokens --admin-*) y "menu" (tokens --t-* del template
// de la carta pública; tiene que dibujarse dentro de la carta para heredarlos).

export type ConfirmDialogVariant = "panel" | "menu";

export interface ConfirmDialogField {
  label: string;
  /** "date": selector de fecha (el valor es AAAA-MM-DD). */
  type?: "text" | "date";
  min?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  /** Sin texto no se puede confirmar. */
  required?: boolean;
}

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón de confirmar como acción destructiva. */
  danger?: boolean;
  /** Pide un texto antes de confirmar (lo que antes era window.prompt). */
  field?: ConfirmDialogField;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  variant?: ConfirmDialogVariant;
  busy?: boolean;
  /** value: el texto del campo (sin espacios a los costados), si hay campo. */
  onAnswer: (accepted: boolean, value?: string) => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel, cancelLabel, danger = false, field, variant = "panel", busy = false, onAnswer,
}: ConfirmDialogProps) {
  const s = variant === "menu" ? menuStyles : panelStyles;
  const dialogRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const [value, setValue] = useState(field?.defaultValue ?? "");
  const missingValue = field?.required === true && value.trim() === "";

  // Con campo, el foco arranca en el campo. En una acción destructiva arranca
  // en "Cancelar": un Enter de más no la confirma. Al cerrar, el foco vuelve
  // a donde estaba (normalmente, el botón que abrió la ventana).
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const input = dialog?.querySelector<HTMLInputElement>("input");
    if (input) {
      input.focus();
      if (input.type === "text") input.select();
    } else {
      dialog?.querySelector<HTMLButtonElement>(danger ? "[data-cancel]" : "[data-confirm]")?.focus();
    }
    return () => previous?.focus({ preventScroll: true });
  }, [danger]);

  // Escape cierra solo esta ventana: se ataja antes de que lo vea el modal de
  // abajo (algunos escuchan el teclado en document).
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onAnswer(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [busy, onAnswer]);

  // El foco recorre la ventana y no se va al fondo.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)") ?? [])];
    if (focusable.length === 0) return;
    event.preventDefault();
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    focusable[(current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || missingValue) return;
    onAnswer(true, field ? value.trim() : undefined);
  };

  return (
    <div
      className={s.overlay}
      onKeyDown={onKeyDown}
      // Dibujada dentro de otro modal, el clic no tiene que llegar al fondo de
      // ese modal (lo cerraría).
      onClick={(event) => {
        event.stopPropagation();
        if (!busy) onAnswer(false);
      }}
    >
      <form
        ref={dialogRef}
        className={s.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={message ? `${id}-message` : undefined}
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id={`${id}-title`} className={variant === "menu" ? `${s.title} t-family-heading` : s.title}>{title}</h2>
        {message && <p id={`${id}-message`} className={s.message}>{message}</p>}
        {field && (
          <label className={s.field}>
            <span className={s.fieldLabel}>{field.label}</span>
            <input
              className={s.input}
              type={field.type ?? "text"}
              min={field.min}
              value={value}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        )}
        <div className={s.actions}>
          <button type="button" data-cancel className={s.cancel} disabled={busy} onClick={() => onAnswer(false)}>
            {cancelLabel ?? "Cancelar"}
          </button>
          <button type="submit" data-confirm className={danger ? s.danger : s.accept} disabled={busy || missingValue}>
            {busy && <Spinner />} {confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}
