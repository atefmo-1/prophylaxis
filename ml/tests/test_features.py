import chess

from tactics.features import NAMES, features


def value(fen: str, uci: str, name: str) -> float:
    return float(features(chess.Board(fen), chess.Move.from_uci(uci))[NAMES.index(name)])


def test_one_name_per_feature():
    assert len(features(chess.Board(), chess.Move.from_uci("e2e4"))) == len(NAMES)


def test_fork_hits_two_pieces():
    assert value("2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1", "d5e7", "hits") == 2
    assert value("2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1", "d5e7", "hits_king") == 1


def test_pin_line():
    # Bb5 pins the c6 knight to the e8 king.
    assert value("r1bqkbnr/ppp2ppp/2np4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4", "f1b5", "moved_pin_lines") == 1


def test_back_rank_mate():
    assert value("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "d1d8", "checkmate") == 1
    assert value("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "d1d8", "their_king_sealed") == 1
