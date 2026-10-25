"""Score the rule-based detectors, in Python and in the site's TypeScript port, on a split."""

import json
import subprocess
from multiprocessing import Pool
from pathlib import Path

from . import rules
from .dataset import OUT, load
from .fetch import DATA
from .metrics import from_sets, labels, per_theme

WEB = Path(__file__).resolve().parents[2] / "web"


def python_rules(examples: list[dict]) -> list[set[str]]:
    with Pool() as pool:
        return pool.map(rules.predict, examples, chunksize=500)


def typescript_rules(split: str) -> dict[str, set[str]]:
    script = WEB / "scripts" / "rules-on-puzzles.ts"
    run = subprocess.run(["node", str(script), str(OUT / f"{split}.jsonl")], cwd=WEB, capture_output=True,
                         text=True, check=True)
    return {(row := json.loads(line))["id"]: rules.themes_from_tags(row["tags"]) for line in run.stdout.splitlines()}


def run(split: str = "test") -> dict:
    examples = load(split)
    y = labels(examples)
    py = python_rules(examples)
    ts_by_id = typescript_rules(split)
    ts = [ts_by_id[ex["id"]] for ex in examples]
    result = {
        "split": split,
        "n": len(examples),
        "python": per_theme(y, from_sets(py)),
        "typescript": per_theme(y, from_sets(ts)),
        "python_ts_disagree": sum(a != b for a, b in zip(py, ts)),
    }
    (DATA / "results").mkdir(exist_ok=True)
    (DATA / "results" / f"rules-{split}.json").write_text(json.dumps(result, indent=1))
    return result


def shipped(split: str = "test") -> dict:
    """Score the model as the site runs it: TypeScript planes and onnxruntime-web (web/scripts/tactics-on-puzzles.ts)."""
    import numpy as np

    from .dataset import THEMES

    examples = load(split)
    script = WEB / "scripts" / "tactics-on-puzzles.ts"
    run = subprocess.run(["node", str(script), str(OUT / f"{split}.jsonl")], cwd=WEB, capture_output=True,
                         text=True, check=True)
    by_id = {(row := json.loads(line))["id"]: set(row["themes"]) for line in run.stdout.splitlines()}
    web = from_sets([by_id[ex["id"]] for ex in examples])
    onnx = json.loads((DATA / "results" / "onnx.json").read_text())
    native = np.load(DATA / "results" / "onnx-int8-test-prob.npy") >= np.array([onnx["int8"]["thresholds"][t] for t in THEMES])
    result = {
        "split": split,
        "scores": per_theme(labels(examples), web),
        "decisions_differing_from_native": int((native != web.astype(bool)).sum()),
        "decisions": int(web.size),
    }
    (DATA / "results" / f"web-{split}.json").write_text(json.dumps(result, indent=1))
    return result
