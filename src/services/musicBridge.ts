export type MusicBridgeAction = "previous" | "toggle" | "stop" | "next";

export interface EmbeddedMusicState {
  active: boolean;
  title: string;
  artist: string;
  album: string;
  playing: boolean;
}

let state: EmbeddedMusicState = {
  active: false,
  title: "",
  artist: "",
  album: "",
  playing: false,
};
const listeners = new Set<(value: EmbeddedMusicState) => void>();
let commandHandler: ((action: MusicBridgeAction) => Promise<void>) | null = null;

export function publishEmbeddedMusic(value: EmbeddedMusicState) {
  state = value;
  listeners.forEach(listener => listener(state));
}

export function subscribeEmbeddedMusic(listener: (value: EmbeddedMusicState) => void) {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
}

export function registerEmbeddedMusicControls(handler: (action: MusicBridgeAction) => Promise<void>) {
  commandHandler = handler;
  return () => { if (commandHandler === handler) commandHandler = null; };
}

export async function controlEmbeddedMusic(action: MusicBridgeAction) {
  if (!commandHandler) throw new Error("Der integrierte Player ist noch nicht bereit.");
  await commandHandler(action);
}
