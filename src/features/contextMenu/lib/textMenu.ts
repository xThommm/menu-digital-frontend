import { ClipboardPaste, Copy, TextSelect } from "lucide-react";
import type { ContextMenuItem } from "../types";

// Opciones de texto del menú contextual: reemplazan a las del menú del
// navegador, que está bloqueado en toda la app. Se suman arriba de cualquier
// menú (el de una zona o el global) cuando hay texto seleccionado o el clic
// cae en un campo de texto. El acceso al DOM está en textField.ts; acá solo
// la descripción, para poder probarla con node --test.

/** Campo de texto bajo el cursor, ya adaptado (ver textField.ts). */
export interface TextField {
  /** false en campos de solo lectura o deshabilitados. */
  editable: boolean;
  /** Inserta el texto en el cursor, reemplazando la selección si la hay. */
  insert: (text: string) => void;
  selectAll: () => void;
}

export interface TextMenuContext {
  /** Texto seleccionado: el del campo si el clic cayó en uno, si no el de la página. */
  selectedText: string;
  field: TextField | null;
}

export interface TextMenuHandlers {
  writeClipboard: (text: string) => Promise<void>;
  readClipboard: () => Promise<string>;
}

export function buildTextMenu(handlers: TextMenuHandlers): ContextMenuItem<TextMenuContext>[] {
  return [
    {
      id: "copy",
      label: "Copiar",
      icon: Copy,
      visible: (context) => context.selectedText !== "",
      run: (context) => handlers.writeClipboard(context.selectedText),
      errorMessage: "No se pudo copiar el texto.",
    },
    {
      id: "paste",
      label: "Pegar",
      icon: ClipboardPaste,
      visible: (context) => context.field !== null,
      disabled: (context) => context.field?.editable === false && "Este campo no se puede editar",
      run: async (context) => {
        const text = await handlers.readClipboard();
        if (text) context.field?.insert(text);
      },
      // El navegador puede negar la lectura del portapapeles (permiso
      // rechazado o página sin HTTPS): el teclado sigue funcionando.
      errorMessage: "No se pudo leer el portapapeles. Probá con Ctrl + V.",
    },
    {
      id: "select-all",
      label: "Seleccionar todo",
      icon: TextSelect,
      visible: (context) => context.field !== null,
      run: (context) => context.field?.selectAll(),
    },
  ];
}
