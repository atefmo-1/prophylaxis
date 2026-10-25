"""Export the CNN to ONNX, quantise it to int8, re-score it, and write what the site loads:
web/public/models/tactics.onnx and tactics.json (themes, thresholds, and the themes the model is trusted for)."""

import hashlib
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quant_pre_process, quantize_static

from . import cnn
from .dataset import THEMES
from .encode import Planes, arrays
from .fetch import DATA
from .metrics import best_thresholds, per_theme
from .planes import PLANES

WEB_MODELS = Path(__file__).resolve().parents[2] / "web" / "public" / "models"
CALIBRATION = 2048


class Probabilities(torch.nn.Module):
    def __init__(self, net: torch.nn.Module):
        super().__init__()
        self.net = net

    def forward(self, planes):
        return torch.sigmoid(self.net(planes))


class Reader(CalibrationDataReader):
    def __init__(self, planes: np.ndarray, batch: int = 128):
        self.batches = iter([{"planes": np.asarray(planes[i:i + batch], np.float32)} for i in range(0, len(planes), batch)])

    def get_next(self):
        return next(self.batches, None)


def run(path: Path, planes: np.ndarray, batch: int = 4096) -> np.ndarray:
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    return np.concatenate([
        session.run(None, {"planes": np.asarray(planes[i:i + batch], np.float32)})[0] for i in range(0, len(planes), batch)
    ])


def export() -> dict:
    model, _ = cnn.load()
    work = cnn.MODELS / "onnx"
    work.mkdir(parents=True, exist_ok=True)
    fp32, prep, int8 = work / "tactics-fp32.onnx", work / "tactics-prep.onnx", work / "tactics-int8.onnx"
    torch.onnx.export(
        Probabilities(model), (torch.zeros(1, PLANES, 8, 8),), str(fp32), input_names=["planes"],
        output_names=["probabilities"], dynamic_axes={"planes": {0: "n"}, "probabilities": {0: "n"}},
        opset_version=17, dynamo=False,
    )
    quant_pre_process(str(fp32), str(prep))
    val_planes = Planes("val")
    quantize_static(
        str(prep), str(int8), Reader(val_planes[:CALIBRATION]), quant_format=QuantFormat.QDQ,
        activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True,
        # Keep the output in float: quantised, probabilities snap to steps of 1/255 and the thresholds with them.
        nodes_to_exclude=[n.name for n in onnx.load(str(prep)).graph.node if n.op_type == "Sigmoid"],
    )
    onnx.checker.check_model(str(int8))

    # Thresholds are re-chosen on validation for the quantised model, since that is what ships.
    y_val, y_test = arrays("val", "labels"), arrays("test", "labels")
    test_planes = Planes("test")
    report = {}
    for name, path in (("fp32", fp32), ("int8", int8)):
        p_val, p_test = run(path, val_planes), run(path, test_planes)
        thresholds = best_thresholds(y_val, p_val)
        report[name] = {
            "bytes": path.stat().st_size,
            "thresholds": dict(zip(THEMES, thresholds.tolist())),
            "val": per_theme(y_val, (p_val >= thresholds).astype(np.uint8)),
            "test": per_theme(y_test, (p_test >= thresholds).astype(np.uint8)),
        }
        np.save(DATA / "results" / f"onnx-{name}-test-prob.npy", p_test)

    # Trust the model for a theme only where it beats the rules on the test split.
    rules = json.loads((DATA / "results" / "rules-test.json").read_text())["python"]
    shipped = report["int8"]
    trusted = [t for t in THEMES if shipped["test"][t]["f1"] > rules[t]["f1"]]
    WEB_MODELS.mkdir(parents=True, exist_ok=True)
    (WEB_MODELS / "tactics.onnx").write_bytes(int8.read_bytes())
    (WEB_MODELS / "tactics.json").write_text(json.dumps({
        "version": hashlib.sha256(int8.read_bytes()).hexdigest()[:12],
        "planes": PLANES,
        "themes": THEMES,
        "thresholds": [round(shipped["thresholds"][t], 2) for t in THEMES],
        "trusted": trusted,
    }, indent=1) + "\n")
    report["trusted"] = trusted
    (DATA / "results" / "onnx.json").write_text(json.dumps(report, indent=1))
    return report
