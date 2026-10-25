import json
from pathlib import Path

import chess
import pytest

from coach import book, grading, openings, stats


def test_win_percent_is_symmetric():
    assert grading.win_from_cp(0) == 50
    assert grading.win_from_cp(300) == pytest.approx(100 - grading.win_from_cp(-300))
    assert grading.line_win_white({"cp": None, "mate": 3, "pv": []}) == 100
    assert grading.line_win_white({"cp": None, "mate": -2, "pv": []}) == 0


def test_move_accuracy():
    assert grading.move_accuracy(60, 60) == 100
    assert grading.move_accuracy(60, 70) == 100
    assert grading.move_accuracy(90, 10) < grading.move_accuracy(60, 50) < 100


@pytest.mark.parametrize(
    ("loss", "best", "expected"),
    [(0, True, "best"), (1.9, False, "excellent"), (4, False, "good"), (9, False, "inaccuracy"),
     (15, False, "mistake"), (20, False, "blunder"), (60, False, "blunder")],
)
def test_classify(loss, best, expected):
    assert grading.classify(loss, best) == expected


def test_game_accuracy_perfect_and_blundered_games():
    steady = grading.game_accuracy([50.0] * 41)
    assert steady[chess.WHITE] == pytest.approx(100)
    assert steady[chess.BLACK] == pytest.approx(100)

    # White blunders on move 3; black never does
    swing = [50.0] * 5 + [5.0] * 36
    result = grading.game_accuracy(swing)
    assert result[chess.WHITE] < 80 < result[chess.BLACK]


def test_phase():
    assert grading.phase(chess.Board(), 1) == "opening"
    assert grading.phase(chess.Board(), 30) == "middlegame"
    assert grading.phase(chess.Board("4k3/8/8/8/8/8/8/R3K3 w - - 0 1"), 5) == "endgame"


@pytest.mark.parametrize(
    ("url", "name", "family"),
    [
        ("https://www.chess.com/openings/Kings-Pawn-Opening-1...e5", "King's Pawn Opening: 1...e5",
         "King's Pawn Opening"),
        ("https://www.chess.com/openings/Petrovs-Defense-Classical-Variation",
         "Petrov's Defense: Classical Variation", "Petrov's Defense"),
        ("https://www.chess.com/openings/Van-t-Kruijs-Opening", "Van't Kruijs Opening", "Van't Kruijs Opening"),
        ("https://www.chess.com/openings/Undefined", openings.UNKNOWN, openings.UNKNOWN),
        (None, openings.UNKNOWN, openings.UNKNOWN),
    ],
)
def test_opening_names(url, name, family):
    assert openings.parse(url) == (name, family)


def test_interval_contains_rate():
    ci = stats.interval(7, 20)
    assert ci["lo"] < ci["rate"] < ci["hi"]
    assert stats.interval(0, 10)["lo"] == 0
    assert stats.interval(10, 10)["hi"] == 1
    assert stats.interval(0, 0) is None


# Brilliant and Book. The same positions are checked against the site's TypeScript port
# (web/scripts/check-grading.ts), so the two stay in step.
FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "grading.json").read_text())


@pytest.mark.parametrize("case", FIXTURE["sacrifice"], ids=lambda c: c["name"])
def test_sacrifice(case):
    board = chess.Board(case["fen"])
    move = chess.Move.from_uci(case["move"])
    assert grading.sacrifice(board, move) == case["given"]
    board.push(move)
    assert grading.best_capture(board) == case["best_capture_after"]


@pytest.mark.parametrize("case", FIXTURE["book"], ids=lambda c: c["name"])
def test_book_plies(case):
    board = chess.Board()
    boards = [board.copy()]
    for san in case["moves"]:
        board.push_san(san)
        boards.append(board.copy())
    assert book.book_plies(boards) == case["book_plies"]


def test_brilliant_needs_a_sound_sacrifice_from_a_position_that_isnt_won():
    board = chess.Board("2r3k1/5ppp/5n2/8/8/5R2/6PP/6K1 w - - 0 1")
    rxf6 = board.parse_san("Rxf6")
    assert grading.is_brilliant(board, rxf6, win_before=55, win_after=60, win_loss=0)
    assert not grading.is_brilliant(board, rxf6, win_before=55, win_after=40, win_loss=15)  # unsound
    assert not grading.is_brilliant(board, rxf6, win_before=95, win_after=96, win_loss=0)  # already winning
    assert not grading.is_brilliant(board, board.parse_san("h3"), win_before=55, win_after=55, win_loss=0)  # no sacrifice
