"""Win %, accuracy and move classes.

The win % and accuracy formulas are Lichess's published ones
(https://lichess.org/page/accuracy). Class thresholds follow chess.com's expected-points
scale, so the labels mean what they mean on chess.com.
"""

import math
import statistics

import chess

# (upper bound of win % lost, class), checked in order; anything larger is a blunder
THRESHOLDS = [(2.0, "excellent"), (5.0, "good"), (10.0, "inaccuracy"), (20.0, "mistake")]
CLASSES = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "miss", "blunder"]
BOOK_MAX_LOSS = 10.0      # a known opening move the engine calls a mistake stays a mistake
BRILLIANT_MAX_LOSS = 2.0  # the best move or close to it (excellent)
BRILLIANT_MAX_WIN = 90.0  # not already winning anyway
BRILLIANT_MIN_AFTER = 50.0  # and still at least level after it
SACRIFICE_MIN = 2         # material given up, in pawns (an exchange sacrifice counts)
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}


def win_from_cp(cp: float) -> float:
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def line_win_white(line: dict) -> float:
    """White's win % for one engine line."""
    if line["mate"] is not None:
        return 100.0 if line["mate"] > 0 else 0.0
    return win_from_cp(line["cp"])


def terminal_win_white(board: chess.Board) -> float:
    if board.is_checkmate():
        return 0.0 if board.turn == chess.WHITE else 100.0
    return 50.0


def pov(win_white: float, color: chess.Color) -> float:
    return win_white if color == chess.WHITE else 100.0 - win_white


def move_accuracy(win_before: float, win_after: float) -> float:
    """Accuracy of one move from the mover's win % before and after (Lichess, incl. its +1 bonus)."""
    if win_after >= win_before:
        return 100.0
    raw = 103.1668100711649 * math.exp(-0.04354415386753951 * (win_before - win_after)) - 3.166924740191411
    return min(100.0, max(0.0, raw + 1))


def classify(win_loss: float, played_best: bool) -> str:
    if played_best:
        return "best"
    for bound, name in THRESHOLDS:
        if win_loss < bound:
            return name
    return "blunder"


def game_accuracy(win_white: list[float]) -> dict[chess.Color, float | None]:
    """Per-side game accuracy: average of a volatility-weighted mean and a harmonic mean.

    `win_white` holds white's win % for the start position and after every ply.
    """
    n_moves = len(win_white) - 1
    if n_moves < 2:
        return {chess.WHITE: None, chess.BLACK: None}

    window = min(max(n_moves // 10, 2), 8)
    windows = [win_white[:window]] * (window - 2) + [
        win_white[i : i + window] for i in range(len(win_white) - window + 1)
    ]
    weights = [min(max(statistics.pstdev(w), 0.5), 12.0) for w in windows]

    per_side: dict[chess.Color, list[tuple[float, float]]] = {chess.WHITE: [], chess.BLACK: []}
    for i in range(n_moves):
        color = chess.WHITE if i % 2 == 0 else chess.BLACK
        acc = move_accuracy(pov(win_white[i], color), pov(win_white[i + 1], color))
        per_side[color].append((acc, weights[i]))

    result: dict[chess.Color, float | None] = {}
    for color, items in per_side.items():
        if not items:
            result[color] = None
            continue
        weighted = sum(a * w for a, w in items) / sum(w for _, w in items)
        harmonic = len(items) / sum(1 / max(a, 1.0) for a, _ in items)
        result[color] = (weighted + harmonic) / 2
    return result


def phase(board: chess.Board, ply: int) -> str:
    """Game phase of the position a move was played from."""
    pieces = sum(
        len(board.pieces(piece_type, color))
        for piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
        for color in chess.COLORS
    )
    if pieces <= 6:
        return "endgame"
    if ply <= 20:
        return "opening"
    return "middlegame"


# Brilliant: chess.com's "a good piece sacrifice". The material is counted with a static exchange: capture on a
# square and keep trading there, each side using its least valuable piece and stopping when trading on loses.
def _captured(board: chess.Board, move: chess.Move) -> int:
    if board.is_en_passant(move):
        return VALUES[chess.PAWN]
    piece = board.piece_at(move.to_square)
    return VALUES[piece.piece_type] if piece else 0


def _cheapest_capture(board: chess.Board, square: chess.Square) -> chess.Move | None:
    """The side to move's legal capture on `square` with its least valuable piece (a king last)."""
    best, best_rank = None, 100
    for move in board.legal_moves:
        if move.to_square != square or not board.is_capture(move) or move.promotion not in (None, chess.QUEEN):
            continue
        piece = board.piece_type_at(move.from_square)
        rank = 99 if piece == chess.KING else VALUES[piece]
        if rank < best_rank:
            best, best_rank = move, rank
    return best


def exchange(board: chess.Board, move: chess.Move) -> int:
    """What the side to move wins by making capture `move` and trading on that square afterwards."""
    won = _captured(board, move)
    board.push(move)
    reply = _cheapest_capture(board, move.to_square)
    if reply is not None:
        won -= max(0, exchange(board, reply))
    board.pop()
    return won


def best_capture(board: chess.Board) -> int:
    """The most material the side to move can win with one capture and the trades after it (0 if none)."""
    gains = [
        exchange(board, m)
        for m in board.legal_moves
        if board.is_capture(m) and m.promotion in (None, chess.QUEEN)
    ]
    return max([0, *gains])


def sacrifice(before: chess.Board, move: chess.Move) -> int:
    """Material the move gives up: what the opponent can now win, less what the move took and what was already
    there for the taking before it (0 if it gives nothing up)."""
    after = before.copy(stack=False)
    after.push(move)
    given = best_capture(after)
    if given == 0:
        return 0
    if before.is_check():
        already = 0
    else:
        passed = before.copy(stack=False)
        passed.push(chess.Move.null())
        already = best_capture(passed)
    return given - _captured(before, move) if given > already else 0


def is_brilliant(before: chess.Board, move: chess.Move, win_before: float, win_after: float, win_loss: float) -> bool:
    return (
        win_loss < BRILLIANT_MAX_LOSS
        and win_before < BRILLIANT_MAX_WIN
        and win_after >= BRILLIANT_MIN_AFTER
        and not before.is_check()
        and move.promotion is None
        and sacrifice(before, move) >= SACRIFICE_MIN
    )
