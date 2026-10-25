"""LightGBM on the handcrafted features: one binary model per theme."""

import json
import os
import sys
from pathlib import Path

import numpy as np

from .dataset import THEMES
from .encode import arrays
from .features import NAMES
from .fetch import DATA
from .metrics import best_thresholds, per_theme

MODELS = Path(__file__).resolve().parent.parent / "models"
PARAMS = {
    "objective": "binary", "learning_rate": 0.08, "num_leaves": 63, "min_data_in_leaf": 40,
    "feature_fraction": 0.8, "bagging_fraction": 0.8, "bagging_freq": 1, "lambda_l2": 1.0,
    "verbose": -1, "seed": 7, "num_threads": os.cpu_count(),
}
ROUNDS = 1500


def lightgbm():
    """LightGBM's macOS wheel links against Homebrew's OpenMP. Without it, re-run this process with the copy
    scikit-learn ships (DYLD_LIBRARY_PATH is read only at process start)."""
    try:
        import lightgbm

        return lightgbm
    except OSError:
        if sys.platform != "darwin" or os.environ.get("TACTICS_OPENMP"):
            raise
        import sklearn

        os.environ["DYLD_LIBRARY_PATH"] = str(Path(sklearn.__file__).parent / ".dylibs")
        os.environ["TACTICS_OPENMP"] = "1"
        os.execv(sys.executable, sys.orig_argv)


def train() -> dict:
    lgb = lightgbm()
    x_train, y_train = arrays("train", "features"), arrays("train", "labels")
    x_val, y_val = arrays("val", "features"), arrays("val", "labels")
    x_test, y_test = arrays("test", "features"), arrays("test", "labels")
    out = MODELS / "lgbm"
    out.mkdir(parents=True, exist_ok=True)
    p_val = np.zeros(y_val.shape, np.float32)
    p_test = np.zeros(y_test.shape, np.float32)
    importance = {}
    for i, theme in enumerate(THEMES):
        train_set = lgb.Dataset(x_train, y_train[:, i], feature_name=NAMES, free_raw_data=False)
        val_set = lgb.Dataset(x_val, y_val[:, i], reference=train_set)
        booster = lgb.train(PARAMS, train_set, ROUNDS, valid_sets=[val_set],
                            callbacks=[lgb.early_stopping(50, verbose=False)])
        booster.save_model(str(out / f"{theme}.txt"))
        p_val[:, i] = booster.predict(x_val, num_iteration=booster.best_iteration)
        p_test[:, i] = booster.predict(x_test, num_iteration=booster.best_iteration)
        gain = booster.feature_importance("gain")
        importance[theme] = [NAMES[j] for j in np.argsort(-gain)[:5]]
        print(f"  {theme}: {booster.best_iteration} trees")
    thresholds = best_thresholds(y_val, p_val)
    result = {
        "thresholds": dict(zip(THEMES, thresholds.tolist())),
        "val": per_theme(y_val, (p_val >= thresholds).astype(np.uint8)),
        "test": per_theme(y_test, (p_test >= thresholds).astype(np.uint8)),
        "top_features": importance,
    }
    (DATA / "results").mkdir(exist_ok=True)
    (DATA / "results" / "lgbm.json").write_text(json.dumps(result, indent=1))
    np.save(DATA / "results" / "lgbm-test-prob.npy", p_test)
    return result
