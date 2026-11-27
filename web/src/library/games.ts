// Where a player's games come from: chess.com or Lichess (lib/player.ts says which).
import { nameOf, playerOn, siteOf, type Site } from "../lib/player";
import * as chesscom from "./chesscom";
import * as lichess from "./lichess";

export { PlayerNotFound, gameId } from "./chesscom";

/** The player as kept here ("name" or "lichess:name", in the site's spelling), or PlayerNotFound. A name typed with
 * "lichess:" in front is looked up on Lichess whichever site is chosen. */
export async function findPlayer(typed: string, site: Site): Promise<string> {
  const on: Site = siteOf(typed.trim()) === "lichess" ? "lichess" : site;
  const name = nameOf(typed.trim());
  return playerOn(on, on === "lichess" ? await lichess.findPlayer(name) : await chesscom.findPlayer(name));
}

/** The player's standard-chess games, newest first, from the last `months` months, stopping once there are `enough`. */
export const fetchGames = (player: string, months: number, enough: number) =>
  siteOf(player) === "lichess" ? lichess.fetchGames(player, months, enough) : chesscom.fetchGames(player, months, enough);
