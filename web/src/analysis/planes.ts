// Port of ml/tactics/planes.py: the tactic classifier's input, planes of 8x8 seen from the side to move, for a key
// move and the next few moves of the line after it. Keep the two identical; web/scripts/check-planes.ts compares
// them on fixtures written by the Python side.
import { attacks } from "chessops/attacks";
import { normalizeMove, type Position } from "chessops/chess";
import type { Color, NormalMove, Role } from "chessops/types";
import { parseUci } from "chessops/util";

const LINE_PLIES = 4;
const PER_PLY = 16;
export const PLANES = 32 + LINE_PLIES * PER_PLY;
const ROLES: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const MAX_PLIES = 7;
const MATE_PLIES = 5;

const other = (c: Color): Color => (c === "white" ? "black" : "white");

function material(pos: Position, color: Color): number {
  let total = 0;
  for (const role of ROLES) total += VALUE[role] * (pos.board.pieces(color, role).size() - pos.board.pieces(other(color), role).size());
  return total;
}

/** The UCI move as chessops plays it, or null if it isn't legal here. */
function legal(pos: Position, uci: string): NormalMove | null {
  const parsed = parseUci(uci) as NormalMove | undefined;
  if (!parsed || !("from" in parsed)) return null;
  const move = normalizeMove(pos, parsed) as NormalMove;
  return pos.isLegal(move) ? move : null;
}

/** An engine line cut where the tactic is over: at mate, or at the first move of the side to move after which they
 *  are at least 2 points up and still are after the reply. Null if neither happens within MAX_PLIES. */
export function tacticLine(pos: Position, line: string[]): string[] | null {
  const me = pos.turn;
  const start = material(pos, me);
  const p = pos.clone();
  for (let i = 0; i < Math.min(line.length, MAX_PLIES); i++) {
    const move = legal(p, line[i]);
    if (!move) return null;
    p.play(move);
    if (p.isCheckmate()) return i < MATE_PLIES ? line.slice(0, i + 1) : null;
    if (i % 2 === 0 && material(p, me) - start >= 2) {
      if (i + 1 >= line.length) return line.slice(0, i + 1);
      const reply = legal(p, line[i + 1]);
      if (!reply) return line.slice(0, i + 1);
      const q = p.clone();
      q.play(reply);
      if (material(q, me) - start >= 2) return line.slice(0, i + 1);
    }
  }
  return null;
}

/** What the model sees of a line: the tactic part if the line has one, else just its first move. */
export const modelLine = (pos: Position, line: string[]): string[] => tacticLine(pos, line) ?? line.slice(0, 1);

function attackCounts(pos: Position, color: Color, out: Float32Array, base: number, flip: number) {
  for (const square of pos.board[color]) {
    for (const target of attacks(pos.board.get(square)!, square, pos.board.occupied)) out[base + (target ^ flip)] += 1;
  }
}

function pieces(pos: Position, me: Color, out: Float32Array, base: number, flip: number) {
  ROLES.forEach((role, i) => {
    [me, other(me)].forEach((color, j) => {
      for (const square of pos.board.pieces(color, role)) out[base + (6 * j + i) * 64 + (square ^ flip)] = 1;
    });
  });
}

/** Planes for `line` (its first move is the key move) played from `pos`, written into `out` at `offset`
 *  (PLANES * 64 floats). From/to planes use the UCI squares, so castling is the king's two-square move. */
export function encode(pos: Position, line: string[], out: Float32Array = new Float32Array(PLANES * 64), offset = 0): Float32Array | null {
  const move = legal(pos, line[0]);
  if (!move) return null;
  const first = parseUci(line[0]) as NormalMove;
  const me = pos.turn;
  const flip = me === "white" ? 0 : 56;
  const after = pos.clone();
  after.play(move);
  out.fill(0, offset, offset + PLANES * 64);
  pieces(pos, me, out, offset, flip);
  pieces(after, me, out, offset + 12 * 64, flip);
  out[offset + 24 * 64 + (first.from ^ flip)] = 1;
  out[offset + 25 * 64 + (first.to ^ flip)] = 1;
  attackCounts(pos, me, out, offset + 26 * 64, flip);
  attackCounts(pos, other(me), out, offset + 27 * 64, flip);
  attackCounts(after, me, out, offset + 28 * 64, flip);
  attackCounts(after, other(me), out, offset + 29 * 64, flip);
  if (after.isCheck()) out.fill(1, offset + 30 * 64, offset + 31 * 64);
  if (after.isCheckmate()) out.fill(1, offset + 31 * 64, offset + 32 * 64);
  for (let k = 0; k < Math.min(LINE_PLIES, line.length - 1); k++) {
    const next = legal(after, line[k + 1]);
    if (!next) break;
    const uci = parseUci(line[k + 1]) as NormalMove;
    after.play(next);
    const base = offset + (32 + k * PER_PLY) * 64;
    pieces(after, me, out, base, flip);
    out[base + 12 * 64 + (uci.from ^ flip)] = 1;
    out[base + 13 * 64 + (uci.to ^ flip)] = 1;
    out.fill(1, base + 14 * 64, base + 15 * 64);
    if (after.isCheckmate()) out.fill(1, base + 15 * 64, base + 16 * 64);
  }
  return out;
}
