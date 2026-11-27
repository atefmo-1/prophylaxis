// Reading a player's games from Lichess's public API, in the browser (it allows cross-origin requests). The games
// come back in the same shape as chess.com's, so everything after this file treats the two sites alike. They're kept
// in this browser, and each later visit asks only for games played since the newest one kept.
import type { ChessComGame } from "../analysis/review";
import { nameOf } from "../lib/player";
import { PlayerNotFound } from "./chesscom";
import { loadMonths, saveMonth } from "./store";

const API = "https://lichess.org/api";
const DAY_MS = 24 * 3600 * 1000;

function trouble(status: number): Error {
  return new Error(status === 429 ? "Lichess asked for a pause. Try again in a minute." : `Lichess answered ${status}. Try again in a minute.`);
}

/** Lichess's own spelling of the username, or PlayerNotFound. */
export async function findPlayer(username: string): Promise<string> {
  const typed = username.trim();
  const res = await fetch(`${API}/user/${encodeURIComponent(typed)}`);
  if (res.status === 404) throw new PlayerNotFound(`There's no Lichess player called "${typed}".`);
  if (!res.ok) throw trouble(res.status);
  const profile = (await res.json()) as { username: string; disabled?: boolean; closed?: boolean };
  if (profile.disabled || profile.closed) throw new PlayerNotFound(`The Lichess account "${profile.username}" is closed.`);
  return profile.username;
}

interface LichessSide {
  user?: { name: string };
  rating?: number;
  aiLevel?: number;
}

interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  winner?: "white" | "black";
  players: { white: LichessSide; black: LichessSide };
  opening?: { eco: string; name: string };
  clock?: { initial: number; increment: number };
  pgn?: string;
}

// Lichess's ways a game ends, as chess.com's result codes for the side that didn't win (catalog.ts ENDINGS). A draw
// Lichess doesn't break down (agreement, repetition, the 50-move rule) is "drawn", shown simply as "Draw".
const LOSER: Record<string, string> = { mate: "checkmated", resign: "resigned", outoftime: "timeout", timeout: "abandoned" };
const DRAWN: Record<string, string> = { stalemate: "stalemate", draw: "drawn", insufficientMaterialClaim: "insufficient", outoftime: "timevsinsufficient" };
// Lichess's classical games count as rapid, the slowest class chess.com has apart from daily games.
const CLASS: Record<string, string> = { ultraBullet: "bullet", bullet: "bullet", blitz: "blitz", rapid: "rapid", classical: "rapid" };

/** A Lichess game in chess.com's shape, or null for one the coach doesn't review (a variant, a game against the
 * computer or an anonymous player, an aborted game). */
export function fromLichess(g: LichessGame): (ChessComGame & { rated: boolean }) | null {
  const { white, black } = g.players;
  if (g.variant !== "standard" || !g.pgn || !g.clock || !white.user || !black.user || !CLASS[g.speed]) return null;
  const result = (color: "white" | "black") =>
    g.winner === color ? "win" : g.winner ? LOSER[g.status] : DRAWN[g.status];
  if (!result("white") || !result("black")) return null;
  // The opening's name, written the way chess.com's opening addresses are, which review.ts's openingParts reads.
  const slug = (g.opening?.name ?? "").replace(/'/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    url: `https://lichess.org/${g.id}`,
    pgn: g.pgn,
    time_control: g.clock.increment ? `${g.clock.initial}+${g.clock.increment}` : String(g.clock.initial),
    time_class: CLASS[g.speed],
    end_time: Math.round(g.lastMoveAt / 1000),
    rules: "chess",
    eco: slug ? `https://lichess.org/opening/${slug}` : undefined,
    white: { username: white.user.name, rating: white.rating ?? 0, result: result("white") },
    black: { username: black.user.name, rating: black.rating ?? 0, result: result("black") },
    rated: g.rated,
  };
}

async function download(name: string, since: number, max: number): Promise<ChessComGame[]> {
  const params = new URLSearchParams({
    max: String(max),
    since: String(since),
    perfType: "ultraBullet,bullet,blitz,rapid,classical",
    clocks: "true",
    opening: "true",
    pgnInJson: "true",
  });
  const res = await fetch(`${API}/games/user/${encodeURIComponent(name)}?${params}`, { headers: { Accept: "application/x-ndjson" } });
  if (res.status === 404) throw new PlayerNotFound(`There's no Lichess player called "${name}".`);
  if (!res.ok) throw trouble(res.status);
  return (await res.text())
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => fromLichess(JSON.parse(line) as LichessGame))
    .filter((g) => g !== null);
}

/**
 * Standard-chess games of this player ("lichess:name"), newest first, from the last `months` months, at most
 * `enough`. The games already kept are reused; only newer ones are asked for.
 */
export async function fetchGames(player: string, months: number, enough: number): Promise<ChessComGame[]> {
  const key = player.toLowerCase();
  const name = nameOf(player);
  const url = `${API}/games/user/${name.toLowerCase()}`;
  const kept = (await loadMonths(key)).find((m) => m.url === url);
  const from = Date.now() - months * 30.5 * DAY_MS;
  // Kept games are enough only if they were fetched asking for at least as many as now.
  const reuse = kept && (kept.asked ?? 0) >= enough ? kept.games : [];
  const newest = reuse.reduce((t, g) => Math.max(t, g.end_time * 1000 + 1), from);
  const fresh = await download(name, newest, enough);
  const seen = new Set(fresh.map((g) => g.url));
  const games = [...fresh, ...reuse.filter((g) => !seen.has(g.url))]
    .filter((g) => g.end_time * 1000 >= from)
    .sort((a, b) => b.end_time - a.end_time)
    .slice(0, enough);
  await saveMonth({ player: key, url, games, fetched: Date.now(), asked: Math.max(enough, kept?.asked ?? 0) });
  return games;
}
