// Shared by the extension's background worker, offscreen engine page, content script and side panel.
import type { ChessComGame, Frame } from "../../src/analysis/review";
import type { GameFacts } from "../../src/analysis/stats";
import type { Color, Weakness } from "../../src/types";

export interface Settings {
  username: string; // empty until the player sets it in the panel
  siteUrl: string;
  autoOpen: boolean;
}

export const DEFAULTS: Settings = {
  username: "",
  siteUrl: "https://atefmo-1.github.io/prophylaxis/",
  autoOpen: true,
};

// The old default, from before the site was deployed. Saving Settings stored it, so treat it as "not set".
const OLD_DEFAULT_SITE = "http://localhost:5173/";

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get({ ...DEFAULTS } as Record<string, unknown>);
  return {
    username: String(stored.username || DEFAULTS.username),
    siteUrl: String(stored.siteUrl && stored.siteUrl !== OLD_DEFAULT_SITE ? stored.siteUrl : DEFAULTS.siteUrl),
    autoOpen: stored.autoOpen !== false,
  };
}

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
/** Who played a reviewed game and what the site's statistics need about it, so the site can take the review over. */
export const factsKey = (id: string) => `facts:${id}`;
export interface ReviewFacts {
  player: string;
  facts: GameFacts;
  version: number;
}
/** The player's habits as the site last worked them out, so a review here can say "your #2 habit". */
export const habitsKey = (player: string) => `habits:${player.toLowerCase()}`;
export type SiteHabits = Pick<Weakness, "tag" | "windows">[];
/** The player the site was last opened for, offered when the panel asks for a username. */
export const SITE_PLAYER = "sitePlayer";

export type Message =
  | { type: "check"; id: string }
  | { type: "analyse"; id: string }
  | { type: "open-panel"; id: string; mode: "summary" | "moments" }
  | { type: "await"; id: string }
  | { type: "game-over"; id: string; open: boolean; gesture: boolean }
  | { type: "progress"; id: string; percent: number; frame?: Frame; meta?: { color: Color; opponent: string; plies: number } }
  | { type: "done"; id: string; review: unknown; facts: ReviewFacts }
  | { type: "failed"; id: string; message: string }
  // Offscreen documents can't read chrome.storage, so the worker sends the player's habits along.
  | { target: "offscreen"; type: "analyse"; id: string; username: string; habits: SiteHabits | null }
  // From the site, through the bridge script on its page (public/site-bridge.js)
  | { type: "site:hello"; player: string | null }
  | { type: "site:reviews"; player: string }
  | { type: "site:habits"; player: string; habits: SiteHabits };

export type CheckResult = "finished" | "not-found" | "not-mine" | "no-player";
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
