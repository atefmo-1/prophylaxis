"""Tactic detectors on hand-built positions. Engine lines are written by hand (white POV)."""

import chess

from coach import grading, motifs


def line(pv: list[str], cp: int | None = None, mate: int | None = None) -> dict:
    return {"cp": cp, "mate": mate, "pv": pv}


def tags_for(fen: str, uci: str, before: list[dict], after: list[dict] | None, clock=None, spent=None):
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    win_before = grading.pov(grading.line_win_white(before[0]), board.turn)
    after_board = board.copy()
    after_board.push(move)
    win_after = grading.pov(
        grading.terminal_win_white(after_board) if after is None else grading.line_win_white(after[0]), board.turn
    )
    found = motifs.detect(board, move, before, after, max(0.0, win_before - win_after), clock, spent)
    return dict(found)


def test_hanging_piece():
    # White plays Bd5?? and the e6 pawn takes it.
    tags = tags_for(
        "4k3/8/4p3/8/8/8/6B1/4K3 w - - 0 1", "g2d5",
        before=[line(["g2f3", "e8e7"], cp=250)],
        after=[line(["e6d5", "e1d2"], cp=-100)],
    )
    assert tags["hanging_piece"] == {"piece": "bishop", "square": "d5"}


def test_even_trade_is_not_a_hanging_piece():
    # Bxd5 exd5 trades bishop for knight. The engine dislikes it, but nothing was hung.
    tags = tags_for(
        "4k3/8/4p3/3n4/8/8/6B1/4K3 w - - 0 1", "g2d5",
        before=[line(["e1d2", "e8e7"], cp=300)],
        after=[line(["e6d5", "e1d2"], cp=0)],
    )
    assert tags == {}


def test_missed_free_piece():
    # Black's queen on d5 is undefended and the f4 knight can take it.
    tags = tags_for(
        "4k3/8/8/3q4/5N2/8/8/4K3 w - - 0 1", "e1f2",
        before=[line(["f4d5", "e8d7"], cp=900)],
        after=[line(["e8e7", "f2e3"], cp=-900)],
    )
    assert tags == {"missed_free_piece": {"piece": "queen"}}


def test_allowed_back_rank_mate():
    tags = tags_for(
        "3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "a1a7",
        before=[line(["h2h3", "d8d2"], cp=0)],
        after=[line(["d8d1"], mate=-1)],
    )
    assert tags["allowed_mate"] == {"in": 1}
    assert "back_rank_mate" in tags


def test_missed_mate():
    # Ra8 is mate (the f7/g7/h7 pawns box the black king in).
    tags = tags_for(
        "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "h2h3",
        before=[line(["a1a8"], mate=1)],
        after=[line(["g8f8", "a1a8"], cp=600)],
    )
    assert tags["missed_mate"] == {"in": 1}


def test_fork_targets_knight_fork():
    board = chess.Board("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1")
    move = chess.Move.from_uci("d5c7")
    board.push(move)
    assert set(motifs.fork_targets(board, move)) == {chess.E8, chess.A8}


def test_single_attack_is_not_a_fork():
    board = chess.Board("4k3/8/8/3N4/8/8/8/4K3 w - - 0 1")
    move = chess.Move.from_uci("d5c7")
    board.push(move)
    assert motifs.fork_targets(board, move) == []


def test_rushed_blunder():
    tags = tags_for(
        "4k3/8/4p3/8/8/8/6B1/4K3 w - - 0 1", "g2d5",
        before=[line(["g2f3", "e8e7"], cp=250)],
        after=[line(["e6d5", "e1d2"], cp=-100)],
        clock=400, spent=1.2,
    )
    assert tags["rushed"] == {"seconds": 1.2}
    assert "time_pressure" not in tags


def test_time_pressure_blunder():
    tags = tags_for(
        "4k3/8/4p3/8/8/8/6B1/4K3 w - - 0 1", "g2d5",
        before=[line(["g2f3", "e8e7"], cp=250)],
        after=[line(["e6d5", "e1d2"], cp=-100)],
        clock=42, spent=1.2,
    )
    assert tags["time_pressure"] == {"clock": 42}
    assert "rushed" not in tags


def test_long_mates_are_not_tagged():
    # Mate in 7 that the player didn't find: winning anyway, not a "missed checkmate".
    tags = tags_for(
        "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "h2h3",
        before=[line(["a1a7"], mate=7)],
        after=[line(["g8f8", "a1a8"], cp=600)],
    )
    assert "missed_mate" not in tags


def test_quiet_best_move_is_not_a_missed_tactic():
    # The best move is a quiet king move; even if its line nets material, that is not a tactic.
    tags = tags_for(
        "4k3/8/8/3q4/8/8/8/4K2R w K - 0 1", "h1h2",
        before=[line(["e1f2", "d5d4", "h1d1", "d4d1"], cp=-300)],
        after=[line(["d5h1", "e1e2"], cp=-900)],
    )
    assert "missed_tactic" not in tags
