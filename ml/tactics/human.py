"""A check by a person: real blunders from the test half, each with one plain question about the board.

For each tactic the site names, three kinds of case, shown in a shuffled order without saying which is which:
both the model and Lichess's tagger see the tactic, only the model sees it, or only the tagger does. The answers
say how often each side is right where they disagree, which neither label can say about itself.

`uv run tactics human` writes data/human/questions.json (with the hidden groups) and data/human/page.json (what
the review page shows). `uv run tactics human-score <answers.json>` scores the answers into results/human.json.
"""

import hashlib
import json
import random
import sys
from pathlib import Path

import chess
import numpy as np

from .dataset import THEMES
from .fetch import DATA
from .games import OUT, half
from .planes import encode, model_line

HUMAN = DATA / "human"
PER_GROUP = {"both": 3, "model": 3, "tagger": 2}
SHOWN = ["fork", "pin", "skewer", "discoveredAttack", "trappedPiece", "backRankMate"]
NAMES = {chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop", chess.ROOK: "rook", chess.QUEEN: "queen",
         chess.KING: "king"}
VALUE = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100}
SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)


def _side(color: chess.Color) -> str:
    return "White" if color == chess.WHITE else "Black"


def _arrows(board: chess.Board, move: chess.Move) -> list[list[str]]:
    """The move, and every piece it newly attacks (from the moved piece or a piece it uncovers), continued through a
    slider's line to a second piece behind: the same drawing as web/src/lib/shapes.ts."""
    me = board.turn
    after = board.copy(stack=False)
    after.push(move)
    out = [[chess.square_name(move.from_square), chess.square_name(move.to_square), "move"]]
    for victim in chess.SquareSet(after.occupied_co[not me]):
        piece = after.piece_at(victim)
        defended = after.is_attacked_by(not me, victim)
        if VALUE[piece.piece_type] < 3 and defended:
            continue
        for frm in after.attackers(me, victim):
            if frm in board.attackers(me, victim) and frm != move.to_square:
                continue
            out.append([chess.square_name(frm), chess.square_name(victim), "target"])
            if after.piece_type_at(frm) in SLIDERS:
                for s in chess.SquareSet.ray(frm, victim):
                    if chess.square_distance(frm, s) <= chess.square_distance(frm, victim):
                        continue
                    if chess.square_distance(frm, s) != chess.square_distance(frm, victim) + chess.square_distance(victim, s):
                        continue
                    behind = after.piece_at(s)
                    if behind:
                        if behind.color != me and VALUE[behind.piece_type] >= 3:
                            out.append([chess.square_name(frm), chess.square_name(s), "target"])
                        break
    return out


def _trapped_piece(after: chess.Board, me: chess.Color) -> chess.Square | None:
    for square in chess.SquareSet(after.occupied_co[not me]):
        pt = after.piece_type_at(square)
        if pt in (chess.PAWN, chess.KING) or not after.is_attacked_by(me, square):
            continue
        if all(
            after.color_at(t) == (not me) or (after.is_attacked_by(me, t) and VALUE.get(after.piece_type_at(t), 0) < VALUE[pt])
            for t in after.attacks(square)
        ):
            return square
    return None


def _question(ex: dict, theme: str) -> dict:
    board = chess.Board(ex["fen"])
    line = model_line(board, [chess.Move.from_uci(u) for u in ex["line"]])
    me, them = _side(board.turn), _side(not board.turn)
    key = line[0]
    sans, b = [], board.copy(stack=False)
    for move in line:
        sans.append(b.san(move))
        b.push(move)
    after = board.copy(stack=False)
    after.push(key)
    moved = NAMES[after.piece_type_at(key.to_square)]
    shown, arrows = board.fen(), _arrows(board, key)
    to = chess.square_name(key.to_square)
    if theme == "fork":
        ask = (f"{me} plays the {moved} to {to} (blue arrow). After that move, does this one {moved} attack two or more of "
               f"{them}'s pieces at the same time (counting a check on the king)?")
    elif theme == "pin":
        ask = (f"{me} plays {sans[0]} (blue arrow). Does a {me} bishop, rook or queen now attack a {them} piece that can't "
               f"move away without leaving a more valuable {them} piece (or the king) behind it open to capture?")
    elif theme == "skewer":
        ask = (f"{me} plays {sans[0]} (blue arrow). Does a {me} bishop, rook or queen now attack a valuable {them} piece "
               f"(or give check) with another {them} piece behind it on the same line, so that when the front piece moves "
               f"away, the one behind can be taken?")
    elif theme == "discoveredAttack":
        ask = (f"{me} plays {sans[0]} (blue arrow). Did that move get out of the way of another {me} piece, so that the "
               f"other piece now attacks something of {them}'s (or gives check) that it was blocked from before?")
    elif theme == "trappedPiece":
        square = _trapped_piece(after, board.turn)
        piece = f"the {them} {NAMES[after.piece_type_at(square)]} on {chess.square_name(square)}" if square else f"one of {them}'s pieces"
        ask = (f"{me} plays {sans[0]} (blue arrow). Is {piece} now attacked with no safe square to escape to, so it is "
               f"going to be lost?")
    else:  # backRankMate
        shown, arrows = b.fen(), []
        ask = (f"This is the position at the end of the line {' '.join(sans)}. Is the {them} king checkmated on its own "
               f"back row (the row it started on), with its escape squares blocked by its own pieces?")
    return {"fen": shown, "orientation": "white" if board.turn == chess.WHITE else "black", "arrows": arrows,
            "line": " ".join(sans), "question": ask}


def build(seed: int = 7) -> dict:
    from .export import WEB_MODELS, run

    examples = [ex for line in (OUT / "blunders.jsonl").open() if half((ex := json.loads(line))["game"]) == "test"]
    meta = json.loads((WEB_MODELS / "tactics.json").read_text())
    planes = []
    for ex in examples:
        board = chess.Board(ex["fen"])
        planes.append(encode(board, model_line(board, [chess.Move.from_uci(u) for u in ex["line"]])))
    model = run(WEB_MODELS / "tactics.onnx", np.stack(planes)) >= np.array(meta["thresholds"])
    rng = random.Random(seed)
    questions = []
    for theme in SHOWN:
        i = THEMES.index(theme)
        groups = {
            "both": [ex for ex, m in zip(examples, model) if m[i] and theme in ex["themes"]],
            "model": [ex for ex, m in zip(examples, model) if m[i] and theme not in ex["themes"]],
            "tagger": [ex for ex, m in zip(examples, model) if not m[i] and theme in ex["themes"]],
        }
        for group, n in PER_GROUP.items():
            for ex in rng.sample(groups[group], min(n, len(groups[group]))):
                qid = hashlib.blake2b(f"{ex['id']}-{theme}".encode(), digest_size=4).hexdigest()
                questions.append({"id": qid, "theme": theme, "group": group, "example": ex["id"], **_question(ex, theme)})
    rng.shuffle(questions)
    HUMAN.mkdir(parents=True, exist_ok=True)
    (HUMAN / "questions.json").write_text(json.dumps(questions, indent=1))
    page = [{k: q[k] for k in ("id", "fen", "orientation", "arrows", "line", "question")} for q in questions]
    (HUMAN / "page.json").write_text(json.dumps(page, separators=(",", ":")))
    return {"questions": len(questions), "by_group": {g: sum(q["group"] == g for q in questions) for g in PER_GROUP}}


def score(answers_path: str) -> dict:
    """answers.json: {question id: "yes" | "no" | "unsure"}. Per theme and group, how often the person said yes."""
    from .report import RESULTS

    questions = json.loads((HUMAN / "questions.json").read_text())
    answers = json.loads(Path(answers_path).read_text())
    table: dict = {}
    for q in questions:
        a = answers.get(q["id"])
        if a not in ("yes", "no"):
            continue
        cell = table.setdefault(q["theme"], {}).setdefault(q["group"], {"yes": 0, "no": 0})
        cell[a] += 1
    totals = {g: {"yes": sum(t.get(g, {}).get("yes", 0) for t in table.values()),
                  "no": sum(t.get(g, {}).get("no", 0) for t in table.values())} for g in PER_GROUP}
    result = {"answered": sum(a in ("yes", "no") for a in answers.values()), "unsure": sum(a == "unsure" for a in answers.values()),
              "questions": len(questions), "by_theme": table, "by_group": totals}
    (RESULTS / "human.json").write_text(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    print(score(sys.argv[1]))
