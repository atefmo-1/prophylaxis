"""Building puzzle-shaped examples from real games (tactics/games.py), without an engine."""

import chess

from tactics import games
from tactics.planes import tactic_line


def line(fen: str, ucis: str) -> list[str] | None:
    found = tactic_line(chess.Board(fen), [chess.Move.from_uci(u) for u in ucis.split()])
    return None if found is None else [m.uci() for m in found]


def test_line_stops_at_mate():
    assert line("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "d1d8 g8h7 d8e8") == ["d1d8"]


def test_line_stops_once_the_material_is_kept():
    # Rxe5 wins a free knight and the reply doesn't win it back: the tactic is over after one move.
    assert line("4k3/8/8/4n3/8/8/8/4R1K1 w - - 0 1", "e1e5 e8d7 e5e4") == ["e1e5"]


def test_a_capture_that_is_taken_back_is_not_the_end():
    # Rxe5 dxe5 trades a rook for a knight: nothing is won, so there is no punishing line.
    assert line("4k3/8/3p4/4n3/8/8/8/4R1K1 w - - 0 1", "e1e5 d6e5") is None


def test_filters():
    base = {"Event": "Rated Rapid game", "WhiteElo": "1100", "BlackElo": "1250", "Termination": "Normal",
            "Site": "https://lichess.org/abcdefgh"}
    assert games._wanted(base, set())
    assert not games._wanted(base, {"abcdefgh"})                      # it produced a training puzzle
    assert not games._wanted({**base, "BlackElo": "1450"}, set())
    assert not games._wanted({**base, "Event": "Rated Blitz game"}, set())
    assert not games._wanted({**base, "Termination": "Abandoned"}, set())
    assert not games._wanted({**base, "WhiteElo": "?"}, set())
