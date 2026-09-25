import type { Dispatch, SetStateAction } from "react";
export interface Game {
  id: string;
  name: string;
  path: string;
  steamAppId?: number;
  steamLibrary?: string;
  cover?: string;
  favorite?: boolean;
  lastLaunchedAt?: number;
  tags?: string[];
  notes?: string;
}
export interface Settings {
  name: string;
  accent: "mint" | "violet" | "ocean" | "amber" | "coral" | "pink" | "ice" | "red";
  theme?: "graphite" | "midnight" | "forest" | "aurora" | "crimson" | "daylight";
  customAccent?: string;
  density?: "comfortable" | "compact";
  startPage?: string;
  focusMode?: boolean;
  showHero?: boolean;
  showSystem?: boolean;
  showLibrary?: boolean;
  showMusic?: boolean;
  showDiscord?: boolean;
  reduceMotion?: boolean;
  cockpitWidgets?: string[];
  steamId?: string;
  welcomeComplete?: boolean;
  automaticUpdates?: boolean;
}
export interface ModuleProps {
  games: Game[];
  setGames: Dispatch<SetStateAction<Game[]>>;
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  navigate: (id: string) => void;
  libraryKind?: "steam" | "apps";
}
