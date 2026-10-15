import {
  CalendarClock, CalendarX, Columns3, Eraser, ExternalLink, FileSpreadsheet, Mail, MessageCircle, Power, ReceiptText,
  StickyNote, Tag, Table2, UserCog, UserRound, Workflow,
} from "lucide-react";
import { buildWaLink } from "../../../lib/whatsapp.ts";
import { TIMEZONE_BA } from "../../../lib/dates.ts";
import { copySubmenu, openUrlItem, type MenuEnv } from "../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../features/contextMenu/types";
import type { CrmClient, CrmStage } from "../../../types";

// Clic derecho en un cliente del CRM (fila de la tabla o tarjeta del kanban)
// y en el fondo de la pantalla. Lo de admin (pagos, reasignar, activar o
// desactivar la cuenta) solo aparece para admin; el backend lo valida igual.
// Desactivar una cuenta pide confirmación.

/** Fecha de hoy + `days` en Buenos Aires, como la guarda el seguimiento (AAAA-MM-DD). */
export function followUpDate(days: number, now = new Date()): string {
  const shifted = new Date(now.getTime() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE_BA, year: "numeric", month: "2-digit", day: "2-digit" }).format(shifted);
}

export interface CrmClientMenuActions {
  open: (client: CrmClient) => void;
  setStage: (client: CrmClient, stage: CrmStage) => Promise<void>;
  /** null: sacar el seguimiento. */
  setFollowUp: (client: CrmClient, date: string | null) => Promise<void>;
  // Las que abren una ventana no hacen esperar al menú: avisan ellas mismas.
  /** Pide la fecha en una ventana y la agenda. */
  pickFollowUp: (client: CrmClient) => void;
  /** Pide el texto en una ventana y agrega la nota. */
  addNote: (client: CrmClient) => void;
  addTag: (client: CrmClient, tag: string) => Promise<void>;
  /** Pide el nombre de una etiqueta nueva. */
  newTag: (client: CrmClient) => void;
  /** "" = pendiente de asignación. */
  assign: (client: CrmClient, sellerId: string) => Promise<void>;
  setActive: (client: CrmClient, active: boolean) => Promise<void>;
}

export interface CrmClientMenuContext {
  client: CrmClient;
  isAdmin: boolean;
  stages: { value: CrmStage; label: string }[];
  /** Etiquetas que ya se usan en el CRM (para sumarlas con un clic). */
  knownTags: string[];
  /** Vendedores que pueden recibir leads (solo admin). */
  receivers: { _id: string; name: string }[];
  /** El cliente se está moviendo de etapa (arrastre en curso o pedido). */
  busy: boolean;
  origin: string;
  actions: CrmClientMenuActions;
}

const BUSY = "Se está guardando un cambio de este cliente";
const name = (client: CrmClient) => client.businessName || `@${client.username}`;

const FOLLOW_UPS = [
  { id: "tomorrow", label: "Mañana", days: 1 },
  { id: "in-3", label: "En 3 días", days: 3 },
  { id: "in-7", label: "En una semana", days: 7 },
];

export function buildCrmClientMenu(env: MenuEnv): ContextMenuItem<CrmClientMenuContext>[] {
  return [
    { id: "open", label: "Abrir ficha", icon: UserRound, run: ({ client, actions }) => actions.open(client) },
    { type: "separator" },
    {
      type: "submenu",
      id: "stage",
      label: "Mover a etapa",
      icon: Workflow,
      disabled: ({ busy }) => busy && BUSY,
      items: ({ stages }) => stages.map((stage): ContextMenuItem<CrmClientMenuContext> => ({
        id: stage.value,
        label: stage.label,
        disabled: ({ client }) => client.stage === stage.value && "Es la etapa actual",
        run: ({ client, actions }) => actions.setStage(client, stage.value),
        successMessage: `Cliente movido a ${stage.label}.`,
        errorMessage: "No se pudo guardar la nueva etapa del cliente.",
      })),
    },
    {
      type: "submenu",
      id: "follow-up",
      label: "Agendar seguimiento",
      icon: CalendarClock,
      items: [
        ...FOLLOW_UPS.map((entry): ContextMenuItem<CrmClientMenuContext> => ({
          id: entry.id,
          label: entry.label,
          run: ({ client, actions }) => actions.setFollowUp(client, followUpDate(entry.days)),
          successMessage: "Seguimiento agendado.",
          errorMessage: "No se pudo agendar el seguimiento.",
        })),
        {
          id: "pick",
          label: "Elegir fecha…",
          run: ({ client, actions }) => actions.pickFollowUp(client),
        },
        { type: "separator" },
        {
          id: "clear",
          label: "Sacar seguimiento",
          icon: CalendarX,
          visible: ({ client }) => client.nextFollowUp !== null,
          run: ({ client, actions }) => actions.setFollowUp(client, null),
          successMessage: "Seguimiento quitado.",
          errorMessage: "No se pudo quitar el seguimiento.",
        },
      ],
    },
    {
      id: "note",
      label: "Agregar nota…",
      icon: StickyNote,
      run: ({ client, actions }) => actions.addNote(client),
    },
    {
      type: "submenu",
      id: "tag",
      label: "Agregar etiqueta",
      icon: Tag,
      items: ({ knownTags, client }) => [
        ...knownTags.filter((tag) => !client.tags.includes(tag)).slice(0, 12).map((tag): ContextMenuItem<CrmClientMenuContext> => ({
          id: `tag-${tag}`,
          label: tag,
          run: (context) => context.actions.addTag(context.client, tag),
          successMessage: `Etiqueta "${tag}" agregada.`,
          errorMessage: "No se pudo agregar la etiqueta.",
        })),
        { type: "separator" },
        {
          id: "new",
          label: "Nueva etiqueta…",
          run: (context) => context.actions.newTag(context.client),
        },
      ],
    },
    { type: "separator" },
    openUrlItem<CrmClientMenuContext>(env, {
      id: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      url: ({ client }) => (client.contactInfo?.number ? buildWaLink(client.contactInfo.number, "") : null),
    }),
    openUrlItem<CrmClientMenuContext>(env, {
      id: "mail",
      label: "Email",
      icon: Mail,
      url: ({ client }) => (client.contactInfo?.mail ? `mailto:${client.contactInfo.mail}` : null),
    }),
    openUrlItem<CrmClientMenuContext>(env, {
      id: "menu",
      label: "Ver carta",
      icon: ExternalLink,
      url: ({ client, origin }) => (client.slug ? `${origin}/${client.slug}/menu` : null),
    }),
    copySubmenu<CrmClientMenuContext>(env, [
      { id: "menu-link", label: "Enlace de la carta", value: ({ client, origin }) => (client.slug ? `${origin}/${client.slug}/menu` : null), done: "Enlace de la carta copiado." },
      { id: "phone", label: "Teléfono", value: ({ client }) => client.contactInfo?.number, done: "Teléfono copiado." },
      { id: "mail", label: "Mail", value: ({ client }) => client.contactInfo?.mail, done: "Mail copiado." },
      { id: "username", label: "Usuario", value: ({ client }) => client.username, done: "Usuario copiado." },
    ]),
    { type: "separator" },
    {
      id: "payments",
      label: "Ver pagos del cliente",
      icon: ReceiptText,
      visible: ({ isAdmin }) => isAdmin,
      run: ({ client }) => env.navigate(`/admin/payments?userID=${encodeURIComponent(client._id)}`),
    },
    {
      type: "submenu",
      id: "assign",
      label: "Reasignar a otro vendedor",
      icon: UserCog,
      visible: ({ isAdmin, client }) => isAdmin && client.leadSource === "influencer",
      items: ({ receivers, client }) => [
        ...receivers.map((seller): ContextMenuItem<CrmClientMenuContext> => ({
          id: seller._id,
          label: seller.name,
          disabled: () => client.assignedSeller?._id === seller._id && "Ya es el encargado",
          run: (context) => context.actions.assign(context.client, seller._id),
          successMessage: `Encargado: ${seller.name}.`,
          errorMessage: "No se pudo asignar el encargado.",
        })),
        { type: "separator" },
        {
          id: "none",
          label: "Pendiente de asignación",
          disabled: () => !client.assignedSeller && "Ya está sin encargado",
          run: (context) => context.actions.assign(context.client, ""),
          successMessage: "Lead pendiente de asignación.",
          errorMessage: "No se pudo cambiar el encargado.",
        },
      ],
    },
    {
      id: "deactivate",
      label: "Desactivar cuenta",
      icon: Power,
      danger: true,
      visible: ({ isAdmin, client }) => isAdmin && client.active,
      confirm: ({ client }) => ({
        title: `¿Desactivar la cuenta de ${name(client)}?`,
        message: "El cliente y su carta dejarán de estar accesibles.",
        confirmLabel: "Desactivar",
        danger: true,
      }),
      run: ({ client, actions }) => actions.setActive(client, false),
      successMessage: "Cuenta desactivada.",
      errorMessage: "No se pudo desactivar la cuenta.",
    },
    {
      id: "activate",
      label: "Activar cuenta",
      icon: Power,
      visible: ({ isAdmin, client }) => isAdmin && !client.active,
      confirm: ({ client }) => ({
        title: `¿Activar la cuenta de ${name(client)}?`,
        message: "La cuenta y su carta vuelven a estar accesibles al público.",
        confirmLabel: "Activar",
      }),
      run: ({ client, actions }) => actions.setActive(client, true),
      successMessage: "Cuenta activada.",
      errorMessage: "No se pudo activar la cuenta.",
    },
  ];
}

// ── Fondo ──

export interface CrmPageMenuContext {
  isAdmin: boolean;
  view: "list" | "kanban";
  activeFilters: number;
  exporting: boolean;
  actions: { exportExcel: () => void; clearFilters: () => void; setView: (view: "list" | "kanban") => void };
}

export function buildCrmPageMenu(): ContextMenuItem<CrmPageMenuContext>[] {
  return [
    {
      id: "export",
      label: "Exportar a Excel",
      icon: FileSpreadsheet,
      visible: ({ isAdmin }) => isAdmin,
      disabled: ({ exporting }) => exporting && "Exportando",
      run: ({ actions }) => actions.exportExcel(),
    },
    {
      id: "clear",
      label: "Limpiar filtros",
      icon: Eraser,
      disabled: ({ activeFilters }) => activeFilters === 0 && "No hay filtros aplicados",
      run: ({ actions }) => actions.clearFilters(),
    },
    { type: "separator" },
    {
      id: "list",
      label: "Vista tabla",
      icon: Table2,
      disabled: ({ view }) => view === "list" && "Es la vista actual",
      run: ({ actions }) => actions.setView("list"),
    },
    {
      id: "kanban",
      label: "Vista kanban",
      icon: Columns3,
      disabled: ({ view }) => view === "kanban" && "Es la vista actual",
      run: ({ actions }) => actions.setView("kanban"),
    },
  ];
}
