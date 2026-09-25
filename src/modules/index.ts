import type { ComponentType } from "react";
import type { ModuleProps } from "./types";
import Home from "./home";
import Games from "./games";
import PcMonitor from "./pc-monitor";
import Music from "./music";
import Statistics from "./statistics";
import Settings from "./settings";
import Discord from "./discord";
import Modrinth from "./modrinth";
import Store from "./store";
interface HubModule {
  id: string;
  label: string;
  icon: string;
  component: ComponentType<ModuleProps>;
}
const SteamPage = (props: ModuleProps) => Games({ ...props, libraryKind: "steam" });
const AppsPage = (props: ModuleProps) => Games({ ...props, libraryKind: "apps" });
// Navigation and page rendering share this registry. Register future modules here.
export const modules: HubModule[] = [
  { id: "home", label: "Home", icon: "⌂", component: Home },
  { id: "games", label: "Steam", icon: "▦", component: SteamPage },
  { id: "apps", label: "Apps", icon: "▤", component: AppsPage },
  { id: "pc", label: "PC-Monitoring", icon: "▣", component: PcMonitor },
  { id: "music", label: "Musik", icon: "♫", component: Music },
  { id: "discord", label: "Discord", icon: "◉", component: Discord },
  { id: "modrinth", label: "Minecraft", icon: "◇", component: Modrinth },
  { id: "store", label: "Microsoft Store", icon: "▣", component: Store },
  { id: "statistics", label: "Statistiken", icon: "▥", component: Statistics },
  { id: "settings", label: "Einstellungen", icon: "⚙", component: Settings },
];
