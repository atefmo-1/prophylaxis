"""The rules-as-theme-predictor adapter used for the baseline."""

import chess

from tactics import rules


def puzzle(fen_before: str, moves: str) -> dict:
    first, *line = moves.split()
    return {"fen_before": fen_before, "blunder": first, "line": line}


def test_knight_fork_is_a_fork():
    # ...Kg8?? and Ne7+ forks the king and the c8 queen.
    assert "fork" in rules.predict(puzzle("2q4k/8/8/3N4/8/8/8/6K1 b - - 0 1", "h8g8 d5e7 g8f8 e7c8"))


def test_back_rank_mate_in_one():
    fen = "6k1/p4ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1"
    after = chess.Board(fen)
    after.push_uci("a7a6")
    assert rules.solver_mate(after, ["d1d8"]) == 1
    assert rules.predict(puzzle(fen, "a7a6 d1d8")) == {"mateIn1", "backRankMate"}


def test_free_queen_is_hanging():
    # Qh1?? puts the queen on the rook's file with nothing defending it.
    assert rules.predict(puzzle("4k2r/8/8/8/8/8/8/4KQ2 w - - 0 1", "f1h1 h8h1 e1f2")) == {"hangingPiece"}


def test_back_rank_mate_needs_the_king_boxed_in_by_its_own_pieces():
    # Same mate on the first rank, but f2 is held by the e4 knight rather than a white pawn.
    assert rules.predict(puzzle("3r2k1/8/8/8/4n3/8/6PP/R5K1 w - - 0 1", "a1a7 d8d1")) == {"mateIn1"}
