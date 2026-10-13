import { useCallback, useEffect, useState } from "react";
import { getMyGroup } from "../api/publicOrdersApi";
import { errorStatus } from "../lib/errors";
import {
  clearGroupSession, readGroupSession, readJoinParam, saveGroupSession, type JoinParam, type StoredGroupSession,
} from "../lib/groupSession";
import type { GroupMemberView, GroupSession } from "../types";

// Pedido grupal del comensal: ¿este celular es parte de uno?
//
// - Se entra abriendo el pedido de la mesa, tipeando un código o con el QR /
//   enlace del grupo (?grupo=<token o código>). Ese dato de la URL se lee UNA
//   vez al montar y se saca de la barra de direcciones.
// - El token de integrante queda en localStorage (ver groupSession.ts): una
//   recarga no lo saca del grupo.
// - El carrito es de todos: se vuelve a consultar cada pocos segundos mientras
//   la carta está a la vista, para ver lo que cargan los demás.

const POLL_MS = 8_000;

export interface GroupState {
  // Vino con el QR / enlace del grupo y todavía no se sumó.
  joinParam: JoinParam | null;
  dismissJoin: () => void;
  // Es parte de un pedido grupal (aunque todavía se esté cargando).
  active: boolean;
  token: string | null;
  view: GroupMemberView | null;
  // Recién se sumó: guarda su acceso.
  enter: (memberToken: string, name: string, group: GroupSession) => void;
  // Una acción devolvió el grupo actualizado.
  setGroup: (group: GroupSession) => void;
  refresh: () => Promise<void>;
  // Deja de ser parte en este celular (salió o el acceso ya no sirve).
  drop: () => void;
}

const stripJoinParam = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("grupo")) return;
  params.delete("grupo");
  const search = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
};

export function useGroupSession(slug: string | undefined): GroupState {
  const [joinParam, setJoinParam] = useState(() => readJoinParam(window.location.search));
  const [stored, setStored] = useState<StoredGroupSession | null>(() => (slug ? readGroupSession(slug) : null));
  const [view, setView] = useState<GroupMemberView | null>(null);
  const [prevSlug, setPrevSlug] = useState(slug);
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setStored(slug ? readGroupSession(slug) : null);
    setView(null);
  }

  useEffect(() => { stripJoinParam(); }, []);

  const token = stored?.token ?? null;

  const drop = useCallback(() => {
    if (slug) clearGroupSession(slug);
    setStored(null);
    setView(null);
  }, [slug]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setView(await getMyGroup(token));
    } catch (err) {
      // El acceso ya no sirve (salió, o el local cerró la gestión de pedidos).
      const status = errorStatus(err);
      if (status === 401 || status === 403) drop();
      // Sin conexión: se muestra lo último que se vio.
    }
  }, [token, drop]);

  useEffect(() => {
    if (!token) return;
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, refresh]);

  const enter = useCallback((memberToken: string, name: string, group: GroupSession) => {
    if (!slug) return;
    saveGroupSession(slug, memberToken, name);
    setStored(readGroupSession(slug));
    setJoinParam(null);
    // Se muestra ya; el resto (si puede enviar) llega con la primera consulta.
    const me = group.members.find(member => member.me);
    setView({ group, member: { id: me?.id ?? 0, name }, ordering: false });
  }, [slug]);

  const setGroup = useCallback((group: GroupSession) => {
    setView(prev => (prev ? { ...prev, group } : prev));
  }, []);

  const dismissJoin = useCallback(() => setJoinParam(null), []);

  return { joinParam: token ? null : joinParam, dismissJoin, active: !!token, token, view, enter, setGroup, refresh, drop };
}
