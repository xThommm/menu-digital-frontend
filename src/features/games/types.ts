// Tipos de Juegos para comensales (contrato de /api/games del backend).

export type GameId = "roulette" | "questions" | "duel";

// ── Lo que recibe la carta pública ──
export interface RouletteGame {
  id: "roulette";
  // Cuántos productos salen por tirada.
  picks: number;
  promoText: string;
  // Productos que participan (ids de la carta): reales y pedibles ahora.
  itemIds: string[];
}

export interface QuestionCategory {
  id: string;
  name: string;
  questions: string[];
}

export interface QuestionsGame {
  id: "questions";
  categories: QuestionCategory[];
  // null: sin desafíos con productos.
  challenges: { every: number; itemIds: string[] } | null;
}

export interface DuelGame {
  id: "duel";
  rounds: number;
  seconds: number;
  prizeText: string;
  minPlayers: number;
  maxPlayers: number;
}

export type PublicGame = RouletteGame | QuestionsGame | DuelGame;

export interface PublicGames {
  enabled: boolean;
  // true: solo para quien escaneó el QR del local.
  venueOnly: boolean;
  games: PublicGame[];
}

// ── Duelo de la carta (multijugador) ──
export type DuelStatus = "lobby" | "question" | "reveal" | "finished";

export interface DuelPlayer {
  id: number;
  name: string;
  score: number;
  connected: boolean;
  // Ya respondió la ronda en curso (no dice qué).
  answered: boolean;
}

export interface DuelRound {
  index: number;
  prompt: string;
  detail: string | null;
  options: string[];
  // Momento del servidor en que cierra la ronda (ms).
  endsAt: number;
  myAnswer: number | null;
  // Solo con la ronda cerrada:
  correct?: number;
  itemId?: string;
  answers?: { playerId: number; option: number; points: number }[];
}

// La partida vista por un jugador (lo que manda el servidor en cada cambio).
export interface DuelState {
  code: string;
  status: DuelStatus;
  me: number;
  hostId: number;
  serverNow: number;
  totalRounds: number;
  seconds: number;
  prizeText: string;
  minPlayers: number;
  players: DuelPlayer[];
  round: DuelRound | null;
  ranking: { id: number; name: string; score: number }[] | null;
}

export type DuelServerMessage =
  | { type: "joined"; code: string; playerToken: string; state: DuelState }
  | { type: "state"; state: DuelState }
  | { type: "error"; code?: string; message: string }
  | { type: "closed" }
  | { type: "left" };

// ── Configuración del panel ──
export interface GamePool {
  // Vacío = todas las categorías.
  categoryIds: string[];
  excludedItemIds: string[];
}

export interface QuestionCategorySettings extends QuestionCategory {
  enabled: boolean;
}

export interface GamesSettings {
  venueOnly: boolean;
  games: {
    roulette: { enabled: boolean; picks: number; pool: GamePool; promoText: string };
    questions: {
      enabled: boolean;
      categories: QuestionCategorySettings[];
      challenges: { enabled: boolean; every: number; pool: GamePool };
    };
    duel: { enabled: boolean; rounds: number; seconds: number; pool: GamePool; prizeText: string };
  };
}

export interface GamesCatalog {
  categories: { id: string; title: string }[];
  products: { id: string; title: string; categoryId: string; available: boolean }[];
}

export interface GamesSettingsPayload {
  settings: GamesSettings;
  catalog: GamesCatalog;
  limits: Record<string, number>;
}

// Cambio parcial que acepta PUT /api/games/settings.
export type GamesSettingsPatch = {
  venueOnly?: boolean;
  games?: { [K in GameId]?: Partial<GamesSettings["games"][K]> };
};
