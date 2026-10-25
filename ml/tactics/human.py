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


def _english(board: chess.Board, move: chess.Move) -> str:
    """One move in plain English, for someone new to chess notation."""
    side, piece = _side(board.turn), NAMES[board.piece_type_at(move.from_square)]
    other = _side(not board.turn)
    if board.is_castling(move):
        text = f"{side} castles: the king moves two squares towards a rook, and the rook jumps over to its other side"
    elif board.is_en_passant(move):
        text = f"{side}'s pawn on {chess.square_name(move.from_square)} takes {other}'s pawn en passant (a special pawn capture)"
    elif board.is_capture(move):
        victim = NAMES[board.piece_type_at(move.to_square)]
        text = f"{side}'s {piece} on {chess.square_name(move.from_square)} takes {other}'s {victim} on {chess.square_name(move.to_square)}"
    else:
        text = f"{side}'s {piece} moves from {chess.square_name(move.from_square)} to {chess.square_name(move.to_square)}"
    if move.promotion:
        text += f", and the pawn turns into a {NAMES[move.promotion]}"
    after = board.copy(stack=False)
    after.push(move)
    if after.is_checkmate():
        text += ". That is checkmate: the king is attacked and can't escape, so the game is over"
    elif after.is_check():
        text += ", attacking the king (check)"
    return text + "."


def _question(ex: dict, theme: str) -> dict:
    board = chess.Board(ex["fen"])
    line = model_line(board, [chess.Move.from_uci(u) for u in ex["line"]])
    me, them = _side(board.turn), _side(not board.turn)
    key = line[0]
    sans, steps, b = [], [], board.copy(stack=False)
    for move in line:
        sans.append(b.san(move))
        text = _english(b, move)
        b.push(move)
        steps.append({"fen": b.fen(), "arrow": [chess.square_name(move.from_square), chess.square_name(move.to_square)],
                      "text": text})
    after = board.copy(stack=False)
    after.push(key)
    moved = NAMES[after.piece_type_at(key.to_square)]
    shown, arrows, auto = board.fen(), _arrows(board, key), None
    to = chess.square_name(key.to_square)
    if theme == "fork":
        ask = (f"{me}'s {moved} moves to {to} (blue arrow). Look at the red arrows that start from that {moved}: does it "
               f"now attack two or more of {them}'s pieces at the same time? (Attacking the king counts.)")
    elif theme == "pin":
        ask = (f"After {me}'s move (blue arrow), is there a {me} bishop, rook or queen lined up with two of {them}'s pieces "
               f"in a row, so that the front one can't move away without leaving the one behind it (more valuable, or the "
               f"king) open to capture?")
    elif theme == "skewer":
        ask = (f"After {me}'s move (blue arrow), does a {me} bishop, rook or queen attack a valuable {them} piece (or the "
               f"king) with another {them} piece directly behind it on the same line, so that when the front piece "
               f"steps away, the one behind can be taken?")
    elif theme == "discoveredAttack":
        ask = (f"{me}'s move (blue arrow) gets a piece out of the way. Does a different {me} piece, the one that was behind "
               f"it, now attack one of {them}'s pieces (or the king) that it couldn't reach before?")
    elif theme == "trappedPiece":
        square = _trapped_piece(after, board.turn)
        piece = (f"{them}'s {NAMES[after.piece_type_at(square)]} on {chess.square_name(square)}" if square
                 else f"one of {them}'s pieces")
        ask = (f"After {me}'s move (blue arrow), is {piece} under attack with no safe square to run to, so {them} is "
               f"going to lose it?")
    else:  # backRankMate
        shown, arrows = b.fen(), []
        row = "8 (the top row from White's side)" if them == "Black" else "1 (the bottom row from White's side)"
        if not b.is_checkmate():
            # Not checkmate at all, so not a back-rank mate: that is a fact, not something to ask a person.
            auto = "no"
        ask = (f"This is the end of the line, and it is checkmate. Is {them}'s king on its own back row, row {row}, with "
               f"the squares just in front of it filled by {them}'s own pieces, so it was boxed in by them?")
    return {"fen": shown, "orientation": "white" if board.turn == chess.WHITE else "black", "arrows": arrows,
            "line": " ".join(sans), "steps": steps, "start": board.fen(), "question": ask, "auto": auto}


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
    page = [{k: q[k] for k in ("id", "fen", "orientation", "arrows", "line", "steps", "start", "question")}
            for q in questions if not q["auto"]]
    (HUMAN / "page.json").write_text(json.dumps(page, separators=(",", ":")))
    return {"questions": len(questions), "by_group": {g: sum(q["group"] == g for q in questions) for g in PER_GROUP}}


def score(answers_path: str) -> dict:
    """answers.json: {question id: "yes" | "no" | "unsure"}. Per theme and group, how often the answer was yes.
    Back-rank questions whose line isn't checkmate are answered "no" automatically and never shown."""
    from .report import RESULTS

    questions = json.loads((HUMAN / "questions.json").read_text())
    answers = json.loads(Path(answers_path).read_text())
    table: dict = {}
    for q in questions:
        a = q["auto"] or answers.get(q["id"])
        if a not in ("yes", "no"):
            continue
        cell = table.setdefault(q["theme"], {}).setdefault(q["group"], {"yes": 0, "no": 0})
        cell[a] += 1
    totals = {g: {"yes": sum(t.get(g, {}).get("yes", 0) for t in table.values()),
                  "no": sum(t.get(g, {}).get("no", 0) for t in table.values())} for g in PER_GROUP}
    result = {"answered": sum(a in ("yes", "no") for a in answers.values()), "unsure": sum(a == "unsure" for a in answers.values()),
              "automatic": sum(bool(q["auto"]) for q in questions), "questions": len(questions), "by_theme": table,
              "by_group": totals}
    (RESULTS / "human.json").write_text(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    print(score(sys.argv[1]))
