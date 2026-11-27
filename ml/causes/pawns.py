"""Candidate reasons under the rules' 2-pawn bar, tried on the census before any of them ships.

- lost_pawn: the opponent's best reply takes a pawn within their first two moves, you are exactly a pawn down at the
  rules' horizon, and the best move kept material level.
- missed_pawn: the best move captures a pawn, and its line ends exactly a pawn up, while the move played didn't.
- lost_material_later: material lost between the rules' horizon (9 plies) and the end of the stored line (12 plies).

    python -m causes.pawns [n]    # coverage, then n random examples of each for checking by hand
"""

import json
import random
import sys
from collections import Counter

import chess
from coach import motifs

from .check import _san
from .classify import OUT, bucket

H = motifs.HORIZON


def _gain(board: chess.Board, pv: list[str], plies: int, me: chess.Color, start: int) -> int:
    return motifs.material(motifs.play(board, pv, plies), me) - start


def _first_pawn_capture(after: chess.Board, reply: list[str], me: chess.Color, within: int, start: int) -> str | None:
    """The opponent's capture of one of your pawns that wins it: you are a pawn down after it and still after your
    answer (so a trade, where you take back, doesn't count)."""
    b = after.copy(stack=False)
    for i, uci in enumerate(reply[:within]):
        m = chess.Move.from_uci(uci)
        if m not in b.legal_moves:
            return None
        victim = b.piece_at(m.to_square)
        takes_pawn = b.turn != me and (b.is_en_passant(m) or (victim and victim.color == me and victim.piece_type == chess.PAWN))
        san = b.san(m)
        b.push(m)
        if takes_pawn and motifs.material(motifs.play(b, reply[i + 1 :], 1), me) - start == -1:
            return san
    return None


def candidates(m: dict) -> dict[str, dict]:
    before = chess.Board(m["fen"])
    me = before.turn
    move = chess.Move.from_uci(m["move"])
    after = before.copy(stack=False)
    after.push(move)
    start = motifs.material(before, me)
    best, reply = m["best"], m["reply"]
    played = _gain(after, reply, H - 1, me, start)
    kept = _gain(before, best, H, me, start)
    out = {}
    if played == -1 and kept >= 0 and (cap := _first_pawn_capture(after, reply, me, 3, start)):
        out["lost_pawn"] = {"move": cap}
    if best:
        b0 = chess.Move.from_uci(best[0])
        victim = before.piece_at(b0.to_square)
        takes_pawn = (victim and victim.color != me and victim.piece_type == chess.PAWN) or before.is_en_passant(b0)
        if takes_pawn and kept == 1 and played <= 0:
            out["missed_pawn"] = {"move": before.san(b0)}
    later = _gain(after, reply, 11, me, start)
    best_later = _gain(before, best, 12, me, start)
    if played > -2 and later <= -2 and best_later - later >= 2 and len(reply) >= 11:
        out["lost_material_later"] = {"amount": -later}
    return out


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    rows = [m for line in (OUT / "chesscom.jsonl").open() for m in json.loads(line)["mistakes"]]
    found = [(m, candidates(m)) for m in rows]
    print(f"{len(rows)} mistakes")
    for b in ("none", "generic", "named"):
        c = Counter(k for m, cand in found if bucket(m) == b for k in cand)
        print(f"  {b:8} {sum(bucket(m) == b for m in rows):5}  {dict(c)}")
    none = [(m, c) for m, c in found if bucket(m) == "none"]
    print("  unexplained with any candidate:", sum(bool(c) for _, c in none), "of", len(none))
    rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 5)
    for kind in sys.argv[3:] or ("lost_pawn", "missed_pawn", "lost_material_later"):
        pool = [(m, c) for m, c in none if kind in c]
        print(f"\n===== {kind}: {len(pool)} unexplained")
        for m, c in rng.sample(pool, min(n, len(pool))):
            print(f"{m['san']:7} -{m['loss']:4} from {m['win_before']:5} {m['phase'][:3]} {c[kind]} | best {_san(m['fen'], m['best'][:8])}"
                  f" | reply {_san(m['fen'], m['reply'][:12], m['move'])} | {m['fen']}")


if __name__ == "__main__":
    main()
