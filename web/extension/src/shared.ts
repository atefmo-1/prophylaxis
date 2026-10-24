// Shared by the extension's background worker, offscreen engine page, content script and side panel.
import type { ChessComGame, Frame } from "../../src/analysis/review";
import type { Color } from "../../src/types";

export interface Settings {
  username: string;
  siteUrl: string;
  autoOpen: boolean;
  repo: string; // owner/name of the GitHub repo whose "Update games" workflow rebuilds the site
}

export const DEFAULTS: Settings = {
  username: "atefmo-1",
  siteUrl: "https://atefmo-1.github.io/prophylaxis/",
  autoOpen: true,
  repo: "atefmo-1/prophylaxis",
};

// The old default, from before the site was deployed. Saving Settings stored it, so treat it as "not set".
const OLD_DEFAULT_SITE = "http://localhost:5173/";

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get({ ...DEFAULTS } as Record<string, unknown>);
  return {
    username: String(stored.username || DEFAULTS.username),
    siteUrl: String(stored.siteUrl && stored.siteUrl !== OLD_DEFAULT_SITE ? stored.siteUrl : DEFAULTS.siteUrl),
    autoOpen: stored.autoOpen !== false,
    repo: String(stored.repo || DEFAULTS.repo),
  };
}

// The GitHub token stays in local storage: on this computer only, never synced to the Chrome account.
export async function getToken(): Promise<string> {
  const { githubToken } = (await chrome.storage.local.get("githubToken")) as { githubToken?: string };
  return githubToken ?? "";
}

/** Whether the game has reached the site: asked GitHub to update it, on the site, or GitHub refused. */
export type SiteSync = { status: "sent"; at: number } | { status: "live" } | { status: "failed"; message: string };
export const siteKey = (id: string) => `site:${id}`;

export interface Live {
  color: Color;
  opponent: string;
  fen: string | null;
  wins: number[]; // white's winning chances for each position read so far
  plies: number;
}

export type GameState =
  | { status: "waiting"; since: number } // the game ended; chess.com hasn't listed it in the archive yet
  | { status: "unlisted" } // still not listed after a long wait
  | { status: "analysing"; percent: number; live?: Live }
  | { status: "ready" }
  | { status: "error"; message: string };

export const stateKey = (id: string) => `state:${id}`;
export const reviewKey = (id: string) => `review:${id}`;

export type Message =
  | { type: "check"; id: string }
  | { type: "analyse"; id: string }
  | { type: "open-panel"; id: string; mode: "summary" | "moments" }
  | { type: "await"; id: string }
  | { type: "update-site"; id: string }
  | { type: "game-over"; id: string; open: boolean; gesture: boolean }
  | { type: "progress"; id: string; percent: number; frame?: Frame; meta?: { color: Color; opponent: string; plies: number } }
  | { type: "done"; id: string; review: unknown }
  | { type: "failed"; id: string; message: string }
  | { target: "offscreen"; type: "analyse"; id: string; username: string; siteUrl: string };

export type CheckResult = "finished" | "not-found" | "not-mine";
export interface CheckReply {
  result: CheckResult;
  panelOpen: boolean;
}

/** The game id on a finished-game page: /game/live/123, /game/daily/123, /game/123, /analysis/game/live/123. */
export function gameIdFromPath(path: string): string | null {
  const m = path.match(/^\/(?:analysis\/)?game\/(?:(?:live|daily)\/)?(\d{5,})/);
  return m ? m[1] : null;
}

const API = "https://api.chess.com/pub/player";

/**
 * Find a game in the player's public archive. The archive only lists finished games, so this is also the
 * fair-play guard: nothing is analysed or shown until chess.com itself has published the result.
 */
export async function findGame(username: string, id: string): Promise<ChessComGame | null> {
  const user = username.toLowerCase();
  const list = await fetch(`${API}/${user}/games/archives`, { cache: "no-store" });
  if (!list.ok) throw new Error(`chess.com archive list returned ${list.status}`);
  const archives: string[] = (await list.json()).archives ?? [];
  for (const url of archives.slice(-2).reverse()) {
    const month = await fetch(url, { cache: "no-store" });
    if (!month.ok) continue;
    const games: ChessComGame[] = (await month.json()).games ?? [];
    const game = games.find((g) => g.url.replace(/\/$/, "").endsWith(`/${id}`));
    if (game) return game;
  }
  return null;
}

export const isPlayer = (game: ChessComGame, username: string) =>
  [game.white.username, game.black.username].some((u) => u.toLowerCase() === username.toLowerCase());
