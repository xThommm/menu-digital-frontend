import test from "node:test";
import assert from "node:assert/strict";
import {
  addAction, allMenuItems, buildDeck, categoryInPool, challengeText, cleanDuelCode, clockOffset, duelJoinUrl, duelView,
  gamesVisible, inPool, isDuelCode, playableItems, poolCount, questionsToText, readDuelParam, secondsLeft, shuffle, spin,
  stepCard, textToQuestions, timeFraction, togglePoolCategory, togglePoolItem,
} from "../src/features/games/lib/games.ts";
import type { DuelState, PublicGames } from "../src/features/games/types.ts";
import type { PublicMenuItem } from "../src/types/index.ts";

// Juegos para comensales: lo que resuelve la pantalla (sorteos, mazos, reloj
// del duelo, qué se puede agregar al pedido, selección de productos del panel).

// Azar reproducible.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const item = (id: string, over: Partial<PublicMenuItem> = {}): PublicMenuItem => ({ _id: id, title: `Producto ${id}`, price: 1000, ...over });
const ITEMS = [item("a"), item("b"), item("c", { available: false }), item("d"), item("e")];

test("los juegos se ofrecen si hay alguno y, si el local lo pidió, solo a quien escaneó su QR", () => {
  const games = (over: Partial<PublicGames> = {}): PublicGames => ({
    enabled: true, venueOnly: false, games: [{ id: "roulette", picks: 1, promoText: "", itemIds: ["a"] }], ...over,
  });
  assert.equal(gamesVisible(games(), false), true);
  assert.equal(gamesVisible(games({ venueOnly: true }), false), false);
  assert.equal(gamesVisible(games({ venueOnly: true }), true), true);
  assert.equal(gamesVisible(games({ enabled: false }), true), false);
  assert.equal(gamesVisible(games({ games: [] }), true), false);
  assert.equal(gamesVisible(null, true), false, "todavía no cargó o el local no tiene juegos");
});

test("productos de un juego: solo los que la carta tiene y se pueden pedir, en el orden del servidor", () => {
  assert.deepEqual(playableItems(["d", "a", "c", "zzz"], ITEMS).map(i => i._id), ["d", "a"]);
  assert.deepEqual(playableItems([], ITEMS), []);
  const tabs = [
    { label: "Comidas", categorias: [{ title: "Pizzas", items: [ITEMS[0], ITEMS[1]] }, { title: "Postres", items: [ITEMS[2]] }] },
    { label: "Otros", categorias: [{ title: "Bebidas", items: [ITEMS[3], ITEMS[4]] }] },
  ];
  assert.deepEqual(allMenuItems(tabs).map(i => i._id), ["a", "b", "c", "d", "e"]);
});

test("agregar al pedido: directo, eligiendo variante o no se puede; con el precio de la carta", () => {
  assert.deepEqual(addAction(item("x", { price: 2500 }), false), { kind: "add", unitPrice: 2500 });
  // Oferta vigente: entra con el precio de oferta.
  assert.deepEqual(addAction(item("x", { price: 2500, offerPrice: 2000 }), false), { kind: "add", unitPrice: 2000 });
  // Con variantes hay que elegir (se abre el producto), tenga o no precio propio.
  assert.deepEqual(addAction(item("x", { price: null, options: { Chica: 1000, Grande: 1800 } }), false), { kind: "options" });
  assert.deepEqual(addAction(item("x", { price: 1500, options: { Chica: 1000 } }), false), { kind: "options" });
  // Variantes + oferta del producto: precio único, entra directo.
  assert.deepEqual(addAction(item("x", { price: 1500, offerPrice: 1200, options: { Chica: 1000 } }), false), { kind: "add", unitPrice: 1200 });
  // No disponible o sin precio: no se ofrece agregar.
  assert.deepEqual(addAction(item("x", { available: false }), false), { kind: "none" });
  assert.deepEqual(addAction(item("x", { price: null }), false), { kind: "none" });
  // Precios ocultos: se puede pedir igual, sin monto.
  assert.deepEqual(addAction(item("x", { price: undefined }), true), { kind: "add", unitPrice: 0 });
  assert.deepEqual(addAction(item("x", { price: undefined, options: { Chica: 0 } }), true), { kind: "options" });
});

test("ruleta: salen productos distintos, tantos como se pidió (o los que haya)", () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const result = spin(ITEMS, 3, seeded(seed));
    assert.equal(result.length, 3);
    assert.equal(new Set(result).size, 3, "sin repetir");
    assert.ok(result.every(entry => ITEMS.includes(entry)));
  }
  assert.equal(spin(ITEMS, 9, seeded(1)).length, 5);
  assert.deepEqual(spin(ITEMS, 0, seeded(1)), []);
  assert.deepEqual(spin([], 2, seeded(1)), []);
  assert.deepEqual(spin(ITEMS, 2, seeded(7)), spin(ITEMS, 2, seeded(7)), "misma suerte, mismo resultado");
});

test("ruleta: con muchas tiradas salen todos los productos (no hay uno que nunca salga)", () => {
  const seen = new Map<string, number>();
  const rng = seeded(123);
  for (let i = 0; i < 2000; i += 1) {
    const [picked] = spin(ITEMS, 1, rng);
    seen.set(picked._id, (seen.get(picked._id) ?? 0) + 1);
  }
  assert.equal(seen.size, ITEMS.length);
  for (const count of seen.values()) assert.ok(count > 300 && count < 500, `reparto parejo: ${count}`);
});

test("mezclar no pierde, repite ni toca la lista original", () => {
  const list = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffle(list, seeded(3)).sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(list, [1, 2, 3, 4, 5]);
});

test("preguntas: el mazo trae todas las preguntas y un desafío cada tantas, con productos reales", () => {
  const category = { questions: Array.from({ length: 10 }, (_, i) => `¿Pregunta ${i + 1}?`) };
  const products = [{ _id: "a", title: "Pizza" }, { _id: "b", title: "Cerveza" }];
  const deck = buildDeck(category, { every: 3, items: products }, seeded(5));

  const questions = deck.filter(card => card.kind === "question");
  const challenges = deck.filter(card => card.kind === "challenge");
  assert.deepEqual(questions.map(card => card.text).sort(), [...category.questions].sort(), "todas, sin repetir");
  assert.equal(challenges.length, 3, "después de la 3ª, la 6ª y la 9ª");
  assert.deepEqual(deck.map(card => card.kind).slice(0, 8), [
    "question", "question", "question", "challenge", "question", "question", "question", "challenge",
  ]);
  for (const card of challenges) {
    if (card.kind !== "challenge") continue;
    const product = products.find(p => p._id === card.itemId)!;
    assert.ok(card.text.includes(product.title), "el desafío nombra al producto");
    assert.ok(!card.text.includes("{producto}"));
  }
  // Con dos productos y tres desafíos, se usan los dos antes de repetir.
  assert.equal(new Set(challenges.slice(0, 2).map(card => (card.kind === "challenge" ? card.itemId : ""))).size, 2);
  assert.notDeepEqual(questions.map(card => card.text), category.questions, "salen mezcladas");
});

test("preguntas: sin desafíos, sin productos o con pocas preguntas", () => {
  const category = { questions: ["¿Uno?", "¿Dos?", "¿Tres?", "¿Cuatro?"] };
  assert.equal(buildDeck(category, null, seeded(1)).every(card => card.kind === "question"), true);
  assert.equal(buildDeck(category, { every: 2, items: [] }, seeded(1)).length, 4);
  // El mazo no termina en un desafío: después de la última pregunta no va nada.
  const deck = buildDeck(category, { every: 2, items: [{ _id: "a", title: "Flan" }] }, seeded(1));
  assert.deepEqual(deck.map(card => card.kind), ["question", "question", "challenge", "question", "question"]);
  assert.deepEqual(buildDeck({ questions: [] }, { every: 2, items: [{ _id: "a", title: "Flan" }] }, seeded(1)), []);
  assert.notEqual(challengeText("Flan", 0), challengeText("Flan", 1), "varían los textos");
  assert.ok(challengeText("Flan", -3).includes("Flan"));
});

test("preguntas: avanzar y volver no se sale del mazo", () => {
  assert.equal(stepCard(0, 1, 5), 1);
  assert.equal(stepCard(4, 1, 5), 4);
  assert.equal(stepCard(0, -1, 5), 0);
  assert.equal(stepCard(2, -1, 5), 1);
});

test("duelo: código de sala mientras se tipea, en el enlace y para compartir", () => {
  assert.equal(cleanDuelCode(" ab-cd9 "), "ABCD9");
  assert.equal(cleanDuelCode("abcdefgh"), "ABCDE");
  assert.equal(cleanDuelCode("a0b1cild"), "ABCD", "sin 0, 1, O, I ni L");
  assert.equal(isDuelCode("ABCDE"), true);
  assert.equal(isDuelCode("ABCD"), false);
  assert.equal(isDuelCode("abcde"), false);
  assert.equal(readDuelParam("?juego=abcde&src=qr"), "ABCDE");
  assert.equal(readDuelParam("?juego=ABCD0"), null);
  assert.equal(readDuelParam("?juego=<script>"), null);
  assert.equal(readDuelParam("?mesa=ABCDE"), null);
  assert.equal(duelJoinUrl("https://x.com", "mi-bar", "ABCDE"), "https://x.com/mi-bar/menu?juego=ABCDE");
});

test("duelo: el reloj usa la hora del servidor aunque el celular esté adelantado o atrasado", () => {
  // El servidor dice que son las 100.000 y la ronda cierra a las 110.000.
  // Este celular atrasa 3 segundos (recibió el estado a las 97.000 de su reloj).
  const offset = clockOffset(100_000, 97_000);
  assert.equal(offset, 3_000);
  assert.equal(secondsLeft(110_000, offset, 97_000), 10);
  assert.equal(secondsLeft(110_000, offset, 101_500), 6, "5,5 s: se muestra 6 hasta que baja a 5");
  assert.equal(secondsLeft(110_000, offset, 107_000), 0);
  assert.equal(secondsLeft(110_000, offset, 999_999), 0, "nunca negativo");
  assert.equal(timeFraction(110_000, 10, offset, 97_000), 1);
  assert.equal(timeFraction(110_000, 10, offset, 102_000), 0.5);
  assert.equal(timeFraction(110_000, 10, offset, 500_000), 0);
  assert.equal(timeFraction(110_000, 10, offset, 0), 1);
});

const duel = (over: Partial<DuelState> = {}): DuelState => ({
  code: "ABCDE", status: "lobby", me: 2, hostId: 1, serverNow: 0, totalRounds: 3, seconds: 10, prizeText: "", minPlayers: 2,
  players: [
    { id: 1, name: "Ana", score: 0, connected: true, answered: false },
    { id: 2, name: "Beto", score: 0, connected: true, answered: false },
  ],
  round: null, ranking: null, ...over,
});

test("duelo: quién puede empezar y cuántos faltan responder", () => {
  const guest = duelView(duel());
  assert.equal(guest.isHost, false);
  assert.equal(guest.canStart, false);
  assert.equal(guest.host?.name, "Ana");
  assert.equal(guest.me?.name, "Beto");

  assert.equal(duelView(duel({ me: 1 })).canStart, true);
  // Con uno desconectado no alcanzan los jugadores.
  const alone = duel({ me: 1 });
  alone.players[1].connected = false;
  assert.equal(duelView(alone).canStart, false);
  assert.equal(duelView(alone).connectedCount, 1);
  assert.equal(duelView(duel({ me: 1, status: "question" })).canStart, false);

  const asking = duel({ status: "question" });
  asking.players[0].answered = true;
  assert.equal(duelView(asking).answeredCount, 1);
  assert.equal(duelView(asking).myResult, null, "con la ronda abierta no hay resultado");
});

test("duelo: cómo me fue en la ronda y quién ganó", () => {
  const round = { index: 0, prompt: "¿?", detail: null, options: ["A", "B"], endsAt: 0, myAnswer: 1, correct: 1, itemId: "a" };
  const hit = duelView(duel({ status: "reveal", round: { ...round, answers: [{ playerId: 2, option: 1, points: 800 }, { playerId: 1, option: 0, points: 0 }] } }));
  assert.deepEqual(hit.myResult, { answered: true, correct: true, points: 800 });
  const miss = duelView(duel({ me: 1, status: "reveal", round: { ...round, answers: [{ playerId: 1, option: 0, points: 0 }] } }));
  assert.deepEqual(miss.myResult, { answered: true, correct: false, points: 0 });
  const silent = duelView(duel({ status: "reveal", round: { ...round, answers: [] } }));
  assert.deepEqual(silent.myResult, { answered: false, correct: false, points: 0 });

  const won = duelView(duel({ status: "finished", ranking: [{ id: 2, name: "Beto", score: 2100 }, { id: 1, name: "Ana", score: 900 }] }));
  assert.deepEqual([won.winners, won.iWon], [["Beto"], true]);
  const tie = duelView(duel({ status: "finished", me: 1, ranking: [{ id: 1, name: "Ana", score: 1500 }, { id: 2, name: "Beto", score: 1500 }] }));
  assert.deepEqual([tie.winners, tie.iWon], [["Ana", "Beto"], true]);
  const nobody = duelView(duel({ status: "finished", ranking: [{ id: 1, name: "Ana", score: 0 }, { id: 2, name: "Beto", score: 0 }] }));
  assert.deepEqual([nobody.winners, nobody.iWon], [[], false], "con todos en cero no gana nadie");
});

test("panel: preguntas como texto, una por renglón", () => {
  assert.equal(questionsToText(["¿Uno?", "¿Dos?"]), "¿Uno?\n¿Dos?");
  assert.deepEqual(textToQuestions("  ¿Uno?  \n\n¿Dos?\r\n¿Uno?\n   \n¿Con   espacios?"), ["¿Uno?", "¿Dos?", "¿Con espacios?"]);
  assert.deepEqual(textToQuestions(""), []);
  assert.deepEqual(textToQuestions(questionsToText(["¿Uno?", "¿Dos?"])), ["¿Uno?", "¿Dos?"]);
});

test("panel: elegir qué categorías y productos participan", () => {
  const all = ["c1", "c2", "c3"];
  const everything = { categoryIds: [], excludedItemIds: [] };
  assert.equal(categoryInPool(everything, "c2"), true, "lista vacía = todas");

  // Desmarcar una: quedan las otras dos, explícitas.
  let pool = togglePoolCategory(everything, "c2", all);
  assert.deepEqual(pool.categoryIds, ["c1", "c3"]);
  assert.equal(categoryInPool(pool, "c2"), false);
  // Volver a marcarla: otra vez "todas" (así una categoría nueva entra sola).
  assert.deepEqual(togglePoolCategory(pool, "c2", all).categoryIds, []);
  // La última no se puede desmarcar: sin ninguna no hay juego.
  pool = togglePoolCategory(togglePoolCategory(everything, "c1", all), "c2", all);
  assert.deepEqual(pool.categoryIds, ["c3"]);
  assert.deepEqual(togglePoolCategory(pool, "c3", all).categoryIds, ["c3"]);

  // Excluir un producto puntual, y volver a incluirlo.
  pool = togglePoolItem(everything, "p1");
  assert.deepEqual(pool.excludedItemIds, ["p1"]);
  assert.equal(inPool(pool, { id: "p1", categoryId: "c1" }), false);
  assert.equal(inPool(pool, { id: "p2", categoryId: "c1" }), true);
  assert.deepEqual(togglePoolItem(pool, "p1").excludedItemIds, []);
  assert.deepEqual(everything, { categoryIds: [], excludedItemIds: [] }, "no se modifica la selección original");

  const products = [
    { id: "p1", categoryId: "c1", available: true }, { id: "p2", categoryId: "c1", available: false },
    { id: "p3", categoryId: "c2", available: true }, { id: "p4", categoryId: "c3", available: true },
  ];
  assert.equal(poolCount(everything, products), 3, "los pausados no cuentan");
  assert.equal(poolCount({ categoryIds: ["c1", "c2"], excludedItemIds: ["p3"] }, products), 1);
  assert.equal(poolCount({ categoryIds: ["c9"], excludedItemIds: [] }, products), 0);
});
