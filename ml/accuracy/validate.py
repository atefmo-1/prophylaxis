"""Does Prophylaxis's game accuracy agree with chess.com's?

Every random chess.com game in ml/rating's samples where chess.com shows an accuracy for both players (a player ran
Game Review on it): 218 games, 436 player-games. Stockfish 19 (300k nodes per position, as in the other studies)
reads every position; the reference pipeline's formula (src/coach/grading.game_accuracy, which the site's TypeScript
port matches) gives each side's accuracy. Then Pearson and Spearman correlation with chess.com's number, with 95%
intervals from resampling games, the mean difference, and the same by rating band and time control.

    python -m accuracy.validate      # from ml/; engine results are cached in data/accuracy

Writes results/accuracy.json and results/accuracy.md (counts and summary statistics only).
"""

import json
import os
import statistics
from multiprocessing import Pool

os.environ.setdefault("EXTEND", "0")

import chess
import numpy as np
from coach import grading

from causes import classify
from maia.study import _engine

from .paths import DATA, ML, RESULTS

SOURCES = [ML / "data" / "rating" / "games.jsonl", ML / "data" / "rating" / "multi.jsonl"]
BANDS = [("Under 600", 0, 600), ("600 to 999", 600, 1000), ("1000 to 1399", 1000, 1400), ("1400 and up", 1400, 10_000)]
RESAMPLES = 2000


def games() -> list[dict]:
    """Unique games with chess.com's accuracy for both players."""
    seen: dict[str, dict] = {}
    for path in SOURCES:
        for line in path.open():
            g = json.loads(line)
            acc = g.get("accuracies") or {}
            if g.get("pgn") and "white" in acc and "black" in acc and g["url"] not in seen:
                seen[g["url"]] = g
    return list(seen.values())


def engine_pass(todo: list[dict]) -> dict[str, dict]:
    DATA.mkdir(parents=True, exist_ok=True)
    cache = DATA / "engine.jsonl"
    done = {}
    if cache.exists():
        for line in cache.open():
            row = json.loads(line)
            done[row["url"]] = row
    left = [g for g in todo if g["url"] not in done]
    print(f"engine: {len(todo)} games, {len(left)} to read", flush=True)
    with cache.open("a") as f, Pool(max(1, (os.cpu_count() or 2) - 2), initializer=classify._start) as pool:
        for i, row in enumerate(pool.imap_unordered(_engine, left), 1):
            done[row["url"]] = row
            f.write(json.dumps(row) + "\n")
            f.flush()
            if i % 10 == 0:
                print(f"  {i} / {len(left)}", flush=True)
    return done


def _ci(pairs: list[tuple[int, float, float]], stat) -> list[float]:
    """95% interval for a statistic of (game, ours, theirs) rows, resampling whole games."""
    rng = np.random.default_rng(11)
    by_game: dict[int, list] = {}
    for row in pairs:
        by_game.setdefault(row[0], []).append(row)
    keys = list(by_game)
    values = []
    for _ in range(RESAMPLES):
        sample = [r for k in rng.choice(keys, size=len(keys)) for r in by_game[k]]
        values.append(stat([r[1] for r in sample], [r[2] for r in sample]))
    return [round(float(np.percentile(values, 2.5)), 3), round(float(np.percentile(values, 97.5)), 3)]


def _spearman(xs, ys) -> float:
    rank = lambda v: np.argsort(np.argsort(v))
    return float(np.corrcoef(rank(np.array(xs)), rank(np.array(ys)))[0, 1])


def _summary(pairs: list[tuple[int, float, float]], intervals: bool = True) -> dict:
    ours = [p[1] for p in pairs]
    theirs = [p[2] for p in pairs]
    diff = [a - b for a, b in zip(ours, theirs)]
    out = {"player_games": len(pairs), "games": len({p[0] for p in pairs}),
           "pearson": round(statistics.correlation(ours, theirs), 3), "spearman": round(_spearman(ours, theirs), 3),
           "mean_difference": round(statistics.fmean(diff), 2), "mean_absolute_difference": round(statistics.fmean(map(abs, diff)), 2),
           "within_5_points": round(sum(abs(d) <= 5 for d in diff) / len(diff), 3)}
    if intervals:
        out["pearson_95"] = _ci(pairs, statistics.correlation)
        out["spearman_95"] = _ci(pairs, _spearman)
    return out


def main() -> dict:
    sample = games()
    rows = engine_pass(sample)
    pairs, meta = [], []
    for gi, g in enumerate(sample):
        row = rows[g["url"]]
        first = chess.Board(row["rows"][0]["fen"]).turn
        acc = grading.game_accuracy([r["win_white"] for r in row["rows"]], first)
        for color, side in ((chess.WHITE, "white"), (chess.BLACK, "black")):
            if acc[color] is None:
                continue
            pairs.append((gi, acc[color], float(g["accuracies"][side])))
            meta.append({"rating": g[side]["rating"], "time_class": g.get("time_class")})
    result = {"nodes": classify.NODES, "overall": _summary(pairs), "by_rating": {}, "by_time_class": {}}
    for name, lo, hi in BANDS:
        part = [p for p, m in zip(pairs, meta) if lo <= m["rating"] < hi]
        if len(part) >= 20:
            result["by_rating"][name] = _summary(part, intervals=False)
    for tc in sorted({m["time_class"] for m in meta}):
        part = [p for p, m in zip(pairs, meta) if m["time_class"] == tc]
        if len(part) >= 20:
            result["by_time_class"][tc] = _summary(part, intervals=False)
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "accuracy.json").write_text(json.dumps(result, indent=1) + "\n")
    print(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    main()
