"""Handcrafted features for the LightGBM model: what a coach would look at for one move in one position.

All counts are from the mover's side ("me"). Values: pawn 1, knight/bishop 3, rook 5, queen 9, king 0 (as the
rules use), except where attacking the king matters, which has its own features.
"""

import chess
import numpy as np

V = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)
RAYS = {
    chess.BISHOP: [(1, 1), (1, -1), (-1, 1), (-1, -1)],
    chess.ROOK: [(1, 0), (-1, 0), (0, 1), (0, -1)],
}
RAYS[chess.QUEEN] = RAYS[chess.BISHOP] + RAYS[chess.ROOK]

NAMES: list[str] = []


def _ray(square: int, df: int, dr: int):
    f, r = chess.square_file(square) + df, chess.square_rank(square) + dr
    while 0 <= f < 8 and 0 <= r < 8:
        yield chess.square(f, r)
        f, r = f + df, r + dr


def _line_pairs(board: chess.Board, square: int, color: chess.Color) -> tuple[int, int, int]:
    """Along each ray of the slider on `square`: the first two pieces hit, if both are the enemy's.
    Counts (pin-shaped: front worth less than back or back is the king; skewer-shaped: front worth more or front
    is the king; x-ray through my own piece onto an enemy piece)."""
    piece = board.piece_at(square)
    pins = skewers = xrays = 0
    for df, dr in RAYS.get(piece.piece_type, []):
        hit = []
        for s in _ray(square, df, dr):
            p = board.piece_at(s)
            if p:
                hit.append(p)
                if len(hit) == 2:
                    break
        if len(hit) < 2:
            continue
        front, back = hit
        if front.color != color and back.color != color:
            fv = 100 if front.piece_type == chess.KING else V[front.piece_type]
            bv = 100 if back.piece_type == chess.KING else V[back.piece_type]
            if bv > fv:
                pins += 1
            elif fv > bv >= 3:
                skewers += 1
        elif front.color == color and back.color != color and back.piece_type != chess.PAWN:
            xrays += 1
    return pins, skewers, xrays


def _attacked_value(board: chess.Board, by: chess.Color) -> tuple[int, int, int, int]:
    """Enemy pieces `by` attacks: count, total value, count undefended, most valuable loose-or-cheaper target."""
    n = total = loose = best = 0
    for square in chess.SquareSet(board.occupied_co[not by]):
        victim = board.piece_type_at(square)
        attackers = board.attackers(by, square)
        if not attackers or victim == chess.KING:
            continue
        n += 1
        total += V[victim]
        defended = board.is_attacked_by(not by, square)
        cheapest = min(V[board.piece_type_at(a)] or 100 for a in attackers)
        if not defended:
            loose += 1
        if not defended or cheapest < V[victim]:
            best = max(best, V[victim])
    return n, total, loose, best


def _king_zone(board: chess.Board, color: chess.Color) -> tuple[int, int, int, int, int]:
    """The `color` king: escape squares, on its back rank, own pieces next to it, enemy attacks on its zone,
    and whether its back rank is sealed by its own pawns."""
    king = board.king(color)
    if king is None:
        return 0, 0, 0, 0, 0
    zone = board.attacks(king)
    escapes = sum(
        1 for s in zone
        if board.color_at(s) != color and not board.is_attacked_by(not color, s)
    )
    back = 0 if color == chess.WHITE else 7
    own = sum(1 for s in zone if board.color_at(s) == color)
    pressure = sum(len(board.attackers(not color, s)) for s in zone)
    forward = 1 if color == chess.WHITE else -1
    rank = chess.square_rank(king)
    sealed = int(rank == back and all(
        board.color_at(s) == color or board.is_attacked_by(not color, s)
        for s in zone if chess.square_rank(s) == rank + forward
    ))
    return escapes, int(rank == back), own, pressure, sealed


def _trapped(board: chess.Board, me: chess.Color) -> int:
    """Enemy minor/major pieces attacked by me with no square to go to that I don't attack."""
    count = 0
    for square in chess.SquareSet(board.occupied_co[not me]):
        pt = board.piece_type_at(square)
        if pt in (chess.PAWN, chess.KING) or not board.is_attacked_by(me, square):
            continue
        safe = False
        for target in board.attacks(square):
            if board.color_at(target) == (not me):
                continue
            occupant = board.piece_type_at(target)
            if not board.is_attacked_by(me, target) or (occupant and V[occupant] >= V[pt]):
                safe = True
                break
        count += not safe
    return count


def _pinned(board: chess.Board, color: chess.Color) -> int:
    return sum(1 for s in chess.SquareSet(board.occupied_co[color]) if board.is_pinned(color, s))


def features(board: chess.Board, move: chess.Move) -> np.ndarray:
    me, them = board.turn, not board.turn
    after = board.copy(stack=False)
    after.push(move)
    moved = board.piece_type_at(move.from_square)
    captured = chess.PAWN if board.is_en_passant(move) else board.piece_type_at(move.to_square)
    f: list[float] = []

    # Material
    for color in (me, them):
        f += [len(board.pieces(pt, color)) for pt in chess.PIECE_TYPES[:5]]
    f.append(sum(V[p.piece_type] * (1 if p.color == me else -1) for p in board.piece_map().values()))
    f.append(sum(V[p.piece_type] for p in board.piece_map().values()))

    # The move itself
    f += [int(moved == pt) for pt in chess.PIECE_TYPES]
    f += [int(captured == pt) for pt in chess.PIECE_TYPES[:5]]
    f.append(V[captured] if captured else 0)
    f.append(int(move.promotion is not None))
    f.append(int(board.is_castling(move)))
    checkers = after.checkers()
    f += [int(after.is_check()), int(after.is_checkmate()), len(checkers)]
    f.append(int(any(s != move.to_square for s in checkers)))  # discovered check
    f.append(chess.square_rank(move.to_square) if me == chess.WHITE else 7 - chess.square_rank(move.to_square))

    # Was the captured piece loose? Did it defend anything?
    if captured:
        f.append(int(not board.is_attacked_by(them, move.to_square)))
        f.append(sum(1 for s in board.attacks(move.to_square) if board.color_at(s) == them))
        f.append(sum(1 for s in board.attacks(move.to_square)
                     if board.color_at(s) == them and len(board.attackers(them, s)) == 1 and board.is_attacked_by(me, s)))
    else:
        f += [0, 0, 0]

    # Safety of the moved piece on its new square
    to_attackers = after.attackers(them, move.to_square)
    f.append(len(to_attackers))
    f.append(len(after.attackers(me, move.to_square)))
    f.append(min((V[after.piece_type_at(a)] or 100 for a in to_attackers), default=0))
    f.append(V[moved] if moved else 0)
    f.append(len(board.attackers(them, move.from_square)))

    # What the moved piece hits now
    hits = [after.piece_type_at(s) for s in after.attacks(move.to_square) if after.color_at(s) == them]
    hit_vals = [V[h] for h in hits if h != chess.KING]
    f += [len(hits), sum(hit_vals), max(hit_vals, default=0), int(chess.KING in hits)]
    f.append(sum(1 for s in after.attacks(move.to_square)
                 if after.color_at(s) == them and after.piece_type_at(s) != chess.KING
                 and (not after.is_attacked_by(them, s) or V[after.piece_type_at(s)] > V[moved])))

    # Discovered attacks: my other pieces that hit more enemy material after the move than before
    disc = disc_val = 0
    for square in chess.SquareSet(after.occupied_co[me]):
        if square == move.to_square or after.piece_type_at(square) not in SLIDERS:
            continue
        old = {s for s in board.attacks(square) if board.color_at(s) == them}
        new = {s for s in after.attacks(square) if after.color_at(s) == them} - old
        if new:
            disc += 1
            disc_val += max(100 if after.piece_type_at(s) == chess.KING else V[after.piece_type_at(s)] for s in new)
    f += [disc, disc_val]

    # Lines through the moved piece and through all my sliders
    f += list(_line_pairs(after, move.to_square, me)) if moved in SLIDERS else [0, 0, 0]
    tot = np.zeros(3)
    for square in chess.SquareSet(after.occupied_co[me]):
        if after.piece_type_at(square) in SLIDERS:
            tot += _line_pairs(after, square, me)
    f += list(tot)
    f += [_pinned(board, them), _pinned(after, them), _pinned(after, me)]

    # Threats before and after
    f += list(_attacked_value(board, me)) + list(_attacked_value(after, me)) + list(_attacked_value(after, them))
    f += [_trapped(board, me), _trapped(after, me)]

    # Kings
    f += list(_king_zone(after, them)) + list(_king_zone(after, me))
    replies = list(after.legal_moves)
    f.append(len(replies))
    f.append(sum(1 for r in replies if r.to_square == move.to_square))
    f.append(sum(1 for r in replies if after.piece_type_at(r.from_square) == chess.KING))

    # Pawns close to promotion
    seventh = 6 if me == chess.WHITE else 1
    f.append(sum(1 for s in after.pieces(chess.PAWN, me) if chess.square_rank(s) == seventh))
    f.append(sum(1 for s in after.pieces(chess.PAWN, them) if chess.square_rank(s) == 7 - seventh))
    return np.asarray(f, np.float32)


NAMES += [f"my_{n}" for n in "pnbrq"] + [f"their_{n}" for n in "pnbrq"] + ["balance", "total_material"]
NAMES += [f"moved_{n}" for n in "pnbrqk"] + [f"captured_{n}" for n in "pnbrq"]
NAMES += ["captured_value", "promotion", "castling", "check", "checkmate", "checkers", "discovered_check", "to_rank"]
NAMES += ["captured_loose", "captured_defended_count", "captured_was_sole_defender"]
NAMES += ["to_attackers", "to_defenders", "to_cheapest_attacker", "moved_value", "from_attackers"]
NAMES += ["hits", "hits_value", "hits_max", "hits_king", "hits_winnable"]
NAMES += ["discovered", "discovered_value"]
NAMES += ["moved_pin_lines", "moved_skewer_lines", "moved_xray_lines", "pin_lines", "skewer_lines", "xray_lines"]
NAMES += ["their_pinned_before", "their_pinned_after", "my_pinned_after"]
NAMES += [f"{w}_{k}" for w in ("threat_before", "threat_after", "threat_against") for k in ("n", "value", "loose", "best")]
NAMES += ["trapped_before", "trapped_after"]
NAMES += [f"{w}_{k}" for w in ("their_king", "my_king") for k in ("escapes", "back_rank", "shield", "pressure", "sealed")]
NAMES += ["replies", "replies_capturing_moved", "king_replies", "my_pawns_7th", "their_pawns_2nd"]
