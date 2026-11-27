// Which site a player's games come from. A chess.com player is kept as their username, a Lichess player as
// "lichess:" and their username, so two people with the same name on the two sites never share stored games.
// No imports: the review code and the extension use it too.

export type Site = "chesscom" | "lichess";

const LICHESS = "lichess:";

export const siteOf = (player: string): Site => (player.toLowerCase().startsWith(LICHESS) ? "lichess" : "chesscom");

/** The username on the player's own site, as games name them. */
export const nameOf = (player: string): string => (siteOf(player) === "lichess" ? player.slice(LICHESS.length) : player);

export const playerOn = (site: Site, username: string): string => (site === "lichess" ? `${LICHESS}${username}` : username);

export const SITE_NAMES: Record<Site, string> = { chesscom: "chess.com", lichess: "Lichess" };

export const siteName = (player: string): string => SITE_NAMES[siteOf(player)];

/** Whether a username in a game is this player: `who` may carry the "lichess:" prefix. */
export const isPlayer = (username: string, who: string): boolean => username.toLowerCase() === nameOf(who).toLowerCase();

export const profileUrl = (player: string): string =>
  siteOf(player) === "lichess"
    ? `https://lichess.org/@/${encodeURIComponent(nameOf(player))}`
    : `https://www.chess.com/member/${encodeURIComponent(player)}`;

/** Where a game can be opened, from its address: "chess.com", "Lichess", or null for the made-up sample games. */
export function gameSite(url: string): string | null {
  if (url.startsWith("https://www.chess.com/")) return SITE_NAMES.chesscom;
  if (url.startsWith("https://lichess.org/")) return SITE_NAMES.lichess;
  return null;
}
