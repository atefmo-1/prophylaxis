"""The model on real beginner blunders instead of curated puzzles.

Low-rated rapid games come from the Lichess game database (CC0). Stockfish finds the blunders and the line that
punishes each one, and Lichess's own puzzle tagger (lichess-puzzler, pinned below) labels that line, so the labels
mean what the training labels meant. Only blunders with one clear punishment are kept, as Lichess does for its
puzzles. No game that produced a training puzzle is used.
"""

import csv
import hashlib
import io
import json
import os
import re
import sys
from multiprocessing import Pool
from pathlib import Path

import chess
import chess.engine
import chess.pgn
import httpx
import numpy as np
import zstandard
from coach import config, grading

from .dataset import THEMES
from .fetch import DATA, RAW
from .planes import tactic_line

GAMES_URL = "https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst"
OUT = DATA / "games"
MAX_ELO = 1300          # both players; Lichess ratings run a few hundred points above chess.com's at this level
N_GAMES = 10_000        # the first games in the month's file that pass the filters
SCAN_NODES = 50_000     # every position, to find the blunders
LINE_NODES = 1_000_000  # the position after each blunder, for the punishing line
BLUNDER = 20.0          # win % the mover loses
SOLVER_WINS = 70.0      # the punisher's winning chances after the blunder, and after their best move
ONLY_MOVE = 15.0        # the best punishment must beat the second best by this much (win %)

# Lichess's puzzle tagger: the commit before 2026-10-23 changed how forks are tagged, so it matches the labels of
# the puzzle database the model was trained on (released 2026-10-02). Only the pure python-chess files are used.
PUZZLER = "https://raw.githubusercontent.com/ornicar/lichess-puzzler/608cf7f2b2a2/tagger/"
PUZZLER_FILES = {
    "cook.py": "b21a0d179b710742010dde07e806eda0ecea0514412af9f5a1d04d053bc9859d",
    "model.py": "7c1a2c7722f221db34a2f8a703eb6c54822dd63793102c79cf2263bd33141896",
    "util.py": "af224e75f7cbd7149f824bcb2bfeb9fba351c7d9d4abfddca99d4b1ce9b59633",
}
VENDOR = DATA / "vendor" / "lichess-puzzler-608cf7f"
HEADER = re.compile(r'^\[(\w+) "(.*)"\]$', re.MULTILINE)


def tagger():
    """Lichess's `cook` module, downloaded once and checked against the pinned hashes (it is AGPL; never committed)."""
    VENDOR.mkdir(parents=True, exist_ok=True)
    for name, digest in PUZZLER_FILES.items():
        path = VENDOR / name
        if not path.exists():
            path.write_bytes(httpx.get(PUZZLER + name, timeout=60, follow_redirects=True).raise_for_status().content)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            path.unlink()
            raise RuntimeError(f"{name} from lichess-puzzler does not match its pinned hash")
    if str(VENDOR) not in sys.path:
        sys.path.insert(0, str(VENDOR))
    import cook

    return cook


def label(cook, ex: dict, cp: int) -> list[str]:
    from model import Puzzle  # the tagger's own module, importable once tagger() has run

    node = chess.pgn.Game.from_board(chess.Board(ex["fen_before"]))
    for uci in [ex["blunder"], *ex["line"]]:
        node = node.add_main_variation(chess.Move.from_uci(uci))
    return [t for t in cook.cook(Puzzle(ex["id"], node.game(), cp)) if t in THEMES]


def puzzle_games() -> set[str]:
    """Ids of every game the puzzle database took a puzzle from."""
    with RAW.open("rb") as f:
        text = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8")
        return {row["GameUrl"].split("lichess.org/")[-1][:8] for row in csv.DictReader(text)}


def _wanted(headers: dict[str, str], exclude: set[str]) -> bool:
    try:
        elos = int(headers["WhiteElo"]), int(headers["BlackElo"])
    except (KeyError, ValueError):
        return False
    return (
        headers.get("Event", "").startswith("Rated Rapid")
        and max(elos) <= MAX_ELO
        and headers.get("Termination") in ("Normal", "Time forfeit")
        and headers.get("Site", "").rsplit("/", 1)[-1] not in exclude
    )


def fetch_games(n: int = N_GAMES) -> Path:
    """Stream the month's file from the start and keep the first `n` games that pass the filters."""
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "games.pgn"
    exclude = puzzle_games()
    kept: list[str] = []
    seen = 0
    buffer = ""
    decompressor = zstandard.ZstdDecompressor().decompressobj(read_across_frames=True)  # the file has many frames
    with httpx.stream("GET", GAMES_URL, timeout=60, follow_redirects=True) as response:
        response.raise_for_status()
        for chunk in response.iter_bytes(1 << 20):
            buffer += decompressor.decompress(chunk).decode("utf-8", errors="ignore")
            *games, buffer = buffer.split("\n\n[Event ")
            for text in games:
                text = text if text.startswith("[Event ") else "[Event " + text
                seen += 1
                if _wanted(dict(HEADER.findall(text)), exclude):
                    kept.append(text.strip() + "\n")
            if len(kept) >= n:
                break
    out.write_text("\n".join(kept[:n]))
    print(f"  kept {min(n, len(kept))} of the first {seen:,} games")
    return out


_engine: chess.engine.SimpleEngine | None = None


def _start() -> None:
    global _engine
    _engine = chess.engine.SimpleEngine.popen_uci(config.stockfish_path())
    _engine.configure({"Threads": 1, "Hash": 32})


def _win(board: chess.Board, info: dict) -> float:
    """The side to move's winning chances."""
    score = info["score"].white()
    win_white = grading.line_win_white({"cp": score.score(), "mate": score.mate()})
    return grading.pov(win_white, board.turn)


def _blunders(text: str) -> list[dict]:
    """Every blunder in one game that has a single clear punishment, as a puzzle-shaped example."""
    game = chess.pgn.read_game(io.StringIO(text))
    gid = game.headers["Site"].rsplit("/", 1)[-1]
    rating = (int(game.headers["WhiteElo"]) + int(game.headers["BlackElo"])) // 2
    boards = [game.board()]
    moves = list(game.mainline_moves())
    for move in moves:
        b = boards[-1].copy(stack=False)
        b.push(move)
        boards.append(b)
    wins = [
        None if b.is_game_over() else _win(b, _engine.analyse(b, chess.engine.Limit(nodes=SCAN_NODES)))
        for b in boards
    ]
    out = []
    for ply, move in enumerate(moves):
        before, after = boards[ply], boards[ply + 1]
        if wins[ply] is None or wins[ply + 1] is None:
            continue
        lost = wins[ply] - (100 - wins[ply + 1])
        if lost < BLUNDER or wins[ply + 1] < SOLVER_WINS:
            continue
        infos = _engine.analyse(after, chess.engine.Limit(nodes=LINE_NODES), multipv=2)
        if not infos or not infos[0].get("pv"):
            continue
        top = _win(after, infos[0])
        second = _win(after, infos[1]) if len(infos) > 1 else 0.0
        if top < SOLVER_WINS or top - second < ONLY_MOVE:
            continue
        line = tactic_line(after, infos[0]["pv"])
        if not line:
            continue
        line = [m.uci() for m in line]
        score = infos[0]["score"].pov(after.turn)
        out.append({
            "id": f"{gid}-{ply + 1}", "game": gid, "rating": rating,
            "fen_before": before.fen(), "blunder": move.uci(), "fen": after.fen(), "line": line,
            "cp": 1000 if score.is_mate() else int(score.score()),
        })
    return out


def _game_id(text: str) -> str:
    return dict(HEADER.findall(text))["Site"].rsplit("/", 1)[-1]


def find_blunders(workers: int = max(1, (os.cpu_count() or 2) - 3)) -> Path:
    """Scan every game once. Results are cached per game in scanned.jsonl, so an interrupted run resumes and a
    larger sample only scans the new games."""
    games = (OUT / "games.pgn").read_text().split("\n\n[Event ")
    games = [g if g.startswith("[Event ") else "[Event " + g for g in games]
    cache = OUT / "scanned.jsonl"
    done = {}
    if cache.exists():
        for line in cache.open():
            row = json.loads(line)
            done[row["game"]] = row["blunders"]
    todo = [g for g in games if _game_id(g) not in done]
    print(f"  {len(done)} games already scanned, {len(todo)} to go", flush=True)
    with cache.open("a") as f, Pool(workers, initializer=_start) as pool:
        for i, (text, found) in enumerate(zip(todo, pool.imap(_blunders, todo)), 1):
            done[_game_id(text)] = found
            f.write(json.dumps({"game": _game_id(text), "blunders": found}, separators=(",", ":")) + "\n")
            f.flush()
            if i % 250 == 0:
                print(f"  scanned {i} / {len(todo)}", flush=True)
    cook = tagger()
    out = OUT / "blunders.jsonl"
    found = [ex for g in games for ex in done[_game_id(g)]]
    with out.open("w") as f:
        for ex in found:
            ex["themes"] = label(cook, ex, ex["cp"])
            f.write(json.dumps(ex, separators=(",", ":")) + "\n")
    print(f"  {len(found)} blunders with one clear punishment in {len(games)} games")
    return out


def _bootstrap_f1(y: np.ndarray, pred: np.ndarray, games: np.ndarray, rounds: int = 1000) -> tuple[float, float]:
    """90% interval for F1, resampling whole games (blunders from one game are not independent)."""
    rng = np.random.default_rng(7)
    ids = np.unique(games)
    by_game = {g: np.flatnonzero(games == g) for g in ids}
    scores = []
    for _ in range(rounds):
        idx = np.concatenate([by_game[g] for g in rng.choice(ids, len(ids))])
        tp = int((y[idx] & pred[idx]).sum())
        denom = int(y[idx].sum() + pred[idx].sum())
        scores.append(2 * tp / denom if denom else 0.0)
    return float(np.percentile(scores, 5)), float(np.percentile(scores, 95))


# The tags the site can name from the model (web/src/analysis/tactics.ts, NAMED), in its order.
NAMED = ["hangingPiece", "fork", "discoveredAttack", "pin", "skewer", "trappedPiece"]
SHIP_MIN_CASES = 20      # a theme needs this many real blunders in the deciding half to be judged at all
SHIP_MIN_PRECISION = 0.6  # a name the site shows should be right more often than not, comfortably


def half(game: str) -> str:
    """Which half of the real games a game belongs to: "val" decides what ships, "test" is reported."""
    return "val" if hashlib.blake2b(game.encode(), digest_size=1).digest()[0] < 128 else "test"


def _site(rule: np.ndarray, model: np.ndarray, trusted: set[str]) -> np.ndarray:
    """What the site shows per theme: the rules for mates; for forks and hanging pieces the rules' tag, plus the
    model's where the rules found none; back-rank mates and the other named themes from the model, if trusted."""
    site = np.zeros_like(rule)
    for i, t in enumerate(THEMES):
        if t in ("mateIn1", "mateIn2"):
            site[:, i] = rule[:, i]
        elif t in ("fork", "hangingPiece"):
            site[:, i] = rule[:, i] | (model[:, i] if t in trusted else 0)
        elif t == "backRankMate":
            site[:, i] = model[:, i] if t in trusted else rule[:, i]
        elif t in NAMED and t in trusted:
            site[:, i] = model[:, i]
    return site


def _evaluate(y: np.ndarray, preds: dict[str, np.ndarray], games: np.ndarray, shown: set[str]) -> dict:
    from .metrics import per_theme

    result = {"n": len(y), "games": len(set(games)), "themes": {}}
    for name, pred in preds.items():
        scores = per_theme(y, pred)
        for i, t in enumerate(THEMES):
            entry = result["themes"].setdefault(t, {"support": scores[t]["support"], "site_shows": t in shown})
            low, high = _bootstrap_f1(y[:, i], pred[:, i], games)
            entry[name] = {**{k: scores[t][k] for k in ("precision", "recall", "f1")}, "f1_90": [low, high]}
    none = y.sum(1) == 0
    result["no_theme"] = {"n": int(none.sum()), "model_names_one": float(preds["model"][none].any(1).mean())}
    return result


def score() -> dict:
    """Score the shipped model on the real blunders and decide what the site may name from it: a theme the model
    beat the rules on in the puzzle test also has to beat them on the "val" half of the real games, with precision
    of at least SHIP_MIN_PRECISION on at least SHIP_MIN_CASES blunders. The "test" half is reported."""
    from .export import WEB_MODELS, run
    from .metrics import from_sets, labels, per_theme
    from .planes import encode, model_line
    from .rules import predict

    examples = [json.loads(line) for line in (OUT / "blunders.jsonl").open()]
    y = labels(examples)
    with Pool() as pool:
        rule = from_sets(pool.map(predict, examples, chunksize=200))
    meta_path = WEB_MODELS / "tactics.json"
    meta = json.loads(meta_path.read_text())

    def planes_of(ex: dict) -> np.ndarray:
        board = chess.Board(ex["fen"])
        return encode(board, model_line(board, [chess.Move.from_uci(u) for u in ex["line"]]))

    planes = np.stack([planes_of(ex) for ex in examples])
    model = (run(WEB_MODELS / "tactics.onnx", planes) >= np.array(meta["thresholds"])).astype(np.uint8)
    games = np.array([ex["game"] for ex in examples])
    val = np.array([half(g) == "val" for g in games])

    puzzle_trusted = json.loads((DATA / "results" / "onnx.json").read_text())["trusted"]
    on_val_rules, on_val_model = per_theme(y[val], rule[val]), per_theme(y[val], model[val])
    decisions = {}
    for t in puzzle_trusted:
        m, r = on_val_model[t], on_val_rules[t]
        if m["support"] < SHIP_MIN_CASES:
            decisions[t] = f"not shipped: only {m['support']} real blunders to judge it on"
        elif m["precision"] < SHIP_MIN_PRECISION:
            decisions[t] = f"not shipped: precision {m['precision']:.2f} on real blunders"
        elif m["f1"] <= r["f1"]:
            decisions[t] = f"not shipped: F1 {m['f1']:.2f}, rules {r['f1']:.2f} on real blunders"
        else:
            decisions[t] = f"shipped: F1 {m['f1']:.2f} (rules {r['f1']:.2f}), precision {m['precision']:.2f}"
    trusted = [t for t in puzzle_trusted if decisions[t].startswith("shipped")]
    meta["trusted"] = trusted
    meta_path.write_text(json.dumps(meta, indent=1) + "\n")

    site = _site(rule, model, set(trusted))
    shown = {t for t in THEMES if site.any(0)[THEMES.index(t)] or t in ("mateIn1", "mateIn2")}

    def preds(mask: np.ndarray) -> dict[str, np.ndarray]:
        return {"rules": rule[mask], "model": model[mask], "site": site[mask]}

    result = {
        "decisions": decisions,
        "trusted": trusted,
        "val": _evaluate(y[val], preds(val), games[val], shown),
        "test": _evaluate(y[~val], preds(~val), games[~val], shown),
    }
    (DATA / "results" / "games.json").write_text(json.dumps(result, indent=1))
    _table(result)
    return result


def _table(result: dict) -> None:
    """results/games.md and games.json: committed, numbers only."""
    from .report import RESULTS

    def cell(m: dict) -> str:
        low, high = m["f1_90"]
        return f"{m['f1']:.2f} ({low:.2f}–{high:.2f})"

    test = result["test"]
    lines = [
        (f"Test half: {test['n']:,} blunders with one clear punishment, from {test['games']:,} Lichess rapid games "
         f"between players rated {MAX_ELO} or less. F1 with a 90% interval (games resampled)."),
        "",
        "| Theme | Blunders | Rules F1 | Model F1; precision, recall | Site F1 |",
        "|---|---:|---:|---:|---:|",
    ]
    for t, m in test["themes"].items():
        if m["support"]:
            site = cell(m["site"]) if m["site_shows"] else "not shown"
            model = f"{cell(m['model'])}; P {m['model']['precision']:.2f}, R {m['model']['recall']:.2f}"
            lines.append(f"| {t} | {m['support']} | {cell(m['rules'])} | {model} | {site} |")
    lines += ["", f"What ships, decided on the other half ({result['val']['n']:,} blunders):", ""]
    lines += [f"- {t}: {why}" for t, why in result["decisions"].items()]
    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "games.md").write_text("\n".join(lines) + "\n")
    (RESULTS / "games.json").write_text(json.dumps(result, indent=1))
