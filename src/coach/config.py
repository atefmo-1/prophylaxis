"""Paths and settings. Every value can be overridden with an environment variable."""

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("COACH_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "chess.db"
EXPORT_DIR = Path(os.environ.get("COACH_EXPORT_DIR", DATA_DIR / "export"))
# Lichess's openings list (CC0), shared with the site, which serves it from the same file.
OPENINGS_TSV = ROOT / "web" / "public" / "openings" / "lichess.tsv"

USERNAME = os.environ.get("COACH_USERNAME", "")
USER_AGENT = "prophylaxis/0.1 (personal game-analysis tool)"

ENGINE_NODES = int(os.environ.get("COACH_ENGINE_NODES", "1000000"))
ENGINE_WORKERS = int(os.environ.get("COACH_ENGINE_WORKERS") or max(1, (os.cpu_count() or 2) - 1))
ENGINE_MULTIPV = 2

# Bump when move grading or tactic detection changes; `coach analyze` then re-grades
# every game from the engine cache without re-running Stockfish.
ANALYSIS_VERSION = 5  # 4: a back-rank mate needs the king boxed in; 5: Brilliant and Book


def stockfish_path() -> str:
    path = os.environ.get("STOCKFISH_PATH") or shutil.which("stockfish")
    if path:
        return path
    fallback = Path.home() / ".local" / "bin" / "stockfish"
    if fallback.exists():
        return str(fallback)
    raise FileNotFoundError("Stockfish not found. Install it or set STOCKFISH_PATH.")
