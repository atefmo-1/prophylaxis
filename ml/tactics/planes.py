"""8x8xN board planes for the CNN: a position, the key move, and the next few moves of the line that follows it.
web/src/analysis/planes.ts is a line-by-line port; tests/test_planes.py and web/scripts/check-planes.ts keep the two
identical.

Everything is seen from the side to move ("me"): if that is black, ranks are flipped and colours swapped, so a
tactic looks the same whichever colour plays it. Plane p, row r, column c holds square (r * 8 + c) ^ flip.
"""

import chess
import numpy as np
from coach.motifs import material

PIECES = [chess.PAWN, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]
LINE_PLIES = 4   # moves of the line after the key move
PER_PLY = 16
PLANES = 32 + LINE_PLIES * PER_PLY
# 0-5 my pieces before the key move, 6-11 theirs; 12-23 the same after it; 24 from-square; 25 to-square;
# 26/27 how many of my/their pieces attack each square before the key move; 28/29 the same after; 30 the key move
# gives check; 31 it is checkmate.
# Then for each of the next LINE_PLIES moves of the line, 16 planes: 12 pieces after it, from, to, a plane of ones
# if the move exists, and a plane of ones if it gives checkmate.
COUNTS = [26, 27, 28, 29]                                  # the only planes that aren't 0/1
BINARY = [p for p in range(PLANES) if p not in COUNTS]

MAX_PLIES = 7    # a tactic line ends on the punisher's move within this many plies...
MATE_PLIES = 5   # ...or in mate within this many


def tactic_line(board: chess.Board, moves: list[chess.Move]) -> list[chess.Move] | None:
    """An engine line cut where the tactic is over: at mate, or at the first move of the side to move after which
    they are at least 2 points up and still are after the reply. None if neither happens in MAX_PLIES."""
    me = board.turn
    start = material(board, me)
    b = board.copy(stack=False)
    for i, move in enumerate(moves[:MAX_PLIES]):
        if move not in b.legal_moves:
            return None
        b.push(move)
        if b.is_checkmate():
            return moves[:i + 1] if i < MATE_PLIES else None
        if i % 2 == 0 and material(b, me) - start >= 2:
            if i + 1 >= len(moves):
                return moves[:i + 1]
            reply = b.copy(stack=False)
            if moves[i + 1] not in reply.legal_moves:
                return moves[:i + 1]
            reply.push(moves[i + 1])
            if material(reply, me) - start >= 2:
                return moves[:i + 1]
    return None


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


def encode(board: chess.Board, line: list[chess.Move]) -> np.ndarray:
    """Planes for the line `line` (its first move is the key move) played from `board`, shape (PLANES, 8, 8)."""
    me = board.turn
    flip = 0 if me == chess.WHITE else 56
    out = np.zeros((PLANES, 64), np.float32)
    move = line[0]
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
    for k, move in enumerate(line[1:LINE_PLIES + 1]):
        if move not in after.legal_moves:
            break
        after.push(move)
        base = 32 + k * PER_PLY
        _pieces(after, me, out, base, flip)
        out[base + 12, move.from_square ^ flip] = 1
        out[base + 13, move.to_square ^ flip] = 1
        out[base + 14] = 1
        if after.is_checkmate():
            out[base + 15] = 1
    return out.reshape(PLANES, 8, 8)


def pack(planes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Planes as (bit-packed 0/1 planes, uint8 attack counts): a tenth of the memory, for millions of examples."""
    flat = planes.reshape(PLANES, 64)
    return np.packbits(flat[BINARY].astype(bool), axis=-1), flat[COUNTS].astype(np.uint8)


def unpack(bits: np.ndarray, counts: np.ndarray) -> np.ndarray:
    """Batched inverse of pack: (n, binary, 8) and (n, 4, 64) back to float32 planes (n, PLANES, 8, 8)."""
    out = np.empty((len(bits), PLANES, 64), np.float32)
    out[:, BINARY] = np.unpackbits(bits, axis=-1)
    out[:, COUNTS] = counts
    return out.reshape(-1, PLANES, 8, 8)


def model_line(board: chess.Board, moves: list[chess.Move]) -> list[chess.Move]:
    """What the model sees of a line: the tactic part if the line has one, else just its first move."""
    return tactic_line(board, moves) or moves[:1]
