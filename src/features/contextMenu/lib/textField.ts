import { resolveMenuItems } from "./contextMenu";
import { buildTextMenu, type TextField, type TextMenuContext } from "./textMenu";
import type { ResolvedItem } from "../types";

// Parte del menú de texto que toca el DOM: detecta el campo y la selección
// bajo el cursor y sabe pegar y seleccionar en inputs, textareas y
// contenteditable. Todo se captura al abrir el menú: al abrirse, el foco pasa
// al menú y la selección del campo deja de estar a mano.

const FIELD_SELECTOR = "input, textarea, [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']";
// Los demás tipos de <input> (checkbox, date, file, range…) no son de texto.
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

type ValueField = HTMLInputElement | HTMLTextAreaElement;

// Campo donde se usó "Cortar" desde el menú por última vez: ahí se ofrece
// "Deshacer". Se olvida al deshacer o al cortar en otro campo.
let lastCut: WeakRef<HTMLElement> | null = null;
const markCut = (field: HTMLElement) => { lastCut = new WeakRef(field); };
const wasCut = (field: HTMLElement) => lastCut?.deref() === field;
const undoIn = (field: HTMLElement) => {
  field.focus({ preventScroll: true });
  document.execCommand("undo");
  lastCut = null;
};

const isValueField = (element: Element): element is ValueField =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

function textFieldElement(target: Element | null): HTMLElement | null {
  const element = target?.closest<HTMLElement>(FIELD_SELECTOR) ?? null;
  if (element instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has(element.type)) return null;
  return element;
}

function pageSelection(): string {
  return window.getSelection()?.toString() ?? "";
}

function selectedTextIn(field: HTMLElement): string {
  if (!isValueField(field)) return pageSelection();
  // Una contraseña no se copia, igual que en el menú del navegador.
  if (field instanceof HTMLInputElement && field.type === "password") return "";
  const { selectionStart, selectionEnd } = field;
  if (selectionStart !== null && selectionEnd !== null) return field.value.slice(selectionStart, selectionEnd);
  // email y number no exponen selectionStart: queda lo que informe el navegador.
  return document.activeElement === field ? pageSelection() : "";
}

// React pisa el setter de `value` para rastrear los inputs controlados: hay
// que escribir con el nativo y avisar con un evento input para que el
// onChange del formulario se entere.
function setNativeValue(field: ValueField, value: string) {
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function adaptValueField(field: ValueField): TextField {
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const restoreSelection = () => {
    if (start === null || end === null) return;
    try { field.setSelectionRange(start, end); } catch { /* tipos sin rango (email, number) */ }
  };
  return {
    editable: !field.disabled && !field.readOnly,
    canUndo: wasCut(field),
    undo: () => undoIn(field),
    deleteSelection: () => {
      field.focus({ preventScroll: true });
      restoreSelection();
      // "delete" deja el cambio en el historial de deshacer (Ctrl + Z y "Deshacer").
      if (!document.execCommand("delete")) {
        const from = start ?? field.value.length;
        const to = end ?? field.value.length;
        setNativeValue(field, field.value.slice(0, from) + field.value.slice(to));
      }
      markCut(field);
    },
    insert: (text) => {
      field.focus({ preventScroll: true });
      restoreSelection();
      // insertText respeta maxLength, el historial de deshacer y dispara el
      // evento input. Está obsoleto pero no tiene reemplazo; si un navegador
      // lo rechaza se escribe el valor a mano.
      if (document.execCommand("insertText", false, text)) return;
      const from = start ?? field.value.length;
      const to = end ?? field.value.length;
      setNativeValue(field, field.value.slice(0, from) + text + field.value.slice(to));
    },
    selectAll: () => {
      field.focus({ preventScroll: true });
      field.select();
    },
  };
}

function adaptEditable(field: HTMLElement): TextField {
  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 && field.contains(selection.anchorNode)
    ? selection.getRangeAt(0).cloneRange()
    : null;
  const restoreRange = () => {
    if (!range) return;
    const current = window.getSelection();
    current?.removeAllRanges();
    current?.addRange(range);
  };
  return {
    editable: true,
    canUndo: wasCut(field),
    undo: () => undoIn(field),
    deleteSelection: () => {
      field.focus({ preventScroll: true });
      restoreRange();
      document.execCommand("delete");
      markCut(field);
    },
    insert: (text) => {
      field.focus({ preventScroll: true });
      if (range) {
        const current = window.getSelection();
        current?.removeAllRanges();
        current?.addRange(range);
      }
      document.execCommand("insertText", false, text);
    },
    selectAll: () => {
      field.focus({ preventScroll: true });
      window.getSelection()?.selectAllChildren(field);
    },
  };
}

function textContextOf(target: Element | null): TextMenuContext {
  const field = textFieldElement(target);
  if (!field) return { selectedText: pageSelection(), field: null };
  return {
    selectedText: selectedTextIn(field),
    field: isValueField(field) ? adaptValueField(field) : adaptEditable(field),
  };
}

const TEXT_MENU = buildTextMenu({
  writeClipboard: (text) => navigator.clipboard.writeText(text),
  readClipboard: () => navigator.clipboard.readText(),
});

/**
 * Opciones de texto para el punto donde se hizo clic: Copiar si hay texto
 * seleccionado; Pegar y Seleccionar todo sobre un campo de texto. [] si no
 * corresponde ninguna.
 */
export function resolveTextItems(target: Element | null): ResolvedItem[] {
  return resolveMenuItems(TEXT_MENU, textContextOf(target), "text/");
}
