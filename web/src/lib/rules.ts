// Chess rules in the browser (chessops, Lichess's library): legal moves for the retry board, SAN <-> UCI.
import { Chess } from "chessops/chess";
import { chessgroundDests } from "chessops/compat";
import { parseFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { makeUci, parseSquare, parseUci } from "chessops/util";
import type { Key } from "chessground/types";

export function position(fen: string) {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
}

export function legalDests(fen: string): Map<Key, Key[]> {
  return chessgroundDests(position(fen)) as Map<Key, Key[]>;
}

/** A drag on the board as the UCI the engine data uses: king-onto-rook becomes a normal castle, pawns promote to a queen. */
export function dragToUci(fen: string, orig: string, dest: string): string {
  const piece = position(fen).board.get(parseSquare(orig)!);
  let to = dest;
  if (piece?.role === "king" && orig[0] === "e" && orig[1] === dest[1] && (dest[0] === "h" || dest[0] === "a")) {
    to = `${dest[0] === "h" ? "g" : "c"}${dest[1]}`;
  }
  const promote = piece?.role === "pawn" && (dest[1] === "8" || dest[1] === "1") ? "q" : "";
  return `${orig}${to}${promote}`;
}

export function sanOf(fen: string, uci: string): string {
  const move = parseUci(uci);
  return move ? makeSan(position(fen), move) : uci;
}

export function uciOfSan(fen: string, san: string): string | null {
  const move = parseSan(position(fen), san);
  return move ? makeUci(move) : null;
}

const PIECE_NAMES: Record<string, string> = {
  pawn: "pawn",
  knight: "knight",
  bishop: "bishop",
  rook: "rook",
  queen: "queen",
  king: "king",
};

/** "your knight on f3": the piece that moves in a UCI move, for hints. */
export function pieceAt(fen: string, square: string): string | null {
  const piece = position(fen).board.get(parseSquare(square)!);
  return piece ? PIECE_NAMES[piece.role] : null;
}
