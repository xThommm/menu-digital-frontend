import { useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import type { PublicMenuItem } from "../../../types/index";
import { buildDeck, cryptoRng, playableItems, stepCard, type Card } from "../lib/games";
import type { QuestionsGame as QuestionsConfig } from "../types";
import GameProduct from "./GameProduct";
import v from "../../orders/components/customer/VenueOrder.module.css";
import s from "./Games.module.css";

// Preguntas para compartir: juego social para citas, parejas y grupos. Se
// elige una categoría y se pasan las tarjetas (adelante y atrás). Cada tanto
// aparece un desafío con un producto real del local y su botón para pedirlo.

interface Props {
  game: QuestionsConfig;
  items: PublicMenuItem[];
  hidePrices: boolean;
  canOrder: boolean;
  onOpenItem: (item: PublicMenuItem) => void;
}

export default function QuestionsGame({ game, items, hidePrices, canOrder, onOpenItem }: Props) {
  const challengeItems = game.challenges ? playableItems(game.challenges.itemIds, items) : [];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [deck, setDeck] = useState<Card[]>([]);
  const [position, setPosition] = useState(0);

  // El mazo se arma al elegir la categoría (y al mezclar), no en cada render.
  const open = (id: string) => {
    const category = game.categories.find(entry => entry.id === id);
    if (!category) return;
    setCategoryId(id);
    setDeck(buildDeck(category, game.challenges ? { every: game.challenges.every, items: challengeItems } : null, cryptoRng));
    setPosition(0);
  };

  const card = deck[position];
  const product = card?.kind === "challenge" ? items.find(item => item._id === card.itemId) : undefined;

  return (
    <>
      <div className={s.chips} role="group" aria-label="Categorías de preguntas">
        {game.categories.map(category => (
          <button
            key={category.id}
            type="button"
            className={s.chip}
            aria-pressed={category.id === categoryId}
            onClick={() => open(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {!card && <p className={v.hint}>Elegí una categoría para empezar. Lean cada pregunta en voz alta y respondan todos.</p>}

      {card && (
        <>
          <div className={s.card} aria-live="polite">
            <span className={s.cardKind}>{card.kind === "challenge" ? "Desafío" : "Pregunta"}</span>
            <p className={s.cardText}>{card.text}</p>
          </div>

          {product && (
            <GameProduct item={product} hidePrices={hidePrices} canOrder={canOrder} onOpenItem={onOpenItem} />
          )}

          <div className={s.nav}>
            <button type="button" className={v.ghostBtn} disabled={position === 0} onClick={() => setPosition(stepCard(position, -1, deck.length))}>
              <ChevronLeft size={16} aria-hidden /> Anterior
            </button>
            <span className={s.navCount}>{position + 1} / {deck.length}</span>
            <button type="button" className={v.sendBtn} disabled={position >= deck.length - 1} onClick={() => setPosition(stepCard(position, 1, deck.length))}>
              Siguiente <ChevronRight size={16} aria-hidden />
            </button>
          </div>

          <button type="button" className={v.ghostBtn} onClick={() => categoryId && open(categoryId)}>
            <Shuffle size={15} aria-hidden /> Mezclar de nuevo
          </button>
        </>
      )}
    </>
  );
}
