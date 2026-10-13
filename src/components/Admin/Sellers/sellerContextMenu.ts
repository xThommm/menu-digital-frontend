import {
  Copy, Eye, FlaskConical, ListFilter, RefreshCw, RotateCcw, UserMinus, UserPlus,
} from "lucide-react";
import type { Seller } from "../../../api/adminSellers";
import type { ContextMenuItem } from "../../../features/contextMenu/types";

// Opciones del clic derecho en el ABM de vendedores. Son solo la descripción:
// abrir, ubicar, confirmar y avisar lo hace features/contextMenu. Las
// operaciones en sí son las que ya usa la pantalla (api/adminSellers) y
// llegan por `handlers`, así este archivo no depende de React.

export interface SellerMenuHandlers {
  viewProfile: (seller: Seller) => void;
  createTestUser: (seller: Seller) => void;
  deactivate: (seller: Seller) => Promise<void>;
  reactivate: (seller: Seller) => Promise<void>;
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
    { type: "separator" },
    {
      id: "test-user",
      label: "Crear usuario de prueba",
      icon: FlaskConical,
      disabled: (seller) => !seller.active && "El vendedor está dado de baja",
      run: handlers.createTestUser,
    },
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
