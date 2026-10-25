// Port of ml/tactics/planes.py: the tactic classifier's input, 32 planes of 8x8 seen from the side to move.
// Keep the two identical; web/scripts/check-planes.ts compares them on fixtures written by the Python side.
import { attacks } from "chessops/attacks";
import { normalizeMove, type Position } from "chessops/chess";
import type { Color, NormalMove, Role } from "chessops/types";
import { parseUci } from "chessops/util";

export const PLANES = 32;
const ROLES: Role[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];

function attackCounts(pos: Position, color: Color, out: Float32Array, base: number, flip: number) {
  for (const square of pos.board[color]) {
    for (const target of attacks(pos.board.get(square)!, square, pos.board.occupied)) out[base + (target ^ flip)] += 1;
  }
}

function pieces(pos: Position, me: Color, out: Float32Array, base: number, flip: number) {
  ROLES.forEach((role, i) => {
    (([me, me === "white" ? "black" : "white"]) as Color[]).forEach((color, j) => {
      for (const square of pos.board.pieces(color, role)) out[base + (6 * j + i) * 64 + (square ^ flip)] = 1;
    });
  });
}

/** Planes for the UCI move `uci` played in `pos`, written into `out` at `offset` (PLANES * 64 floats).
 *  The from/to planes use the UCI squares, so castling is the king's two-square move, as in python-chess. */
export function encode(pos: Position, uci: string, out: Float32Array = new Float32Array(PLANES * 64), offset = 0): Float32Array | null {
  const parsed = parseUci(uci) as NormalMove | undefined;
  if (!parsed || !("from" in parsed)) return null;
  const move = normalizeMove(pos, parsed) as NormalMove;
  if (!pos.isLegal(move)) return null;
  const me = pos.turn;
  const flip = me === "white" ? 0 : 56;
  const after = pos.clone();
  after.play(move);
  out.fill(0, offset, offset + PLANES * 64);
  pieces(pos, me, out, offset, flip);
  pieces(after, me, out, offset + 12 * 64, flip);
  out[offset + 24 * 64 + (parsed.from ^ flip)] = 1;
  out[offset + 25 * 64 + (parsed.to ^ flip)] = 1;
  const them: Color = me === "white" ? "black" : "white";
  attackCounts(pos, me, out, offset + 26 * 64, flip);
  attackCounts(pos, them, out, offset + 27 * 64, flip);
  attackCounts(after, me, out, offset + 28 * 64, flip);
  attackCounts(after, them, out, offset + 29 * 64, flip);
  if (after.isCheck()) out.fill(1, offset + 30 * 64, offset + 31 * 64);
  if (after.isCheckmate()) out.fill(1, offset + 31 * 64, offset + 32 * 64);
  return out;
}
