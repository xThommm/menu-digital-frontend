import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";
import type { PublicMenuItem } from "../../../types/index";
import { cryptoRng, playableItems, spin } from "../lib/games";
import type { RouletteGame as RouletteConfig } from "../types";
import GameProduct from "./GameProduct";
import v from "../../orders/components/customer/VenueOrder.module.css";
import s from "./Games.module.css";

// Ruleta de la carta: sortea productos reales del local (los que participan y
// se pueden pedir ahora) para descubrir qué pedir. Cada resultado trae su
// botón para sumarlo al pedido.

const SPIN_MS = 1400;
const TICK_MS = 90;

interface Props {
  game: RouletteConfig;
  items: PublicMenuItem[];
  hidePrices: boolean;
  canOrder: boolean;
  onOpenItem: (item: PublicMenuItem) => void;
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export default function RouletteGame({ game, items, hidePrices, canOrder, onOpenItem }: Props) {
  const pool = playableItems(game.itemIds, items);
  const [result, setResult] = useState<PublicMenuItem[] | null>(null);
  // Mientras gira: el nombre que va pasando.
  const [flash, setFlash] = useState<string | null>(null);
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; stop?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => () => {
    clearInterval(timers.current.tick);
    clearTimeout(timers.current.stop);
  }, []);

  const roll = () => {
    if (pool.length === 0 || flash !== null) return;
    const picked = spin(pool, game.picks, cryptoRng);
    if (reducedMotion()) {
      setResult(picked);
      return;
    }
    setResult(null);
    setFlash(pool[Math.floor(cryptoRng() * pool.length)].title);
    timers.current.tick = setInterval(() => setFlash(pool[Math.floor(cryptoRng() * pool.length)].title), TICK_MS);
    timers.current.stop = setTimeout(() => {
      clearInterval(timers.current.tick);
      setFlash(null);
      setResult(picked);
    }, SPIN_MS);
  };

  if (pool.length === 0) return <p className={v.hint}>Ahora no hay productos disponibles para la ruleta.</p>;

  const spinning = flash !== null;

  return (
    <>
      {game.promoText && <p className={s.promo}>{game.promoText}</p>}

      <div className={`${s.wheel} ${spinning ? s.wheelSpinning : ""}`} aria-live="polite">
        <span className={s.wheelText}>
          {spinning && flash}
          {!spinning && result === null && "¿Qué pedimos?"}
          {!spinning && result !== null && (result.length === 1 ? "¡Salió!" : `¡Salieron ${result.length}!`)}
        </span>
      </div>

      <button type="button" className={v.sendBtn} onClick={roll} disabled={spinning}>
        <Dices size={18} aria-hidden /> {spinning ? "Girando…" : result ? "Girar de nuevo" : "Girar la ruleta"}
      </button>

      {!spinning && result?.map(item => (
        <GameProduct key={item._id} item={item} hidePrices={hidePrices} canOrder={canOrder} onOpenItem={onOpenItem} />
      ))}
    </>
  );
}
