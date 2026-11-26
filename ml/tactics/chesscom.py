"""The shipped model on chess.com beginners: the players the site is for.

The real-game test in games.py uses Lichess rapid games rated 1300 or less, roughly chess.com 600 to 1000. This
runs the same blunder search and the same labels (Lichess's own tagger) on chess.com games: the random public games
collected for the rating study (ml/rating, kept in data/rating and ignored by git). Nothing decides what ships here;
it reports how the rules, the model and what the site shows do on these players, by rating band.

    uv run tactics chesscom
"""

import json
import os
from multiprocessing import Pool

import numpy as np

from . import games
from .dataset import THEMES
from .fetch import DATA

SOURCE = DATA / "rating" / "games.jsonl"
OUT = DATA / "chesscom"
BANDS = [("Under 600", 0, 600), ("600 to 999", 600, 1000), ("1000 and up", 1000, 10_000)]
BEGINNER = 1000  # the headline: games where both players are rated under this


def _pgn(row: dict) -> str:
    """chess.com writes Site as "Chess.com"; the game's URL is the id the blunder search keys games by."""
    lines = [f'[Site "{row["url"]}"]' if line.startswith("[Site ") else line for line in row["pgn"].splitlines()]
    return "\n".join(lines)


def _scan(text: str) -> list[dict]:
    try:
        return games._blunders(text)
    except (KeyError, ValueError):  # a game without both ratings
        return []


def find(workers: int = max(1, (os.cpu_count() or 2) - 3)) -> list[dict]:
    """Every blunder with one clear punishment, labelled by Lichess's tagger. Cached per game, so it resumes."""
    OUT.mkdir(parents=True, exist_ok=True)
    rows = [json.loads(line) for line in SOURCE.open()]
    texts = {row["url"].rsplit("/", 1)[-1]: _pgn(row) for row in rows}
    cache = OUT / "scanned.jsonl"
    done: dict[str, list[dict]] = {}
    if cache.exists():
        for line in cache.open():
            row = json.loads(line)
            done[row["game"]] = row["blunders"]
    todo = [(gid, text) for gid, text in texts.items() if gid not in done]
    print(f"  {len(done)} games already scanned, {len(todo)} to go", flush=True)
    with cache.open("a") as f, Pool(workers, initializer=games._start) as pool:
        for i, ((gid, _), found) in enumerate(zip(todo, pool.imap(_scan, [t for _, t in todo])), 1):
            done[gid] = found
            f.write(json.dumps({"game": gid, "blunders": found}, separators=(",", ":")) + "\n")
            f.flush()
            if i % 50 == 0:
                print(f"  scanned {i} / {len(todo)}", flush=True)
    cook = games.tagger()
    found = [ex for gid in texts for ex in done.get(gid, [])]
    for ex in found:
        ex["themes"] = games.label(cook, ex, ex["cp"])
    print(f"  {len(found)} blunders with one clear punishment in {len(texts)} games")
    return found


def score(found: list[dict]) -> dict:
    """Rules, model and site per theme, for beginners (the headline) and by rating band."""
    import chess

    from .export import WEB_MODELS, run
    from .metrics import from_sets, labels
    from .planes import encode, model_line
    from .rules import predict

    meta = json.loads((WEB_MODELS / "tactics.json").read_text())
    y = labels(found)
    rule = from_sets([predict(ex) for ex in found])

    def planes_of(ex: dict) -> np.ndarray:
        board = chess.Board(ex["fen"])
        return encode(board, model_line(board, [chess.Move.from_uci(u) for u in ex["line"]]))

    model = (run(WEB_MODELS / "tactics.onnx", np.stack([planes_of(ex) for ex in found])) >= np.array(meta["thresholds"])).astype(np.uint8)
    site = games._site(rule, model, set(meta["trusted"]))
    # What the site can name: the mates (rules), forks and hanging pieces (rules, plus the model), and the other
    # names in tactics.ts or back-rank mate where tactics.json trusts the model.
    named = set(games.NAMED) | {"backRankMate"}
    shown = {"mateIn1", "mateIn2", "fork", "hangingPiece"} | {t for t in meta["trusted"] if t in named}
    ids = np.array([ex["game"] for ex in found])
    rating = np.array([ex["rating"] for ex in found])

    def part(mask: np.ndarray) -> dict:
        return games._evaluate(y[mask], {"rules": rule[mask], "model": model[mask], "site": site[mask]}, ids[mask], shown)

    result = {
        "source": "chess.com public games, one per random player (ml/rating), reviewed for blunders like games.py",
        "trusted": meta["trusted"],
        "beginners": part(rating < BEGINNER),
        "bands": {name: part((rating >= lo) & (rating < hi)) for name, lo, hi in BANDS},
    }
    from .report import RESULTS

    (RESULTS / "chesscom.json").write_text(json.dumps(result, indent=1) + "\n")
    _table(result)
    return result


def _table(result: dict) -> None:
    from .report import RESULTS

    b = result["beginners"]

    def cell(m: dict) -> str:
        low, high = m["f1_90"]
        return f"{m['f1']:.2f} ({low:.2f}–{high:.2f})"

    lines = [
        "# The tactic model on chess.com beginners",
        "",
        (
            f"{b['n']} blunders with one clear punishment, from {b['games']} chess.com games where the two players "
            f"average under {BEGINNER}. Labels: Lichess's puzzle tagger. F1 with a 90% interval from resampling whole games."
        ),
        "",
        "| Theme | Blunders | Rules | Model (P / R) | What the site shows |",
        "|---|---:|---:|---:|---:|",
    ]
    for t in THEMES:
        e = b["themes"][t]
        if e["support"] == 0 and e["model"]["precision"] == 0:
            continue
        m = e["model"]
        lines.append(
            f"| {t} | {e['support']} | {cell(e['rules'])} | {cell(m)} ({m['precision']:.2f} / {m['recall']:.2f}) | "
            f"{cell(e['site']) if e['site_shows'] else 'not shown'} |"
        )
    lines += ["", "By rating band (average of the two players), F1 of what the site shows:", "", "| Band | Blunders | " + " | ".join(
        t for t in games.NAMED) + " |", "|---|---:|" + "---:|" * len(games.NAMED)]
    for name, part in result["bands"].items():
        cells = [f"{part['themes'][t]['site']['f1']:.2f} ({part['themes'][t]['support']})" if part["themes"][t]["site_shows"] else "–" for t in games.NAMED]
        lines.append(f"| {name} | {part['n']} | " + " | ".join(cells) + " |")
    (RESULTS / "chesscom.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def main() -> dict:
    return score(find())
