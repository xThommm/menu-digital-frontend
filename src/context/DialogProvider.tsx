import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ConfirmDialog, { type ConfirmDialogOptions } from "../components/Common/ConfirmDialog";
import { themeScopeOf } from "../lib/themeScope";
import { DialogContext, type DialogContextValue } from "./DialogContext";

// Ventanas de confirmación de toda la app (useDialogs), por encima de
// cualquier modal abierto. Toman el estilo de la zona desde donde se pidieron:
// en la carta pública se dibujan dentro de ella (tokens del template del
// local); en el resto, en <body> con el tema del panel.

// Lo que tiene los tokens --t-* de la carta pública (UserMenu, UserHome).
const MENU_SCOPE_SELECTOR = "[data-template]";

interface OpenDialog {
  key: number;
  options: ConfirmDialogOptions;
  /** Dentro de la carta pública: ahí se dibuja, con su estilo. */
  menuHost: Element | null;
  themeScope: string;
  answer: (accepted: boolean, value?: string) => void;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const dialogRef = useRef<OpenDialog | null>(null);
  const nextKeyRef = useRef(1);
  // Último elemento tocado: en iOS tocar un botón no le da el foco, así que
  // document.activeElement no alcanza para saber desde dónde se pidió.
  const lastPointerTargetRef = useRef<Element | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      lastPointerTargetRef.current = event.target instanceof Element ? event.target : null;
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  // Todo pasa por refs y setDialog (estables): el valor del contexto se arma
  // una sola vez y los que usan useDialogs no se vuelven a dibujar.
  const [value] = useState<DialogContextValue>(() => {
    const originOfRequest = (): Element | null => {
      const active = document.activeElement;
      if (active && active !== document.body) return active;
      const touched = lastPointerTargetRef.current;
      return touched?.isConnected ? touched : null;
    };

    const open = (options: ConfirmDialogOptions, onAnswer: (accepted: boolean, value?: string) => void) => {
      // Pedir otra mientras hay una abierta cancela la anterior.
      dialogRef.current?.answer(false);
      const origin = originOfRequest();
      const key = nextKeyRef.current++;
      const entry: OpenDialog = {
        key,
        options,
        menuHost: origin?.closest(MENU_SCOPE_SELECTOR) ?? null,
        themeScope: themeScopeOf(origin),
        answer: (accepted, text) => {
          if (dialogRef.current?.key !== key) return;
          dialogRef.current = null;
          setDialog(null);
          onAnswer(accepted, text);
        },
      };
      dialogRef.current = entry;
      setDialog(entry);
    };

    return {
      confirm: (options) => new Promise<boolean>((resolve) => {
        open(options, (accepted) => resolve(accepted));
      }),
      prompt: (options) => new Promise<string | null>((resolve) => {
        open(options, (accepted, text) => resolve(accepted ? text ?? "" : null));
      }),
    };
  });

  const renderDialog = (current: OpenDialog) => {
    const menuHost = current.menuHost?.isConnected ? current.menuHost : null;
    const element = (
      <ConfirmDialog
        key={current.key}
        {...current.options}
        variant={menuHost ? "menu" : "panel"}
        onAnswer={current.answer}
      />
    );
    if (menuHost) return createPortal(element, menuHost);
    return createPortal(<div className={current.themeScope || undefined}>{element}</div>, document.body);
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && renderDialog(dialog)}
    </DialogContext.Provider>
  );
}
