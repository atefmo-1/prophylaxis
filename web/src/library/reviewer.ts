// Reviewing one chess.com game in this browser, on the device's engines with the tactic model and the opening book.
// The player's library and comparisons with other players both use it.
import { loadBook, type OpeningBook } from "../analysis/book";
import { buildReview, gameFacts, type ChessComGame, type Progress } from "../analysis/review";
import { ANALYSIS_VERSION, type StoredGame } from "../analysis/stats";
import { loadTacticModel, type TacticModel } from "../analysis/tactics";
import type { Device } from "./device";

let tactics: Promise<TacticModel | null> | null = null;
export const getTactics = () => (tactics ??= loadTacticModel(import.meta.env.BASE_URL));
let book: Promise<OpeningBook | null> | null = null;
export const getBook = () => (book ??= loadBook(import.meta.env.BASE_URL));

/** One game, reviewed from `who`'s side, ready to keep. */
export async function reviewGame(game: ChessComGame, who: string, device: Device, progress?: Progress): Promise<StoredGame> {
  const [model, openings] = await Promise.all([getTactics(), getBook()]);
  const review = await buildReview(game, who, device.pool, null, progress, { tactics: model, book: openings });
  return { review, facts: gameFacts(game, who), version: ANALYSIS_VERSION, tagged: model?.version };
}
