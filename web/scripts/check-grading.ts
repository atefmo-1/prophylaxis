// Brilliant and Book in the site's TypeScript against the Python reference: the same positions
// (tests/fixtures/grading.json, recorded with src/coach) must give the same answers.
//   node scripts/check-grading.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Chess } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import type { NormalMove } from "chessops/types";
import { parseUci } from "chessops/util";
import { bookPlies, parseBook } from "../src/analysis/book.ts";
import { bestCapture, sacrifice } from "../src/analysis/grading.ts";

const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../tests/fixtures/grading.json"), "utf8")) as {
  sacrifice: { name: string; fen: string; move: string; given: number; best_capture_after: number }[];
  book: { name: string; moves: string[]; book_plies: number }[];
};
const book = parseBook(readFileSync(resolve(import.meta.dirname, "../public/openings/lichess.tsv"), "utf8"));
let failed = 0;
const check = (name: string, got: number, want: number) => {
  if (got !== want) failed++;
  console.log(`${got === want ? "ok  " : "FAIL"} ${name}: ${got}${got === want ? "" : ` (Python: ${want})`}`);
};

console.log(`book: ${book.size} positions`);
for (const c of fixture.sacrifice) {
  const pos = Chess.fromSetup(parseFen(c.fen).unwrap()).unwrap();
  const move = parseUci(c.move) as NormalMove;
  check(`${c.name}, material given up`, sacrifice(pos, move), c.given);
  const after = pos.clone();
  after.play(move);
  check(`${c.name}, best capture after`, bestCapture(after), c.best_capture_after);
}
for (const c of fixture.book) {
  const pos = Chess.default();
  const positions = [pos.clone()];
  for (const san of c.moves) {
    pos.play(parseSan(pos, san)!);
    positions.push(pos.clone());
  }
  check(`${c.name}, moves in book`, bookPlies(book, positions), c.book_plies);
}
process.exit(failed ? 1 : 0);
