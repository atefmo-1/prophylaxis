"""Practice puzzles for the site: for each tactic the site names, a few hundred well-liked Lichess puzzles (CC0)
spread over beginner-to-intermediate ratings, in web/public/puzzles/<theme>.json. The site serves them at the
player's level, per habit (web/src/lib/puzzles.ts)."""

import csv
import hashlib
import io
import json
from collections import defaultdict
from pathlib import Path

import zstandard

from .fetch import RAW

OUT = Path(__file__).resolve().parents[2] / "web" / "public" / "puzzles"
THEMES = ["hangingPiece", "fork", "pin", "skewer", "discoveredAttack", "trappedPiece", "mateIn1", "mateIn2",
          "backRankMate"]
LOW, HIGH, BAND = 400, 1700, 100
PER_BAND = 50
MIN_POPULARITY = 80   # players liked it
MIN_PLAYS = 300       # its rating has settled
MAX_DEVIATION = 90
MAX_PLIES = 7         # the opponent's move plus at most three of yours


def _order(puzzle_id: str) -> bytes:
    return hashlib.blake2b(puzzle_id.encode(), digest_size=8).digest()


def build(out: Path = OUT) -> dict[str, int]:
    picked: dict[str, dict[int, list]] = {t: defaultdict(list) for t in THEMES}
    with RAW.open("rb") as f:
        text = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8")
        for row in csv.DictReader(text):
            rating = int(row["Rating"])
            if not LOW <= rating < HIGH or len(row["Moves"].split()) > MAX_PLIES:
                continue
            if int(row["Popularity"]) < MIN_POPULARITY or int(row["NbPlays"]) < MIN_PLAYS:
                continue
            if int(row["RatingDeviation"]) > MAX_DEVIATION:
                continue
            themes = set(row["Themes"].split())
            for t in THEMES:
                if t in themes:
                    picked[t][rating // BAND].append((_order(row["PuzzleId"]), row["PuzzleId"], row["FEN"], row["Moves"], rating))
    out.mkdir(parents=True, exist_ok=True)
    counts = {}
    for t, bands in picked.items():
        # A deterministic, even spread: the same PER_BAND puzzles per 100 rating points on every run.
        rows = sorted(r[1:] for band in bands.values() for r in sorted(band)[:PER_BAND])
        rows.sort(key=lambda r: r[3])
        (out / f"{t}.json").write_text(json.dumps([list(r) for r in rows], separators=(",", ":")) + "\n")
        counts[t] = len(rows)
    (out / "LICENSE.txt").write_text(
        "These puzzles come from the Lichess puzzle database (https://database.lichess.org/#puzzles),\n"
        "released under Creative Commons CC0. Each row is [puzzle id, FEN, moves (UCI), rating]; the first move\n"
        "is the opponent's, and the puzzle is lichess.org/training/<puzzle id>.\n"
    )
    return counts
