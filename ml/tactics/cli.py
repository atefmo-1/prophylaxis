"""`uv run tactics <step>`: each step reads the previous one's output from ml/data. `uv run tactics all` runs them
in order, each in its own process (LightGBM and PyTorch each bring their own OpenMP runtime)."""

import subprocess
import sys

STEPS = ["fetch", "data", "rules", "encode", "lgbm", "cnn", "export", "web", "fixtures", "report", "analysis", "games", "blunders", "real", "bundle"]


def _print_scores(scores: dict) -> None:
    for theme, m in scores.items():
        print(f"  {theme:18s} P {m['precision']:.3f}  R {m['recall']:.3f}  F1 {m['f1']:.3f}  (n={m['support']})")


def run(step: str) -> None:
    if step == "fetch":
        from .fetch import fetch

        print(fetch())
    elif step == "data":
        from .dataset import build

        print(build())
    elif step == "rules":
        from .baseline import run as rules

        result = rules("test")
        print(f"python and typescript rules disagree on {result['python_ts_disagree']} of {result['n']} puzzles")
        _print_scores(result["python"])
    elif step == "encode":
        from .encode import build

        build()
    elif step == "lgbm":
        from . import gbm

        _print_scores(gbm.train()["test"])
    elif step == "cnn":
        from . import cnn

        _print_scores(cnn.train()["test"])
    elif step == "export":
        from .export import export

        report = export()
        print(f"int8 model: {report['int8']['bytes'] / 1e6:.2f} MB (fp32 {report['fp32']['bytes'] / 1e6:.2f} MB)")
        print(f"trusted over the rules for: {', '.join(report['trusted'])}")
    elif step == "web":
        from .baseline import shipped

        result = shipped("test")
        print(f"onnxruntime-web differs from native onnxruntime on {result['decisions_differing_from_native']} "
              f"of {result['decisions']} theme decisions")
        _print_scores(result["scores"])
    elif step == "fixtures":
        from .fixtures import build

        print(build())
    elif step == "report":
        from .report import write

        print(write())
    elif step == "analysis":
        from .analysis import run as analyse

        result = analyse()
        for band, b in result["bands"].items():
            print(f"  rating {band}: {b['n']} puzzles, model macro F1 {b['model_macro_f1']:.3f}")
        for theme, m in result["rules_or_model"].items():
            print(f"  rules or model, {theme}: F1 {m['f1']:.3f}")
        for reason, n in result["rules_false_positives"].items():
            print(f"  rules' extra {reason}: {n}")
    elif step == "games":
        from .games import fetch_games

        print(fetch_games())
    elif step == "blunders":
        from .games import find_blunders

        print(find_blunders())
    elif step == "real":
        from .games import score

        result = score()
        test = result["test"]
        print(f"  test half: {test['n']} blunders from {test['games']} games")
        for theme, m in test["themes"].items():
            print(f"  {theme:18s} n={m['support']:4d}  rules {m['rules']['f1']:.3f}  model {m['model']['f1']:.3f}"
                  f"  site {m['site']['f1']:.3f}")
        for theme, why in result["decisions"].items():
            print(f"  {theme}: {why}")
    elif step == "bundle":
        from .bundle import build

        print(build())
    else:
        sys.exit(f"usage: tactics {{{'|'.join(STEPS + ['all'])}}}")


def main() -> None:
    step = sys.argv[1] if len(sys.argv) > 1 else ""
    if step == "all":
        for s in STEPS:
            print(f"== {s}", flush=True)
            subprocess.run([sys.executable, "-m", "tactics.cli", s], check=True)
    else:
        run(step)


if __name__ == "__main__":
    main()
