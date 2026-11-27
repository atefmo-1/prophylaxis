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


def test_mate_on_the_back_rank_without_a_box_is_not_back_rank_mate():
    # Rd1 is mate on white's first rank, but f2 is empty and held by the e4 knight: the king is not boxed in by
    # its own pieces.
    fen = "3r2k1/8/8/8/4n3/8/6PP/R5K1 w - - 0 1"
    board = chess.Board(fen)
    board.push_uci("a1a7")
    board.push_uci("d8d1")
    assert board.is_checkmate()
    tags = tags_for(
        fen, "a1a7",
        before=[line(["h2h3", "d8d1"], cp=-300)],
        after=[line(["d8d1"], mate=-1)],
    )
    assert tags["allowed_mate"] == {"in": 1}
    assert "back_rank_mate" not in tags


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


def threat_for(fen: str, uci: str, threat: dict, reply: list[str], win_loss: float = 30.0, reply_mate=None):
    board = chess.Board(fen)
    after = [line(reply, mate=reply_mate) if reply_mate else line(reply, cp=-300)]
    return motifs.ignored_threat(board, chess.Move.from_uci(uci), after, threat, win_loss)


def test_ignored_threat_to_win_a_piece():
    # The e4 pawn already attacks the f3 knight; h3 does nothing about it, and exf3 follows.
    found = threat_for("4k3/8/8/8/4p3/5N2/7P/4K3 w - - 0 1", "h2h3", line(["e4f3", "e1f2"], cp=-300), ["e4f3", "e1f2"])
    assert found == ("ignored_threat", {"move": "exf3", "amount": 3})


def test_moving_the_attacked_piece_is_not_ignoring_the_threat():
    found = threat_for("4k3/8/8/8/4p3/5N2/7P/4K3 w - - 0 1", "f3d4", line(["e4f3", "e1f2"], cp=-300), ["e8d7", "d4f5"])
    assert found is None


def test_ignored_mate_threat():
    # Ra1 is mate on white's back rank; b3 ignores it.
    found = threat_for("r5k1/5ppp/8/8/8/8/1P3PPP/6K1 w - - 0 1", "b2b3", line(["a8a1"], mate=-1), ["a8a1"], reply_mate=-1)
    assert found == ("ignored_threat", {"move": "Ra1#", "mate": 1})


def test_a_move_that_stops_the_mate_is_not_ignoring_it():
    # Kf1 makes room: Ra1+ is still their best reply, but it is only a check now.
    found = threat_for("r5k1/5ppp/8/8/8/8/1P3PPP/6K1 w - - 0 1", "g1f1", line(["a8a1"], mate=-1), ["a8a1", "f1e2"])
    assert found is None


def test_no_threat_test_from_check_or_for_small_losses():
    in_check = "4k3/8/8/8/4p3/5N2/4r2P/4K3 w - - 0 1"
    assert threat_for(in_check, "e1e2", line(["e4f3"], cp=-300), ["e4f3"]) is None
    small = threat_for("4k3/8/8/8/4p3/5N2/7P/4K3 w - - 0 1", "h2h3", line(["e4f3"], cp=-300), ["e4f3"], win_loss=5)
    assert small is None


def test_lost_pawn():
    # h3 leaves the e4 pawn to the f6 knight.
    tags = tags_for(
        "4k3/8/5n2/8/4P3/8/7P/4K3 w - - 0 1", "h2h3",
        before=[line(["e4e5", "f6d5"], cp=0)],
        after=[line(["f6e4", "e1e2"], cp=-200)],
    )
    assert tags["lost_pawn"] == {"move": "Nxe4"}


def test_lost_pawn_names_the_capture_that_wins_it_not_a_trade():
    # c3 is answered by dxc3+ Kxc3, an even trade; the pawn that is lost is f2, to Bxf2.
    tags = tags_for(
        "6k1/8/8/8/3p3b/8/1KP2P2/8 w - - 0 1", "c2c3",
        before=[line(["f2f3", "g8f7"], cp=0)],
        after=[line(["d4c3", "b2c3", "h4f2"], cp=-200)],
    )
    assert tags["lost_pawn"] == {"move": "Bxf2"}


def test_missed_pawn():
    tags = tags_for(
        "4k3/8/8/4p3/8/5N2/8/4K3 w - - 0 1", "e1d2",
        before=[line(["f3e5", "e8e7"], cp=150)],
        after=[line(["e8d7"], cp=0)],
    )
    assert tags["missed_pawn"] == {"move": "Nxe5"}
