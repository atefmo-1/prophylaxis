"""The plane encoder, and its TypeScript port, on fixed positions."""

import json
import shutil
import subprocess
from pathlib import Path

import chess
import numpy as np
import pytest

from tactics.fixtures import FIXTURES
from tactics.planes import PLANES, encode

WEB = Path(__file__).resolve().parents[2] / "web"


def test_black_to_move_is_seen_from_its_own_side():
    # 1. e4 e5 and the mirrored position with black to move encode the same way.
    white = encode(chess.Board("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"), chess.Move.from_uci("g1f3"))
    black = encode(chess.Board("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2"), chess.Move.from_uci("g8f6"))
    assert white.shape == (PLANES, 8, 8)
    assert np.array_equal(white, black)


def test_move_and_check_planes():
    planes = encode(chess.Board("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"), chess.Move.from_uci("d1d8"))
    assert planes[24, 0, 3] == 1 and planes[24].sum() == 1  # from d1
    assert planes[25, 7, 3] == 1 and planes[25].sum() == 1  # to d8
    assert planes[30].all() and planes[31].all()            # check, and mate


def test_fixtures_are_current():
    for case in json.loads(FIXTURES.read_text()):
        planes = encode(chess.Board(case["fen"]), chess.Move.from_uci(case["uci"])).reshape(-1)
        assert [[int(i), float(planes[i])] for i in planes.nonzero()[0]] == case["nonzero"], case["fen"]


@pytest.mark.skipif(not shutil.which("node") or not (WEB / "node_modules").exists(), reason="needs node and web/node_modules")
def test_typescript_port_matches():
    run = subprocess.run(["node", "scripts/check-planes.ts", str(FIXTURES)], cwd=WEB, capture_output=True, text=True, check=False)
    assert run.returncode == 0, run.stderr


@pytest.mark.skipif(not shutil.which("node") or not (WEB / "node_modules").exists(), reason="needs node and web/node_modules")
def test_browser_runtime_matches():
    if not any("probabilities" in case for case in json.loads(FIXTURES.read_text())):
        pytest.skip("fixtures were written before the model was exported")
    run = subprocess.run(["node", "scripts/check-tactics.ts", str(FIXTURES)], cwd=WEB, capture_output=True, text=True, check=False)
    assert run.returncode == 0, run.stdout + run.stderr
