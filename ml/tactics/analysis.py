"""Questions the metrics table doesn't answer, written to results/analysis.json:
how the shipped model does by puzzle rating; how often it names a theme on puzzles that have none; how the site's
combination (the rules' fork and hanging-piece tags kept, the model's added) scores; and why the rules disagree
with Lichess's labels on forks and hanging pieces."""

import json
from collections import Counter
from multiprocessing import Pool

import chess
import numpy as np
from coach.motifs import VALUE

from . import rules
from .dataset import THEMES, load
from .fetch import DATA
from .metrics import from_sets, labels, per_theme
from .report import RESULTS

BANDS = [(0, 999), (1000, 1399), (1400, 2000)]


def _disagreement(ex: dict) -> tuple[str, str] | None:
    """Why the rules' fork or hanging-piece call differs from Lichess's label, for the first move of the solution."""
    found = rules.predict(ex)
    board = chess.Board(ex["fen"])
    move = chess.Move.from_uci(ex["line"][0])
    if "hangingPiece" in found and "hangingPiece" not in ex["themes"]:
        victim = board.piece_at(move.to_square)
        defended = victim is not None and board.is_attacked_by(victim.color, move.to_square)
        return "hangingPiece", "defended, taken by a cheaper piece" if defended else "undefended"
    if "fork" in found and "fork" not in ex["themes"]:
        moved = board.piece_type_at(move.from_square)
        board.push(move)
        attackers = board.attackers(board.turn, move.to_square)
        can_be_won = bool(attackers) and (
            not board.is_attacked_by(not board.turn, move.to_square)
            or min(VALUE[board.piece_type_at(a)] or 100 for a in attackers) < VALUE[moved]
        )
        return "fork", "forking piece can be won" if can_be_won else "other"
    return None


def run() -> dict:
    examples = load("test")
    y = labels(examples)
    onnx = json.loads((DATA / "results" / "onnx.json").read_text())
    thresholds = np.array([onnx["int8"]["thresholds"][t] for t in THEMES])
    model = (np.load(DATA / "results" / "onnx-int8-test-prob.npy") >= thresholds).astype(np.uint8)
    with Pool() as pool:
        rule = from_sets(pool.map(rules.predict, examples, chunksize=2000))
        why = Counter(k for k in pool.map(_disagreement, examples, chunksize=2000) if k)

    rating = np.array([ex["rating"] for ex in examples])
    bands = {}
    for lo, hi in BANDS:
        m = (rating >= lo) & (rating <= hi)
        r, s = per_theme(y[m], rule[m]), per_theme(y[m], model[m])
        bands[f"{lo}-{hi}"] = {
            "n": int(m.sum()),
            "rules_f1": {t: r[t]["f1"] for t in THEMES},
            "model_f1": {t: s[t]["f1"] for t in THEMES},
            "model_macro_f1": float(np.mean([s[t]["f1"] for t in THEMES])),
        }
    none = y.sum(1) == 0
    union = per_theme(y, rule | model)
    result = {
        "bands": bands,
        "no_theme": {"n": int(none.sum()), "model_names_one": float(model[none].any(1).mean()),
                     "rules_name_one": float(rule[none].any(1).mean())},
        "rules_or_model": {t: union[t] for t in ("fork", "hangingPiece")},
        "rules_false_positives": {f"{theme}: {reason}": n for (theme, reason), n in why.most_common()},
    }
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "analysis.json").write_text(json.dumps(result, indent=1))
    return result
