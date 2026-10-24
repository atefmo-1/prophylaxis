// Reading a player's games straight from chess.com's public API, in the browser (it allows cross-origin requests).
// Past months never change, so each is fetched once; the current month is fetched on every visit.
import type { ChessComGame } from "../analysis/review";
import { loadMonths, saveMonth, type MonthRecord } from "./store";

const API = "https://api.chess.com/pub/player";

export class PlayerNotFound extends Error {}

/** chess.com's own spelling of the username, or PlayerNotFound. */
export async function findPlayer(username: string): Promise<string> {
  const res = await fetch(`${API}/${encodeURIComponent(username.trim().toLowerCase())}`);
  if (res.status === 404 || res.status === 410) throw new PlayerNotFound(`There's no chess.com player called "${username.trim()}".`);
  if (!res.ok) throw new Error(`chess.com answered ${res.status}. Try again in a minute.`);
  const profile = (await res.json()) as { username: string };
  return profile.username;
}

const isMine = (g: ChessComGame, player: string) =>
  [g.white.username, g.black.username].some((u) => u.toLowerCase() === player.toLowerCase());

/**
 * Standard-chess games of this player, newest first, from the last `months` months, stopping once there are `enough`.
 * Requests go one at a time, as chess.com asks.
 */
export async function fetchGames(player: string, months: number, enough: number): Promise<ChessComGame[]> {
  const user = player.toLowerCase();
  const list = await fetch(`${API}/${user}/games/archives`);
  if (!list.ok) throw new Error(`chess.com answered ${list.status} for the game archive.`);
  const archives: string[] = ((await list.json()).archives ?? []).slice(-months);
  const known = new Map((await loadMonths(user)).map((m) => [m.url, m]));
  const current = archives[archives.length - 1];
  const out: ChessComGame[] = [];
  for (const url of [...archives].reverse()) {
    if (out.length >= enough) break;
    let month: MonthRecord | undefined = known.get(url);
    if (!month || url === current) {
      const res = await fetch(url, { cache: "no-cache" });
      // chess.com sometimes lists a past month it doesn't serve; remember it as empty rather than asking every visit.
      if (!res.ok && !(res.status === 404 && url !== current)) continue;
      const games: ChessComGame[] = res.ok
        ? ((await res.json()).games ?? []).filter((g: ChessComGame) => g.rules === "chess" && g.pgn && isMine(g, user))
        : [];
      month = { player: user, url, games, fetched: Date.now() };
      await saveMonth(month);
    }
    out.push(...month.games);
  }
  return out.sort((a, b) => b.end_time - a.end_time);
}

export const gameId = (g: ChessComGame) => g.url.replace(/\/$/, "").split("/").pop()!;
