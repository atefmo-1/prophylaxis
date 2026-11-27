# SPDX-License-Identifier: AGPL-3.0
# Runs the Maia-3 model code (CSSLab/maia3, AGPL-3.0); see LICENSES/AGPL-3.0.txt.
"""Maia-3 (5M) move probabilities for many positions at once, through the authors' own code.

The checkpoint and the code (CSSLab/maia3, AGPL-3.0) live in data/maia3, which git ignores; nothing from them is
copied here. Positions are scored one at a time with no move history, as the authors' engine does by default.
"""

import sys
from argparse import Namespace
from pathlib import Path

import chess
import torch

ML = Path(__file__).resolve().parent.parent
SRC = ML / "data" / "maia3" / "src"
CHECKPOINT = ML / "data" / "maia3" / "maia3-5m.pt"
sys.path.insert(0, str(SRC))

from maia3.dataset import get_historical_tokens, get_legal_moves_mask, tokenize_board
from maia3.model_registry import resolve_model_spec
from maia3.models import MAIA3Model
from maia3.utils import get_all_possible_moves, mirror_move

MOVES = get_all_possible_moves()
INDEX = {m: i for i, m in enumerate(MOVES)}
_model = None
_cfg = None


def load():
    global _model, _cfg
    if _model is None:
        spec = resolve_model_spec("maia3-5m")
        _cfg = Namespace(**spec.config, device="cpu", use_amp=False)
        _model = MAIA3Model(_cfg)
        state = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
        state = state.get("model_state_dict", state)
        missing, unexpected = _model.load_state_dict({k.replace("smolgen", "gab"): v for k, v in state.items()}, strict=False)
        assert not missing and not unexpected, (missing[:3], unexpected[:3])
        _model.eval()
        torch.set_num_threads(max(1, (torch.get_num_threads())))
    return _model, _cfg


def _tokens(board: chess.Board, before: list[chess.Board] | None = None) -> torch.Tensor:
    """The current board, after up to history-1 earlier positions (oldest first) when given."""
    boards = [*(before or [])][-(_cfg.history - 1) :] + [board]
    return get_historical_tokens([tokenize_board(b) for b in boards], _cfg, base=0.0, inc=0.0, clk_left_before=0.0, clk_ponder=0.0)


@torch.no_grad()
def policies(
    boards: list[chess.Board],
    self_elo: list[int],
    oppo_elo: list[int],
    batch: int = 256,
    history: list[list[chess.Board]] | None = None,
) -> list[dict[str, float]]:
    """For each position, the chance of each legal move (UCI, real orientation) for a player of `self_elo`.
    `history`: for each position, the positions before it in the game (oldest first)."""
    model, _ = load()
    out: list[dict[str, float]] = []
    for start in range(0, len(boards), batch):
        part = boards[start : start + batch]
        hist = history[start : start + batch] if history else [None] * len(part)
        tokens = torch.stack([_tokens(b, h) for b, h in zip(part, hist)])
        mask = torch.stack([get_legal_moves_mask(b, INDEX) for b in part])
        se = torch.tensor(self_elo[start : start + batch], dtype=torch.long)
        oe = torch.tensor(oppo_elo[start : start + batch], dtype=torch.long)
        logits, _value, _ = model(tokens, se, oe)
        probs = torch.softmax(logits.float().masked_fill(~mask, float("-inf")), dim=-1)
        for b, p in zip(part, probs):
            legal = {}
            for move in b.legal_moves:
                uci = move.uci()
                key = mirror_move(uci) if b.turn == chess.BLACK else uci
                legal[uci] = float(p[INDEX[key]])
            out.append(legal)
    return out
