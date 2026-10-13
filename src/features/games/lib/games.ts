import type { PublicMenuItem, PublicMenuTab } from "../../../types/index.ts";
import { cartUnitPrice } from "../../../lib/cartPricing.ts";
import { isOfferActive } from "../../../lib/offers.ts";
import { isItemUnavailable } from "../../../lib/publicMenu.ts";
import type { DuelState, GameId, GamePool, PublicGames, QuestionCategory } from "../types";

// Juegos para comensales: lógica de la pantalla, sin React ni red (así se
// prueba con Node). El azar se inyecta: en la carta es crypto, en los tests fijo.

export const GAME_COPY: Record<GameId, { title: string; tagline: string }> = {
  roulette: { title: "Ruleta de la carta", tagline: "¿No sabés qué pedir? Que decida la suerte." },
  questions: { title: "Preguntas para compartir", tagline: "Para conocerse más y reírse un rato." },
  duel: { title: "Duelo de la carta", tagline: "Compitan entre ustedes, cada uno desde su celular." },
};

export type Rng = () => number;

// Azar de la carta: crypto si está, Math.random si no.
export const cryptoRng: Rng = () => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  }
  return Math.random();
};

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

// ── A quién se le ofrecen ──

// Los juegos se muestran si hay alguno y, cuando el local lo pidió, solo a
// quien escaneó su QR.
export const gamesVisible = (games: PublicGames | null, inVenue: boolean): boolean =>
  !!games && games.enabled && games.games.length > 0 && (!games.venueOnly || inVenue);

// ── Productos ──

export const allMenuItems = (tabs: PublicMenuTab[]): PublicMenuItem[] =>
  tabs.flatMap(tab => tab.categorias.flatMap(category => category.items));

// Productos de un juego que la carta cargada tiene y se pueden pedir. El
// servidor manda ids; el precio, las variantes y la disponibilidad son los de
// la carta, que es lo que el comensal ve y lo que valida el pedido.
export function playableItems(itemIds: readonly string[], items: readonly PublicMenuItem[]): PublicMenuItem[] {
  const byId = new Map(items.map(item => [item._id, item]));
  return itemIds.flatMap(id => {
    const item = byId.get(id);
    return item && !isItemUnavailable(item) ? [item] : [];
  });
}

// Qué pasa al tocar "Agregar" en un producto de un juego:
//   add      entra directo al pedido con ese precio
//   options  tiene variantes: se abre el producto para elegir
//   none     no se puede pedir (no disponible o sin precio)
export type AddAction = { kind: "add"; unitPrice: number } | { kind: "options" } | { kind: "none" };

export function addAction(item: PublicMenuItem, hidePrices: boolean, now = Date.now()): AddAction {
  if (isItemUnavailable(item)) return { kind: "none" };
  // Mismo criterio que la tarjeta de la carta: con variantes hay que elegir una,
  // salvo que rija una oferta del producto (ahí el precio es uno solo).
  const hasOptions = Object.keys(item.options ?? {}).length > 0;
  if (hasOptions && !isOfferActive(item, now)) return { kind: "options" };
  const unitPrice = cartUnitPrice(item, undefined, { hidePrices, now });
  return unitPrice == null ? { kind: "none" } : { kind: "add", unitPrice };
}

// ── Ruleta ──

// Una tirada: `picks` productos distintos al azar (o todos, si hay menos).
export function spin<T>(items: readonly T[], picks: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, Math.max(0, Math.min(picks, items.length)));
}

// ── Preguntas para compartir ──

export type Card =
  | { kind: "question"; text: string }
  | { kind: "challenge"; itemId: string; text: string };

const CHALLENGES = [
  "Desafío: pidan {producto} para compartir y que elija el primer bocado quien menos habló.",
  "Desafío: el próximo en responder invita {producto}. ¿Se anima?",
  "Desafío: brinden con {producto} por algo bueno que les haya pasado esta semana.",
  "Desafío: pidan {producto} al medio y cuenten con quién lo compartirían.",
];

export const challengeText = (title: string, variant: number) =>
  CHALLENGES[Math.abs(variant) % CHALLENGES.length].replace("{producto}", title);

/**
 * Mazo de una categoría: sus preguntas mezcladas y, cada `every` preguntas, un
 * desafío con un producto real (sin repetir producto hasta usarlos todos).
 */
export function buildDeck(
  category: Pick<QuestionCategory, "questions">,
  challenges: { every: number; items: Pick<PublicMenuItem, "_id" | "title">[] } | null,
  rng: Rng,
): Card[] {
  const questions = shuffle(category.questions, rng);
  const products = challenges && challenges.items.length > 0 && challenges.every > 0 ? shuffle(challenges.items, rng) : [];
  const deck: Card[] = [];
  let used = 0;
  questions.forEach((text, index) => {
    deck.push({ kind: "question", text });
    if (products.length > 0 && (index + 1) % challenges!.every === 0 && index + 1 < questions.length) {
      const product = products[used % products.length];
      deck.push({ kind: "challenge", itemId: product._id, text: challengeText(product.title, used) });
      used += 1;
    }
  });
  return deck;
}

// Avanzar o volver dentro del mazo, sin salirse.
export const stepCard = (position: number, delta: number, length: number) =>
  Math.max(0, Math.min(length - 1, position + delta));

// ── Duelo de la carta ──

const CODE_ALPHABET = /[^A-HJKMNP-Z2-9]/g;
export const DUEL_CODE_LENGTH = 5;

// Código de sala mientras se tipea: mayúsculas, sin los caracteres que se confunden.
export const cleanDuelCode = (value: string) => value.toUpperCase().replace(CODE_ALPHABET, "").slice(0, DUEL_CODE_LENGTH);
export const isDuelCode = (value: string) => value.length === DUEL_CODE_LENGTH && cleanDuelCode(value) === value;

// Código que viene en el enlace compartido (?juego=ABCDE), o null.
export const readDuelParam = (search: string): string | null => {
  const raw = (new URLSearchParams(search).get("juego") ?? "").trim().toUpperCase();
  return isDuelCode(raw) ? raw : null;
};

export const duelJoinUrl = (origin: string, slug: string, code: string) =>
  `${origin}/${slug}/menu?juego=${encodeURIComponent(code)}`;

// Diferencia entre el reloj del servidor y el de este celular, tomada al recibir un estado.
export const clockOffset = (serverNow: number, receivedAt: number) => serverNow - receivedAt;

// Segundos que quedan de la ronda (entero, nunca negativo), con el reloj del servidor.
export const secondsLeft = (endsAt: number, offset: number, now: number) =>
  Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));

// Fracción de tiempo que queda (1 → 0), para la barra.
export const timeFraction = (endsAt: number, totalSeconds: number, offset: number, now: number) =>
  Math.max(0, Math.min(1, (endsAt - (now + offset)) / (totalSeconds * 1000)));

export interface DuelView {
  me: DuelState["players"][number] | null;
  host: DuelState["players"][number] | null;
  isHost: boolean;
  connectedCount: number;
  canStart: boolean;
  answeredCount: number;
  // En la ronda cerrada: cómo me fue.
  myResult: { answered: boolean; correct: boolean; points: number } | null;
  // Con la partida terminada: quién ganó (varios si empataron).
  winners: string[];
  iWon: boolean;
}

export function duelView(state: DuelState): DuelView {
  const me = state.players.find(player => player.id === state.me) ?? null;
  const host = state.players.find(player => player.id === state.hostId) ?? null;
  const connected = state.players.filter(player => player.connected);
  const isHost = state.me === state.hostId;

  let myResult: DuelView["myResult"] = null;
  if (state.status === "reveal" && state.round && state.round.correct !== undefined) {
    const mine = state.round.answers?.find(answer => answer.playerId === state.me);
    myResult = { answered: !!mine, correct: mine?.option === state.round.correct, points: mine?.points ?? 0 };
  }

  const top = state.ranking?.[0]?.score ?? 0;
  const leaders = (state.ranking ?? []).filter(player => player.score === top && top > 0);

  return {
    me,
    host,
    isHost,
    connectedCount: connected.length,
    canStart: isHost && state.status === "lobby" && connected.length >= state.minPlayers,
    answeredCount: connected.filter(player => player.answered).length,
    myResult,
    winners: leaders.map(player => player.name),
    iWon: leaders.some(player => player.id === state.me),
  };
}

// ── Configuración del panel ──

// Preguntas ↔ texto del editor (una por renglón, sin vacías ni repetidas).
export const questionsToText = (questions: readonly string[]) => questions.join("\n");
export const textToQuestions = (text: string): string[] => [
  ...new Set(text.split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean)),
];

// ¿Este producto participa del juego con esta selección?
export const inPool = (pool: GamePool, product: { id: string; categoryId: string }) =>
  (pool.categoryIds.length === 0 || pool.categoryIds.includes(product.categoryId)) && !pool.excludedItemIds.includes(product.id);

export const categoryInPool = (pool: GamePool, categoryId: string) =>
  pool.categoryIds.length === 0 || pool.categoryIds.includes(categoryId);

/**
 * Marca o desmarca una categoría. "Todas" se guarda como lista vacía: al
 * desmarcar la primera se pasa a la lista de las que quedan, y si vuelven a
 * estar todas marcadas se vuelve a la lista vacía (así una categoría nueva de
 * la carta entra sola).
 */
export function togglePoolCategory(pool: GamePool, categoryId: string, allCategoryIds: readonly string[]): GamePool {
  const current = pool.categoryIds.length === 0 ? [...allCategoryIds] : pool.categoryIds;
  const next = current.includes(categoryId) ? current.filter(id => id !== categoryId) : [...current, categoryId];
  // Sin ninguna no hay juego (y la lista vacía significa "todas"): la última no se desmarca.
  if (next.length === 0) return pool;
  const everything = allCategoryIds.length > 0 && allCategoryIds.every(id => next.includes(id));
  return { ...pool, categoryIds: everything ? [] : next };
}

export function togglePoolItem(pool: GamePool, itemId: string): GamePool {
  const excluded = pool.excludedItemIds.includes(itemId)
    ? pool.excludedItemIds.filter(id => id !== itemId)
    : [...pool.excludedItemIds, itemId];
  return { ...pool, excludedItemIds: excluded };
}

// Cuántos productos participan hoy (los pausados no cuentan).
export const poolCount = (pool: GamePool, products: readonly { id: string; categoryId: string; available: boolean }[]) =>
  products.filter(product => product.available && inPool(pool, product)).length;
