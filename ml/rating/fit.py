"""Can one game's accuracy estimate a chess.com rating? Fit, cross-validate and export the model.

Inputs (ml/data/rating, never committed): games.jsonl + reviewed.jsonl (one game per sampled player, reviewed by
web/scripts/analyse-games.mjs with the site's own Stockfish 19 Lite analysis) and, if present, multi.jsonl +
multi_reviewed.jsonl (~20 recent games for a subset of players). Outputs (aggregates only): ml/rating/model.json and
ml/rating/results.json.

    uv run --frozen python -m rating.fit
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.optimize import lsq_linear
from scipy.stats import pearsonr, spearmanr
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import GroupKFold

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data" / "rating"
TCS = ("blitz", "rapid")
BANDS = [0, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200]
Q = (0.1, 0.25, 0.5, 0.75, 0.9)
FOLDS = 10


def band(r: float) -> int:
    return max(b for b in BANDS if r >= b)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.open()] if path.exists() else []


def sides(games: list[dict], reviewed: list[dict]) -> list[dict]:
    """Both sides of every reviewed game: rating, time class, our accuracy, chess.com's, move features."""
    rev = {r["url"]: r for r in reviewed if "error" not in r}
    out = []
    for gi, g in enumerate(games):
        r = rev.get(g["url"])
        if not r or r["white_accuracy"] is None or r["black_accuracy"] is None:
            continue
        ww = [r["start_win_white"], *r["win_white"]]
        for color in ("white", "black"):
            white = color == "white"
            plies = [i for i in range(len(r["classes"])) if (i % 2 == 0) == white]
            loss = [max(0.0, (ww[i] - ww[i + 1]) if white else (ww[i + 1] - ww[i])) for i in plies]
            live = [x for x, i in zip(loss, plies) if not r["decided"][i]] or [0.0]
            cls = [r["classes"][i] for i in plies]
            out.append({
                "game": gi,
                "url": g["url"],
                "user": g.get("_sampled"),
                "sampled_side": g.get("_side") == color,
                "band_game": g.get("_band"),
                "source": g.get("_source", ""),
                "color": color,
                "tc": g["time_class"],
                "rating": g[color]["rating"],
                "acc": r[f"{color}_accuracy"],
                "cc_acc": (g.get("accuracies") or {}).get(color),
                "moves": len(plies),
                "mean_loss": float(np.mean(live)),
                "blunders": sum(c == "blunder" for c in cls) / len(cls),
                "mistakes": sum(c in ("mistake", "miss") for c in cls) / len(cls),
                "end_time": g["end_time"],
            })
    return out


# ---- models -------------------------------------------------------------------------------------------------------

class Median:
    def fit(self, x, y, w):
        self.m = weighted_quantile(y, w, 0.5)
        return self

    def predict(self, x):
        return np.full(len(x), self.m)


class Linear:
    def fit(self, x, y, w):
        X = np.c_[np.ones(len(x)), x]
        sw = np.sqrt(w)
        self.b = np.linalg.lstsq(X * sw[:, None], y * sw, rcond=None)[0]
        return self

    def predict(self, x):
        return np.c_[np.ones(len(x)), x] @ self.b


class Isotonic:
    def fit(self, x, y, w):
        self.m = IsotonicRegression(out_of_bounds="clip").fit(x[:, 0], y, sample_weight=w)
        return self

    def predict(self, x):
        return self.m.predict(x[:, 0])


class MonotoneSpline:
    """Piecewise-linear, non-decreasing in accuracy: values at knots, linear in between, flat outside."""

    def __init__(self, knots: int = 8, extra: bool = False):
        self.k, self.extra = knots, extra

    def basis(self, x):
        a = x[:, 0]
        t = self.t
        B = np.stack([np.clip((a - t[i]) / (t[i + 1] - t[i]), 0, 1) for i in range(len(t) - 1)], 1)
        cols = [np.ones(len(a)), B]
        if self.extra:
            cols.append(x[:, 1:])
        return np.column_stack(cols)

    def fit(self, x, y, w):
        self.t = np.unique(np.quantile(x[:, 0], np.linspace(0.02, 0.98, self.k)))
        B = self.basis(x)
        sw = np.sqrt(w)
        lo = np.r_[-np.inf, np.zeros(len(self.t) - 1), np.full(B.shape[1] - len(self.t), -np.inf)]
        self.c = lsq_linear(B * sw[:, None], y * sw, bounds=(lo, np.inf)).x
        return self

    def predict(self, x):
        return self.basis(x) @ self.c

    def values(self):
        return (self.c[0] + np.r_[0, np.cumsum(self.c[1:len(self.t)])]).tolist()


class Gbm:
    """A ceiling check: boosted trees on every feature, monotone in accuracy."""

    def fit(self, x, y, w):
        from sklearn.ensemble import HistGradientBoostingRegressor

        self.m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.03, max_leaf_nodes=8, min_samples_leaf=20,
                                               monotonic_cst=[1] + [0] * (x.shape[1] - 1), random_state=0)
        self.m.fit(x, y, sample_weight=w)
        return self

    def predict(self, x):
        return self.m.predict(x)


def weighted_quantile(v, w, q):
    o = np.argsort(v)
    v, w = np.asarray(v)[o], np.asarray(w)[o]
    c = (np.cumsum(w) - 0.5 * w) / w.sum()
    return np.interp(q, c, v)


# ---- evaluation ---------------------------------------------------------------------------------------------------

def features(rows, which):
    cols = {
        "acc": [r["acc"] for r in rows],
        "log_moves": [np.log(r["moves"]) for r in rows],
        "mean_loss": [r["mean_loss"] for r in rows],
        "blunders": [r["blunders"] for r in rows],
        "mistakes": [r["mistakes"] for r in rows],
        "cc_acc": [r["cc_acc"] for r in rows],
    }
    return np.column_stack([np.asarray(cols[c], float) for c in which])


MODELS = {
    "median": (lambda: Median(), ["acc"]),
    "linear": (lambda: Linear(), ["acc"]),
    "isotonic": (lambda: Isotonic(), ["acc"]),
    "monotone spline": (lambda: MonotoneSpline(8), ["acc"]),
    "spline + moves": (lambda: MonotoneSpline(8, extra=True), ["acc", "log_moves"]),
    "spline + moves + errors": (lambda: MonotoneSpline(8, extra=True), ["acc", "log_moves", "blunders", "mistakes", "mean_loss"]),
    "gbm, all features": (lambda: Gbm(), ["acc", "log_moves", "blunders", "mistakes", "mean_loss"]),
}


def crossval(rows, weights, make, which, seed=0):
    """Held-out predictions and 80% intervals, folds grouped by game (both sides of a game in one fold), one model
    per time class. The interval adds the weighted 10th and 90th percentiles of held-out residuals."""
    rows = np.array(rows, dtype=object)
    pred = np.full(len(rows), np.nan)
    lo = np.full(len(rows), np.nan)
    hi = np.full(len(rows), np.nan)
    groups = np.array([r["game"] for r in rows])
    rng = np.random.default_rng(seed)
    perm = rng.permutation(np.unique(groups))
    fold_of = {g: i % FOLDS for i, g in enumerate(perm)}
    folds = np.array([fold_of[g] for g in groups])
    tcs = np.array([r["tc"] for r in rows])
    y = np.array([r["rating"] for r in rows], float)
    for f in range(FOLDS):
        for tc in TCS:
            tr = (folds != f) & (tcs == tc)
            te = (folds == f) & (tcs == tc)
            if not te.any():
                continue
            xtr, xte = features(rows[tr], which), features(rows[te], which)
            pred[te] = make().fit(xtr, y[tr], weights[tr]).predict(xte)
    # Intervals from the other folds' held-out residuals, so a model that fits its training data closely (boosting)
    # doesn't get an interval that is too narrow.
    res = y - pred
    for f in range(FOLDS):
        for tc in TCS:
            te = (folds == f) & (tcs == tc)
            other = (folds != f) & (tcs == tc)
            if te.any():
                lo[te] = pred[te] + weighted_quantile(res[other], weights[other], 0.1)
                hi[te] = pred[te] + weighted_quantile(res[other], weights[other], 0.9)
    return pred, lo, hi


def summarise(y, pred, lo, hi, w, mask):
    e = (y - pred)[mask]
    ww = w[mask]
    cover = ((y >= lo) & (y <= hi))[mask]
    return {
        "n": int(mask.sum()),
        "mae": float(np.average(np.abs(e), weights=ww)),
        "sd": float(np.sqrt(np.average((e - np.average(e, weights=ww)) ** 2, weights=ww))),
        "bias": float(np.average(e, weights=ww)),
        "pi80_width": float(np.average((hi - lo)[mask], weights=ww)),
        "pi80_coverage": float(np.average(cover, weights=ww)),
    }


def main() -> None:
    games = load_jsonl(DATA / "games.jsonl")
    rows = sides(games, load_jsonl(DATA / "reviewed.jsonl"))
    meta = json.loads((DATA / "sample_meta.json").read_text()) if (DATA / "sample_meta.json").exists() else {}
    multi_games = load_jsonl(DATA / "multi.jsonl")
    multi_rows = sides(multi_games, load_jsonl(DATA / "multi_reviewed.jsonl"))
    multi_users = {g["_sampled"] for g in multi_games}

    # Population weights: the random draw's band mix over the stratified sample's (by the game's sampled band).
    natural = {int(k): v for k, v in meta.get("natural_bands", {}).items()}
    taken: dict[int, int] = {}
    for r in rows:
        if r["sampled_side"]:
            taken[r["band_game"]] = taken.get(r["band_game"], 0) + 1
    nat_total, take_total = sum(natural.values()) or 1, sum(taken.values()) or 1
    bw = {b: (natural.get(b, 0) / nat_total) / (taken[b] / take_total) for b in taken} if natural else {}
    # A band with almost no random players (2200+) still keeps a small weight so the curve's top end is defined.
    floor = 0.05
    W = np.array([max(bw.get(r["band_game"], 1.0), floor) for r in rows]) if bw else np.ones(len(rows))
    U = np.ones(len(rows))
    y = np.array([r["rating"] for r in rows], float)
    tcs = np.array([r["tc"] for r in rows])

    results: dict = {
        "data": {
            "games": len({r["game"] for r in rows}),
            "sides": len(rows),
            "by_tc": {tc: int((tcs == tc).sum()) for tc in TCS},
            "by_band": {b: int(sum(band(r["rating"]) == b for r in rows)) for b in BANDS},
            "players_tried": meta.get("players_tried"),
            "requests": meta.get("requests"),
            "natural_band_share": {b: natural.get(b, 0) / nat_total for b in BANDS} if natural else None,
            "titled_games": len({r["game"] for r in rows if r["source"].startswith("titled")}),
            "rating_quantiles": {str(q): float(np.quantile(y, q)) for q in Q},
            "acc_quantiles": {str(q): float(np.quantile([r["acc"] for r in rows], q)) for q in Q},
        },
        "cv": {},
    }
    # Accuracy and rating correlation
    acc = np.array([r["acc"] for r in rows])
    results["correlation"] = {
        tc: {"pearson": float(pearsonr(acc[tcs == tc], y[tcs == tc])[0]),
             "spearman": float(spearmanr(acc[tcs == tc], y[tcs == tc])[0])} for tc in TCS
    }
    # Which single move-based feature tracks rating best (Spearman, both time classes pooled within each)
    results["feature_spearman"] = {
        f: {tc: float(spearmanr(features([r for r, k in zip(rows, tcs == tc) if k], [f])[:, 0], y[tcs == tc])[0]) for tc in TCS}
        for f in ("acc", "log_moves", "mean_loss", "blunders", "mistakes")
    }
    # What accuracy looks like at each rating: the signal (how the mean moves) against the noise (spread in a band).
    bands_y = np.array([band(v) for v in y])
    results["accuracy_by_band"] = {
        tc: {b: {"n": int(k.sum()), "mean": float(acc[k].mean()), "sd": float(acc[k].std()),
                 "q10": float(np.quantile(acc[k], 0.1)), "q90": float(np.quantile(acc[k], 0.9))}
             for b in BANDS for k in [(bands_y == b) & (tcs == tc)] if k.sum() >= 8}
        for tc in TCS
    }
    for wname, w in (("population", W), ("stratified", U)):
        out = {}
        for name, (make, which) in MODELS.items():
            pred, lo, hi = crossval(rows, w, make, which)
            out[name] = {tc: summarise(y, pred, lo, hi, w, tcs == tc) for tc in TCS}
            out[name]["all"] = summarise(y, pred, lo, hi, w, np.ones(len(rows), bool))
            if name == "monotone spline":
                bands = np.array([band(v) for v in y])
                out[name]["by_band"] = {b: summarise(y, pred, lo, hi, w, bands == b) for b in BANDS if (bands == b).sum() >= 10}
                accq = np.quantile(acc, [1 / 3, 2 / 3])
                tert = np.digitize(acc, accq)
                out[name]["by_acc_tercile"] = {int(t): summarise(y, pred, lo, hi, w, tert == t) for t in range(3)}
        results["cv"][wname] = out

    # chess.com's accuracy beside ours
    both = [r for r in rows if r["cc_acc"] is not None]
    if both:
        a = np.array([r["acc"] for r in both])
        c = np.array([r["cc_acc"] for r in both])
        results["chesscom"] = {
            "sides": len(both),
            "pearson": float(pearsonr(a, c)[0]),
            "spearman": float(spearmanr(a, c)[0]),
            "mean_diff_ours_minus_cc": float(np.mean(a - c)),
            "mad": float(np.mean(np.abs(a - c))),
        }
        idx = [i for i, r in enumerate(rows) if r["cc_acc"] is not None]
        sub = [rows[i] for i in idx]
        sw = U[idx]
        ys = y[idx]
        ts = tcs[idx]
        for label, which in (("ours", ["acc"]), ("chesscom", ["cc_acc"])):
            pred, lo, hi = crossval(sub, sw, lambda: MonotoneSpline(8), which)
            results["chesscom"][f"spline_mae_{label}"] = {tc: summarise(ys, pred, lo, hi, sw, ts == tc)["mae"] for tc in TCS}

    # Final model, population-weighted: per time class, the monotone spline and its residual quantiles.
    model = {
        "about": "Prophylaxis rating-from-one-game model (ml/rating). rating = interp(accuracy, knots, values), flat "
                 "outside the knots; an interval is rating + residual quantile. Fitted on chess.com rapid/blitz games "
                 "reviewed with Stockfish 19 Lite at 400k nodes, weighted to the random draw's rating mix.",
        "accuracy": "Lichess game accuracy as web/src/analysis/grading.ts gameAccuracy computes it",
        "time_classes": {},
    }
    for tc in TCS:
        m = tcs == tc
        x = features([r for r, k in zip(rows, m) if k], ["acc"])
        sp = MonotoneSpline(8).fit(x, y[m], W[m])
        res = y[m] - sp.predict(x)
        model["time_classes"][tc] = {
            "knots": [round(float(v), 2) for v in sp.t],
            "values": [round(v) for v in sp.values()],
            "residual_quantiles": {str(q): round(float(weighted_quantile(res, W[m], q))) for q in Q},
            "n_sides": int(m.sum()),
        }
    model["median_rating"] = {tc: round(float(weighted_quantile(y[tcs == tc], W[tcs == tc], 0.5))) for tc in TCS}

    # Averaging over a player's last N games (players held out of the fit)
    if multi_rows:
        keep = np.array([r["user"] not in multi_users for r in rows])
        fits = {}
        for tc in TCS:
            m = keep & (tcs == tc)
            x = features([r for r, k in zip(rows, m) if k], ["acc"])
            fits[tc] = MonotoneSpline(8).fit(x, y[m], W[m])
            # the inverse view: accuracy as a function of rating, for inverting a mean accuracy
            fits[tc + "_inv"] = IsotonicRegression(out_of_bounds="clip").fit(y[m], acc[m], sample_weight=W[m])
        per_player: dict[str, list[dict]] = {}
        for r in multi_rows:
            if r["sampled_side"]:
                r["est"] = float(fits[r["tc"]].predict(np.array([[r["acc"]]]))[0])
                per_player.setdefault(r["user"], []).append(r)
        avg = {}
        grid = np.arange(0, 3201, 5.0)
        for n in (1, 5, 10, 20):
            errs, errs_inv, covered = [], [], []
            for user, rs in per_player.items():
                rs = sorted(rs, key=lambda r: -r["end_time"])
                if len(rs) < n:
                    continue
                last = rs[:n]
                truth = np.mean([r["rating"] for r in last])
                est = np.mean([r["est"] for r in last])
                errs.append(est - truth)
                # invert: the rating whose expected accuracy matches this player's mean accuracy, per time class
                inv = []
                for tc in TCS:
                    a = [r["acc"] for r in last if r["tc"] == tc]
                    if a:
                        curve = fits[tc + "_inv"].predict(grid)
                        k = np.searchsorted(curve, np.mean(a))
                        inv += [grid[min(k, len(grid) - 1)]] * len(a)
                errs_inv.append(np.mean(inv) - truth)
            if not errs:
                continue
            errs, errs_inv = np.array(errs), np.array(errs_inv)
            avg[n] = {
                "players": len(errs),
                "mae_mean_of_estimates": float(np.mean(np.abs(errs))),
                "sd_mean_of_estimates": float(np.std(errs)),
                "bias_mean_of_estimates": float(np.mean(errs)),
                "mae_inverted_mean_accuracy": float(np.mean(np.abs(errs_inv))),
                "sd_inverted_mean_accuracy": float(np.std(errs_inv)),
            }
        # how much of a player's game-to-game error is the player (persistent) rather than the game
        resid = {u: [r["est"] - r["rating"] for r in rs] for u, rs in per_player.items() if len(rs) >= 10}
        if len(resid) >= 2:
            within = np.mean([np.var(v, ddof=1) for v in resid.values()])
            between = np.var([np.mean(v) for v in resid.values()], ddof=1) - within / np.mean([len(v) for v in resid.values()])
            acc_sd = [np.std([r["acc"] for r in rs], ddof=1) for rs in per_player.values() if len(rs) >= 10]
            results["within_player_accuracy_sd"] = float(np.sqrt(np.mean(np.square(acc_sd))))
            results["averaging"] = {"by_n": avg, "players": len(per_player), "games": sum(map(len, per_player.values())),
                                    "within_player_sd": float(np.sqrt(within)), "between_player_sd": float(np.sqrt(max(between, 0)))}
            model["averaging_mae"] = {str(n): round(v["mae_mean_of_estimates"]) for n, v in avg.items()}

    (HERE / "model.json").write_text(json.dumps(model, indent=1) + "\n")
    (HERE / "results.json").write_text(json.dumps(results, indent=1, default=str) + "\n")
    print_tables(results)


def print_tables(res: dict) -> None:
    print(json.dumps(res["data"], indent=1))
    print("correlation", res["correlation"])
    print("feature spearman", json.dumps(res["feature_spearman"]))
    for tc, rows in res["accuracy_by_band"].items():
        print(f"-- accuracy by rating band, {tc}")
        for b, d in rows.items():
            print(f"  {b!s:5} n={d['n']:4d} mean={d['mean']:5.1f} sd={d['sd']:5.1f} 10-90%: {d['q10']:5.1f}-{d['q90']:5.1f}")
    for wname, out in res["cv"].items():
        print(f"\n== cross-validated, {wname} weights ==")
        print(f"{'model':26} {'tc':6} {'n':>5} {'MAE':>6} {'SD':>6} {'bias':>6} {'PI80 w':>7} {'cover':>6}")
        for name, d in out.items():
            for tc in (*TCS, "all"):
                s = d[tc]
                print(f"{name:26} {tc:6} {s['n']:5d} {s['mae']:6.0f} {s['sd']:6.0f} {s['bias']:6.0f} {s['pi80_width']:7.0f} {s['pi80_coverage']:6.2f}")
        sp = out["monotone spline"]
        for key in ("by_band", "by_acc_tercile"):
            print(f"-- monotone spline {key}")
            for b, s in sp[key].items():
                print(f"  {b!s:6} n={s['n']:4d} MAE={s['mae']:5.0f} bias={s['bias']:6.0f} cover={s['pi80_coverage']:.2f}")
    if "chesscom" in res:
        print("\nchess.com", json.dumps(res["chesscom"], indent=1))
    if "averaging" in res:
        print("\naveraging", json.dumps(res["averaging"], indent=1))


if __name__ == "__main__":
    main()
