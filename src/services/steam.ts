import type { Game } from "../modules/types";
export interface SteamGame {
  appId: number;
  name: string;
  installDir: string;
  library: string;
  updateRequired: boolean;
}
export interface SteamScan {
  games: SteamGame[];
  libraries: string[];
  warnings: string[];
}
export function mergeSteamGames(
  existing: Game[],
  selected: SteamGame[],
): Game[] {
  const result = [...existing];
  for (const game of selected) {
    const index = result.findIndex((item) => item.steamAppId === game.appId);
    if (index >= 0) {
      // Keep the user's name and stable identity when a Steam library moves.
      result[index] = {
        ...result[index],
        path: game.installDir,
        steamLibrary: game.library,
      };
    } else {
      result.push({
        id: `steam:${game.appId}`,
        name: game.name,
        path: game.installDir,
        steamAppId: game.appId,
        steamLibrary: game.library,
      });
    }
  }
  return result;
}
