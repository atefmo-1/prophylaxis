"""Fixtures for checking that the TypeScript plane encoder matches the Python one (tests/test_planes.py)."""

import json
import random
from pathlib import Path

import chess

from .dataset import load
from .planes import encode, model_line

FIXTURES = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "planes.json"
MODEL = Path(__file__).resolve().parents[2] / "web" / "public" / "models" / "tactics.onnx"
# Moves the puzzles rarely cover: castling both ways and both colours, en passant, promotions; and lines that end
# in mate, in a won piece, or not at all.
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
    ("2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1", "d5e7 g8f7 e7c8 f7e8"),
    ("4k3/8/8/4n3/8/8/8/4R1K1 w - - 0 1", "e1e5 e8d7 e5e4"),
    ("4k3/8/3p4/4n3/8/8/8/4R1K1 w - - 0 1", "e1e5 d6e5 g1f2"),
    ("6k1/p4ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1", "b1b8"),
]


def build(n: int = 50, seed: int = 7) -> Path:
    examples = random.Random(seed).sample(load("test"), n)
    cases = [(fen, ucis.split()) for fen, ucis in SPECIAL]
    for ex in examples:
        cases.append((ex["fen"], ex["line"]))
        cases.append((ex["fen_before"], [ex["blunder"], *ex["line"]]))
    out, stack = [], []
    for fen, ucis in cases:
        board = chess.Board(fen)
        planes = encode(board, model_line(board, [chess.Move.from_uci(u) for u in ucis]))
        stack.append(planes)
        flat = planes.reshape(-1)
        out.append({"fen": fen, "line": ucis, "nonzero": [[int(i), float(flat[i])] for i in flat.nonzero()[0]]})
    # What the shipped model says about each, so the browser runtime can be checked against this one.
    if MODEL.exists():
        import numpy as np
        import onnxruntime as ort

        session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
        if session.get_inputs()[0].shape[1] == stack[0].shape[0]:
            for case, p in zip(out, session.run(None, {"planes": np.stack(stack)})[0]):
                case["probabilities"] = [round(float(v), 5) for v in p]
    FIXTURES.parent.mkdir(parents=True, exist_ok=True)
    FIXTURES.write_text(json.dumps(out, separators=(",", ":")))
    return FIXTURES
