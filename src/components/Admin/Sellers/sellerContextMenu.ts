import {
  Copy, Eye, FlaskConical, KeyRound, ListFilter, Mail, MessageCircle, Pencil, RefreshCw, RotateCcw, ShieldCheck, Shuffle,
  UserMinus, UserPlus, Users, Wallet,
} from "lucide-react";
import { buildWaLink } from "../../../lib/whatsapp.ts";
import type { Seller } from "../../../api/adminSellers";
import type { ContextMenuItem } from "../../../features/contextMenu/types";

// Opciones del clic derecho en el ABM de vendedores. Son solo la descripción:
// abrir, ubicar, confirmar y avisar lo hace features/contextMenu. Las
// operaciones en sí son las que ya usa la pantalla (api/adminSellers) y
// llegan por `handlers`, así este archivo no depende de React.

export interface SellerMenuHandlers {
  viewProfile: (seller: Seller) => void;
  /** Abre el panel desplegable de la fila. */
  edit: (seller: Seller) => void;
  resetPassword: (seller: Seller) => void;
  createTestUser: (seller: Seller) => void;
  /** Ver (y dar de baja) sus usuarios de prueba. */
  viewTestUsers: (seller: Seller) => void;
  setAdmin: (seller: Seller, admin: boolean) => Promise<void>;
  setReceivesLeads: (seller: Seller, receivesLeads: boolean) => Promise<void>;
  deactivate: (seller: Seller) => Promise<void>;
  reactivate: (seller: Seller) => Promise<void>;
  openUrl: (url: string) => void;
  navigate: (path: string) => void;
}

const copyAction = (id: string, label: string, value: (seller: Seller) => string, done: string): ContextMenuItem<Seller> => ({
  id,
  label,
  visible: (seller) => value(seller) !== "",
  run: (seller) => navigator.clipboard.writeText(value(seller)),
  successMessage: done,
  errorMessage: "No se pudo copiar.",
});

/** Menú de una fila: el contexto es el vendedor sobre el que se hizo clic. */
export function buildSellerMenu(handlers: SellerMenuHandlers): ContextMenuItem<Seller>[] {
  return [
    { id: "profile", label: "Ver perfil", icon: Eye, run: handlers.viewProfile },
    { id: "edit", label: "Editar", icon: Pencil, run: handlers.edit },
    {
      type: "submenu",
      id: "copy",
      label: "Copiar",
      icon: Copy,
      items: [
        copyAction("code", "Código", (seller) => seller.code, "Código copiado."),
        copyAction("mail", "Mail", (seller) => seller.mail, "Mail copiado."),
        copyAction("number", "Teléfono", (seller) => (seller.number ? String(seller.number) : ""), "Teléfono copiado."),
      ],
    },
    {
      id: "whatsapp",
      label: "Enviar WhatsApp",
      icon: MessageCircle,
      visible: (seller) => buildWaLink(seller.number, "") !== null,
      run: (seller) => handlers.openUrl(buildWaLink(seller.number, `¡Hola ${seller.name}!`)!),
    },
    {
      id: "mail-to",
      label: "Enviar mail",
      icon: Mail,
      visible: (seller) => seller.mail.trim() !== "",
      run: (seller) => handlers.openUrl(`mailto:${seller.mail.trim()}`),
    },
    { type: "separator" },
    {
      id: "commissions",
      label: "Ver sus comisiones",
      icon: Wallet,
      visible: (seller) => seller.active && !seller.influencer,
      run: (seller) => handlers.navigate(`/sellers?sellerID=${encodeURIComponent(seller._id)}`),
    },
    {
      id: "clients",
      label: "Ver sus clientes en el CRM",
      icon: Users,
      run: (seller) => handlers.navigate(`/sellers/crm?seller=${encodeURIComponent(seller._id)}`),
    },
    { type: "separator" },
    { id: "password", label: "Restablecer contraseña", icon: KeyRound, run: handlers.resetPassword },
    {
      id: "leads",
      label: (seller) => (seller.receivesLeads ? "Dejar de recibir leads" : "Recibir leads"),
      icon: Shuffle,
      visible: (seller) => seller.active && !seller.influencer,
      run: (seller) => handlers.setReceivesLeads(seller, !seller.receivesLeads),
      successMessage: (seller) => (seller.receivesLeads ? `${seller.name} deja de recibir leads.` : `${seller.name} recibe leads por turnos.`),
      errorMessage: "No se pudo cambiar el reparto de leads.",
    },
    {
      id: "admin",
      label: (seller) => (seller.admin ? "Quitar admin" : "Hacer admin"),
      icon: ShieldCheck,
      danger: true,
      visible: (seller) => seller.active,
      confirm: (seller) => (seller.admin
        ? {
          title: `¿Quitarle los permisos de admin a ${seller.name}?`,
          message: "Deja de poder entrar al panel de administración. Sigue siendo vendedor.",
          confirmLabel: "Quitar admin",
          danger: true,
        }
        : {
          title: `¿Hacer admin a ${seller.name}?`,
          message: "Va a poder ver y cambiar todo el panel de administración: vendedores, pagos, planes y clientes.",
          confirmLabel: "Hacer admin",
          danger: true,
        }),
      run: (seller) => handlers.setAdmin(seller, !seller.admin),
      successMessage: (seller) => (seller.admin ? `${seller.name} ya no es admin.` : `${seller.name} ahora es admin.`),
      errorMessage: "No se pudieron cambiar los permisos.",
    },
    { type: "separator" },
    {
      id: "test-user",
      label: "Crear usuario de prueba",
      icon: FlaskConical,
      disabled: (seller) => !seller.active && "El vendedor está dado de baja",
      run: handlers.createTestUser,
    },
    { id: "test-users", label: "Ver usuarios de prueba", icon: FlaskConical, run: handlers.viewTestUsers },
    { type: "separator" },
    {
      id: "deactivate",
      label: "Dar de baja",
      icon: UserMinus,
      danger: true,
      visible: (seller) => seller.active,
      confirm: (seller) => ({
        title: `¿Dar de baja a ${seller.name}?`,
        message: "Deja de poder iniciar sesión, pero se conserva su historial.",
        confirmLabel: "Dar de baja",
        danger: true,
      }),
      run: handlers.deactivate,
      successMessage: (seller) => `${seller.name} dado de baja.`,
      errorMessage: "No se pudo dar de baja al vendedor.",
    },
    {
      id: "reactivate",
      label: "Deshacer la baja",
      icon: RotateCcw,
      visible: (seller) => !seller.active,
      confirm: (seller) => ({
        title: `¿Deshacer la baja de ${seller.name}?`,
        message: "Vuelve a estar activo y puede iniciar sesión con su código y contraseña.",
        confirmLabel: "Deshacer la baja",
      }),
      run: handlers.reactivate,
      successMessage: (seller) => `${seller.name} vuelve a estar activo.`,
      errorMessage: "No se pudo deshacer la baja.",
    },
  ];
}

export interface SellersPageContext {
  /** Valor del filtro de estado: "active", "inactive" o "" (todos). */
  statusFilter: string;
}

export interface SellersPageMenuHandlers {
  createSeller: () => void;
  refresh: () => Promise<unknown>;
  setStatusFilter: (value: string) => void;
}

const STATUS_VIEWS = [
  { value: "active", label: "Solo activos" },
  { value: "inactive", label: "Solo dados de baja" },
  { value: "", label: "Todos" },
];

/** Menú general: clic derecho en el espacio vacío de la pantalla. */
export function buildSellersPageMenu(handlers: SellersPageMenuHandlers): ContextMenuItem<SellersPageContext>[] {
  return [
    { id: "create", label: "Nuevo vendedor", icon: UserPlus, run: handlers.createSeller },
    {
      type: "submenu",
      id: "status",
      label: "Mostrar",
      icon: ListFilter,
      items: STATUS_VIEWS.map((view) => ({
        id: view.value || "all",
        label: view.label,
        disabled: (context: SellersPageContext) => context.statusFilter === view.value && "Es la vista actual",
        run: () => handlers.setStatusFilter(view.value),
      })),
    },
    { type: "separator" },
    {
      id: "refresh",
      label: "Actualizar listado",
      icon: RefreshCw,
      run: handlers.refresh,
      errorMessage: "No se pudieron cargar los vendedores.",
    },
  ];
}
