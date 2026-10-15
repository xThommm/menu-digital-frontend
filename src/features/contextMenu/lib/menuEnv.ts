import { Copy, ExternalLink, Link2 } from "lucide-react";
import type { ContextMenuAction, ContextMenuIcon, ContextMenuItem } from "../types";

// Lo que casi todos los menús necesitan del navegador: copiar, abrir un link
// y moverse por la app. Llega como dependencia (useMenuEnv en los
// componentes, un doble en los tests), así las descripciones de los menús no
// tocan el DOM ni el router y se prueban con node --test.

export interface MenuEnv {
  copy: (text: string) => Promise<void>;
  /** Abre en una pestaña nueva. */
  openUrl: (url: string) => void;
  /** Navega dentro de la app; `state` viaja con la navegación (location.state). */
  navigate: (path: string, state?: unknown) => void;
}

type Value<C> = (context: C) => string | number | null | undefined;

const text = <C>(value: Value<C>, context: C): string => {
  const result = value(context);
  return result === null || result === undefined ? "" : String(result).trim();
};

interface CopyOptions<C> {
  id: string;
  label: string;
  value: Value<C>;
  /** Aviso al copiar, ej. "Teléfono copiado." */
  done: string;
  icon?: ContextMenuIcon;
}

/** Copiar un dato. No aparece si el dato está vacío. */
export function copyItem<C>(env: MenuEnv, { id, label, value, done, icon }: CopyOptions<C>): ContextMenuAction<C> {
  return {
    id,
    label,
    icon,
    visible: (context) => text(value, context) !== "",
    run: (context) => env.copy(text(value, context)),
    successMessage: done,
    errorMessage: "No se pudo copiar.",
  };
}

/** Submenú "Copiar ▸" con varios datos; desaparece si no queda ninguno. */
export function copySubmenu<C>(env: MenuEnv, items: CopyOptions<C>[], id = "copy"): ContextMenuItem<C> {
  return { type: "submenu", id, label: "Copiar", icon: Copy, items: items.map((item) => copyItem(env, item)) };
}

interface LinkOptions<C> {
  id: string;
  label: string;
  url: Value<C>;
  icon?: ContextMenuIcon;
}

/** Abrir una dirección en una pestaña nueva. No aparece si no hay dirección. */
export function openUrlItem<C>(env: MenuEnv, { id, label, url, icon = ExternalLink }: LinkOptions<C>): ContextMenuAction<C> {
  return {
    id,
    label,
    icon,
    visible: (context) => text(url, context) !== "",
    run: (context) => env.openUrl(text(url, context)),
  };
}

/** Copiar una dirección (link). */
export function copyLinkItem<C>(env: MenuEnv, { id, label, url, icon = Link2 }: LinkOptions<C>): ContextMenuAction<C> {
  return copyItem(env, { id, label, value: url, icon, done: "Enlace copiado." });
}

/** Ir a otra pantalla de la app. */
export function navigateItem<C>(
  env: MenuEnv,
  { id, label, path, state, icon, current }: {
    id: string;
    label: string;
    path: string;
    state?: (context: C) => unknown;
    icon?: ContextMenuIcon;
    /** Pantalla actual: queda deshabilitada. */
    current?: (context: C) => boolean;
  },
): ContextMenuAction<C> {
  return {
    id,
    label,
    icon,
    disabled: current ? (context) => current(context) && "Ya estás en esta pantalla" : undefined,
    run: (context) => env.navigate(path, state?.(context)),
  };
}
