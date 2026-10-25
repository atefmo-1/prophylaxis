"""Collect every model's test scores into ml/results/metrics.md and metrics.json (committed; no puzzle data)."""

import json
from pathlib import Path

from .dataset import OUT, THEMES
from .fetch import DATA

RESULTS = Path(__file__).resolve().parent.parent / "results"


def _f1(m: dict) -> str:
    return f"{m['f1']:.3f}"


def write() -> Path:
    r = DATA / "results"
    rules = json.loads((r / "rules-test.json").read_text())
    lgbm = json.loads((r / "lgbm.json").read_text())
    cnn = json.loads((r / "cnn.json").read_text())
    onnx = json.loads((r / "onnx.json").read_text())
    stats = json.loads((OUT / "stats.json").read_text())
    web = json.loads((r / "web-test.json").read_text())
    models = {"rules": rules["python"], "lgbm": lgbm["test"], "cnn": cnn["test"], "cnn_int8": onnx["int8"]["test"]}
    lines = [
        (f"Test split: {rules['n']:,} puzzles. F1 at thresholds chosen on validation. "
         f"Python and TypeScript rules disagree on {rules['python_ts_disagree']} puzzles."),
        "",
        "| Theme | Test n | Rules F1 | LightGBM F1 | CNN F1 | CNN int8 F1 (P / R) | In the browser F1 | Best | Model trusted |",
        "|---|---:|---:|---:|---:|---:|---:|---|---|",
    ]
    for t in THEMES:
        scores = {k: v[t]["f1"] for k, v in models.items()}
        best = max(("rules", "lgbm", "cnn"), key=lambda k: scores[k])
        q = models["cnn_int8"][t]
        lines.append(
            f"| {t} | {rules['python'][t]['support']:,} | {_f1(models['rules'][t])} | {_f1(models['lgbm'][t])} "
            f"| {_f1(models['cnn'][t])} | {q['f1']:.3f} ({q['precision']:.2f} / {q['recall']:.2f}) | {_f1(web['scores'][t])} "
            f"| { {'rules': 'rules', 'lgbm': 'LightGBM', 'cnn': 'CNN'}[best]} | {'yes' if t in onnx['trusted'] else 'no'} |"
        )
    named = ["mateIn1", "mateIn2", "fork", "hangingPiece", "backRankMate"]
    for name, agg in (("Macro F1, all 15", THEMES), ("Macro F1, the 5 the rules can name", named)):
        cells = [f"{sum(m[t]['f1'] for t in agg) / len(agg):.3f}" for m in (*models.values(), web["scores"])]
        lines.append(f"| **{name}** | | {' | '.join(cells)} | | |")
    lines += [
        "",
        (f"CNN: {cnn['parameters']:,} parameters; ONNX fp32 {onnx['fp32']['bytes'] / 1e6:.2f} MB, "
         f"int8 {onnx['int8']['bytes'] / 1e6:.2f} MB."),
        "",
        (f"In the browser (TypeScript planes + onnxruntime-web) the int8 model makes "
         f"{web['decisions_differing_from_native']:,} of {web['decisions']:,} theme decisions differently from native "
         "onnxruntime."),
    ]
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / "metrics.md"
    out.write_text("\n".join(lines) + "\n")
    (RESULTS / "metrics.json").write_text(json.dumps({
        "split": stats["counts"], "themes_per_split": stats["themes"], "test": models,
        "browser": web["scores"], "browser_decisions_differing": web["decisions_differing_from_native"],
        "trusted": onnx["trusted"], "lgbm_top_features": lgbm["top_features"],
        "onnx_bytes": {k: onnx[k]["bytes"] for k in ("fp32", "int8")},
    }, indent=1))
    return out
