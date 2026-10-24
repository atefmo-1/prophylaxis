// TypeScript port of src/coach/grading.py: win %, accuracy, move classes, game phase.
// Formulas are Lichess's published ones; class thresholds follow chess.com's expected-points scale.
import type { Position } from "chessops/chess";
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
