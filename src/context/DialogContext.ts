import { createContext } from "react";
import type { ConfirmDialogField, ConfirmDialogOptions } from "../components/Common/ConfirmDialog";

export type ConfirmOptions = Omit<ConfirmDialogOptions, "field">;
export type PromptOptions = ConfirmOptions & { field: ConfirmDialogField };

export interface DialogContextValue {
  /** Ventana propia en lugar de window.confirm: true si se confirmó. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Ventana propia en lugar de window.prompt: el texto, o null si se canceló. */
  prompt: (options: PromptOptions) => Promise<string | null>;
}

export const DialogContext = createContext<DialogContextValue | null>(null);
