"""Name the kind of mistake behind a bad move.

The engine says *how much* a move cost; these rules say *why*. Every tag is backed by the
engine's own lines: a "hung piece" is only reported when the best reply really captures
it and the material is really lost over the following moves.
"""

import chess

VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
HORIZON = 9          # plies of an engine line to play out when counting material
MATERIAL_SWING = 2   # pawns of material that count as "really lost" or "really won"
ALLOWED_MIN_LOSS = 10.0  # win % a move must cost before we explain what it allowed
MISSED_MIN_LOSS = 5.0    # ... or what it missed
MATE_HORIZON = 3         # longer forced mates are not something to expect a beginner to see
TIME_PRESSURE_S = 60
RUSHED_S = 3
RUSHED_MIN_CLOCK_S = 120

TAGS = [
    "hanging_piece", "allowed_fork", "allowed_mate", "back_rank_mate", "lost_material",
    "allowed_stalemate", "missed_free_piece", "missed_fork", "missed_mate", "missed_tactic",
    "time_pressure", "rushed",
]


def material(board: chess.Board, color: chess.Color) -> int:
    return sum(
        VALUE[piece_type] * (len(board.pieces(piece_type, color)) - len(board.pieces(piece_type, not color)))
        for piece_type in VALUE
    )


def play(board: chess.Board, ucis: list[str], limit: int = HORIZON) -> chess.Board:
    """Play up to `limit` moves of an engine line, stopping at the first illegal one."""
    board = board.copy(stack=False)
    for uci in ucis[:limit]:
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            break
        board.push(move)
    return board


def _mover_mate(line: dict | None, color: chess.Color) -> int | None:
    """Moves to mate from `color`'s point of view: positive = `color` mates."""
    if not line or line["mate"] is None:
        return None
    return line["mate"] if color == chess.WHITE else -line["mate"]


def is_en_prise(board: chess.Board, capture: chess.Move) -> bool:
    """The captured piece was undefended, or taken by something cheaper (board: before the capture)."""
    victim = board.piece_at(capture.to_square)
    attacker = board.piece_at(capture.from_square)
    if victim is None or attacker is None:
        return False
    defended = board.is_attacked_by(victim.color, capture.to_square)
    return not defended or VALUE[attacker.piece_type] < VALUE[victim.piece_type]


def fork_targets(board: chess.Board, move: chess.Move) -> list[chess.Square]:
    """Pieces the just-moved piece attacks that it could win (board: after the move). Two or more = fork."""
    piece = board.piece_at(move.to_square)
    if piece is None:
        return []
    attacker_value = 100 if piece.piece_type == chess.KING else VALUE[piece.piece_type]
    targets = []
    for square in board.attacks(move.to_square):
        victim = board.piece_at(square)
        if victim is None or victim.color == piece.color:
            continue
        is_king = victim.piece_type == chess.KING
        winnable = VALUE[victim.piece_type] >= 3 and (
            VALUE[victim.piece_type] > attacker_value or not board.is_attacked_by(victim.color, square)
        )
        if is_king or winnable:
            targets.append(square)
    return targets if len(targets) >= 2 else []


def _is_back_rank_mate(board: chess.Board, line: list[str]) -> bool:
    """The line ends in mate by a rook or queen along the mated king's back rank, with every square in front of
    the king taken by its own pieces: the king is boxed in by them, not just mated on its first rank."""
    final = board.copy(stack=False)
    for uci in line:
        move = chess.Move.from_uci(uci)
        if move not in final.legal_moves:
            return False
        final.push(move)
    if not final.is_checkmate():
        return False
    king = final.king(final.turn)
    last = final.peek()
    mater = final.piece_at(last.to_square)
    back_rank = 0 if final.turn == chess.WHITE else 7
    if king is None or chess.square_rank(king) != back_rank:
        return False
    in_front = back_rank + (1 if final.turn == chess.WHITE else -1)
    file = chess.square_file(king)
    boxed_in = all(
        final.color_at(chess.square(f, in_front)) == final.turn for f in range(max(0, file - 1), min(7, file + 1) + 1)
    )
    return (
        boxed_in
        and mater is not None
        and mater.piece_type in (chess.ROOK, chess.QUEEN)
        and chess.square_rank(last.to_square) == back_rank
    )


def _piece_name(board: chess.Board, square: chess.Square) -> str:
    piece = board.piece_at(square)
    return chess.piece_name(piece.piece_type) if piece else "piece"


def detect(
    before: chess.Board,
    move: chess.Move,
    lines_before: list[dict],
    lines_after: list[dict] | None,
    win_loss: float,
    clock_before: float | None,
    time_spent: float | None,
) -> list[tuple[str, dict]]:
    """Tags for one move. `lines_*` are engine lines (white POV); `lines_after` is None if the game ended."""
    me = before.turn
    after = before.copy(stack=False)
    after.push(move)
    tags: list[tuple[str, dict]] = []

    best_pv = lines_before[0]["pv"] if lines_before else []
    reply_pv = lines_after[0]["pv"] if lines_after else []
    start = material(before, me)
    gain_best = material(play(before, best_pv), me) - start
    gain_played = material(play(after, reply_pv, HORIZON - 1), me) - start

    # What the move allowed
    if win_loss >= ALLOWED_MIN_LOSS:
        mate_against = _mover_mate(lines_after[0] if lines_after else None, me)
        best_mate = _mover_mate(lines_before[0] if lines_before else None, me)
        if after.is_stalemate():
            tags.append(("allowed_stalemate", {}))
        elif (
            mate_against is not None
            and -MATE_HORIZON <= mate_against < 0
            and not (best_mate is not None and best_mate < 0)
        ):
            tags.append(("allowed_mate", {"in": -mate_against}))
            if _is_back_rank_mate(after, reply_pv):
                tags.append(("back_rank_mate", {}))
        elif gain_played <= -MATERIAL_SWING and gain_best - gain_played >= MATERIAL_SWING and reply_pv:
            reply = chess.Move.from_uci(reply_pv[0])
            victim = after.piece_at(reply.to_square)
            if (
                after.is_capture(reply)
                and victim is not None
                and VALUE[victim.piece_type] >= 3
                and is_en_prise(after, reply)
            ):
                tags.append(("hanging_piece", {
                    "piece": chess.piece_name(victim.piece_type),
                    "square": chess.square_name(reply.to_square),
                }))
            else:
                after_reply = after.copy(stack=False)
                after_reply.push(reply)
                targets = fork_targets(after_reply, reply)
                if targets:
                    tags.append(("allowed_fork", {
                        "by": _piece_name(after_reply, reply.to_square),
                        "targets": [_piece_name(after_reply, t) for t in targets],
                    }))
                else:
                    tags.append(("lost_material", {"amount": -gain_played}))

    # What the move missed
    if win_loss >= MISSED_MIN_LOSS and best_pv:
        best_mate = _mover_mate(lines_before[0], me)
        mate_after = _mover_mate(lines_after[0] if lines_after else None, me)
        best = chess.Move.from_uci(best_pv[0])
        forcing = before.is_capture(best) or before.gives_check(best)
        if best_mate is not None and 0 < best_mate <= MATE_HORIZON and not after.is_checkmate():
            if mate_after is None or mate_after <= 0:
                tags.append(("missed_mate", {"in": best_mate}))
        elif forcing and gain_best >= MATERIAL_SWING and gain_best - gain_played >= MATERIAL_SWING:
            victim = before.piece_at(best.to_square)
            if (
                before.is_capture(best)
                and victim is not None
                and VALUE[victim.piece_type] >= 3
                and is_en_prise(before, best)
            ):
                tags.append(("missed_free_piece", {"piece": chess.piece_name(victim.piece_type)}))
            else:
                after_best = before.copy(stack=False)
                after_best.push(best)
                targets = fork_targets(after_best, best)
                if targets:
                    tags.append(("missed_fork", {
                        "by": _piece_name(after_best, best.to_square),
                        "targets": [_piece_name(after_best, t) for t in targets],
                    }))
                else:
                    tags.append(("missed_tactic", {"amount": gain_best - gain_played}))

    # When it happened
    if win_loss >= ALLOWED_MIN_LOSS and clock_before is not None:
        if clock_before < TIME_PRESSURE_S:
            tags.append(("time_pressure", {"clock": round(clock_before)}))
        elif time_spent is not None and time_spent < RUSHED_S and clock_before >= RUSHED_MIN_CLOCK_S:
            tags.append(("rushed", {"seconds": round(time_spent, 1)}))

    return tags
