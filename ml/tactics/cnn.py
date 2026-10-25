"""A small ResNet on the board planes (tactics/planes.py), multi-label output, trained on MPS."""

import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .dataset import THEMES
from .encode import arrays
from .fetch import DATA
from .metrics import best_thresholds, per_theme
from .planes import PLANES

MODELS = Path(__file__).resolve().parent.parent / "models"
CHANNELS = 64
BLOCKS = 6
EPOCHS = 10
BATCH = 1024
LR = 2e-3
SEED = 7


class Block(nn.Module):
    def __init__(self, c: int):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(c, c, 3, padding=1, bias=False), nn.BatchNorm2d(c), nn.ReLU(),
            nn.Conv2d(c, c, 3, padding=1, bias=False), nn.BatchNorm2d(c),
        )

    def forward(self, x):
        return torch.relu(x + self.body(x))


class TacticNet(nn.Module):
    def __init__(self, planes: int = PLANES, channels: int = CHANNELS, blocks: int = BLOCKS, themes: int = len(THEMES)):
        super().__init__()
        self.stem = nn.Sequential(nn.Conv2d(planes, channels, 3, padding=1, bias=False), nn.BatchNorm2d(channels), nn.ReLU())
        self.tower = nn.Sequential(*[Block(channels) for _ in range(blocks)])
        # Tactics are about particular squares, so the head keeps the board layout instead of pooling it away.
        self.head = nn.Sequential(
            nn.Conv2d(channels, 16, 1, bias=False), nn.BatchNorm2d(16), nn.ReLU(), nn.Flatten(),
            nn.Linear(16 * 64, 256), nn.ReLU(), nn.Dropout(0.1), nn.Linear(256, themes),
        )

    def forward(self, x):
        return self.head(self.tower(self.stem(x)))


def device() -> torch.device:
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


@torch.no_grad()
def predict(model: nn.Module, planes: np.ndarray, dev: torch.device, batch: int = 4096) -> np.ndarray:
    model.eval()
    out = []
    for i in range(0, len(planes), batch):
        x = torch.from_numpy(np.asarray(planes[i:i + batch], np.float32)).to(dev)
        out.append(torch.sigmoid(model(x)).float().cpu().numpy())
    return np.concatenate(out)


def train(epochs: int = EPOCHS) -> dict:
    torch.manual_seed(SEED)
    rng = np.random.default_rng(SEED)
    dev = device()
    x_train, y_train = arrays("train", "planes"), arrays("train", "labels").astype(np.float32)
    x_val, y_val = arrays("val", "planes"), arrays("val", "labels")
    x_test, y_test = arrays("test", "planes"), arrays("test", "labels")
    model = TacticNet().to(dev)
    steps = epochs * (len(x_train) // BATCH)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps, pct_start=0.15)
    loss_fn = nn.BCEWithLogitsLoss()
    print(f"  {sum(p.numel() for p in model.parameters()):,} parameters on {dev}")
    for epoch in range(epochs):
        model.train()
        order = rng.permutation(len(x_train))
        start, total = time.time(), 0.0
        for b in range(len(x_train) // BATCH):
            idx = np.sort(order[b * BATCH:(b + 1) * BATCH])
            x = x_train[idx].astype(np.float32)
            # A tactic mirrored left to right is the same tactic (the planes carry no castling rights).
            mirror = rng.random(len(idx)) < 0.5
            x[mirror] = x[mirror][..., ::-1]
            x = torch.from_numpy(x).to(dev)
            y = torch.from_numpy(y_train[idx]).to(dev)
            loss = loss_fn(model(x), y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            total += loss.item()
        p_val = predict(model, x_val, dev)
        val_loss = float(np.mean(-(y_val * np.log(p_val + 1e-7) + (1 - y_val) * np.log(1 - p_val + 1e-7))))
        print(f"  epoch {epoch + 1}: train {total / (b + 1):.4f}  val {val_loss:.4f}  {time.time() - start:.0f}s")
    p_val = predict(model, x_val, dev)
    p_test = predict(model, x_test, dev)
    thresholds = best_thresholds(y_val, p_val)
    MODELS.mkdir(exist_ok=True)
    torch.save({"state": model.state_dict(), "thresholds": thresholds.tolist(), "themes": THEMES,
                "channels": CHANNELS, "blocks": BLOCKS}, MODELS / "cnn.pt")
    result = {
        "parameters": sum(p.numel() for p in model.parameters()),
        "thresholds": dict(zip(THEMES, thresholds.tolist())),
        "val": per_theme(y_val, (p_val >= thresholds).astype(np.uint8)),
        "test": per_theme(y_test, (p_test >= thresholds).astype(np.uint8)),
    }
    (DATA / "results").mkdir(exist_ok=True)
    (DATA / "results" / "cnn.json").write_text(json.dumps(result, indent=1))
    np.save(DATA / "results" / "cnn-test-prob.npy", p_test)
    return result


def load(path: Path = MODELS / "cnn.pt") -> tuple[TacticNet, dict]:
    ckpt = torch.load(path, map_location="cpu")
    model = TacticNet(channels=ckpt["channels"], blocks=ckpt["blocks"], themes=len(ckpt["themes"]))
    model.load_state_dict(ckpt["state"])
    return model.eval(), ckpt
