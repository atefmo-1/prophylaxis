"""The hand-written motif rules (src/coach/motifs.py) as a theme predictor, for the baseline.

The rules need engine lines. A puzzle supplies one: its first move is the side-to-move's mistake and the rest
is the line that punishes it. So each puzzle is run through `motifs.detect` exactly as a game move is in the
"what the move allowed" branch: `before` is the puzzle FEN, the move is the mistake, and the engine's reply
line is the puzzle solution. The win-% loss is set high enough that every detector is switched on.
"""

import chess
from coach import motifs

TAG_THEMES = {"hanging_piece": "hangingPiece", "allowed_fork": "fork", "back_rank_mate": "backRankMate"}
RULE_THEMES = ["mateIn1", "mateIn2", "fork", "hangingPiece", "backRankMate"]  # the only themes a rule can name


def solver_mate(board: chess.Board, line: list[str]) -> int | None:
    """Mate-in-N for the side to move if the line ends in checkmate, as the engine reports it (white POV)."""
    end = board.copy(stack=False)
    for uci in line:
        end.push(chess.Move.from_uci(uci))
    if not end.is_checkmate():
        return None
    n = (len(line) + 1) // 2
    return n if board.turn == chess.WHITE else -n


def engine_lines(board: chess.Board, line: list[str]) -> list[dict]:
    mate = solver_mate(board, line)
    sign = 1 if board.turn == chess.WHITE else -1
    return [{"cp": None if mate else sign * 1000, "mate": mate, "pv": line}]


def tags(ex: dict) -> list[tuple[str, dict]]:
    before = chess.Board(ex["fen_before"])
    move = chess.Move.from_uci(ex["blunder"])
    after = before.copy(stack=False)
    after.push(move)
    return motifs.detect(before, move, [], engine_lines(after, ex["line"]), 100.0, None, None)


def themes_from_tags(found: list[tuple[str, dict]] | list[list]) -> set[str]:
    out = set()
    for tag, detail in found:
        if tag == "allowed_mate" and detail.get("in") in (1, 2):
            out.add(f"mateIn{detail['in']}")
        elif tag in TAG_THEMES:
            out.add(TAG_THEMES[tag])
    return out


def predict(ex: dict) -> set[str]:
    return themes_from_tags(tags(ex))
