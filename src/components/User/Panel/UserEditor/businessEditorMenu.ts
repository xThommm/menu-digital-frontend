import {
  CalendarCheck, CalendarX, Copy, CopyCheck, ImageUp, Images, MessageCircle, RotateCcw, Save, Trash2, X,
} from "lucide-react";
import { buildWaLink } from "../../../../lib/whatsapp.ts";
import { copyItem, openUrlItem, type MenuEnv } from "../../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../../features/contextMenu/types";

// Clic derecho en el editor del negocio: el fondo, una foto de la galería, la
// portada, el logo, un WhatsApp y un día del horario. Lo que borra algo ya
// guardado (fotos, portada, logo) y descartar los cambios piden confirmación;
// lo demás cambia el formulario y se guarda con "Guardar cambios".

// ── Fondo ──

export interface BusinessPageMenuContext {
  dirty: boolean;
  canSave: boolean;
  /** Link de la página del local (null sin slug). */
  pageUrl: string | null;
  actions: { save: () => void; discard: () => void };
}

export function buildBusinessPageMenu(env: MenuEnv): ContextMenuItem<BusinessPageMenuContext>[] {
  return [
    {
      id: "save",
      label: "Guardar cambios",
      icon: Save,
      disabled: ({ dirty, canSave }) => (!dirty ? "No hay cambios para guardar" : !canSave && "Terminá lo que está en curso para guardar"),
      run: ({ actions }) => actions.save(),
    },
    {
      id: "discard",
      label: "Descartar cambios",
      icon: RotateCcw,
      danger: true,
      visible: ({ dirty }) => dirty,
      confirm: {
        title: "¿Descartar los cambios sin guardar?",
        message: "La información vuelve a lo último que guardaste. Las fotos, la portada y el logo no cambian (se guardan al subirlos).",
        confirmLabel: "Descartar cambios",
        danger: true,
      },
      run: ({ actions }) => actions.discard(),
    },
    { type: "separator" },
    openUrlItem<BusinessPageMenuContext>(env, { id: "page", label: "Ver mi página", url: ({ pageUrl }) => pageUrl }),
  ];
}

// ── Una foto de la galería ──

export interface GalleryPhotoMenuContext {
  url: string;
  index: number;
  /** Ya es la portada. */
  isBackground: boolean;
  busy: boolean;
  actions: { useAsBackground: (index: number) => Promise<void>; remove: (index: number) => void };
}

const UPLOADING = "Hay una imagen subiéndose";

export function buildGalleryPhotoMenu(env: MenuEnv): ContextMenuItem<GalleryPhotoMenuContext>[] {
  return [
    {
      id: "background",
      label: "Usar como portada",
      icon: ImageUp,
      disabled: ({ isBackground, busy }) => (busy ? UPLOADING : isBackground && "Ya es la portada"),
      run: ({ index, actions }) => actions.useAsBackground(index),
      successMessage: "Portada actualizada.",
      errorMessage: "No se pudo cambiar la portada.",
    },
    openUrlItem<GalleryPhotoMenuContext>(env, { id: "open", label: "Abrir en pestaña nueva", url: ({ url }) => url }),
    { type: "separator" },
    {
      id: "remove",
      label: "Quitar de la galería",
      icon: Trash2,
      danger: true,
      disabled: ({ busy }) => busy && UPLOADING,
      confirm: { title: "¿Quitar esta foto de la galería?", message: "Deja de verse en tu página. Para volver a tenerla hay que subirla de nuevo.", confirmLabel: "Quitar foto", danger: true },
      run: ({ index, actions }) => actions.remove(index),
    },
  ];
}

// ── Portada y logo ──

export interface MediaMenuContext {
  kind: "portada" | "logo";
  url: string;
  busy: boolean;
  actions: { change: () => void; remove: () => Promise<void> | void };
}

const MEDIA_NAME = { portada: "la portada", logo: "el logo" };

export function buildMediaMenu(env: MenuEnv): ContextMenuItem<MediaMenuContext>[] {
  return [
    {
      id: "change",
      label: ({ kind, url }) => (url ? `Cambiar ${MEDIA_NAME[kind]}` : `Subir ${MEDIA_NAME[kind]}`),
      icon: Images,
      disabled: ({ busy }) => busy && UPLOADING,
      run: ({ actions }) => actions.change(),
    },
    openUrlItem<MediaMenuContext>(env, { id: "open", label: "Abrir en pestaña nueva", url: ({ url }) => url }),
    { type: "separator" },
    {
      id: "remove",
      label: ({ kind }) => `Quitar ${MEDIA_NAME[kind]}`,
      icon: X,
      danger: true,
      visible: ({ url }) => url !== "",
      disabled: ({ busy }) => busy && UPLOADING,
      confirm: ({ kind }) => (kind === "portada"
        ? { title: "¿Quitar la portada?", message: "Tu página y tu carta quedan sin foto de portada.", confirmLabel: "Quitar portada", danger: true }
        : { title: "¿Quitar el logo?", message: "La pestaña del navegador vuelve a mostrar el ícono de Menú Digital.", confirmLabel: "Quitar logo", danger: true }),
      run: ({ actions }) => actions.remove(),
      // El logo avisa solo (el editor muestra su cartel al quitarlo).
      successMessage: ({ kind }) => (kind === "portada" ? "Portada quitada." : ""),
      errorMessage: ({ kind }) => (kind === "portada" ? "No se pudo quitar la portada." : "No se pudo quitar el logo."),
    },
  ];
}

// ── Un WhatsApp de la lista ──

export interface WhatsAppRowMenuContext {
  name: string;
  number: string;
  actions: { remove: () => void };
}

export function buildWhatsAppRowMenu(env: MenuEnv): ContextMenuItem<WhatsAppRowMenuContext>[] {
  return [
    copyItem<WhatsAppRowMenuContext>(env, { id: "copy", label: "Copiar número", icon: Copy, value: ({ number }) => number, done: "Número copiado." }),
    openUrlItem<WhatsAppRowMenuContext>(env, {
      id: "test",
      label: "Abrir chat de prueba",
      icon: MessageCircle,
      url: ({ number }) => buildWaLink(number, "Mensaje de prueba desde Menú Digital ✅"),
    }),
    { type: "separator" },
    { id: "remove", label: "Quitar este WhatsApp", icon: Trash2, danger: true, run: ({ actions }) => actions.remove() },
  ];
}

// ── Un día del horario ──

export interface ScheduleDayMenuContext {
  dayLabel: string;
  open: boolean;
  /** Hay otros días que ya abren (para "a los días abiertos"). */
  otherOpenDays: boolean;
  actions: { copyTo: (scope: "open" | "all") => void; close: () => void; open: () => void };
}

export function buildScheduleDayMenu(): ContextMenuItem<ScheduleDayMenuContext>[] {
  return [
    {
      type: "submenu",
      id: "copy",
      label: ({ dayLabel }) => `Copiar el horario del ${dayLabel.toLowerCase()} a`,
      icon: CopyCheck,
      visible: ({ open }) => open,
      items: [
        {
          id: "open",
          label: "Los otros días que abro",
          disabled: ({ otherOpenDays }) => !otherOpenDays && "No abrís otros días",
          run: ({ actions }) => actions.copyTo("open"),
        },
        { id: "all", label: "Todos los días (abre los cerrados)", run: ({ actions }) => actions.copyTo("all") },
      ],
    },
    { id: "close", label: "Marcar cerrado", icon: CalendarX, visible: ({ open }) => open, run: ({ actions }) => actions.close() },
    { id: "reopen", label: "Marcar abierto", icon: CalendarCheck, visible: ({ open }) => !open, run: ({ actions }) => actions.open() },
  ];
}
