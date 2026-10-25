// The tactic drawn on the board: after a move, thin arrows to every piece of the other side that it newly attacks
// (the moved piece, or a piece it uncovers), continued through to a second piece behind, which is how a fork,
// a discovered attack, a pin or a skewer looks.
import { attacks, ray } from "chessops/attacks";
import type { Position } from "chessops/chess";
import { makeSquare } from "chessops/util";
import type { Role, Square } from "chessops/types";
import type { Arrow } from "../components/Board";
import { playUci, position } from "./rules";

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
const SLIDERS: Role[] = ["bishop", "rook", "queen"];

function attacked(pos: Position, by: "white" | "black"): Map<Square, Square[]> {
  const out = new Map<Square, Square[]>();
  for (const from of pos.board[by]) {
    for (const to of attacks(pos.board.get(from)!, from, pos.board.occupied)) {
      if (pos.board.get(to)?.color === (by === "white" ? "black" : "white")) out.set(to, [...(out.get(to) ?? []), from]);
    }
  }
  return out;
}

/** The move's arrow plus what it attacks, in `brush` (the move) and its target brush. */
export function tacticArrows(fen: string, uci: string, brush: "best" | "threat"): Arrow[] {
  const after = playUci(fen, uci);
  if (!after) return [];
  const before = position(fen);
  const pos = position(after);
  const mover = before.turn;
  const target = brush === "best" ? "bestTarget" : "threatTarget";
  const old = attacked(before, mover);
  const arrows: Arrow[] = [{ uci, brush }];
  const seen = new Set<string>();
  for (const [victim, attackers] of attacked(pos, mover)) {
    const piece = pos.board.get(victim)!;
    const defended = pos.kingAttackers(victim, piece.color, pos.board.occupied).nonEmpty();
    for (const from of attackers) {
      const isNew = !(old.get(victim) ?? []).includes(from);
      const worth = VALUE[piece.role] >= 3 || !defended;
      if (!isNew || !worth || from === victim) continue;
      const line = `${makeSquare(from)}${makeSquare(victim)}`;
      if (line === uci || seen.has(line)) continue;
      seen.add(line);
      arrows.push({ uci: line, brush: target });
      // A slider's line goes on: a second piece of theirs right behind is what a pin or a skewer wins.
      if (SLIDERS.includes(pos.board.get(from)!.role)) {
        const behind = [...ray(from, victim)].filter((s) => s !== from && s !== victim && between(from, victim, s));
        const next = behind.sort((a, b) => dist(victim, a) - dist(victim, b)).find((s) => pos.board.has(s));
        if (next !== undefined && pos.board.get(next)!.color === piece.color && VALUE[pos.board.get(next)!.role] >= 3) {
          arrows.push({ uci: `${makeSquare(from)}${makeSquare(next)}`, brush: target });
        }
      }
    }
  }
  return arrows;
}

const dist = (a: Square, b: Square) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
/** `s` lies on the far side of `victim`, as seen from `from`. */
const between = (from: Square, victim: Square, s: Square) => dist(from, s) === dist(from, victim) + dist(victim, s);
