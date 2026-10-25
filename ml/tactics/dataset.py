"""Turn the raw puzzle CSV into train/val/test JSONL.

A Lichess puzzle's FEN is the position *before* the opponent's move; its first move is that opponent's
mistake and the rest is the solution. Each example here is the puzzle position (after that first move),
the key move (the solution's first move) and the themes Lichess attached to the puzzle.
"""

import csv
import hashlib
import io
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import chess
import zstandard

from .fetch import DATA, RAW

# Themes that matter for beginner and intermediate players, most common first.
THEMES = [
    "mateIn1", "mateIn2", "fork", "pin", "discoveredAttack", "deflection", "hangingPiece", "attraction",
    "backRankMate", "promotion", "skewer", "trappedPiece", "capturingDefender", "doubleCheck", "smotheredMate",
]
MAX_RATING = 2000    # beginner-to-intermediate puzzles (about 80% of the database)
MIN_PLAYS = 20       # drop puzzles too new to have a settled rating
SAMPLE = 1.0         # fraction of eligible puzzles kept, chosen by a hash of the puzzle id
SPLIT = {"train": 0.8, "val": 0.1, "test": 0.1}
SEED = 7
OUT = DATA / "puzzles"


def keep(puzzle_id: str, fraction: float = SAMPLE) -> bool:
    digest = hashlib.blake2b(puzzle_id.encode(), digest_size=8).digest()
    return int.from_bytes(digest) / 2**64 < fraction


def example(row: dict) -> dict | None:
    """One puzzle as a training example, or None if its moves don't replay."""
    moves = row["Moves"].split()
    board = chess.Board(row["FEN"])
    blunder = chess.Move.from_uci(moves[0])
    if blunder not in board.legal_moves or len(moves) < 2:
        return None
    board.push(blunder)
    if chess.Move.from_uci(moves[1]) not in board.legal_moves:
        return None
    themes = set(row["Themes"].split())
    return {
        "id": row["PuzzleId"],
        "game": row["GameUrl"].split("lichess.org/")[-1][:8],  # https://lichess.org/<id>[/black]#<ply>
        "fen_before": row["FEN"],
        "blunder": moves[0],
        "fen": board.fen(),
        "line": moves[1:],
        "themes": [t for t in THEMES if t in themes],
        "rating": int(row["Rating"]),
    }


def read(raw: Path = RAW, fraction: float = SAMPLE):
    with raw.open("rb") as f:
        text = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8")
        for row in csv.DictReader(text):
            if int(row["Rating"]) > MAX_RATING or int(row["NbPlays"]) < MIN_PLAYS or int(row["Popularity"]) < 0:
                continue
            if keep(row["PuzzleId"], fraction) and (ex := example(row)):
                yield ex


def split(examples: list[dict], seed: int = SEED) -> dict[str, list[dict]]:
    """Group-aware stratified split: every puzzle from one game lands in the same split, and each split gets
    its share of every stratum. A game's stratum is the rarest theme among its puzzles ("none" if none)."""
    freq = Counter(t for ex in examples for t in ex["themes"])
    games: dict[str, list[dict]] = defaultdict(list)
    for ex in examples:
        games[ex["game"]].append(ex)
    strata: dict[str, list[str]] = defaultdict(list)
    for game, exs in games.items():
        themes = {t for ex in exs for t in ex["themes"]}
        strata[min(themes, key=lambda t: freq[t]) if themes else "none"].append(game)
    rng = random.Random(seed)
    out: dict[str, list[dict]] = {name: [] for name in SPLIT}
    for stratum in sorted(strata):
        ids = sorted(strata[stratum])
        rng.shuffle(ids)
        n = sum(len(games[g]) for g in ids)
        taken = 0
        for g in ids:
            # Fill train, then val, then test, by puzzle count rather than game count.
            name = "train" if taken < SPLIT["train"] * n else "val" if taken < (SPLIT["train"] + SPLIT["val"]) * n else "test"
            out[name].extend(games[g])
            taken += len(games[g])
    for exs in out.values():
        rng.shuffle(exs)
    return out


def build(fraction: float = SAMPLE, out: Path = OUT) -> dict[str, int]:
    examples = list(read(fraction=fraction))
    parts = split(examples)
    out.mkdir(parents=True, exist_ok=True)
    for name, exs in parts.items():
        with (out / f"{name}.jsonl").open("w") as f:
            for ex in exs:
                f.write(json.dumps(ex, separators=(",", ":")) + "\n")
    counts = {name: len(exs) for name, exs in parts.items()}
    stats = {
        "counts": counts,
        "themes": {name: dict(Counter(t for ex in exs for t in ex["themes"])) for name, exs in parts.items()},
        "no_theme": {name: sum(not ex["themes"] for ex in exs) for name, exs in parts.items()},
    }
    (out / "stats.json").write_text(json.dumps(stats, indent=1))
    return counts


def load(name: str, path: Path = OUT) -> list[dict]:
    with (path / f"{name}.jsonl").open() as f:
        return [json.loads(line) for line in f]
