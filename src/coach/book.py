"""The opening book: every position reached by a named line in Lichess's openings list (CC0), so a review can mark
moves that are known theory, as chess.com's "Book" does. The site reads the same file (web/src/analysis/book.ts)."""

import csv
from functools import cache

import chess

from . import config


def key(board: chess.Board) -> str:
    """Pieces, side to move and castling rights: the same position by any move order."""
    return " ".join(board.fen().split()[:3])


@cache
def positions() -> frozenset[str]:
    found = set()
    with open(config.OPENINGS_TSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            board = chess.Board()
            for token in row["pgn"].split():
                if token.endswith("."):
                    continue
                try:
                    board.push_san(token)
                except ValueError:
                    break
                found.add(key(board))
    return frozenset(found)


def book_plies(boards: list[chess.Board]) -> int:
    """How many moves from the start of a game stay in the book (boards: the start and the position after each move)."""
    if boards[0].fen() != chess.STARTING_FEN:
        return 0
    known = positions()
    plies = 0
    for board in boards[1:]:
        if key(board) not in known:
            break
        plies += 1
    return plies
