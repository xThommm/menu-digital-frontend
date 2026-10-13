import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Dices, Gamepad2, MessagesSquare, ShoppingBag, Swords } from "lucide-react";
import { useCart } from "../../../context/useCart";
import type { PublicMenuItem } from "../../../types/index";
import { useDuelRoom } from "../hooks/useDuelRoom";
import { GAME_COPY, readDuelParam } from "../lib/games";
import type { GameId, PublicGame, PublicGames } from "../types";
import DuelGame from "./DuelGame";
import QuestionsGame from "./QuestionsGame";
import RouletteGame from "./RouletteGame";
import cart from "../../../components/User/Home/Menu/CartDrawer.module.css";
import v from "../../orders/components/customer/VenueOrder.module.css";
import s from "./Games.module.css";

// Juegos para comensales dentro de la carta pública: el aviso que los ofrece
// (mismo lugar y estilo que el de "estás en el local") y el panel donde se
// juegan. Los juegos y sus opciones vienen del servidor (useGames); los
// productos, de la carta ya cargada.
//
// Sumar un juego nuevo acá es agregarlo a GAME_ICON, a GAME_COPY (lib/games)
// y al switch de renderGame.

const GAME_ICON: Record<GameId, typeof Dices> = {
  roulette: Dices,
  questions: MessagesSquare,
  duel: Swords,
};

interface Props {
  slug: string;
  games: PublicGames;
  // Todos los productos de la carta cargada.
  items: PublicMenuItem[];
  hidePrices: boolean;
  // false: desde esta carta no se puede pedir (los productos solo se muestran).
  canOrder: boolean;
  // Abre el detalle de un producto de la carta (para elegir variante o verlo).
  onOpenItem: (item: PublicMenuItem) => void;
  // Abre el pedido (el carrito de la carta).
  onOpenCart: () => void;
}

const stripDuelParam = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("juego")) return;
  params.delete("juego");
  const search = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
};

export default function Games({ slug, games, items, hidePrices, canOrder, onOpenItem, onOpenCart }: Props) {
  const hasDuel = games.games.some(game => game.id === "duel");
  // Enlace compartido de una partida (?juego=ABCDE): se lee una vez y se saca de la URL.
  const [linkCode] = useState(() => (hasDuel ? readDuelParam(window.location.search) : null));
  const [open, setOpen] = useState(linkCode !== null);
  const [current, setCurrent] = useState<GameId | null>(linkCode !== null ? "duel" : null);
  // La partida vive acá (y no en la pantalla del duelo) para que cerrar el
  // panel o mirar la carta no corte la conexión.
  const duel = useDuelRoom(slug);
  const { totalItems } = useCart();

  useEffect(() => { stripDuelParam(); }, []);

  const playing = duel.state !== null || duel.resuming;
  const game = games.games.find(entry => entry.id === current) ?? null;

  // Con un solo juego habilitado se entra directo, sin pasar por la lista.
  const only = games.games.length === 1 ? games.games[0].id : null;
  const openGame = (id: GameId | null) => {
    setCurrent(id ?? only);
    setOpen(true);
  };

  const renderGame = (entry: PublicGame) => {
    const common = { items, hidePrices, canOrder, onOpenItem };
    switch (entry.id) {
      case "roulette": return <RouletteGame game={entry} {...common} />;
      case "questions": return <QuestionsGame game={entry} {...common} />;
      case "duel": return <DuelGame slug={slug} game={entry} room={duel} initialCode={linkCode} {...common} />;
    }
  };

  return (
    <>
      <div className={`${v.banner} ${v.scope}`} role="note">
        <span className={v.bannerIcon}><Gamepad2 size={18} aria-hidden /></span>
        <span className={v.bannerText}>
          <strong>{playing ? "Tenés una partida en curso" : "Juegos"}</strong>
          <span>{playing ? "Volvé al Duelo de la carta." : "Mientras esperan, jueguen con la carta."}</span>
        </span>
        <button type="button" className={v.bannerBtn} onClick={() => openGame(playing ? "duel" : current)}>
          {playing ? "Volver" : "Jugar"}
        </button>
      </div>

      {open && (
        <div className={`${cart.overlay} ${v.scope}`} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={game ? GAME_COPY[game.id].title : "Juegos"}>
          <div className={cart.drawer} onClick={event => event.stopPropagation()}>
            <header className={cart.header}>
              <h2 className={`${cart.title} t-family-heading`}>{game ? GAME_COPY[game.id].title : "Juegos"}</h2>
              <button className={cart.close} onClick={() => setOpen(false)} aria-label="Cerrar" type="button">✕</button>
            </header>

            <div className={v.body}>
              {game ? (
                <>
                  {games.games.length > 1 && (
                    <button type="button" className={s.back} onClick={() => setCurrent(null)}>
                      <ChevronLeft size={16} aria-hidden /> Todos los juegos
                    </button>
                  )}
                  {renderGame(game)}
                </>
              ) : (
                <ul className={s.gameList}>
                  {games.games.map(entry => {
                    const Icon = GAME_ICON[entry.id];
                    return (
                      <li key={entry.id}>
                        <button type="button" className={s.gameCard} onClick={() => setCurrent(entry.id)}>
                          <span className={s.gameIcon}><Icon size={22} aria-hidden /></span>
                          <span className={s.gameText}>
                            <span className={s.gameTitle}>{GAME_COPY[entry.id].title}</span>
                            <span className={s.gameTagline}>{GAME_COPY[entry.id].tagline}</span>
                          </span>
                          <ChevronRight size={18} aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Lo que se fue sumando desde los juegos: un paso para verlo y enviarlo. */}
            {canOrder && totalItems > 0 && (
              <div className={cart.checkoutActions}>
                <button type="button" className={v.ghostBtn} onClick={() => { setOpen(false); onOpenCart(); }}>
                  <ShoppingBag size={16} aria-hidden /> Ver mi pedido ({totalItems})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
