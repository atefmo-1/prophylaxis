"""Compute handcrafted features and board planes for every split once, and cache them as .npy files."""

from multiprocessing import Pool

import chess
import numpy as np

from .dataset import load
from .features import features
from .fetch import DATA
from .metrics import labels
from .planes import encode

CACHE = DATA / "encoded"


def _one(ex: dict) -> tuple[np.ndarray, np.ndarray]:
    board = chess.Board(ex["fen"])
    move = chess.Move.from_uci(ex["line"][0])
    return features(board, move), encode(board, move).astype(np.uint8)


def build(splits=("train", "val", "test")) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for split in splits:
        examples = load(split)
        with Pool() as pool:
            rows = pool.map(_one, examples, chunksize=1000)
        np.save(CACHE / f"{split}-features.npy", np.stack([r[0] for r in rows]))
        np.save(CACHE / f"{split}-planes.npy", np.stack([r[1] for r in rows]))
        np.save(CACHE / f"{split}-labels.npy", labels(examples))
        print(f"{split}: {len(examples)} examples")


def arrays(split: str, kind: str, mmap: bool = False) -> np.ndarray:
    return np.load(CACHE / f"{split}-{kind}.npy", mmap_mode="r" if mmap else None)
