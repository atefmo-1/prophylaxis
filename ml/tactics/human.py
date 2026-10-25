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
# The rule for every question: the tactic counts if the side that moves first uses it anywhere in the line, which is
# how Lichess's tagger (and so the labels) define a theme. Questions first asked only about the first move; answers
# given to that wording are kept but not scored (the review page asks to confirm them).
ANYWHERE_REV = 2
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
    sans, steps, b = [], [], board.copy(stack=False)
    for i, move in enumerate(line):
        sans.append(b.san(move))
        text = _english(b, move)
        # The attacking side's moves show what they attack; the replies show just the move.
        arrows = _arrows(b, move) if i % 2 == 0 else [[chess.square_name(move.from_square), chess.square_name(move.to_square), "move"]]
        b.push(move)
        steps.append({"fen": b.fen(), "arrows": arrows, "text": text})
    shown, auto, rev = board.fen(), None, ANYWHERE_REV
    anywhere = f"{me} moves first. Play the moves and look at the whole line, not just the first move."
    if theme == "fork":
        ask = (f"{anywhere} At any point, does one of {me}'s pieces move to a square where it attacks two or more of "
               f"{them}'s pieces at the same time? (Attacking the king counts.)")
    elif theme == "pin":
        ask = (f"{anywhere} At any point, does {me} use a pin: a {me} bishop, rook or queen lined up with two of {them}'s "
               f"pieces, so the front one can't move without leaving a more valuable piece (or the king) behind it open, "
               f"and does that pin help {me} win material or give mate? A pin that is on the board but plays no part in "
               f"the line counts as No.")
    elif theme == "skewer":
        ask = (f"{anywhere} At any point, does {me} use a skewer: a {me} bishop, rook or queen attacks a valuable "
               f"{them} piece (or the king), and when that piece steps away, the {them} piece behind it on the same line "
               f"can be taken?")
    elif theme == "discoveredAttack":
        ask = (f"{anywhere} At any point, does one of {me}'s moves get a piece out of the way, so that a different {me} "
               f"piece that was behind it now attacks one of {them}'s pieces (or the king)?")
    elif theme == "trappedPiece":
        ask = (f"{anywhere} At any point, does one of {them}'s pieces end up attacked with no safe square to run to, so "
               f"that {me} wins it?")
    else:  # backRankMate: about the end of the line from the start, so its wording and answers never changed
        shown, rev = b.fen(), 1
        row = "8 (the top row from White's side)" if them == "Black" else "1 (the bottom row from White's side)"
        if not b.is_checkmate():
            # Not checkmate at all, so not a back-rank mate: that is a fact, not something to ask a person.
            auto = "no"
        ask = (f"This is the end of the line, and it is checkmate. Is {them}'s king on its own back row, row {row}, with "
               f"the squares just in front of it filled by {them}'s own pieces, so it was boxed in by them?")
    return {"fen": shown, "orientation": "white" if board.turn == chess.WHITE else "black", "arrows": [],
            "line": " ".join(sans), "steps": steps, "start": board.fen(), "question": ask, "auto": auto, "rev": rev}


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
    page = [{k: q[k] for k in ("id", "fen", "orientation", "arrows", "line", "steps", "start", "question", "rev")}
            for q in questions if not q["auto"]]
    (HUMAN / "page.json").write_text(json.dumps(page, separators=(",", ":")))
    return {"questions": len(questions), "by_group": {g: sum(q["group"] == g for q in questions) for g in PER_GROUP}}


def score(answers_path: str) -> dict:
    """answers.json: {question id: {"answer": "yes" | "no" | "unsure", "rev": n}}, as the review page stores them.
    An answer counts only if it was given to the question's current wording (rev). Back-rank questions whose line
    isn't checkmate are answered "no" automatically and never shown. Per theme and group: how often the answer was
    yes."""
    from .report import RESULTS

    questions = json.loads((HUMAN / "questions.json").read_text())
    answers = json.loads(Path(answers_path).read_text())
    table: dict = {}
    counted = unsure = stale = 0
    for q in questions:
        given = answers.get(q["id"])
        if q["auto"]:
            a = q["auto"]
        elif given and given.get("rev", 1) >= q["rev"]:
            a = given["answer"]
            counted += a in ("yes", "no")
            unsure += a == "unsure"
        else:
            stale += given is not None
            continue
        if a not in ("yes", "no"):
            continue
        cell = table.setdefault(q["theme"], {}).setdefault(q["group"], {"yes": 0, "no": 0})
        cell[a] += 1
    totals = {g: {"yes": sum(t.get(g, {}).get("yes", 0) for t in table.values()),
                  "no": sum(t.get(g, {}).get("no", 0) for t in table.values())} for g in PER_GROUP}
    result = {
        "rule": "a tactic counts if the side that moves first uses it anywhere in the line",
        "who": "the owner, some answers checked with Claude's help: not purely human labels",
        "answered": counted, "unsure": unsure, "old_wording_not_counted": stale,
        "automatic": sum(bool(q["auto"]) for q in questions), "questions": len(questions),
        "by_theme": table, "by_group": totals,
    }
    (RESULTS / "human.json").write_text(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    print(score(sys.argv[1]))
