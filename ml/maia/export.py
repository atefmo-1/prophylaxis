# SPDX-License-Identifier: AGPL-3.0
# Uses the Maia-3 model code (CSSLab/maia3, AGPL-3.0) and weights; see LICENSES/AGPL-3.0.txt and ml/results/maia.md.
"""Export Maia-3 5M for the site: the authors' official checkpoint, run by their own model code, to ONNX.

Input `tokens` float32 [batch, 64, 96]: the current position and the 7 before it, oldest first, 12 one-hot channels
each (see web/src/analysis/maia.ts), plus `elo_self` and `elo_oppo` float32 [batch] (Maia ratings). Output
`logits_move` float32 [batch, 4352] over Maia-3's move list.

Three files are made and compared with PyTorch: fp32 (21 MB, exact), dynamic int8 (6.5 MB, int8 arithmetic) and w8
(5.8 MB: int8 weights, fp32 arithmetic; see weight_only). The site ships w8: it is closer to PyTorch than dynamic
int8, and gives the same numbers in the browser's runtime, where dynamic int8's kernels drift further (results/maia.md).

    python -m maia.export             # from ml/: make all three in data/maia3 and compare them with PyTorch
    python -m maia.export ship w8     # copy one into the site: web/public/models/maia3.onnx and maia3.json
    python -m maia.export fixtures    # tests/fixtures/maia.json, for web/scripts/check-maia.ts
"""

import datetime
import hashlib
import json
from pathlib import Path

import chess
import numpy as np
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quant_pre_process, quantize_dynamic

from .predict import CHECKPOINT, INDEX, ML, _tokens, load, mirror_move

WEB = ML.parent / "web" / "public" / "models"
WORK = ML / "data" / "maia3"
CHESSCOM_TO_MAIA = [(300, 700), (500, 1000), (700, 1100), (900, 1300), (1100, 1500)]  # results/maia.md


class RMSNorm(torch.nn.Module):
    """torch.nn.RMSNorm written out, since opset 17 has no RMS norm operator. Same weights, same result."""

    def __init__(self, norm: torch.nn.RMSNorm):
        super().__init__()
        self.weight = norm.weight
        self.eps = norm.eps if norm.eps is not None else torch.finfo(torch.float32).eps

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight


def _plain_norms(module: torch.nn.Module) -> None:
    for name, child in module.named_children():
        if isinstance(child, torch.nn.RMSNorm):
            setattr(module, name, RMSNorm(child))
        else:
            _plain_norms(child)


class Wrapped(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, tokens, elo_self, elo_oppo):
        # The model reads 12 * history columns and ignores a trailing clock column; pad one on.
        padded = torch.cat([tokens, torch.zeros_like(tokens[:, :, :1])], dim=-1)
        logits, _value, _ponder = self.model(padded, elo_self.long(), elo_oppo.long())
        return logits


def _samples(n: int = 2000) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[chess.Board]]:
    """Real positions with their history, from the chess.com games the study used."""
    rows = [json.loads(line) for line in (ML / "data" / "maia" / "engine.jsonl").open()]
    rng = np.random.default_rng(3)
    tokens, elos, boards = [], [], []
    for g in rng.permutation(len(rows))[:200]:
        fens = [r["fen"] for r in rows[g]["rows"]]
        for ply in rng.choice(len(fens) - 1, size=min(10, len(fens) - 1), replace=False):
            board = chess.Board(fens[ply])
            if board.is_game_over():
                continue
            before = [chess.Board(f) for f in fens[max(0, ply - 7) : ply]]
            tokens.append(_tokens(board, before)[:, :96].numpy())
            elos.append(rng.choice([700, 1000, 1100, 1300, 1500]))
            boards.append(board)
            if len(tokens) >= n:
                break
        if len(tokens) >= n:
            break
    e = np.array(elos, dtype=np.float32)
    return np.stack(tokens).astype(np.float32), e, e.copy(), boards


def _legal_probs(logits: np.ndarray, boards: list[chess.Board]) -> list[np.ndarray]:
    out = []
    for row, b in zip(logits, boards):
        idx = [INDEX[mirror_move(m.uci()) if b.turn == chess.BLACK else m.uci()] for m in b.legal_moves]
        x = row[idx].astype(np.float64)
        p = np.exp(x - x.max())
        out.append(p / p.sum())
    return out


def compare(path: Path, tokens, es, eo, boards, want: list[np.ndarray]) -> dict:
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    got = _legal_probs(sess.run(["logits_move"], {"tokens": tokens, "elo_self": es, "elo_oppo": eo})[0], boards)
    diffs = np.concatenate([np.abs(a - b) for a, b in zip(got, want)])
    top = np.mean([a.argmax() == b.argmax() for a, b in zip(got, want)])
    return {"max_diff": float(diffs.max()), "mean_diff": float(diffs.mean()), "top1_agree": float(top),
            "size_mb": round(path.stat().st_size / 1e6, 2)}


def weight_only(src: Path, dst: Path) -> None:
    """Int8 weights with fp32 arithmetic: each large weight is stored as int8 with one scale per output channel and
    turned back into fp32 by a DequantizeLinear node when the model loads. A quarter of the download, and unlike
    dynamic quantization it gives the same numbers in the browser's runtime as in Python's."""
    import onnx
    from onnx import helper, numpy_helper

    model = onnx.load(str(src))
    users: dict[str, list] = {}
    for node in model.graph.node:
        for x in node.input:
            users.setdefault(x, []).append(node)
    keep, added = [], []
    for init in model.graph.initializer:
        w = numpy_helper.to_array(init)
        node = users.get(init.name, [None])[0]
        if w.dtype != np.float32 or w.ndim != 2 or w.size < 4096 or node is None:
            keep.append(init)
            continue
        trans_b = node.op_type == "Gemm" and any(a.name == "transB" and a.i for a in node.attribute)
        axis = 0 if trans_b else 1  # the output channel: MatMul's and Einsum's weights are [in, out]
        scale = np.maximum(np.abs(w).max(axis=1 - axis), 1e-12) / 127
        q = np.clip(np.round(w / (scale[None, :] if axis == 1 else scale[:, None])), -127, 127).astype(np.int8)
        keep += [numpy_helper.from_array(q, f"{init.name}_q"), numpy_helper.from_array(scale.astype(np.float32), f"{init.name}_s"),
                 numpy_helper.from_array(np.zeros_like(scale, dtype=np.int8), f"{init.name}_z")]
        added.append(helper.make_node("DequantizeLinear", [f"{init.name}_q", f"{init.name}_s", f"{init.name}_z"], [init.name],
                                      axis=axis, name=f"{init.name}_dq"))
    del model.graph.initializer[:]
    model.graph.initializer.extend(keep)
    nodes = list(model.graph.node)
    del model.graph.node[:]
    model.graph.node.extend(added + nodes)
    onnx.checker.check_model(model)
    onnx.save(model, str(dst))


def export() -> dict:
    model, _ = load()
    wrapped = Wrapped(model).eval()
    tokens, es, eo, boards = _samples()
    with torch.no_grad():
        want = _legal_probs(wrapped(torch.from_numpy(tokens), torch.from_numpy(es), torch.from_numpy(eo)).numpy(), boards)
    _plain_norms(wrapped)
    with torch.no_grad():
        plain = _legal_probs(wrapped(torch.from_numpy(tokens), torch.from_numpy(es), torch.from_numpy(eo)).numpy(), boards)
    assert max(float(np.abs(a - b).max()) for a, b in zip(plain, want)) < 1e-5, "the written-out norm changed results"
    with torch.no_grad():
        _ = _legal_probs(wrapped(torch.from_numpy(tokens), torch.from_numpy(es), torch.from_numpy(eo)).numpy(), boards)
    fp32 = WORK / "maia3-5m.fp32.onnx"
    torch.onnx.export(
        wrapped, (torch.from_numpy(tokens[:2]), torch.from_numpy(es[:2]), torch.from_numpy(eo[:2])), str(fp32),
        input_names=["tokens", "elo_self", "elo_oppo"], output_names=["logits_move"],
        dynamic_axes={"tokens": {0: "batch"}, "elo_self": {0: "batch"}, "elo_oppo": {0: "batch"}, "logits_move": {0: "batch"}},
        opset_version=17, dynamo=False,
    )
    pre = WORK / "maia3-5m.pre.onnx"
    quant_pre_process(str(fp32), str(pre), skip_symbolic_shape=True)
    int8 = WORK / "maia3-5m.int8.onnx"
    quantize_dynamic(str(pre), str(int8), weight_type=QuantType.QInt8)
    w8 = WORK / "maia3-5m.w8.onnx"
    weight_only(fp32, w8)
    report = {name: compare(path, tokens, es, eo, boards, want) for name, path in [("fp32", fp32), ("int8", int8), ("w8", w8)]}
    print(json.dumps(report, indent=1))
    return report


def fixtures(n: int = 80) -> None:
    """Positions with history, the authors' encoding of them, Maia's move list for their legal moves, and their
    model's chances (PyTorch), for web/scripts/check-maia.ts. Positions come from seeded random games, not from players."""

    load()
    rng = np.random.default_rng(7)
    out = []
    while len(out) < n:
        board, fens = chess.Board(), []
        for _ in range(int(rng.integers(4, 140))):
            moves = list(board.legal_moves)
            if not moves:
                break
            # Prefer promotions and castling now and then, so the fixtures cover them.
            special = [m for m in moves if m.promotion or board.is_castling(m) or board.is_en_passant(m)]
            fens.append(board.fen())
            board.push(special[0] if special and rng.random() < 0.5 else moves[int(rng.integers(len(moves)))])
        if board.is_game_over():
            continue
        before = [chess.Board(f) for f in fens][-7:]
        tokens = _tokens(board, before)[:, :96].numpy().astype(np.float32)
        legal = {m.uci(): INDEX[mirror_move(m.uci()) if board.turn == chess.BLACK else m.uci()] for m in board.legal_moves}
        elo = [int(rng.choice([700, 1000, 1100, 1300, 1500, 1900])), int(rng.choice([700, 1100, 1500]))]
        out.append({"fens": [*fens[-7:], board.fen()], "self": elo[0], "oppo": elo[1],
                    "nonzero": np.flatnonzero(tokens).tolist(), "legal": legal, "tokens": tokens})
    # Promotions (both colours, with captures) and en passant, which random games rarely reach.
    for fen in ["1n5k/P7/8/8/8/8/6K1/8 w - - 0 1", "8/6k1/8/8/8/8/p7/1N5K b - - 0 1",
                "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", "4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 2"]:
        board = chess.Board(fen)
        tokens = _tokens(board)[:, :96].numpy().astype(np.float32)
        legal = {m.uci(): INDEX[mirror_move(m.uci()) if board.turn == chess.BLACK else m.uci()] for m in board.legal_moves}
        out.append({"fens": [fen], "self": 1100, "oppo": 1100, "nonzero": np.flatnonzero(tokens).tolist(), "legal": legal,
                    "tokens": tokens})
    # The truth is the authors' model in PyTorch, not any exported file.
    wrapped = Wrapped(load()[0]).eval()
    with torch.no_grad():
        logits = wrapped(torch.from_numpy(np.stack([f.pop("tokens") for f in out])),
                         torch.tensor([f["self"] for f in out], dtype=torch.float32),
                         torch.tensor([f["oppo"] for f in out], dtype=torch.float32)).numpy()
    for f, row in zip(out, logits):
        ucis = list(f["legal"])
        x = row[[f["legal"][u] for u in ucis]].astype(np.float64)
        p = np.exp(x - x.max())
        f["probs"] = {u: round(float(v), 6) for u, v in zip(ucis, p / p.sum())}
    path = ML.parent / "tests" / "fixtures" / "maia.json"
    path.write_text(json.dumps(out) + "\n")
    promos = sum(any(len(u) == 5 for u in f["legal"]) for f in out)
    castles = sum(any(u in ("e1g1", "e1c1", "e8g8", "e8c8") for u in f["legal"]) for f in out)
    black = sum(" b " in f["fens"][-1] for f in out)
    print(f"{len(out)} positions ({black} Black to move, {promos} with promotions, {castles} with castling) -> {path}")


def ship(name: str) -> None:
    """Copy the chosen file into the site, with the settings the site reads."""
    src = WORK / f"maia3-5m.{name}.onnx"
    data = src.read_bytes()
    WEB.mkdir(parents=True, exist_ok=True)
    (WEB / "maia3.onnx").write_bytes(data)
    meta = {
        "version": hashlib.sha256(data).hexdigest()[:12],
        "model": "Maia-3 5M (CSSLab, University of Toronto), exported from huggingface.co/UofTCSSLab/Maia3-5M",
        "checkpoint_sha256": hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest(),
        "license": "AGPL-3.0 (models/maia3-LICENSE.txt)",
        "source": "https://github.com/atefmo-1/prophylaxis: ml/maia/export.py rebuilds this file from the checkpoint",
        "paper": "Monroe, Eilender, Chalmers, Tang and Anderson. Chessformer: A Unified Architecture for Chess Modeling. "
                 "ICLR 2026. https://openreview.net/forum?id=2ltBRzEHyd",
        "exported": datetime.date.today().isoformat(),
        "history": 8,
        "moves": 4352,
        "chesscom_to_maia": CHESSCOM_TO_MAIA,
    }
    (WEB / "maia3.json").write_text(json.dumps(meta, indent=1) + "\n")
    (WEB / "maia3-LICENSE.txt").write_text((ML.parent / "LICENSES" / "AGPL-3.0.txt").read_text())
    print(f"wrote {len(data) / 1e6:.1f} MB, version {meta['version']}")


if __name__ == "__main__":
    import sys

    if sys.argv[1:2] == ["ship"]:
        ship(sys.argv[2])
    elif sys.argv[1:2] == ["fixtures"]:
        fixtures()
    else:
        export()
