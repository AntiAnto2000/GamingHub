import { invoke } from "@tauri-apps/api/core";

const CLIENT_ID = "553f707c9b01481299b4ed6b47aaa1c7";
// Must exactly match the URI registered in the Spotify Developer Dashboard.
const REDIRECT_URI = "http://127.0.0.1:3000/callback";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
// 0.5 Friends Beta: migrate away from persistent web storage. A Spotify
// session intentionally ends when GamingHub is closed.
localStorage.removeItem("gaminghub.spotify.refresh");

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  followers: { total: number };
  images: { url: string; width: number | null; height: number | null }[];
  external_urls: { spotify: string };
}
export interface SpotifyTrack { id: string; name: string; uri: string; duration_ms?: number; artists: { id?: string; name: string }[]; album: { name?: string; images: { url: string }[] }; }
export interface SpotifyPlaylist { id: string; name: string; uri: string; description?: string; images: { url: string }[]; owner?: { display_name?: string }; items?: { total?: number }; external_urls: { spotify: string }; }
interface SpotifyAlbum { id: string; name: string; images: { url: string }[]; artists: { id?: string; name: string }[]; }

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function spotifyToken() {
  return sessionStorage.getItem("gaminghub.spotify.token");
}

let refreshInFlight: Promise<string | null> | null = null;
async function refreshSpotifyToken() {
  const refreshToken = sessionStorage.getItem("gaminghub.spotify.refresh");
  if (!refreshToken) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!response.ok) { sessionStorage.removeItem("gaminghub.spotify.refresh"); return null; }
    const token = await response.json();
    sessionStorage.setItem("gaminghub.spotify.token", token.access_token);
    if (token.refresh_token) sessionStorage.setItem("gaminghub.spotify.refresh", token.refresh_token);
    return token.access_token as string;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function spotifyFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  let token = spotifyToken();
  if (!token) token = await refreshSpotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const request = (value: string) => fetch(input, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${value}` } });
  let response = await request(token);
  if (response.status === 401) {
    const renewed = await refreshSpotifyToken();
    if (renewed) response = await request(renewed);
  }
  return response;
}

export async function beginSpotifyLogin() {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  const verifier = base64Url(bytes);
  sessionStorage.setItem("gaminghub.spotify.verifier", verifier);
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem("gaminghub.spotify.state", state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: await challenge(verifier),
    state,
    scope: "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative",
  });
  const url = `${AUTH_ENDPOINT}?${params}`;
  if ("__TAURI_INTERNALS__" in window) {
    const callback = await invoke<string>("spotify_authorize", { url });
    const result = new URL(callback, REDIRECT_URI);
    if (result.searchParams.get("state") !== state) throw new Error("Spotify-Anmeldung wurde aus Sicherheitsgründen abgebrochen.");
    const code = result.searchParams.get("code");
    const denied = result.searchParams.get("error");
    if (denied) throw new Error("Spotify-Anmeldung wurde abgebrochen.");
    if (!code) throw new Error("Spotify hat keinen Anmeldecode zurückgegeben.");
    return exchangeSpotifyCode(code, verifier);
  }
  window.location.href = url;
  return false;
}

let loginCompletion: Promise<boolean> | undefined;
export function finishSpotifyLogin() {
  return loginCompletion ??= completeSpotifyLogin();
}
async function completeSpotifyLogin() {
  const code = new URLSearchParams(window.location.search).get("code");
  const verifier = sessionStorage.getItem("gaminghub.spotify.verifier");
  if (!code || !verifier) return false;
  const expectedState = sessionStorage.getItem("gaminghub.spotify.state");
  const returnedState = new URLSearchParams(window.location.search).get("state");
  if (expectedState && returnedState !== expectedState) throw new Error("Spotify-Anmeldung wurde aus Sicherheitsgründen abgebrochen.");
  return exchangeSpotifyCode(code, verifier);
}
async function exchangeSpotifyCode(code: string, verifier: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error("Spotify-Anmeldung konnte nicht abgeschlossen werden.");
  const token = await response.json();
  sessionStorage.setItem("gaminghub.spotify.token", token.access_token);
  if (token.refresh_token) sessionStorage.setItem("gaminghub.spotify.refresh", token.refresh_token);
  sessionStorage.removeItem("gaminghub.spotify.verifier");
  sessionStorage.removeItem("gaminghub.spotify.state");
  if (window.location.search) window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

export async function searchArtists(query: string) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const response = await spotifyFetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: "artist", limit: "8" })}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkSpotifyResponse(response);
  const data = await response.json();
  return data.artists.items as SpotifyArtist[];
}

export async function searchTracks(query: string) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const response = await spotifyFetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query.trim(), type: "track", limit: "10" })}`, { headers: { Authorization: `Bearer ${token}` } });
  await checkSpotifyResponse(response);
  const data = await response.json();
  return (data.tracks?.items ?? []).filter((track: SpotifyTrack | null) => track?.id && track.uri && Array.isArray(track.artists)) as SpotifyTrack[];
}

export async function searchPlaylists(query: string) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const response = await spotifyFetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query.trim(), type: "playlist", limit: "10" })}`);
  await checkSpotifyResponse(response);
  const data = await response.json();
  return (data.playlists?.items ?? []).filter((playlist: SpotifyPlaylist | null) => playlist?.id && playlist.uri) as SpotifyPlaylist[];
}

const BROAD_GENRES: Array<[string, RegExp]> = [
  ["Hip-Hop", /hip.?hop|rap|trap|drill|grime|boom bap/i],
  ["Rock", /rock|grunge|shoegaze|britpop/i],
  ["Metal", /metal|deathcore|metalcore/i],
  ["Pop", /pop|boy band|girl group/i],
  ["Electronic", /electro|electronic|edm|techno|house|trance|dubstep|drum and bass|ambient|synthwave/i],
  ["R&B", /r&b|rhythm and blues|neo soul/i],
  ["Soul", /soul|motown/i],
  ["Jazz", /jazz|bebop|swing/i],
  ["Classical", /classical|orchestra|baroque|opera/i],
  ["Country", /country|bluegrass|americana/i],
  ["Reggae", /reggae|dancehall|ska|dub/i],
  ["Latin", /latin|reggaeton|salsa|bachata|cumbia/i],
  ["Punk", /punk|hardcore/i],
  ["Indie", /indie/i],
  ["Folk", /folk|singer-songwriter/i],
  ["Blues", /blues/i],
  ["Funk", /funk|disco/i],
  ["Dance", /dance|club/i],
  ["Soundtrack", /soundtrack|score|video game music/i],
];

function broadGenre(rawGenres: string[]) {
  for (const raw of rawGenres) {
    const match = BROAD_GENRES.find(([, pattern]) => pattern.test(raw));
    if (match) return match[0];
  }
  return "";
}

export async function genreTrackPool(seed: SpotifyTrack, knownArtist?: SpotifyArtist): Promise<{ genre: string; tracks: SpotifyTrack[] }> {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  let genres = knownArtist?.genres ?? [];
  const artistId = seed.artists.find(artist => artist.id)?.id;
  if (!genres.length && artistId) {
    const artistResponse = await spotifyFetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await checkSpotifyResponse(artistResponse);
    const artist = await artistResponse.json() as SpotifyArtist;
    genres = Array.isArray(artist.genres) ? artist.genres : [];
  }
  const genre = broadGenre(genres);
  if (!genre) return { genre: "", tracks: [] };

  const matches = new Map<string, SpotifyTrack>();
  for (const offset of [0, 10, 20, 30, 40, 50]) {
    const response = await spotifyFetch(`https://api.spotify.com/v1/search?${new URLSearchParams({
      q: `genre:"${genre}"`, type: "track", limit: "10", offset: String(offset),
    })}`, { headers: { Authorization: `Bearer ${token}` } });
    await checkSpotifyResponse(response);
    const data = await response.json();
    const items = (data.tracks?.items ?? []) as (SpotifyTrack | null)[];
    for (const track of items) if (track?.id && track.uri && Array.isArray(track.artists)) matches.set(track.id, track);
    if (items.length < 10) break;
  }
  matches.delete(seed.id);
  return { genre, tracks: [...matches.values()] };
}

export async function artistTracks(artistId: string, artistName: string) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const matches = new Map<string, SpotifyTrack>();
  const query = 'artist:"' + artistName.replace(/"/g, "") + '"';
  // Spotify liefert pro Suchseite höchstens zehn Einträge. Einige davon sind
  // Kompilationen oder Namensgleichheiten; deshalb laden wir weitere Seiten,
  // bis zehn eindeutige Titel des gewählten Künstlers gesammelt sind.
  for (const offset of [0, 10, 20, 30, 40]) {
    const response = await spotifyFetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: "track", limit: "10", offset: String(offset) })}`, { headers: { Authorization: `Bearer ${token}` } });
    await checkSpotifyResponse(response);
    const data = await response.json();
    const items = (data.tracks?.items ?? []) as (SpotifyTrack | null)[];
    for (const track of items) {
      if (track?.id && track.uri && track.artists?.some(artist => artist.id === artistId)) matches.set(track.id, track);
      if (matches.size === 10) return [...matches.values()];
    }
    if (items.length < 10) break;
  }
  return [...matches.values()];
}

export async function artistCatalog(artistId: string) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const headers = { Authorization: `Bearer ${token}` };
  const albums = new Map<string, SpotifyAlbum>();
  let next: string | null = `https://api.spotify.com/v1/artists/${artistId}/albums?${new URLSearchParams({ include_groups: "album,single", limit: "10" })}`;
  while (next) {
    const response = await spotifyFetch(next, { headers });
    await checkSpotifyResponse(response);
    const page = await response.json();
    for (const album of (page.items ?? []) as SpotifyAlbum[]) {
      if (album?.id && album.artists?.some(artist => artist.id === artistId)) albums.set(album.id, album);
    }
    next = typeof page.next === "string" ? page.next : null;
  }

  const songs = new Map<string, SpotifyTrack>();
  for (const album of albums.values()) {
    let trackPage: string | null = `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=20`;
    while (trackPage) {
      const response = await spotifyFetch(trackPage, { headers });
      await checkSpotifyResponse(response);
      const page = await response.json();
      for (const track of (page.items ?? []) as SpotifyTrack[]) {
        if (!track?.id || !track.uri || !track.artists?.some(artist => artist.id === artistId)) continue;
        const key = `${track.name.trim().toLocaleLowerCase()}::${track.artists.map(artist => artist.id || artist.name.toLocaleLowerCase()).sort().join(",")}`;
        if (!songs.has(key)) songs.set(key, { ...track, album: { name: album.name, images: album.images ?? [] } });
      }
      trackPage = typeof page.next === "string" ? page.next : null;
    }
  }
  return [...songs.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function checkSpotifyResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 401) {
    sessionStorage.removeItem("gaminghub.spotify.token");
    throw new Error("Deine Spotify-Anmeldung ist abgelaufen. Bitte erneut verbinden.");
  }
  if (response.status === 403) throw new Error("Spotify verweigert den Zugriff. Bitte erneut verbinden und die Berechtigungen bestätigen.");
  if (response.status === 429) throw new Error("Spotify erhält zu viele Anfragen. Bitte später erneut versuchen.");
  const body = await response.json().catch(() => null);
  const detail = String(body?.error?.message || "").trim();
  throw new Error(`Spotify-Anfrage fehlgeschlagen (HTTP ${response.status})${detail ? `: ${detail}` : ". Bitte erneut versuchen."}`);
}

export interface SpotifyDevice { id: string; name: string; is_active: boolean; is_restricted: boolean; }
export async function availableSpotifyDevices(): Promise<SpotifyDevice[]> {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const response = await spotifyFetch("https://api.spotify.com/v1/me/player/devices", { headers: { Authorization: `Bearer ${token}` } });
  await checkSpotifyResponse(response);
  const data = await response.json();
  return (data.devices ?? []).filter((device: SpotifyDevice) => device?.id && !device.is_restricted);
}
export async function controlSpotifyDevice(deviceId: string, action: "pause" | "play" | "next" | "previous") {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  const response = await spotifyFetch(`https://api.spotify.com/v1/me/player/${action}?device_id=${encodeURIComponent(deviceId)}`, {
    method: action === "next" || action === "previous" ? "POST" : "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkSpotifyResponse(response);
}
export async function playOnDevice(deviceId: string, uri: string, queue: string[] = []) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  if (!deviceId) throw new Error("Player noch nicht verbunden.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  async function playbackError(response: Response, stage: string) {
    if (response.status !== 404) return checkSpotifyResponse(response);
    const body = await response.json().catch(() => null);
    const reason = String(body?.error?.reason || body?.error?.message || "Keine weitere Angabe").slice(0, 240);
    throw new Error(`${stage}: Spotify meldet HTTP 404 — ${reason}. Die Geräteaktivierung ist noch nicht bestätigt.`);
  }
  // The devices endpoint is not exhaustive. Address the SDK's own device ID
  // directly instead of treating absence from that list as a failed connection.
  const transfer = await spotifyFetch("https://api.spotify.com/v1/me/player", {
    method: "PUT", headers, body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
  if (!transfer.ok) { await playbackError(transfer, "Player aktivieren"); return; }
  // A successful transfer may become effective asynchronously. Retry only 404,
  // bounded, and never switch to an unrelated device.
  const uris = [uri, ...queue.filter(item => item !== uri)].slice(0, 100);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 700));
    const response = await spotifyFetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: "PUT", headers, body: JSON.stringify({ uris }),
    });
    if (response.ok) return;
    if (response.status === 404 && attempt < 3) continue;
    await playbackError(response, "Titel starten");
  }
}

export async function playContextOnDevice(deviceId: string, contextUri: string) {
  const token = spotifyToken();
  if (!token) throw new Error("Bitte zuerst Spotify verbinden.");
  if (!deviceId) throw new Error("Bitte zuerst eine Audioausgabe auswählen.");
  const response = await spotifyFetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_uri: contextUri }),
  });
  await checkSpotifyResponse(response);
}
