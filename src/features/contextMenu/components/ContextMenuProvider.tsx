import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { ApiError } from "../../../api/apiClient";
import { useNotifications } from "../../../context/useNotifications";
import { extractServerMessage } from "../../../lib/apiErrors";
import { themeScopeOf } from "../../../lib/themeScope";
import ConfirmDialog from "../../../components/Common/ConfirmDialog";
import Spinner from "../../../components/Common/Spinner";
import { ContextMenuContext, type ContextMenuContextValue } from "../ContextMenuContext";
import {
  edgeFocusIndex, nextFocusIndex, placeMenu, placeSubmenu, runMenuAction, shouldUseNativeMenu,
  type AnchorRect, type Point, type Size,
} from "../lib/contextMenu";
import { resolveTextItems } from "../lib/textField";
import type { ContextMenuConfirm, ResolvedAction, ResolvedItem } from "../types";
import s from "./ContextMenu.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// Menú contextual de la app. Se monta una sola vez (App.tsx), bloquea el menú
// del navegador en toda la página y dibuja, en un portal, el menú abierto, la
// confirmación de la acción elegida y el aviso de "en curso". Las zonas con
// opciones propias se habilitan con useContextMenu; en el resto aparece el
// menú global (getGlobalItems). Este archivo no sabe nada de los módulos que
// lo usan.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_ATTRIBUTE = "data-context-menu-root";
const TARGET_ATTRIBUTE = "data-context-menu-target";

const SUBMENU_HOVER_DELAY_MS = 140;
// Alinea la primera opción del submenú con la opción que lo abre (padding de .menu).
const MENU_PADDING_PX = 4;

interface OpenMenu {
  anchor: Point;
  items: ResolvedItem[];
}

interface ConfirmState {
  confirm: ContextMenuConfirm;
  busy: boolean;
  resolve: (accepted: boolean) => void;
}

interface PendingAction {
  token: number;
  label: string;
}

// Copiar / Pegar / Seleccionar todo van arriba de cualquier menú, el de una
// zona o el global, cuando el punto del clic tiene texto seleccionado o es un
// campo de texto.
function withTextItems(target: Element | null, items: ResolvedItem[]): ResolvedItem[] {
  const textItems = resolveTextItems(target);
  if (textItems.length === 0 || items.length === 0) return [...textItems, ...items];
  return [...textItems, { type: "separator", id: "text/separator" }, ...items];
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : extractServerMessage(error, fallback);
}

interface ContextMenuProviderProps {
  children: ReactNode;
  /**
   * Opciones del menú global, el que aparece donde no hay una zona más
   * específica. Se pide en cada clic, así pueden depender de la pantalla
   * actual. Tiene que ser una función estable (de módulo o useCallback).
   */
  getGlobalItems?: () => ResolvedItem[];
}

export function ContextMenuProvider({ children, getGlobalItems }: ContextMenuProviderProps) {
  const notifications = useNotifications();
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [themeScope, setThemeScope] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const targetRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const nextTokenRef = useRef(1);

  const close = useCallback((restoreFocus = false) => {
    targetRef.current?.removeAttribute(TARGET_ATTRIBUTE);
    targetRef.current = null;
    if (restoreFocus) restoreFocusRef.current?.focus({ preventScroll: true });
    restoreFocusRef.current = null;
    setMenu(null);
  }, []);

  const openAt = useCallback((anchor: Point, menuItems: ResolvedItem[], scope: Element | null, highlight: HTMLElement | null) => {
    const items = withTextItems(scope, menuItems);
    if (items.length === 0) {
      close();
      return;
    }
    targetRef.current?.removeAttribute(TARGET_ATTRIBUTE);
    targetRef.current = highlight;
    targetRef.current?.setAttribute(TARGET_ATTRIBUTE, "");
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    setThemeScope(themeScopeOf(scope));
    setMenu({ anchor, items });
  }, [close]);

  // Menú de una zona (useContextMenu). Si la zona no tiene nada para ofrecer
  // acá, el evento sigue de largo y lo toma la siguiente zona hacia afuera o,
  // al final, el menú global.
  const open = useCallback<ContextMenuContextValue["open"]>((event, items, options) => {
    if (shouldUseNativeMenu((event.nativeEvent as PointerEvent).pointerType ?? "")) return;
    const target = event.target instanceof Element ? event.target : null;
    // Un modal dibujado dentro de la zona (React propaga el evento igual): las
    // opciones de la pantalla de atrás no aplican ahí. Si la zona está dentro
    // del modal, sí.
    const modal = target?.closest("[aria-modal='true']");
    if (items.length === 0 || (modal && !modal.contains(event.currentTarget))) return;

    event.preventDefault();
    // Gana la zona más específica: ni las de afuera ni el menú global llegan
    // a ver el evento.
    event.stopPropagation();
    openAt(
      { x: event.clientX, y: event.clientY },
      items,
      target ?? event.currentTarget,
      options?.highlightTarget ? event.currentTarget : null,
    );
  }, [openAt]);

  // Clic derecho en cualquier otra parte de la app: se bloquea el menú del
  // navegador y, si hay opciones generales, se muestra el menú global. Las
  // zonas cortan la propagación, así que acá solo llega lo que ninguna tomó.
  useEffect(() => {
    const onContextMenu = (event: globalThis.MouseEvent) => {
      if (shouldUseNativeMenu((event as PointerEvent).pointerType ?? "")) return;
      event.preventDefault();
      const target = event.target instanceof Element ? event.target : null;
      // Sobre nuestro propio menú o su confirmación: nada.
      if (target?.closest(`[${ROOT_ATTRIBUTE}]`)) return;
      openAt({ x: event.clientX, y: event.clientY }, getGlobalItems?.() ?? [], target, null);
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [getGlobalItems, openAt, close]);

  useEffect(() => {
    if (!menu) return;

    const insideMenu = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(`[${ROOT_ATTRIBUTE}]`));
    const onPointerDown = (event: PointerEvent) => { if (!insideMenu(event.target)) close(); };
    const onScroll = (event: Event) => { if (!insideMenu(event.target)) close(); };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Que el Escape cierre solo el menú y no también el modal de abajo.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    const dismiss = () => close();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    window.addEventListener("popstate", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("popstate", dismiss);
    };
  }, [menu, close]);

  const activate = useCallback((action: ResolvedAction) => {
    close();
    const token = nextTokenRef.current++;
    void runMenuAction(action, {
      confirm: (confirm) => new Promise<boolean>((resolve) => {
        setConfirmState({ confirm, busy: false, resolve });
      }),
      notifySuccess: notifications.success,
      notifyError: notifications.error,
      describeError,
      onStart: () => {
        // Con confirmación, el diálogo queda abierto mostrando la espera.
        setConfirmState((current) => (current ? { ...current, busy: true } : current));
        setPending((current) => [...current, { token, label: action.label }]);
      },
      onFinish: () => {
        setConfirmState(null);
        setPending((current) => current.filter((item) => item.token !== token));
      },
    });
  }, [close, notifications]);

  const answerConfirm = (accepted: boolean) => {
    if (!confirmState || confirmState.busy) return;
    confirmState.resolve(accepted);
    if (!accepted) setConfirmState(null);
  };

  const anchor = menu?.anchor;
  const placeRoot = useCallback(
    (size: Size, viewport: Size) => placeMenu(anchor ?? { x: 0, y: 0 }, size, viewport),
    [anchor],
  );

  const value = useMemo<ContextMenuContextValue>(() => ({ open, close: () => close() }), [open, close]);
  const hasOverlay = Boolean(menu || confirmState || pending.length > 0);

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {hasOverlay && createPortal(
        <div className={themeScope || undefined} data-context-menu-root="">
          {menu && (
            <MenuList
              // Clic derecho en otro lado con el menú abierto: arranca de cero.
              key={`${menu.anchor.x}:${menu.anchor.y}`}
              items={menu.items}
              place={placeRoot}
              initialActive="none"
              onActivate={activate}
            />
          )}
          {confirmState && (
            <ConfirmDialog
              {...confirmState.confirm}
              busy={confirmState.busy}
              onAnswer={answerConfirm}
            />
          )}
          {!confirmState && pending.length > 0 && (
            <div className={s.pending} role="status">
              <Spinner /> {pending[0].label}…
            </div>
          )}
        </div>,
        document.body,
      )}
    </ContextMenuContext.Provider>
  );
}

// ── Lista de opciones (el menú y cada submenú) ──────────────────────────────

interface MenuListProps {
  items: ResolvedItem[];
  place: (size: Size, viewport: Size) => Point;
  /** "first" cuando se abre con el teclado: arranca con la primera opción. */
  initialActive: "first" | "none";
  onActivate: (action: ResolvedAction) => void;
  /** Solo en submenús: vuelve al menú padre (flecha izquierda). */
  onBack?: () => void;
  /** Solo en submenús: el cursor entró al submenú. */
  onPointerInside?: () => void;
}

function MenuList({ items, place, initialActive, onActivate, onBack, onPointerInside }: MenuListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | undefined>(undefined);
  const [active, setActive] = useState(() => (initialActive === "first" ? edgeFocusIndex(items, "first") : -1));
  const [submenu, setSubmenu] = useState<{ index: number; rect: AnchorRect; viaKeyboard: boolean } | null>(null);
  const hasIcons = items.some((item) => item.type !== "separator" && item.icon);

  // Se mide ya dibujado (oculto) y recién ahí se ubica dentro de la pantalla.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const point = place(
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    list.style.left = `${point.x}px`;
    list.style.top = `${point.y}px`;
    list.style.visibility = "visible";
    list.focus({ preventScroll: true });
  }, [place]);

  useEffect(() => () => window.clearTimeout(hoverTimerRef.current), []);

  const openSubmenu = (index: number, viaKeyboard: boolean) => {
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setSubmenu({ index, viaKeyboard, rect: { left: rect.left, right: rect.right, top: rect.top - MENU_PADDING_PX } });
  };

  const closeSubmenu = () => {
    setSubmenu(null);
    listRef.current?.focus({ preventScroll: true });
  };

  const activateIndex = (index: number, viaKeyboard: boolean) => {
    const item = items[index];
    if (!item || item.type === "separator" || item.disabled) return;
    if (item.type === "submenu") openSubmenu(index, viaKeyboard);
    else onActivate(item);
  };

  // Con una demora corta: cruzar en diagonal hacia el submenú pasa por encima
  // de otras opciones y no tiene que cerrarlo.
  const hoverItem = (index: number) => {
    setActive(index);
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      const item = items[index];
      if (item?.type === "submenu" && !item.disabled) openSubmenu(index, false);
      else closeSubmenu(); // devuelve el foco a esta lista: el teclado sigue andando
    }, SUBMENU_HOVER_DELAY_MS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = (index: number) => { setActive(index); setSubmenu(null); };
    switch (event.key) {
      case "ArrowDown": move(nextFocusIndex(items, active, 1)); break;
      case "ArrowUp": move(nextFocusIndex(items, active, -1)); break;
      case "Home": move(edgeFocusIndex(items, "first")); break;
      case "End": move(edgeFocusIndex(items, "last")); break;
      case "Enter":
      case " ": activateIndex(active, true); break;
      case "ArrowRight":
        if (items[active]?.type === "submenu") activateIndex(active, true);
        break;
      case "ArrowLeft":
        if (!onBack) return;
        onBack();
        break;
      case "Tab": break; // el foco no sale del menú
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const submenuItem = submenu ? items[submenu.index] : null;
  const submenuRect = submenu?.rect;
  const placeChild = useCallback(
    (size: Size, viewport: Size) => placeSubmenu(submenuRect ?? { left: 0, right: 0, top: 0 }, size, viewport),
    [submenuRect],
  );

  return (
    <>
      <div
        ref={listRef}
        className={s.menu}
        role="menu"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onContextMenu={(event: MouseEvent) => event.preventDefault()}
        onPointerEnter={onPointerInside}
      >
        {items.map((item, index) => {
          if (item.type === "separator") {
            return <div key={item.id} className={s.separator} role="separator" />;
          }
          const Icon = item.icon;
          const isSubmenu = item.type === "submenu";
          const className = [
            s.item,
            index === active || (isSubmenu && submenu?.index === index) ? s.itemActive : "",
            item.type === "action" && item.danger ? s.itemDanger : "",
          ].join(" ").trim();
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-index={index}
              className={className}
              aria-disabled={item.disabled || undefined}
              aria-haspopup={isSubmenu ? "menu" : undefined}
              aria-expanded={isSubmenu ? submenu?.index === index : undefined}
              title={item.disabledReason ?? undefined}
              onPointerMove={() => { if (active !== index) hoverItem(index); }}
              onClick={() => activateIndex(index, false)}
            >
              {hasIcons && (
                <span className={s.icon} aria-hidden="true">{Icon && <Icon size={15} />}</span>
              )}
              <span className={s.label}>{item.label}</span>
              {isSubmenu && <span className={s.chevron} aria-hidden="true"><ChevronRight size={14} /></span>}
            </button>
          );
        })}
      </div>
      {submenu && submenuItem?.type === "submenu" && (
        <MenuList
          key={submenuItem.id}
          items={submenuItem.items}
          place={placeChild}
          initialActive={submenu.viaKeyboard ? "first" : "none"}
          onActivate={onActivate}
          onBack={closeSubmenu}
          onPointerInside={() => {
            window.clearTimeout(hoverTimerRef.current);
            setActive(submenu.index);
          }}
        />
      )}
    </>
  );
}
