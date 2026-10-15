import { BarChart3, Copy, ExternalLink, Link2, MessageCircle, User, Users } from "lucide-react";
import { copyItem, copySubmenu, openUrlItem, type MenuEnv } from "../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../features/contextMenu/types";
import { buildWaLink } from "../../lib/whatsapp.ts";
import { registerLinkWithCode } from "../../lib/sellerCodeLink.ts";

// Clic derecho en el panel del vendedor: una asignación reciente (Inicio), un
// vendedor del Ranking (admin), el código del influencer y un local referido.
// Nada de esto modifica datos.

const menuUrl = (origin: string, slug: string | null | undefined) => (slug ? `${origin}/${slug}/menu` : null);

// ── Inicio: asignación reciente ──

export interface AssignmentMenuContext {
  client: { _id: string; username: string; slug?: string | null; contactInfo?: { number?: string | number | null } | null };
  origin: string;
}

export function buildAssignmentMenu(env: MenuEnv): ContextMenuItem<AssignmentMenuContext>[] {
  return [
    {
      id: "crm",
      label: "Abrir ficha del cliente",
      icon: User,
      run: ({ client }) => env.navigate(`/sellers/crm?client=${encodeURIComponent(client._id)}`),
    },
    openUrlItem<AssignmentMenuContext>(env, {
      id: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      url: ({ client }) => (client.contactInfo?.number ? buildWaLink(client.contactInfo.number, "") : null),
    }),
    openUrlItem<AssignmentMenuContext>(env, { id: "menu", label: "Ver carta", icon: ExternalLink, url: ({ client, origin }) => menuUrl(origin, client.slug) }),
    copySubmenu<AssignmentMenuContext>(env, [
      { id: "username", label: "Usuario", value: ({ client }) => client.username, done: "Usuario copiado." },
      { id: "menu-link", label: "Enlace de la carta", value: ({ client, origin }) => menuUrl(origin, client.slug), done: "Enlace de la carta copiado." },
    ]),
  ];
}

// ── Ranking (admin): un vendedor ──

export interface RankingSellerMenuContext {
  seller: { sellerID: string; name: string };
}

export function buildRankingSellerMenu(env: MenuEnv): ContextMenuItem<RankingSellerMenuContext>[] {
  return [
    {
      id: "profile",
      label: "Ver perfil",
      icon: User,
      run: ({ seller }) => env.navigate(`/admin/sellers?perfil=${encodeURIComponent(seller.sellerID)}`),
    },
    {
      id: "commissions",
      label: "Ver comisiones",
      icon: BarChart3,
      run: ({ seller }) => env.navigate(`/sellers?sellerID=${encodeURIComponent(seller.sellerID)}`),
    },
    {
      id: "clients",
      label: "Ver sus clientes en el CRM",
      icon: Users,
      run: ({ seller }) => env.navigate(`/sellers/crm?seller=${encodeURIComponent(seller.sellerID)}`),
    },
  ];
}

// ── Influencer: su código ──

export interface InfluencerCodeMenuContext {
  code: string;
  origin: string;
}

export function buildInfluencerCodeMenu(env: MenuEnv): ContextMenuItem<InfluencerCodeMenuContext>[] {
  return [
    copyItem<InfluencerCodeMenuContext>(env, { id: "code", label: "Copiar código", icon: Copy, value: ({ code }) => code, done: "Código de referido copiado." }),
    copyItem<InfluencerCodeMenuContext>(env, {
      id: "register-link",
      label: "Copiar link de registro con el código",
      icon: Link2,
      value: ({ code, origin }) => registerLinkWithCode(origin, code),
      done: "Link de registro copiado: quien se registre con él ya tiene tu código cargado.",
    }),
  ];
}

// ── Influencer: un local referido ──

export interface ReferralMenuContext {
  lead: { businessName: string; username: string; slug: string };
  origin: string;
}

export function buildReferralMenu(env: MenuEnv): ContextMenuItem<ReferralMenuContext>[] {
  return [
    copyItem<ReferralMenuContext>(env, {
      id: "name",
      label: "Copiar nombre del negocio",
      icon: Copy,
      value: ({ lead }) => lead.businessName || lead.username,
      done: "Nombre copiado.",
    }),
    openUrlItem<ReferralMenuContext>(env, { id: "menu", label: "Ver carta", icon: ExternalLink, url: ({ lead, origin }) => menuUrl(origin, lead.slug) }),
  ];
}
