import type {
  ContextMenuConfirm,
  ContextMenuItem,
  ResolvedAction,
  ResolvedItem,
} from "../types";

// Lógica del menú contextual sin React ni DOM: se prueba con node --test
// (test/contextMenu.test.ts).

// ── Resolución declarativa ──────────────────────────────────────────────────

function resolveValue<C, V>(value: V | ((context: C) => V), context: C): V {
  return typeof value === "function" ? (value as (context: C) => V)(context) : value;
}

function resolveDisabled<C>(
  disabled: ((context: C) => boolean | string) | undefined,
  context: C,
): { disabled: boolean; disabledReason: string | null } {
  const result = disabled?.(context) ?? false;
  if (typeof result === "string") {
    return { disabled: result.trim() !== "", disabledReason: result.trim() || null };
  }
  return { disabled: result, disabledReason: null };
}

// Sin separadores al principio, al final ni dos seguidos: pasa cuando las
// opciones que los rodeaban quedaron ocultas para este contexto.
function trimSeparators(items: ResolvedItem[]): ResolvedItem[] {
  const result: ResolvedItem[] = [];
  for (const item of items) {
    if (item.type === "separator" && (result.length === 0 || result[result.length - 1].type === "separator")) {
      continue;
    }
    result.push(item);
  }
  while (result.length > 0 && result[result.length - 1].type === "separator") result.pop();
  return result;
}

/**
 * Convierte la descripción declarativa de un módulo en el menú concreto para
 * un contexto: evalúa visibilidad, estado deshabilitado y textos, y ata cada
 * acción a ese contexto. Devuelve [] si no queda nada para mostrar.
 */
export function resolveMenuItems<C>(
  items: ContextMenuItem<C>[],
  context: C,
  path = "",
): ResolvedItem[] {
  const resolved: ResolvedItem[] = [];

  items.forEach((item, index) => {
    if (item.type === "separator") {
      resolved.push({ type: "separator", id: `${path}separator-${index}` });
      return;
    }
    if (item.visible && !item.visible(context)) return;

    const base = {
      id: `${path}${item.id}`,
      label: resolveValue(item.label, context),
      icon: item.icon,
      ...resolveDisabled(item.disabled, context),
    };

    if (item.type === "submenu") {
      const children = resolveMenuItems(resolveValue(item.items, context), context, `${base.id}/`);
      // Un submenú sin opciones visibles no se muestra vacío.
      if (children.length > 0) resolved.push({ ...base, type: "submenu", items: children });
      return;
    }

    resolved.push({
      ...base,
      type: "action",
      danger: item.danger === true,
      confirm: item.confirm ? resolveValue(item.confirm, context) ?? null : null,
      run: () => item.run(context),
      successMessage: item.successMessage ? resolveValue(item.successMessage, context) : null,
      errorMessage: item.errorMessage ? resolveValue(item.errorMessage, context) : null,
    });
  });

  return trimSeparators(resolved);
}

// ── Posicionamiento ─────────────────────────────────────────────────────────

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Esquina superior izquierda del menú para que entre completo en la pantalla.
 * Abre hacia abajo y a la derecha del cursor; si no entra, hacia el otro lado,
 * y como último recurso se pega al borde.
 */
export function placeMenu(anchor: Point, menu: Size, viewport: Size, margin = 8): Point {
  const maxX = Math.max(margin, viewport.width - menu.width - margin);
  const maxY = Math.max(margin, viewport.height - menu.height - margin);

  let x = anchor.x;
  if (x + menu.width + margin > viewport.width && anchor.x - menu.width >= margin) {
    x = anchor.x - menu.width;
  }
  let y = anchor.y;
  if (y + menu.height + margin > viewport.height && anchor.y - menu.height >= margin) {
    y = anchor.y - menu.height;
  }

  return { x: clamp(x, margin, maxX), y: clamp(y, margin, maxY) };
}

export interface AnchorRect { left: number; right: number; top: number }

/**
 * Posición de un submenú al costado de la opción que lo abre: a la derecha, o
 * a la izquierda si no entra. `overlap` lo encima apenas sobre el menú padre.
 */
export function placeSubmenu(
  parent: AnchorRect,
  menu: Size,
  viewport: Size,
  margin = 8,
  overlap = 4,
): Point {
  const maxX = Math.max(margin, viewport.width - menu.width - margin);
  const maxY = Math.max(margin, viewport.height - menu.height - margin);

  let x = parent.right - overlap;
  if (x + menu.width + margin > viewport.width && parent.left - menu.width + overlap >= margin) {
    x = parent.left - menu.width + overlap;
  }

  return { x: clamp(x, margin, maxX), y: clamp(parent.top, margin, maxY) };
}

// ── Teclado ─────────────────────────────────────────────────────────────────

const isFocusable = (item: ResolvedItem) => item.type !== "separator" && !item.disabled;

/**
 * Próxima opción enfocable con las flechas: saltea separadores y opciones
 * deshabilitadas y da la vuelta al llegar a un extremo. Con `current` en -1
 * arranca desde afuera (la primera hacia abajo, la última hacia arriba).
 * Devuelve -1 si no hay ninguna.
 */
export function nextFocusIndex(items: ResolvedItem[], current: number, direction: 1 | -1): number {
  const total = items.length;
  if (total === 0) return -1;
  const start = current >= 0 && current < total ? current : direction === 1 ? -1 : total;
  for (let step = 1; step <= total; step += 1) {
    const index = (((start + direction * step) % total) + total) % total;
    if (isFocusable(items[index])) return index;
  }
  return -1;
}

/** Primera (o última) opción enfocable, para Inicio / Fin. */
export function edgeFocusIndex(items: ResolvedItem[], edge: "first" | "last"): number {
  return nextFocusIndex(items, -1, edge === "first" ? 1 : -1);
}

// ── Menú nativo ─────────────────────────────────────────────────────────────

/**
 * El menú del navegador está bloqueado en toda la app: con clic derecho solo
 * aparece el nuestro (el de la zona, o el global). La única excepción es la
 * pulsación larga en pantallas táctiles, que usa este mismo evento para
 * seleccionar texto o abrir un link: el menú contextual es una herramienta de
 * escritorio. `pointerType` es el del evento ("mouse", "touch", "pen", o ""
 * con la tecla de menú y en navegadores que no lo informan).
 */
export function shouldUseNativeMenu(pointerType: string): boolean {
  return pointerType === "touch" || pointerType === "pen";
}

// ── Ejecución centralizada ──────────────────────────────────────────────────

export const DEFAULT_ACTION_ERROR = "No se pudo completar la acción. Intentá de nuevo.";

/**
 * Error con un mensaje pensado para mostrar tal cual (ej. "Este pedido
 * todavía no tiene comandas"). El aviso de error del menú usa ese texto en
 * lugar del `errorMessage` genérico de la acción.
 */
export class MenuActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuActionError";
  }
}

export type ActionOutcome = "done" | "cancelled" | "failed";

export interface ActionRunnerDeps {
  /** Muestra la confirmación y resuelve true si el usuario acepta. */
  confirm: (confirm: ContextMenuConfirm) => Promise<boolean>;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  /** Mensaje para mostrar a partir del error (ej. el que mandó el backend). */
  describeError?: (error: unknown, fallback: string) => string;
  /** La acción arrancó de verdad (ya confirmada). */
  onStart?: (action: ResolvedAction) => void;
  /** Terminó, bien o mal. No se llama si se canceló la confirmación. */
  onFinish?: (action: ResolvedAction) => void;
}

/**
 * Único camino por el que se ejecuta una opción del menú: confirmación si la
 * pide, espera si es async, aviso de éxito y aviso de error. Los módulos solo
 * declaran `run`; no repiten try/catch ni notificaciones.
 */
export async function runMenuAction(action: ResolvedAction, deps: ActionRunnerDeps): Promise<ActionOutcome> {
  if (action.disabled) return "cancelled";
  if (action.confirm && !(await deps.confirm(action.confirm))) return "cancelled";

  deps.onStart?.(action);
  try {
    await action.run();
    if (action.successMessage) deps.notifySuccess(action.successMessage);
    return "done";
  } catch (error) {
    const fallback = action.errorMessage ?? DEFAULT_ACTION_ERROR;
    deps.notifyError(deps.describeError ? deps.describeError(error, fallback) : fallback);
    return "failed";
  } finally {
    deps.onFinish?.(action);
  }
}
