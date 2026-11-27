# SPDX-License-Identifier: AGPL-3.0
# Runs the Maia-3 model code (CSSLab/maia3, AGPL-3.0); see LICENSES/AGPL-3.0.txt.
"""Is Maia-3 good enough to say things to chess.com beginners about their own moves?

On the random chess.com games where the two players average under 1000 (ml/rating's sample), every position of both
sides gets Stockfish's best move and evaluation, and Maia-3's move probabilities at a range of Maia ratings. Then:

1. Rating map: Maia learned from Lichess ratings, so which Maia rating best predicts a chess.com player's moves? Fitted
   on half the games (by likelihood of the moves played), by chess.com rating band.
2. Prediction: on the other half, how often Maia's top move is the move played, against Stockfish's best move.
3. Calibration: when Maia gives the best move a chance p at the player's rating, do players find it about p of the time?
   That is what a sentence like "about 1 in 5 players at your level find this" would rest on.
4. Mistakes: how often a mistake is the move Maia expects most at the player's rating (a "typical" mistake), and how
   findable the better move was.

    python -m maia.study      # from ml/; Stockfish results are cached in data/maia

Writes results/maia.json and results/maia.md (counts only).
"""

import io
import json
import math
import os
from collections import defaultdict
from multiprocessing import Pool

os.environ.setdefault("EXTEND", "0")

import chess
import chess.pgn
from coach import grading

from causes import classify

from .predict import ML, policies

GAMES = ML / "data" / "rating" / "games.jsonl"
OUT = ML / "data" / "maia"
RESULTS = ML / "results"
BEGINNER = 1000
GRID = list(range(400, 2201, 100))  # Maia ratings tried
BANDS = [("Under 400", 0, 400), ("400 to 599", 400, 600), ("600 to 799", 600, 800), ("800 to 999", 800, 1000),
         ("1000 and up", 1000, 10_000)]
MISTAKE = 10.0


def _games() -> list[dict]:
    out = []
    for line in GAMES.open():
        g = json.loads(line)
        try:
            w, b = g["white"]["rating"], g["black"]["rating"]
        except (KeyError, TypeError):
            continue
        if (w + b) / 2 < BEGINNER:
            out.append(g)
    return out


def _engine(game: dict) -> dict:
    """Stockfish's line in every position of one game."""
    pgn = chess.pgn.read_game(io.StringIO(game["pgn"]))
    board = pgn.board()
    rows = []
    for node in pgn.mainline():
        line = classify._line(board)
        rows.append({"fen": board.fen(), "played": node.move.uci(), "best": line["pv"][0] if line and line["pv"] else None,
                     "win_white": grading.terminal_win_white(board) if line is None else grading.line_win_white(line)})
        board.push(node.move)
    rows.append({"fen": board.fen(), "played": None, "best": None,
                 "win_white": grading.terminal_win_white(board) if board.is_game_over() else
                 grading.line_win_white(classify._line(board))})
    return {"url": game["url"], "white": game["white"]["rating"], "black": game["black"]["rating"], "rows": rows}


def engine_pass(games: list[dict]) -> list[dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    cache = OUT / "engine.jsonl"
    done = {}
    if cache.exists():
        for line in cache.open():
            row = json.loads(line)
            done[row["url"]] = row
    todo = [g for g in games if g["url"] not in done]
    print(f"engine: {len(games)} games, {len(todo)} to read", flush=True)
    with cache.open("a") as f, Pool(max(1, (os.cpu_count() or 2) - 2), initializer=classify._start) as pool:
        for i, row in enumerate(pool.imap(_engine, todo), 1):
            done[row["url"]] = row
            f.write(json.dumps(row) + "\n")
            f.flush()
            if i % 25 == 0:
                print(f"  {i} / {len(todo)}", flush=True)
    return [done[g["url"]] for g in games]


def positions(games: list[dict]) -> list[dict]:
    """Every move played, with who played it, what was best, and what it cost."""
    out = []
    for gi, g in enumerate(games):
        rows = g["rows"]
        for ply, row in enumerate(rows[:-1]):
            board = chess.Board(row["fen"])
            white = board.turn == chess.WHITE
            me, them = (g["white"], g["black"]) if white else (g["black"], g["white"])
            loss = grading.pov(row["win_white"], board.turn) - grading.pov(rows[ply + 1]["win_white"], board.turn)
            out.append({"game": gi, "ply": ply, "fen": row["fen"], "played": row["played"], "best": row["best"],
                        "me": me, "them": them, "loss": loss, "win": grading.pov(row["win_white"], board.turn)})
    return out


def maia_pass(pos: list[dict]) -> None:
    """p(played), p(best) and Maia's top move at every rating in GRID, cached."""
    cache = OUT / "maia.json"
    if cache.exists():
        stored = json.loads(cache.read_text())
        if len(stored) == len(pos):
            for p, s in zip(pos, stored):
                p.update(s)
            return
    boards = [chess.Board(p["fen"]) for p in pos]
    for elo in GRID:
        print(f"maia at {elo}", flush=True)
        pol = policies(boards, [elo] * len(pos), [elo] * len(pos))
        for p, dist in zip(pos, pol):
            top = max(dist, key=dist.get)
            p.setdefault("by", {})[str(elo)] = {"played": dist.get(p["played"], 0.0), "best": dist.get(p["best"], 0.0),
                                                 "top": top, "top_p": dist[top]}
    cache.write_text(json.dumps([{"by": p["by"]} for p in pos]))


def band_of(rating: int) -> str:
    return next(name for name, lo, hi in BANDS if lo <= rating < hi)


def fit(train: list[dict]) -> dict[str, int]:
    """For each chess.com band, the Maia rating whose probabilities give the moves played the highest likelihood."""
    ll = defaultdict(lambda: defaultdict(float))
    for p in train:
        for elo in GRID:
            ll[band_of(p["me"])][elo] += math.log(max(p["by"][str(elo)]["played"], 1e-9))
    return {band: max(scores, key=scores.get) for band, scores in ll.items()}


def evaluate(test: list[dict], mapping: dict[str, int]) -> dict:
    at = lambda p: p["by"][str(mapping.get(band_of(p["me"]), 1500))]
    n = len(test)
    res = {"positions": n,
           "maia_top1": sum(at(p)["top"] == p["played"] for p in test) / n,
           "maia_1500_top1": sum(p["by"]["1500"]["top"] == p["played"] for p in test) / n,
           "stockfish_top1": sum(p["best"] == p["played"] for p in test) / n,
           "log_loss": -sum(math.log(max(at(p)["played"], 1e-9)) for p in test) / n}
    # Calibration: p(best) at the player's mapped rating against whether they played it.
    bins = [(0, 0.1), (0.1, 0.2), (0.2, 0.35), (0.35, 0.5), (0.5, 0.7), (0.7, 0.9), (0.9, 1.01)]
    cal = []
    ece = 0.0
    scored = [p for p in test if p["best"]]
    for lo, hi in bins:
        part = [p for p in scored if lo <= at(p)["best"] < hi]
        if not part:
            continue
        said = sum(at(p)["best"] for p in part) / len(part)
        found = sum(p["played"] == p["best"] for p in part) / len(part)
        cal.append({"bin": f"{lo:.2f}-{min(hi, 1):.2f}", "n": len(part), "maia_says": said, "players_found": found})
        ece += len(part) / len(scored) * abs(said - found)
    res["calibration"] = cal
    res["calibration_error"] = ece
    # Mistakes.
    mistakes = [p for p in test if p["loss"] >= MISTAKE and p["best"]]
    res["mistakes"] = len(mistakes)
    res["mistake_is_maia_top"] = sum(at(p)["top"] == p["played"] for p in mistakes) / len(mistakes)
    res["mistake_played_p_mean"] = sum(at(p)["played"] for p in mistakes) / len(mistakes)
    res["mistake_best_p"] = {
        "under 10%": sum(at(p)["best"] < 0.1 for p in mistakes) / len(mistakes),
        "10-50%": sum(0.1 <= at(p)["best"] < 0.5 for p in mistakes) / len(mistakes),
        "50% or more": sum(at(p)["best"] >= 0.5 for p in mistakes) / len(mistakes),
    }
    return res


def _answers(pos: list[dict], half: int) -> list[dict]:
    """The position right after each mistake (the opponent to move, with a best move), in one half of the games."""
    idx = {(p["game"], p["ply"]): p for p in pos}
    out = []
    for p in pos:
        if p["game"] % 2 == half and p["loss"] >= MISTAKE:
            q = idx.get((p["game"], p["ply"] + 1))
            if q and q["best"]:
                out.append(q)
    return out


def _ece(pairs: list[tuple[float, bool]]) -> float:
    bins = [(0, 0.1), (0.1, 0.2), (0.2, 0.35), (0.35, 0.5), (0.5, 0.7), (0.7, 0.9), (0.9, 1.01)]
    total = 0.0
    for lo, hi in bins:
        part = [x for x in pairs if lo <= x[0] < hi]
        if part:
            total += len(part) / len(pairs) * abs(sum(x[0] for x in part) / len(part) - sum(x[1] for x in part) / len(part))
    return total


def answer_calibration(pos: list[dict], mapping: dict[str, int]) -> dict:
    """After one of your mistakes, does Maia (at the opponent's rating) give their best answer an honest chance? The
    site says how findable that answer was. Calibration is reported on each half and on both; recalibrating was tried
    (isotonic, and Platt on the logit) and didn't carry over from one half to the other, so the site uses Maia as is."""
    at = lambda p: p["by"][str(mapping.get(band_of(p["me"]), 1500))]["best"]
    pairs = {half: [(at(q), q["played"] == q["best"]) for q in _answers(pos, half)] for half in (0, 1)}
    both = pairs[0] + pairs[1]
    bins = [(0, 0.1), (0.1, 0.2), (0.2, 0.35), (0.35, 0.5), (0.5, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 0.95), (0.95, 1.01)]
    table = []
    for lo, hi in bins:
        part = [x for x in both if lo <= x[0] < hi]
        if part:
            table.append({"bin": f"{lo:.2f}-{min(hi, 1):.2f}", "n": len(part), "maia_says": sum(p for p, _ in part) / len(part),
                          "players_found": sum(y for _, y in part) / len(part)})
    return {"positions": len(both), "error_even": _ece(pairs[0]), "error_odd": _ece(pairs[1]), "error_both": _ece(both),
            "found": sum(y for _, y in both) / len(both), "calibration": table}


def main() -> dict:
    games = engine_pass(_games())
    pos = [p for p in positions(games) if p["played"]]
    maia_pass(pos)
    train = [p for p in pos if p["game"] % 2 == 0]
    test = [p for p in pos if p["game"] % 2 == 1]
    mapping = fit(train)
    result = {"games": len(games), "positions": len(pos), "grid": GRID,
              "mapping": {b: mapping[b] for b, _, _ in BANDS if b in mapping},
              "band_positions": {b: sum(band_of(p["me"]) == b for p in pos) for b, _, _ in BANDS},
              "test": evaluate(test, mapping),
              "answers": answer_calibration(pos, mapping)}
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "maia.json").write_text(json.dumps(result, indent=1) + "\n")
    print(json.dumps(result, indent=1))
    return result


if __name__ == "__main__":
    main()
