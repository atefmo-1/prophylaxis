"""Compute handcrafted features and board planes for every split once, and cache them as .npy files. Planes are
stored bit-packed (tactics/planes.py: pack) and written in chunks, so millions of examples fit in memory."""

from multiprocessing import Pool

import chess
import numpy as np

from .dataset import load
from .features import NAMES, features
from .fetch import DATA
from .metrics import labels
from .planes import BINARY, COUNTS, encode, model_line, pack, unpack

CACHE = DATA / "encoded"
CHUNK = 100_000


def _one(ex: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    board = chess.Board(ex["fen"])
    moves = [chess.Move.from_uci(u) for u in ex["line"]]
    bits, counts = pack(encode(board, model_line(board, moves)))
    return features(board, moves[0]), bits, counts


def build(splits=("train", "val", "test")) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for split in splits:
        examples = load(split)
        n = len(examples)
        feats = np.lib.format.open_memmap(CACHE / f"{split}-features.npy", "w+", np.float32, (n, len(NAMES)))
        bits = np.lib.format.open_memmap(CACHE / f"{split}-bits.npy", "w+", np.uint8, (n, len(BINARY), 8))
        counts = np.lib.format.open_memmap(CACHE / f"{split}-counts.npy", "w+", np.uint8, (n, len(COUNTS), 64))
        with Pool() as pool:
            for start in range(0, n, CHUNK):
                rows = pool.map(_one, examples[start:start + CHUNK], chunksize=500)
                end = start + len(rows)
                feats[start:end] = np.stack([r[0] for r in rows])
                bits[start:end] = np.stack([r[1] for r in rows])
                counts[start:end] = np.stack([r[2] for r in rows])
                print(f"  {split}: {end:,} / {n:,}", flush=True)
        feats.flush(), bits.flush(), counts.flush()
        np.save(CACHE / f"{split}-labels.npy", labels(examples))


def arrays(split: str, kind: str, mmap: bool = False) -> np.ndarray:
    return np.load(CACHE / f"{split}-{kind}.npy", mmap_mode="r" if mmap else None)


class Planes:
    """A split's planes, unpacked on demand: `planes[idx]` gives float32 (len(idx), PLANES, 8, 8)."""

    def __init__(self, split: str):
        self.bits = arrays(split, "bits")
        self.counts = arrays(split, "counts")

    def __len__(self) -> int:
        return len(self.bits)

    def __getitem__(self, idx) -> np.ndarray:
        return unpack(self.bits[idx], self.counts[idx])
