import { ArrowRight, ExternalLink, Users } from "lucide-react";
import { copySubmenu, openUrlItem, type MenuEnv } from "../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../features/contextMenu/types";

// Clic derecho en el dashboard del admin: un cliente reciente (ficha del CRM,
// carta, copiar) y un indicador (ir al detalle: CRM filtrado, pagos o planes).

// ── Cliente reciente ──

export interface RecentClientMenuContext {
  client: { _id: string; username: string; slug?: string | null };
  origin: string;
}

const menuUrl = ({ client, origin }: RecentClientMenuContext) => (client.slug ? `${origin}/${client.slug}/menu` : null);

export function buildRecentClientMenu(env: MenuEnv): ContextMenuItem<RecentClientMenuContext>[] {
  return [
    {
      id: "crm",
      label: "Abrir en el CRM",
      icon: Users,
      run: ({ client }) => env.navigate(`/sellers/crm?client=${encodeURIComponent(client._id)}`),
    },
    openUrlItem<RecentClientMenuContext>(env, { id: "menu", label: "Ver carta", icon: ExternalLink, url: menuUrl }),
    copySubmenu<RecentClientMenuContext>(env, [
      { id: "username", label: "Usuario", value: ({ client }) => client.username, done: "Usuario copiado." },
      { id: "menu-link", label: "Enlace de la carta", value: menuUrl, done: "Enlace de la carta copiado." },
    ]),
  ];
}

// ── Indicador ──

export interface IndicatorTarget {
  label: string;
  path: string;
}

export interface IndicatorMenuContext {
  /** Hasta dos destinos (el principal primero). */
  targets: IndicatorTarget[];
}

export function buildIndicatorMenu(env: MenuEnv): ContextMenuItem<IndicatorMenuContext>[] {
  return [0, 1].map((index): ContextMenuItem<IndicatorMenuContext> => ({
    id: `go-${index}`,
    icon: ArrowRight,
    label: ({ targets }) => targets[index]?.label ?? "",
    visible: ({ targets }) => targets[index] !== undefined,
    run: ({ targets }) => env.navigate(targets[index].path),
  }));
}

/** Destinos de cada indicador del dashboard. */
export const INDICATOR = {
  clients: [{ label: "Ver clientes en el CRM", path: "/sellers/crm" }],
  payments: [{ label: "Ver pagos", path: "/admin/payments" }],
  attention: (code: string) => [{ label: "Ver estos clientes en el CRM", path: `/sellers/crm?attention=${code}` }],
  plan: (plan: string) => [
    { label: "Ver clientes con este plan en el CRM", path: `/sellers/crm?plan=${plan}` },
    { label: "Editar planes y precios", path: "/admin/plans" },
  ],
} satisfies Record<string, IndicatorTarget[] | ((value: string) => IndicatorTarget[])>;
