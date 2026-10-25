// TypeScript port of src/coach/motifs.py: name the kind of mistake behind a bad move, checked against engine lines.
import { attacks } from "chessops/attacks";
import { normalizeMove, type Position } from "chessops/chess";
import { makeSquare, parseUci } from "chessops/util";
import type { Color, Move as CMove, NormalMove, Role, Square } from "chessops/types";
import type { Line } from "./grading";

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const HORIZON = 9;
const MATERIAL_SWING = 2;
const ALLOWED_MIN_LOSS = 10;
const MISSED_MIN_LOSS = 5;
const MATE_HORIZON = 3;
const TIME_PRESSURE_S = 60;
const RUSHED_S = 3;
const RUSHED_MIN_CLOCK_S = 120;

export type Tag = [string, Record<string, unknown>];

/** A UCI move from the engine as chessops plays it (castling is king-onto-rook internally). */
export function toMove(pos: Position, uci: string): NormalMove | null {
  const move = parseUci(uci) as NormalMove | undefined;
  return move ? (normalizeMove(pos, move) as NormalMove) : null;
}

function material(pos: Position, color: Color): number {
  let total = 0;
  for (const role of Object.keys(VALUE) as Role[]) {
    const pieces = pos.board.pieces(color, role).size() - pos.board.pieces(color === "white" ? "black" : "white", role).size();
    total += VALUE[role] * pieces;
  }
  return total;
}

function play(pos: Position, ucis: string[], limit = HORIZON): Position {
  const p = pos.clone();
  for (const uci of ucis.slice(0, limit)) {
    const move = toMove(p, uci);
    if (!move || !p.isLegal(move)) break;
    p.play(move);
  }
  return p;
}

const moverMate = (line: Line | undefined, color: Color) => (!line || line.mate === null ? null : color === "white" ? line.mate : -line.mate);

function defended(pos: Position, square: Square, by: Color): boolean {
  return pos.kingAttackers(square, by, pos.board.occupied).nonEmpty();
}

/** The captured piece was undefended, or taken by something cheaper (pos: before the capture). */
function isEnPrise(pos: Position, move: NormalMove): boolean {
  const victim = pos.board.get(move.to);
  const attacker = pos.board.get(move.from);
  if (!victim || !attacker) return false;
  return !defended(pos, move.to, victim.color) || VALUE[attacker.role] < VALUE[victim.role];
}

const isCapture = (pos: Position, move: NormalMove) => !!pos.board.get(move.to) && pos.board.get(move.to)!.color !== pos.turn;

/** Pieces the just-moved piece attacks that it could win (pos: after the move). Two or more = fork. */
function forkTargets(pos: Position, to: Square): Square[] {
  const piece = pos.board.get(to);
  if (!piece) return [];
  const attackerValue = piece.role === "king" ? 100 : VALUE[piece.role];
  const targets: Square[] = [];
  for (const sq of attacks(piece, to, pos.board.occupied)) {
    const victim = pos.board.get(sq);
    if (!victim || victim.color === piece.color) continue;
    const winnable = VALUE[victim.role] >= 3 && (VALUE[victim.role] > attackerValue || !defended(pos, sq, victim.color));
    if (victim.role === "king" || winnable) targets.push(sq);
  }
  return targets.length >= 2 ? targets : [];
}

function isBackRankMate(pos: Position, line: string[]): boolean {
  const p = pos.clone();
  let last: NormalMove | null = null;
  for (const uci of line) {
    const move = toMove(p, uci);
    if (!move || !p.isLegal(move)) return false;
    p.play(move);
    last = move;
  }
  if (!p.isCheckmate() || !last) return false;
  const king = p.board.kingOf(p.turn);
  const mater = p.board.get(last.to);
  const backRank = p.turn === "white" ? 0 : 7;
  if (king === undefined || king >> 3 !== backRank) return false;
  // Boxed in: every square in front of the king holds one of its own pieces.
  const inFront = backRank + (p.turn === "white" ? 1 : -1);
  for (let f = Math.max(0, (king & 7) - 1); f <= Math.min(7, (king & 7) + 1); f++) {
    if (p.board.get(inFront * 8 + f)?.color !== p.turn) return false;
  }
  return !!mater && (mater.role === "rook" || mater.role === "queen") && last.to >> 3 === backRank;
}

const name = (pos: Position, sq: Square) => pos.board.get(sq)?.role ?? "piece";

export function detect(
  before: Position,
  move: CMove,
  linesBefore: Line[],
  linesAfter: Line[] | null,
  winLoss: number,
  clockBefore: number | null,
  timeSpent: number | null,
): Tag[] {
  const me = before.turn;
  const after = before.clone();
  after.play(move);
  const tags: Tag[] = [];
  const bestPv = linesBefore[0]?.pv ?? [];
  const replyPv = linesAfter?.[0]?.pv ?? [];
  const start = material(before, me);
  const gainBest = material(play(before, bestPv), me) - start;
  const gainPlayed = material(play(after, replyPv, HORIZON - 1), me) - start;

  if (winLoss >= ALLOWED_MIN_LOSS) {
    const against = moverMate(linesAfter?.[0], me);
    const bestMate = moverMate(linesBefore[0], me);
    if (after.isStalemate()) tags.push(["allowed_stalemate", {}]);
    else if (against !== null && against < 0 && against >= -MATE_HORIZON && !(bestMate !== null && bestMate < 0)) {
      tags.push(["allowed_mate", { in: -against }]);
      if (isBackRankMate(after, replyPv)) tags.push(["back_rank_mate", {}]);
    } else if (gainPlayed <= -MATERIAL_SWING && gainBest - gainPlayed >= MATERIAL_SWING && replyPv.length) {
      const reply = toMove(after, replyPv[0])!;
      const victim = after.board.get(reply.to);
      if (isCapture(after, reply) && victim && VALUE[victim.role] >= 3 && isEnPrise(after, reply)) {
        tags.push(["hanging_piece", { piece: victim.role, square: makeSquare(reply.to) }]);
      } else {
        const p = after.clone();
        p.play(reply);
        const targets = forkTargets(p, reply.to);
        if (targets.length) tags.push(["allowed_fork", { by: name(p, reply.to), targets: targets.map((t) => name(p, t)) }]);
        else tags.push(["lost_material", { amount: -gainPlayed }]);
      }
    }
  }

  if (winLoss >= MISSED_MIN_LOSS && bestPv.length) {
    const bestMate = moverMate(linesBefore[0], me);
    const mateAfter = moverMate(linesAfter?.[0], me);
    const best = toMove(before, bestPv[0])!;
    const forcing = isCapture(before, best) || (() => {
      const p = before.clone();
      p.play(best);
      return p.isCheck();
    })();
    if (bestMate !== null && bestMate > 0 && bestMate <= MATE_HORIZON && !after.isCheckmate()) {
      if (mateAfter === null || mateAfter <= 0) tags.push(["missed_mate", { in: bestMate }]);
    } else if (forcing && gainBest >= MATERIAL_SWING && gainBest - gainPlayed >= MATERIAL_SWING) {
      const victim = before.board.get(best.to);
      if (isCapture(before, best) && victim && VALUE[victim.role] >= 3 && isEnPrise(before, best)) {
        tags.push(["missed_free_piece", { piece: victim.role }]);
      } else {
        const p = before.clone();
        p.play(best);
        const targets = forkTargets(p, best.to);
        if (targets.length) tags.push(["missed_fork", { by: name(p, best.to), targets: targets.map((t) => name(p, t)) }]);
        else tags.push(["missed_tactic", { amount: gainBest - gainPlayed }]);
      }
    }
  }

  if (winLoss >= ALLOWED_MIN_LOSS && clockBefore !== null) {
    if (clockBefore < TIME_PRESSURE_S) tags.push(["time_pressure", { clock: Math.round(clockBefore) }]);
    else if (timeSpent !== null && timeSpent < RUSHED_S && clockBefore >= RUSHED_MIN_CLOCK_S) {
      tags.push(["rushed", { seconds: Math.round(timeSpent * 10) / 10 }]);
    }
  }
  return tags;
}
