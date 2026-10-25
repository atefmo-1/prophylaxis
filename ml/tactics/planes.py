"""8x8xN board planes plus a move encoding, for the CNN. web/src/analysis/planes.ts is a line-by-line port;
tests/test_planes.py and web/scripts/check-planes.ts keep the two identical.

Everything is seen from the side to move ("me"): if that is black, ranks are flipped and colours swapped, so a
tactic looks the same whichever colour plays it. Plane p, row r, column c holds square (r * 8 + c) ^ flip.
"""

import chess
import numpy as np

PIECES = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
PLANES = 32
# 0-5 my pieces before the move, 6-11 theirs; 12-23 the same after the move; 24 from-square; 25 to-square;
# 26/27 how many of my/their pieces attack each square before the move; 28/29 the same after; 30 the move gives
# check; 31 the move is checkmate.


def attack_counts(board: chess.Board, color: chess.Color) -> np.ndarray:
    counts = np.zeros(64, np.float32)
    for square in chess.SquareSet(board.occupied_co[color]):
        for target in board.attacks(square):
            counts[target] += 1
    return counts


def _pieces(board: chess.Board, me: chess.Color, out: np.ndarray, base: int, flip: int) -> None:
    for i, piece_type in enumerate(PIECES):
        for j, color in enumerate((me, not me)):
            for square in board.pieces(piece_type, color):
                out[base + 6 * j + i, (square ^ flip)] = 1


def encode(board: chess.Board, move: chess.Move) -> np.ndarray:
    """Planes for `move` played in `board` (side to move = the mover), shape (PLANES, 8, 8), float32."""
    me = board.turn
    flip = 0 if me == chess.WHITE else 56
    out = np.zeros((PLANES, 64), np.float32)
    after = board.copy(stack=False)
    after.push(move)
    _pieces(board, me, out, 0, flip)
    _pieces(after, me, out, 12, flip)
    out[24, move.from_square ^ flip] = 1
    out[25, move.to_square ^ flip] = 1
    idx = np.arange(64) ^ flip
    out[26, idx] = attack_counts(board, me)
    out[27, idx] = attack_counts(board, not me)
    out[28, idx] = attack_counts(after, me)
    out[29, idx] = attack_counts(after, not me)
    if after.is_check():
        out[30] = 1
    if after.is_checkmate():
        out[31] = 1
    return out.reshape(PLANES, 8, 8)
