import { ExternalLink, Link2 } from "lucide-react";
import { resolveMenuItems } from "./contextMenu.ts";
import type { ContextMenuItem, ResolvedItem } from "../types";

// Opciones sobre un link (reemplazan a las del menú del navegador, que está
// bloqueado en toda la app). Se suman arriba de cualquier menú cuando el clic
// cae en un <a href>, igual que las de texto (textMenu.ts).

export interface LinkMenuContext {
  /** Dirección completa (ya resuelta contra la página). */
  href: string;
  /** mailto:, tel: y similares: se copian pero no se abren en otra pestaña. */
  web: boolean;
}

export interface LinkMenuHandlers {
  openInNewTab: (href: string) => void;
  writeClipboard: (text: string) => Promise<void>;
}

/** Lo que se copia: la dirección, sin el "mailto:" o "tel:" adelante. */
export const copiedAddress = (href: string) => href.replace(/^(mailto|tel):/i, "");

export function buildLinkMenu(handlers: LinkMenuHandlers): ContextMenuItem<LinkMenuContext>[] {
  return [
    {
      id: "open",
      label: "Abrir en pestaña nueva",
      icon: ExternalLink,
      visible: ({ web }) => web,
      run: ({ href }) => handlers.openInNewTab(href),
    },
    {
      id: "copy",
      label: ({ href }) => (/^mailto:/i.test(href) ? "Copiar mail" : /^tel:/i.test(href) ? "Copiar teléfono" : "Copiar dirección del enlace"),
      icon: Link2,
      run: ({ href }) => handlers.writeClipboard(copiedAddress(href)),
      successMessage: "Copiado.",
      errorMessage: "No se pudo copiar.",
    },
  ];
}

/** Link bajo el clic, si vale la pena ofrecer opciones (no "#" ni javascript:). */
export function linkContextOf(target: Element | null): LinkMenuContext | null {
  const anchor = target?.closest<HTMLAnchorElement>("a[href]") ?? null;
  if (!anchor) return null;
  const raw = anchor.getAttribute("href") ?? "";
  if (raw === "" || raw.startsWith("#") || /^javascript:/i.test(raw)) return null;
  return { href: anchor.href, web: /^https?:/i.test(anchor.href) };
}

const LINK_MENU = buildLinkMenu({
  openInNewTab: (href) => { window.open(href, "_blank", "noopener,noreferrer"); },
  writeClipboard: (text) => navigator.clipboard.writeText(text),
});

/** Opciones de link para el punto donde se hizo clic ([] si no hay un link). */
export function resolveLinkItems(target: Element | null): ResolvedItem[] {
  const context = linkContextOf(target);
  return context ? resolveMenuItems(LINK_MENU, context, "link/") : [];
}
