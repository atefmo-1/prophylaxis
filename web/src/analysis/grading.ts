// TypeScript port of src/coach/grading.py: win %, accuracy, move classes, game phase.
// Formulas are Lichess's published ones; class thresholds follow chess.com's expected-points scale.
import { Chess, type Position } from "chessops/chess";
import type { NormalMove, Role, Square } from "chessops/types";
import { opposite } from "chessops/util";
import type { MoveClass } from "../types";

export interface Line {
  cp: number | null; // white POV
  mate: number | null; // white POV
  pv: string[]; // UCI
}

const THRESHOLDS: [number, MoveClass][] = [
  [2, "excellent"],
  [5, "good"],
  [10, "inaccuracy"],
  [20, "mistake"],
];

export const BOOK_MAX_LOSS = 10; // a known opening move the engine calls a mistake stays a mistake
const BRILLIANT_MAX_LOSS = 2; // the best move or close to it (excellent)
const BRILLIANT_MAX_WIN = 90; // not already winning anyway
const BRILLIANT_MIN_AFTER = 50; // and still at least level after it
const SACRIFICE_MIN = 2; // material given up, in pawns (an exchange sacrifice counts)
const VALUES: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

export const winFromCp = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

export function lineWinWhite(line: Pick<Line, "cp" | "mate">): number {
  if (line.mate !== null) return line.mate > 0 ? 100 : 0;
  return winFromCp(line.cp ?? 0);
}

export const pov = (winWhite: number, white: boolean) => (white ? winWhite : 100 - winWhite);

export function moveAccuracy(before: number, after: number): number {
  if (after >= before) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411;
  return Math.min(100, Math.max(0, raw + 1));
}

export function classify(loss: number, playedBest: boolean): MoveClass {
  if (playedBest) return "best";
  for (const [bound, name] of THRESHOLDS) if (loss < bound) return name;
  return "blunder";
}

function pstdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** Per-side game accuracy (white, black) from white's win % at the start and after every ply. */
export function gameAccuracy(winWhite: number[]): [number | null, number | null] {
  const n = winWhite.length - 1;
  if (n < 2) return [null, null];
  const window = Math.min(Math.max(Math.floor(n / 10), 2), 8);
  const windows: number[][] = [];
  for (let i = 0; i < window - 2; i++) windows.push(winWhite.slice(0, window));
  for (let i = 0; i + window <= winWhite.length; i++) windows.push(winWhite.slice(i, i + window));
  const weights = windows.map((w) => Math.min(Math.max(pstdev(w), 0.5), 12));
  const sides: [number, number][][] = [[], []];
  for (let i = 0; i < n; i++) {
    const white = i % 2 === 0;
    sides[white ? 0 : 1].push([moveAccuracy(pov(winWhite[i], white), pov(winWhite[i + 1], white)), weights[i]]);
  }
  return sides.map((items) => {
    if (!items.length) return null;
    const weighted = items.reduce((a, [acc, w]) => a + acc * w, 0) / items.reduce((a, [, w]) => a + w, 0);
    const harmonic = items.length / items.reduce((a, [acc]) => a + 1 / Math.max(acc, 1), 0);
    return (weighted + harmonic) / 2;
  }) as [number | null, number | null];
}

export function phase(pos: Position, ply: number): "opening" | "middlegame" | "endgame" {
  const b = pos.board;
  const pieces = b.knight.union(b.bishop).union(b.rook).union(b.queen).size();
  if (pieces <= 6) return "endgame";
  return ply <= 20 ? "opening" : "middlegame";
}

// Brilliant: chess.com's "a good piece sacrifice". The material is counted with a static exchange: capture on a
// square and keep trading there, each side using its least valuable piece and stopping when trading on loses.
// Mirrors src/coach/grading.py.
function captured(pos: Position, move: NormalMove): number {
  const victim = pos.board.get(move.to);
  if (victim) return victim.color === pos.turn ? 0 : VALUES[victim.role]; // castling lands on the own rook
  return pos.board.getRole(move.from) === "pawn" && move.to === pos.epSquare ? VALUES.pawn : 0;
}

const isCapture = (pos: Position, move: NormalMove) => captured(pos, move) > 0;

/** Legal captures for the side to move, promoting to a queen (other promotions are left out, as in Python). */
function captures(pos: Position, onto?: Square): NormalMove[] {
  const out: NormalMove[] = [];
  for (const [from, dests] of pos.allDests()) {
    const pawn = pos.board.getRole(from) === "pawn";
    for (const to of dests) {
      if (onto !== undefined && to !== onto) continue;
      const move: NormalMove = { from, to };
      if (pawn && (to >> 3 === 0 || to >> 3 === 7)) move.promotion = "queen";
      if (isCapture(pos, move)) out.push(move);
    }
  }
  return out;
}

/** The side to move's legal capture on `square` with its least valuable piece (a king last). */
function cheapestCapture(pos: Position, square: Square): NormalMove | null {
  let best: NormalMove | null = null;
  let bestRank = 100;
  for (const move of captures(pos, square)) {
    const role = pos.board.getRole(move.from)!;
    const rank = role === "king" ? 99 : VALUES[role];
    if (rank < bestRank) [best, bestRank] = [move, rank];
  }
  return best;
}

/** What the side to move wins by making capture `move` and trading on that square afterwards. */
export function exchange(pos: Position, move: NormalMove): number {
  let won = captured(pos, move);
  const next = pos.clone();
  next.play(move);
  const reply = cheapestCapture(next, move.to);
  if (reply) won -= Math.max(0, exchange(next, reply));
  return won;
}

/** The most material the side to move can win with one capture and the trades after it (0 if none). */
export const bestCapture = (pos: Position) => Math.max(0, ...captures(pos).map((m) => exchange(pos, m)));

/** Material the move gives up: what the opponent can now win, less what the move took and what was already there
 * for the taking before it (0 if it gives nothing up). */
export function sacrifice(before: Position, move: NormalMove): number {
  const after = before.clone();
  after.play(move);
  const given = bestCapture(after);
  if (given === 0) return 0;
  let already = 0;
  if (!before.isCheck()) {
    const setup = before.toSetup();
    const passed = Chess.fromSetup({ ...setup, turn: opposite(setup.turn), epSquare: undefined });
    if (passed.isOk) already = bestCapture(passed.value);
  }
  return given > already ? given - captured(before, move) : 0;
}

export function isBrilliant(before: Position, move: NormalMove, winBefore: number, winAfter: number, winLoss: number): boolean {
  return (
    winLoss < BRILLIANT_MAX_LOSS &&
    winBefore < BRILLIANT_MAX_WIN &&
    winAfter >= BRILLIANT_MIN_AFTER &&
    !before.isCheck() &&
    !move.promotion &&
    sacrifice(before, move) >= SACRIFICE_MIN
  );
}
