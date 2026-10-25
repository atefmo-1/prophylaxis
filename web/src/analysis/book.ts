// The opening book: every position reached by a named line in Lichess's openings list (CC0, public/openings), so a
// review can mark moves that are known theory, as chess.com's "Book" does. Mirrors src/coach/book.py.
import { Chess, type Position } from "chessops/chess";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";

export type OpeningBook = Set<string>;

/** Pieces, side to move and castling rights: the same position by any move order. */
export const bookKey = (pos: Position) => makeFen(pos.toSetup()).split(" ").slice(0, 3).join(" ");

export function parseBook(tsv: string): OpeningBook {
  const book: OpeningBook = new Set();
  for (const row of tsv.split("\n").slice(1)) {
    const pgn = row.split("\t")[2];
    if (!pgn) continue;
    const pos = Chess.default();
    for (const token of pgn.trim().split(/\s+/)) {
      if (token.endsWith(".")) continue;
      const move = parseSan(pos, token);
      if (!move) break;
      pos.play(move);
      book.add(bookKey(pos));
    }
  }
  return book;
}

/** The book, or null if it can't be loaded (reviews then simply have no Book moves). */
export async function loadBook(base: string): Promise<OpeningBook | null> {
  try {
    const res = await fetch(`${base}openings/lichess.tsv`);
    if (!res.ok) return null;
    const book = parseBook(await res.text());
    return book.size ? book : null;
  } catch {
    return null;
  }
}

const START = makeFen(Chess.default().toSetup());

/** How many moves from the start of a game stay in the book (positions: the start and the position after each move). */
export function bookPlies(book: OpeningBook, positions: Position[]): number {
  if (makeFen(positions[0].toSetup()) !== START) return 0;
  let plies = 0;
  for (const pos of positions.slice(1)) {
    if (!book.has(bookKey(pos))) break;
    plies++;
  }
  return plies;
}

/** Lichess's name for each line, by the position it ends in ("Sicilian Defense: Alapin Variation"). */
export function parseNames(tsv: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of tsv.split("\n").slice(1)) {
    const [, name, pgn] = row.split("\t");
    if (!name || !pgn) continue;
    const pos = Chess.default();
    let ok = true;
    for (const token of pgn.trim().split(/\s+/)) {
      if (token.endsWith(".")) continue;
      const move = parseSan(pos, token);
      if (!move) {
        ok = false;
        break;
      }
      pos.play(move);
    }
    const key = bookKey(pos);
    if (ok && !names.has(key)) names.set(key, name);
  }
  return names;
}

let names: Promise<Map<string, string>> | null = null;

/** Opening names, loaded once; empty if the list can't be loaded. */
export function loadOpeningNames(base: string): Promise<Map<string, string>> {
  return (names ??= fetch(`${base}openings/lichess.tsv`)
    .then((res) => (res.ok ? res.text() : ""))
    .then(parseNames)
    .catch(() => new Map()));
}
