import apiClient from "../../../api/client";
import { apiFetch } from "../../../api/apiClient";
import type { GamesSettingsPatch, GamesSettingsPayload, PublicGames } from "../types";

// API de Juegos para comensales. Ver src/games/routes.js del backend.

// Carta pública (sin sesión): con fetch/apiFetch y no con apiClient, que manda
// el JWT del dueño y ante un 401 redirige a /login.
export const getPublicGames = (slug: string, signal?: AbortSignal) =>
  apiFetch<PublicGames>(`/api/games/public/${encodeURIComponent(slug)}`, { signal });

// Panel del dueño.
export const getGamesSettings = async (): Promise<GamesSettingsPayload> =>
  (await apiClient.get<GamesSettingsPayload>("/games/settings")).data;

export const saveGamesSettings = async (patch: GamesSettingsPatch): Promise<GamesSettingsPayload> =>
  (await apiClient.put<GamesSettingsPayload>("/games/settings", patch)).data;
