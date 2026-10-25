"""Per-theme precision, recall and F1 for multi-label predictions."""

import numpy as np

from .dataset import THEMES


def labels(examples: list[dict], themes: list[str] = THEMES) -> np.ndarray:
    index = {t: i for i, t in enumerate(themes)}
    y = np.zeros((len(examples), len(themes)), np.uint8)
    for row, ex in enumerate(examples):
        for t in ex["themes"]:
            y[row, index[t]] = 1
    return y


def from_sets(predicted: list[set[str]], themes: list[str] = THEMES) -> np.ndarray:
    return labels([{"themes": [t for t in p if t in themes]} for p in predicted], themes)


def per_theme(y: np.ndarray, pred: np.ndarray, themes: list[str] = THEMES) -> dict[str, dict]:
    out = {}
    for i, theme in enumerate(themes):
        tp = int((y[:, i] & pred[:, i]).sum())
        fp = int(((1 - y[:, i]) & pred[:, i]).sum())
        fn = int((y[:, i] & (1 - pred[:, i])).sum())
        p = tp / (tp + fp) if tp + fp else 0.0
        r = tp / (tp + fn) if tp + fn else 0.0
        out[theme] = {"precision": p, "recall": r, "f1": 2 * p * r / (p + r) if p + r else 0.0, "support": tp + fn,
                      "predicted": tp + fp}
    return out


def best_thresholds(y: np.ndarray, prob: np.ndarray) -> np.ndarray:
    """The threshold per theme that maximises F1 (chosen on validation, applied to test)."""
    grid = np.linspace(0.05, 0.95, 91)
    out = np.empty(y.shape[1], np.float32)
    for i in range(y.shape[1]):
        scores = []
        for t in grid:
            pred = prob[:, i] >= t
            tp = (pred & (y[:, i] == 1)).sum()
            denom = pred.sum() + y[:, i].sum()
            scores.append(2 * tp / denom if denom else 0.0)
        out[i] = grid[int(np.argmax(scores))]
    return out
