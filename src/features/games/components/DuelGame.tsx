import { useEffect, useState } from "react";
import { Crown, Share2, Swords, WifiOff } from "lucide-react";
import type { PublicMenuItem } from "../../../types/index";
import type { DuelRoom } from "../hooks/useDuelRoom";
import { cleanDuelCode, duelJoinUrl, duelView, isDuelCode, secondsLeft, timeFraction } from "../lib/games";
import type { DuelGame as DuelConfig, DuelState } from "../types";
import GameProduct from "./GameProduct";
import v from "../../orders/components/customer/VenueOrder.module.css";
import s from "./Games.module.css";
import { useDialogs } from "../../../context/useDialogs";

// Duelo de la carta: juego competitivo, cada uno desde su celular. Uno crea la
// sala y los demás se suman con el código o el enlace. Rondas cortas de opción
// múltiple sobre la carta del local; suma más quien acierta y más rápido. El
// juego lo lleva el servidor (ver useDuelRoom): esta pantalla muestra la
// última foto de la partida y manda lo que toca el jugador.

const NAME_MAX = 20;

interface Props {
  slug: string;
  game: DuelConfig;
  room: DuelRoom;
  items: PublicMenuItem[];
  hidePrices: boolean;
  canOrder: boolean;
  onOpenItem: (item: PublicMenuItem) => void;
  // Código que vino en el enlace compartido.
  initialCode: string | null;
}

export default function DuelGame({ slug, game, room, items, hidePrices, canOrder, onOpenItem, initialCode }: Props) {
  const dialogs = useDialogs();
  const { state } = room;

  if (!state) {
    if (room.resuming) return <p className={v.hint}>Volviendo a tu partida…</p>;
    return <Entry game={game} room={room} initialCode={initialCode} />;
  }

  return (
    <>
      {room.connection === "offline" && (
        <p className={s.offline} role="status"><WifiOff size={14} aria-hidden /> Sin conexión. Reconectando…</p>
      )}
      {room.error && <p className={v.error} role="alert">{room.error}</p>}

      {state.status === "lobby" && <Lobby slug={slug} state={state} room={room} />}
      {(state.status === "question" || state.status === "reveal") && (
        <Round state={state} room={room} items={items} hidePrices={hidePrices} canOrder={canOrder} onOpenItem={onOpenItem} />
      )}
      {state.status === "finished" && <Finished state={state} room={room} />}

      <button type="button" className={v.bannerLeave} onClick={async () => {
          if (await dialogs.confirm({ title: "¿Salir de la partida?", confirmLabel: "Salir", danger: true })) room.leave();
        }}>
        Salir de la partida
      </button>
    </>
  );
}

// ── Crear una sala o sumarse ──

function Entry({ game, room, initialCode }: { game: DuelConfig; room: DuelRoom; initialCode: string | null }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const busy = room.connection === "connecting";
  const named = name.trim().length > 0;

  return (
    <>
      <p className={v.hint}>
        {game.rounds} rondas de {game.seconds} segundos sobre la carta. De {game.minPlayers} a {game.maxPlayers} jugadores, cada uno con su celular.
      </p>
      {game.prizeText && <p className={s.promo}>Premio: {game.prizeText}</p>}

      <label className={v.tableField}>
        <span>Tu nombre</span>
        <input
          className={v.textInput}
          value={name}
          maxLength={NAME_MAX}
          autoComplete="given-name"
          placeholder="Como te van a ver los demás"
          onChange={event => { setName(event.target.value); room.clearError(); }}
        />
      </label>

      {!initialCode && (
        <button type="button" className={v.sendBtn} disabled={busy || !named} onClick={() => room.create(name.trim())}>
          <Swords size={17} aria-hidden /> {busy ? "Entrando…" : "Crear una partida"}
        </button>
      )}

      <label className={v.tableField}>
        <span>{initialCode ? "Código de la partida" : "¿Ya crearon una? Poné el código"}</span>
        <input
          className={`${v.textInput} ${v.codeInput}`}
          value={code}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABCDE"
          onChange={event => { setCode(cleanDuelCode(event.target.value)); room.clearError(); }}
        />
      </label>
      <button
        type="button"
        className={initialCode ? v.sendBtn : v.ghostBtn}
        disabled={busy || !named || !isDuelCode(code)}
        onClick={() => room.join(code, name.trim())}
      >
        {busy ? "Entrando…" : "Sumarme a la partida"}
      </button>

      {room.error && <p className={v.error} role="alert">{room.error}</p>}
    </>
  );
}

// ── Sala de espera ──

function Players({ state, showScore }: { state: DuelState; showScore: boolean }) {
  return (
    <ul className={s.players}>
      {state.players.map(player => (
        <li key={player.id} className={`${s.player} ${player.connected ? "" : s.playerOff} ${player.id === state.me ? s.playerMe : ""}`}>
          <span className={s.playerName}>
            {player.id === state.hostId && <Crown size={14} aria-label="Maneja la partida" />}
            {player.name}{player.id === state.me && " (vos)"}
          </span>
          <span className={s.playerMeta}>
            {!player.connected && "sin conexión"}
            {player.connected && state.status === "question" && (player.answered ? "respondió" : "pensando…")}
          </span>
          {showScore && <span className={s.playerScore}>{player.score}</span>}
        </li>
      ))}
    </ul>
  );
}

function Lobby({ slug, state, room }: { slug: string; state: DuelState; room: DuelRoom }) {
  const view = duelView(state);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = duelJoinUrl(window.location.origin, slug, state.code);
    try {
      if (navigator.share) await navigator.share({ title: "Duelo de la carta", text: `Sumate a la partida ${state.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Canceló el compartir o no hay portapapeles: queda el código.
    }
  };

  return (
    <>
      <div className={s.lobby}>
        <span className={v.hint} style={{ color: "inherit" }}>Código de la partida</span>
        <span className={s.code} aria-label={`Código ${state.code.split("").join(" ")}`}>{state.code}</span>
        <button type="button" className={v.ghostBtn} onClick={share}>
          <Share2 size={15} aria-hidden /> {copied ? "Enlace copiado" : "Compartir enlace"}
        </button>
      </div>
      {state.prizeText && <p className={s.promo}>Premio: {state.prizeText}</p>}

      <Players state={state} showScore={false} />

      {view.isHost ? (
        <>
          <button type="button" className={v.sendBtn} disabled={!view.canStart} onClick={room.start}>
            <Swords size={17} aria-hidden /> Empezar
          </button>
          {!view.canStart && <p className={v.hint}>Hacen falta al menos {state.minPlayers} jugadores conectados. Pasales el código.</p>}
        </>
      ) : (
        <p className={v.hint}>Esperando a que {view.host?.name ?? "quien creó la partida"} empiece…</p>
      )}
    </>
  );
}

// ── Ronda ──

// Reloj que avanza solo mientras hay una ronda abierta.
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Round({ state, room, items, hidePrices, canOrder, onOpenItem }: {
  state: DuelState;
  room: DuelRoom;
  items: PublicMenuItem[];
  hidePrices: boolean;
  canOrder: boolean;
  onOpenItem: (item: PublicMenuItem) => void;
}) {
  const round = state.round!;
  const view = duelView(state);
  const open = state.status === "question";
  const now = useNow(open);
  // Lo que tocó, hasta que el servidor lo confirma (así el botón responde al instante).
  const [picked, setPicked] = useState<{ round: number; option: number } | null>(null);
  const mine = round.myAnswer ?? (picked?.round === round.index ? picked.option : null);
  const left = secondsLeft(round.endsAt, room.offset, now);
  const product = round.itemId ? items.find(item => item._id === round.itemId) : undefined;

  const choose = (option: number) => {
    if (!open || mine !== null || left === 0) return;
    setPicked({ round: round.index, option });
    room.answer(round.index, option);
  };

  const optionClass = (index: number) => {
    if (open) return index === mine ? s.optionPicked : "";
    if (index === round.correct) return s.optionRight;
    return index === mine ? s.optionWrong : "";
  };

  return (
    <>
      <div className={s.roundHead}>
        <span>Ronda {round.index + 1} de {state.totalRounds}</span>
        {open && <span className={s.clock} aria-label={`${left} segundos`}>{left}</span>}
      </div>
      {open && (
        <div className={s.timer} aria-hidden>
          <div className={s.timerFill} style={{ width: `${timeFraction(round.endsAt, state.seconds, room.offset, now) * 100}%` }} />
        </div>
      )}

      <p className={s.prompt}>{round.prompt}</p>
      {round.detail && <p className={s.detail}>«{round.detail}»</p>}

      <div className={s.options} role="group" aria-label="Respuestas">
        {round.options.map((label, index) => (
          <button
            key={index}
            type="button"
            className={`${s.option} ${optionClass(index)}`}
            disabled={!open || mine !== null}
            aria-pressed={index === mine}
            onClick={() => choose(index)}
          >
            {label}
          </button>
        ))}
      </div>

      {open && (
        <p className={v.hint} role="status">
          {mine !== null ? "¡Listo! Esperando al resto… " : ""}
          {view.answeredCount} de {view.connectedCount} respondieron.
        </p>
      )}

      {!open && view.myResult && (
        <p className={`${s.result} ${view.myResult.correct ? s.resultGood : ""}`} role="status">
          {view.myResult.correct && `¡Bien! +${view.myResult.points} puntos`}
          {!view.myResult.correct && view.myResult.answered && "No era esa."}
          {!view.myResult.answered && "Se acabó el tiempo."}
        </p>
      )}

      {!open && product && (
        <GameProduct item={product} hidePrices={hidePrices} canOrder={canOrder} onOpenItem={onOpenItem} />
      )}

      <Players state={state} showScore />
    </>
  );
}

// ── Final ──

function Finished({ state, room }: { state: DuelState; room: DuelRoom }) {
  const view = duelView(state);
  const ranking = state.ranking ?? [];

  return (
    <>
      <div className={s.winner}>
        <Crown size={28} aria-hidden />
        <span className={s.winnerName}>
          {view.winners.length === 0 && "Sin ganador esta vez"}
          {view.winners.length === 1 && (view.iWon ? "¡Ganaste!" : `Ganó ${view.winners[0]}`)}
          {view.winners.length > 1 && `Empate: ${view.winners.join(" y ")}`}
        </span>
        {state.prizeText && view.winners.length > 0 && (
          <span>Premio: {state.prizeText}. {view.iWon ? "Mostrale esta pantalla a quien los atiende." : ""}</span>
        )}
      </div>

      <ol className={s.players}>
        {ranking.map((player, index) => (
          <li key={player.id} className={`${s.player} ${player.id === state.me ? s.playerMe : ""}`}>
            <span className={s.playerName}>{index + 1}. {player.name}{player.id === state.me && " (vos)"}</span>
            <span className={s.playerScore}>{player.score}</span>
          </li>
        ))}
      </ol>

      {view.isHost ? (
        <button type="button" className={v.sendBtn} onClick={room.again}><Swords size={17} aria-hidden /> Revancha</button>
      ) : (
        <p className={v.hint}>{view.host?.name ?? "Quien creó la partida"} puede armar la revancha.</p>
      )}
    </>
  );
}
