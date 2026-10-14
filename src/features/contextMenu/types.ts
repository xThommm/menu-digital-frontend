import type { ComponentType } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Menú contextual (clic derecho) — contrato declarativo.
//
// Cada módulo describe sus opciones como datos: qué se ve, qué está
// deshabilitado y qué hace, en función de un contexto `C` (la fila, la tarjeta
// o lo que haya bajo el cursor). El núcleo (lib/contextMenu.ts +
// ContextMenuProvider) no conoce a ningún módulo: resuelve esa descripción
// contra el contexto y se ocupa de abrir, ubicar, cerrar, confirmar y avisar.
// ─────────────────────────────────────────────────────────────────────────────

/** Componente de ícono (los de lucide-react encajan tal cual). */
export type ContextMenuIcon = ComponentType<{ size?: number | string }>;

type Resolvable<C, V> = V | ((context: C) => V);

export interface ContextMenuConfirm {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el botón de confirmar como acción destructiva. */
  danger?: boolean;
}

interface ContextMenuEntryBase<C> {
  id: string;
  label: Resolvable<C, string>;
  icon?: ContextMenuIcon;
  /** Si devuelve false, la opción no aparece. */
  visible?: (context: C) => boolean;
  /** true la deshabilita; un texto la deshabilita y explica el motivo. */
  disabled?: (context: C) => boolean | string;
}

export interface ContextMenuAction<C> extends ContextMenuEntryBase<C> {
  type?: "action";
  danger?: boolean;
  /** Pide confirmación antes de ejecutar (null: en este contexto no hace falta). */
  confirm?: Resolvable<C, ContextMenuConfirm | null>;
  /** Puede ser async: el núcleo maneja la espera y los errores. */
  run: (context: C) => unknown;
  /** Aviso al terminar bien. Sin esto, la acción no notifica nada. */
  successMessage?: Resolvable<C, string>;
  /** Aviso si falla y el servidor no mandó un mensaje propio. */
  errorMessage?: Resolvable<C, string>;
}

export interface ContextMenuSubmenu<C> extends ContextMenuEntryBase<C> {
  type: "submenu";
  /** Fijas, o armadas para el contexto (ej. "Mover a ▸" con las secciones que hay). */
  items: Resolvable<C, ContextMenuItem<C>[]>;
}

export interface ContextMenuSeparator {
  type: "separator";
}

export type ContextMenuItem<C> =
  | ContextMenuAction<C>
  | ContextMenuSubmenu<C>
  | ContextMenuSeparator;

// ── Menú ya resuelto contra un contexto: lo que dibuja el provider ──────────

export interface ResolvedAction {
  type: "action";
  id: string;
  label: string;
  icon?: ContextMenuIcon;
  disabled: boolean;
  disabledReason: string | null;
  danger: boolean;
  confirm: ContextMenuConfirm | null;
  run: () => unknown;
  successMessage: string | null;
  errorMessage: string | null;
}

export interface ResolvedSubmenu {
  type: "submenu";
  id: string;
  label: string;
  icon?: ContextMenuIcon;
  disabled: boolean;
  disabledReason: string | null;
  items: ResolvedItem[];
}

export interface ResolvedSeparator {
  type: "separator";
  id: string;
}

export type ResolvedItem = ResolvedAction | ResolvedSubmenu | ResolvedSeparator;
