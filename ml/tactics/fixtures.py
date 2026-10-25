"""Fixtures for checking that the TypeScript plane encoder matches the Python one (tests/test_planes.py)."""

import json
import random
from pathlib import Path

import chess

from .dataset import load
from .planes import encode

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "planes.json"
MODEL = Path(__file__).resolve().parents[2] / "web" / "public" / "models" / "tactics.onnx"
# Moves the puzzles rarely cover: castling both ways and both colours, en passant, promotions.
SPECIAL = [
    ("r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 8", "e1g1"),
    ("r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 8", "e1c1"),
    ("r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R4RK1 b kq - 1 8", "e8g8"),
    ("r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R4RK1 b kq - 1 8", "e8c8"),
    ("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", "e5f6"),
    ("rnbqkbnr/pppp1ppp/8/8/3PpP2/8/PPP1P1PP/RNBQKBNR b KQkq f3 0 3", "e4f3"),
    ("1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7b8q"),
    ("1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8n"),
    ("4k3/8/8/8/8/8/p7/1R2K3 b - - 0 1", "a2b1r"),
    ("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "d1d8"),
]


def build(n: int = 50, seed: int = 7) -> Path:
    examples = random.Random(seed).sample(load("test"), n)
    cases = list(SPECIAL)
    for ex in examples:
        cases.append((ex["fen"], ex["line"][0]))
        cases.append((ex["fen_before"], ex["blunder"]))
    out = []
    for fen, uci in cases:
        planes = encode(chess.Board(fen), chess.Move.from_uci(uci)).reshape(-1)
        out.append({"fen": fen, "uci": uci, "nonzero": [[int(i), float(planes[i])] for i in planes.nonzero()[0]]})
    # What the shipped model says about each, so the browser runtime can be checked against this one.
    if MODEL.exists():
        import numpy as np
        import onnxruntime as ort

        session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
        x = np.stack([encode(chess.Board(fen), chess.Move.from_uci(uci)) for fen, uci in cases])
        for case, p in zip(out, session.run(None, {"planes": x})[0]):
            case["probabilities"] = [round(float(v), 5) for v in p]
    FIXTURES.parent.mkdir(parents=True, exist_ok=True)
    FIXTURES.write_text(json.dumps(out, separators=(",", ":")))
    return FIXTURES
